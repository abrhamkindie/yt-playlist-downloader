const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const { PORT, CLIENT_ORIGINS, IS_HOSTED, IS_ELECTRON } = require('./lib/config');
const { ALL_FORMATS, QUALITIES, MAX_PLAYLIST_VIDEOS } = require('./lib/constants');
const { HttpError } = require('./lib/errors');
const { scrapePlaylist } = require('./services/scraper');
const { downloadVideo } = require('./services/downloader');
const downloadManager = require('./services/downloadManager');
const { removeDir } = require('./lib/files');
const { parseYouTubeUrl } = require('./lib/urls');
const settingsStore = require('./lib/settings');
const ytdlpUpdater = require('./services/ytdlpUpdater');
const appUpdater = require('./services/appUpdater');
const {
  HOSTED_DOWNLOAD_ROOT,
  resolveDownloadDir,
  validateLocalDownloadPath,
} = require('./lib/config');

const app = express();
const server = http.createServer(app);
/** Port actually bound — may differ from PORT when the default is busy. */
let boundPort = PORT;
const io = socketIo(server, {
  cors: {
    origin: CLIENT_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false })); // CSP off: client is served from same origin with Vite assets
// A cookies.txt paste is far larger than a typical JSON body. This route gets
// its own limit; body-parser marks the request parsed, so the global 100kb
// parser below skips it instead of answering 413.
app.use('/api/cookies', express.json({ limit: '2mb' }));
app.use(express.json({ limit: '100kb' }));

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API routes are registered on a router so the JSON 404 + error handler
// can be scoped correctly.
const api = express.Router();

// Basic abuse protection on the API surface
api.use(
  '/analyze',
  rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false }),
);
api.use(
  '/download',
  rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }),
);

// ---------------------------------------------------------------
// Analyze
// ---------------------------------------------------------------
api.post('/analyze', async (req, res, next) => {
  try {
    const { url } = req.body || {};
    // Friendly 400 before yt-dlp is ever spawned (non-URLs, non-YouTube links).
    const target = parseYouTubeUrl(url);

    const videos = await scrapePlaylist(target);
    if (!videos || videos.length === 0) {
      throw new HttpError(404, 'No videos found');
    }
    if (videos.length > MAX_PLAYLIST_VIDEOS) {
      throw new HttpError(400, `Playlist too large (${videos.length} videos). Max is ${MAX_PLAYLIST_VIDEOS}.`);
    }

    res.json({ videos, message: 'Playlist analyzed successfully' });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------
// Download
// ---------------------------------------------------------------
api.post('/download', async (req, res, next) => {
  try {
    let { url, format, quality, title, id, downloadPath, createSubfolder, playlistTitle } = req.body || {};

    // Normalizes relative /watch?v=… paths and rejects non-YouTube URLs.
    url = parseYouTubeUrl(url);

    format = format || 'mp4';
    quality = quality || 'best';
    if (!ALL_FORMATS.includes(format)) throw new HttpError(400, `Invalid format: ${format}`);
    if (!QUALITIES.includes(quality)) throw new HttpError(400, `Invalid quality: ${quality}`);

    // Skip re-scraping when the client already has metadata.
    let videos;
    if (title && id) {
      videos = [{
        id,
        url,
        title,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      }];
    } else {
      videos = await scrapePlaylist(url);
    }
    if (!videos || videos.length === 0) {
      throw new HttpError(404, 'No videos found');
    }

    // Resolve + validate the destination directory.
    let outputDir;
    try {
      outputDir = resolveDownloadDir({ downloadPath, playlistTitle, createSubfolder: createSubfolder !== false });
    } catch (err) {
      throw new HttpError(400, err.message);
    }
    fs.mkdirSync(outputDir, { recursive: true });

    let queued = 0;
    for (const video of videos) {
      const task = {
        id: video.id,
        url: video.url,
        title: video.title,
        start: () =>
          downloadVideo({
            url: video.url,
            title: video.title,
            outputDir,
            format,
            quality,
            videoId: video.id,
            io,
            onComplete: (filePath) => downloadManager.handleComplete(video.id, { filePath }),
            onError: (err) => {
              // Late events after cancellation are ignored by the manager.
              downloadManager.handleError(video.id, err);
            },
          }),
      };
      if (downloadManager.addToQueue(task)) queued += 1;
    }

    if (queued === 0) {
      const existing = downloadManager.getResult(videos[0].id);
      throw new HttpError(409, existing ? 'Already downloaded or in progress' : 'Nothing queued');
    }

    const response = { videos, message: 'Downloads queued', queued };
    if (videos.length === 1) response.downloadId = videos[0].id;
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------
// Status / cancel
// ---------------------------------------------------------------
api.get('/status', (_req, res) => {
  res.json({
    queue: downloadManager.getSnapshot(),
    downloads: downloadManager.getAllResults(),
    hosted: IS_HOSTED,
  });
});

api.get('/status/:id', (req, res) => {
  const record = downloadManager.getResult(req.params.id);
  if (!record) return res.status(404).json({ error: 'Download not found' });
  res.json(record);
});

api.post('/cancel/:id', (req, res) => {
  const { id } = req.params;
  if (!id) throw new HttpError(400, 'Download ID required');
  if (downloadManager.cancelDownload(id)) {
    return res.json({ message: 'Download cancelled' });
  }
  res.status(404).json({ error: 'Download not found' });
});

api.post('/cancel-all', (_req, res) => {
  downloadManager.stopAll();
  res.json({ message: 'All downloads cancelled' });
});

// ---------------------------------------------------------------
// Hosted mode: stream finished files back to the browser
// ---------------------------------------------------------------
if (IS_HOSTED) {
  const { getResult } = downloadManager;
  api.get('/files/:id', (req, res) => {
    const record = getResult(req.params.id);
    if (!record || record.status !== 'complete' || !record.filePath) {
      return res.status(404).json({ error: 'File not available' });
    }
    // Only serve files inside the hosted download root (defense in depth).
    const resolved = path.resolve(record.filePath);
    if (!resolved.startsWith(path.resolve(HOSTED_DOWNLOAD_ROOT))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!fs.existsSync(resolved)) {
      return res.status(410,).json({ error: 'File no longer exists on the server' });
    }
    res.download(resolved, path.basename(resolved));
  });
}

// ---------------------------------------------------------------
// Local (Electron/desktop) helpers: directory pick + open folder.
// Disabled entirely in hosted mode — these endpoints are the
// security-sensitive ones and make no sense on a server.
// ---------------------------------------------------------------
if (!IS_HOSTED) {
  const { execFile } = require('child_process');
  const { openAppFolderPicker } = require('./services/systemPicker');

  api.get('/pick-directory', async (req, res, next) => {
    try {
      if (process.versions.electron) {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        if (!result.canceled && result.filePaths.length > 0) {
          return res.json({ path: result.filePaths[0] });
        }
        return res.json({ path: null, cancelled: true });
      }

      // Linux desktop picker via zenity (local dev convenience).
      if (process.platform === 'linux' && !req.query.skipSystem) {
        const picked = await openAppFolderPicker();
        if (picked.cancelled || picked.path) return res.json(picked);
      }

      res.json({ path: null, error: 'Server-side picker unavailable' });
    } catch (error) {
      next(error);
    }
  });

  // Open the folder containing a completed download. Argument-array based —
  // never string interpolation into a shell.
  api.post('/open-folder', (req, res, next) => {
    try {
      const { filePath } = req.body || {};
      if (!filePath || typeof filePath !== 'string') {
        throw new HttpError(400, 'File path required');
      }

      if (process.versions.electron) {
        const { shell } = require('electron');
        shell.showItemInFolder(filePath);
        return res.json({ message: 'Folder opened' });
      }

      const dir = path.dirname(filePath);
      const commandsByPlatform = {
        win32: ['explorer', [dir]],
        darwin: ['open', [dir]],
        linux: ['xdg-open', [dir]],
      };
      const entry = commandsByPlatform[process.platform];
      if (!entry) throw new HttpError(400, 'Unsupported platform');

      execFile(entry[0], entry[1], (error) => {
        if (error) console.error(`[open-folder] failed: ${error.message}`);
      });
      res.json({ message: 'Folder open requested' });
    } catch (error) {
      next(error);
    }
  });

  // ---------------------------------------------------------------
  // Desktop maintenance: yt-dlp freshness + YouTube authentication.
  // These only make sense on the user's own machine — a hosted server
  // must never accept cookies from a browser or touch anyone else's.
  // ---------------------------------------------------------------
  const authInfo = () => {
    const cfg = settingsStore.resolveCookieConfig();
    return {
      method: cfg.method,
      detail: cfg.detail,
      browsers: settingsStore.BROWSER_SOURCES,
      cookiesFromBrowser: cfg.method === 'browser' ? cfg.detail : '',
      cookiesFile: cfg.method === 'file' ? cfg.detail : null,
      // The stored preference even when a cookies.txt shadows it.
      savedBrowserSource: settingsStore.readSettings().cookiesFromBrowser || '',
    };
  };

  api.get('/desktop/info', (_req, res) => {
    res.json({
      dataDir: settingsStore.getDataDir(),
      auth: authInfo(),
      ytdlp: ytdlpUpdater.getStatus(),
      app: appUpdater.getStatus(),
      queue: downloadManager.getSnapshot(),
    });
  });

  // Use the signed-in session of a real browser — the strongest way to beat
  // "Sign in to confirm you're not a bot" from a residential IP.
  api.post('/settings/cookies-from-browser', (req, res) => {
    const { browser } = req.body || {};
    const shadowed = () => {
      const cfg = authInfo();
      return cfg.method === 'file' && cfg.detail
        ? 'Saved as inactive: a cookies.txt file is taking priority. Remove it to use browser cookies.'
        : null;
    };

    if (browser === null || browser === '' || browser === 'none') {
      settingsStore.writeSettings({ cookiesFromBrowser: null });
      return res.json({ auth: authInfo(), message: 'Browser cookie source cleared' });
    }
    const normalized = settingsStore.normalizeBrowserSource(browser);
    if (!normalized) throw new HttpError(400, `Unsupported browser: ${String(browser).slice(0, 40)}`);

    const profile = settingsStore.browserProfile(browser);
    settingsStore.writeSettings({ cookiesFromBrowser: profile ? `${normalized}:${profile}` : normalized });
    const warning = shadowed();
    return res.json({
      auth: authInfo(),
      message: `Using cookies from ${normalized}`,
      ...(warning ? { warning } : {}),
    });
  });

  // Paste/export path: cookies.txt wins over the browser source and survives
  // restarts. Stored in the writable per-user data dir, mode 0600.
  api.post('/cookies', (req, res) => {
    try {
      const { content } = req.body || {};
      const saved = settingsStore.saveCookies(typeof content === 'string' ? content : '');
      res.json({ message: `Saved ${saved.count} cookies`, file: saved.path, auth: authInfo() });
    } catch (err) {
      if (err.code === 'INVALID_COOKIES') throw new HttpError(400, err.message);
      throw err;
    }
  });

  api.delete('/cookies', (_req, res) => {
    const removed = settingsStore.clearCookies();
    res.json({ message: removed.length ? 'Cookies removed' : 'No cookies file found', auth: authInfo() });
  });

  api.post('/ytdlp/check', async (req, res, next) => {
    try {
      res.json(await ytdlpUpdater.checkForUpdates({ force: req.body?.force !== false }));
    } catch (error) {
      next(error);
    }
  });

  api.post('/ytdlp/update', async (req, res, next) => {
    try {
      const busy = downloadManager.getSnapshot().active.length > 0;
      if (busy && req.body?.force !== true) {
        throw new HttpError(409, 'Downloads are running — wait or cancel them before updating yt-dlp.');
      }
      const result = await ytdlpUpdater.updateNow();
      io.emit('ytdlp-updated', result);
      res.json({ ...result, ytdlp: ytdlpUpdater.getStatus() });
    } catch (error) {
      next(error);
    }
  });

  // App self-update: compare the running build against the newest GitHub
  // Release. We never auto-install an unsigned Electron app — the UI opens the
  // official release page so the user installs the correct installer.
  api.post('/app/check', async (req, res, next) => {
    try {
      res.json(await appUpdater.checkForUpdates({ force: req.body?.force !== false }));
    } catch (error) {
      next(error);
    }
  });
}

app.use('/api', api);

// JSON 404 for unknown API routes, before the SPA fallback.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Serve the built client (production).
// Express 5: use a middleware catch-all instead of app.get('*') —
// path-to-regexp v8 no longer accepts a bare '*'.
const CLIENT_DIST = path.join(__dirname, '../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// ---- Socket.IO -------------------------------------------------
downloadManager.on('cancelled', ({ id, url }) => io.emit('cancelled', { id, url }));
downloadManager.on('download-error', ({ id }) => {
  const record = downloadManager.getResult(id) || {};
  io.emit('download-error', { id, url: record.url, error: record.error || 'Download failed' });
});
downloadManager.on('complete', ({ id }) => {
  const record = downloadManager.getResult(id) || {};
  io.emit('download-complete', { id, url: record.url, filePath: record.filePath });
});
downloadManager.on('queue-update', (snapshot) => io.emit('queue-update', snapshot));

io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('disconnect', () => console.log('Client disconnected'));
});

// ---------------------------------------------------------------
// Central error handler (registered LAST so route errors reach it)
// ---------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) console.error('[Server Error]', err);
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
});

// Graceful shutdown: stop downloads, close socket.io, then HTTP.
function shutdown(signal) {
  console.log(`${signal} received, shutting down gracefully`);
  downloadManager.stopAll();
  io.close(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
  // Hard exit fallback if sockets refuse to die.
  setTimeout(() => process.exit(0), 5_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (process.env.NODE_ENV !== 'production') process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Cookies: write from env if provided (never commit the file itself).
// Hosted deployments use env vars; desktop users get a writable per-user
// cookies.txt / browser cookie source via the settings UI instead.
const { COOKIES_PATH } = require('./lib/config');
if (process.env.YOUTUBE_COOKIES_B64 || process.env.YOUTUBE_COOKIES) {
  try {
    const content = process.env.YOUTUBE_COOKIES_B64
      ? Buffer.from(process.env.YOUTUBE_COOKIES_B64, 'base64').toString('utf-8')
      : process.env.YOUTUBE_COOKIES;
    fs.writeFileSync(COOKIES_PATH, content);
    console.log('YouTube cookies loaded from environment');
  } catch (err) {
    console.error('Failed to write cookies from env:', err.message);
  }
}

const authConfig = settingsStore.resolveCookieConfig();
if (authConfig.method === 'file') {
  console.log(`YouTube auth: cookies file ${authConfig.detail}`);
} else if (authConfig.method === 'browser') {
  console.log(`YouTube auth: --cookies-from-browser ${authConfig.detail}`);
} else {
  console.log(
    IS_HOSTED
      ? 'No cookies provided. YouTube bot detection may occur.'
      : 'No cookies configured. If YouTube complains about bots, enable browser cookies in Settings.',
  );
}

// Start listening and resolve with the bound port (Electron waits on this).
// A desktop app must still open when 3000 is taken by a dev server or a second
// instance, so locally we walk forward a few ports instead of dying silently.
const MAX_PORT_ATTEMPTS = 5;

const ready = new Promise((resolve, reject) => {
  const attemptListen = (port, attempt) => {
    const onError = (error) => {
      server.removeListener('listening', onListening);
      if (error.code === 'EADDRINUSE' && !IS_HOSTED && attempt < MAX_PORT_ATTEMPTS) {
        console.warn(`Port ${port} is already in use — trying ${port + 1}`);
        attemptListen(port + 1, attempt + 1);
        return;
      }
      if (error.code === 'EADDRINUSE') console.error(`Port ${port} is already in use`);
      else console.error('Server error:', error);
      reject(error);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      boundPort = port;
      console.log(`Server running on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'} | Hosted mode: ${IS_HOSTED}`);
      resolve(port);
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port);
  };

  attemptListen(PORT, 0);
});

// Outside Electron there is no window to show an error in — fail loudly.
ready.catch(() => {
  if (!IS_ELECTRON) process.exit(1);
});

// Keep yt-dlp fresh in the background on the desktop app. YouTube breaks
// yt-dlp every few weeks, so an app frozen at build time would stop working;
// this is throttled (6h) and every failure is non-fatal.
if (!IS_HOSTED) {
  ready.then(() => {
    setTimeout(() => {
      ytdlpUpdater
        .autoUpdate({
          emit: (event, payload) => io.emit(event, payload),
          isBusy: () => downloadManager.getSnapshot().active.length > 0,
        })
        .catch((err) => console.error(`[ytdlp-updater] ${err.message}`));
    }, 5_000).unref?.();

    // Also check for a newer app release (throttled, non-fatal) so the Desktop
    // settings can surface "Update available" without the user opening it first.
    setTimeout(() => {
      appUpdater.checkForUpdates().catch((err) => console.error(`[app-updater] ${err.message}`));
    }, 8_000).unref?.();
  });
}

server.on('error', (error) => {
  // Bind failures are handled (and retried) by the startup logic above.
  if (error.code === 'EADDRINUSE') return;
  console.error('Server error:', error);
});

module.exports = { app, server, io, ready, getPort: () => boundPort };
