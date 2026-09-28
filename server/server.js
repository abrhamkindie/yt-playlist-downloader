const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const { PORT, CLIENT_ORIGINS, IS_HOSTED } = require('./lib/config');
const { ALL_FORMATS, QUALITIES, MAX_PLAYLIST_VIDEOS } = require('./lib/constants');
const { HttpError } = require('./lib/errors');
const { scrapePlaylist } = require('./services/scraper');
const { downloadVideo } = require('./services/downloader');
const downloadManager = require('./services/downloadManager');
const { removeDir } = require('./lib/files');
const {
  HOSTED_DOWNLOAD_ROOT,
  resolveDownloadDir,
  validateLocalDownloadPath,
} = require('./lib/config');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: CLIENT_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false })); // CSP off: client is served from same origin with Vite assets
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
    if (!url || typeof url !== 'string') {
      throw new HttpError(400, 'URL is required');
    }

    const videos = await scrapePlaylist(url.trim());
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

    if (!url || typeof url !== 'string') {
      throw new HttpError(400, 'Valid URL is required');
    }
    url = url.trim();
    if (url.startsWith('/')) url = `https://www.youtube.com${url}`;
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      throw new HttpError(400, 'Please provide a valid YouTube URL');
    }

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
      return res.status(410, ).json({ error: 'File no longer exists on the server' });
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
if (fs.existsSync(COOKIES_PATH)) {
  console.log('cookies.txt found at:', COOKIES_PATH);
} else {
  console.log('No cookies.txt found. YouTube bot detection may occur.');
}

// Start listening. Resolve a promise when ready (Electron waits on this).
const ready = new Promise((resolve) => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'} | Hosted mode: ${IS_HOSTED}`);
    resolve();
  });
}).catch?.(() => {});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
  console.error('Server error:', error);
  process.exit(1);
});

module.exports = { app, server, io, ready };
