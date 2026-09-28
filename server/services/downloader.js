const { FORMATS, HEIGHT_FILTERS } = require('../lib/constants');
const { friendlyYtdlpError } = require('../lib/errors');
const { spawnYtDlp } = require('../lib/ytdlp');
const { sanitizeFilename, ensureDir, uniqueFilePath } = require('../lib/files');

const ffmpegPath = require('ffmpeg-static');

/**
 * Build the yt-dlp argument list for a video/audio download.
 * Exported for testing.
 */
function buildArgs({ url, format, quality, filePath }) {
  const isAudio = FORMATS.audio.includes(format);
  const args = [
    '--newline',
    '--no-mtime',
    '--retries', '10',
    '--fragment-retries', '10',
    '--socket-timeout', '30',
    '--http-chunk-size', '10M',
    '--ffmpeg-location', ffmpegPath,
    // Concurrent fragment downloads — YouTube DASH streams are fragmented,
    // and without -N yt-dlp fetches them sequentially. This is the single
    // biggest speed factor (old code had it; keep it).
    '-N', '4',
    // NOTE: no player_client override — recent yt-dlp default clients are
    // better tuned than the legacy android workaround (which can 403 or
    // miss formats on current binaries).
  ];

  if (isAudio) {
    args.push('-x', '--audio-format', format, '--audio-quality', '0');
  } else {
    const heightFilter = HEIGHT_FILTERS[quality] || '';
    const formatSelector = `bestvideo${heightFilter}+bestaudio/best${heightFilter}`;
    args.push('-f', formatSelector, '--merge-output-format', format);
  }

  args.push('-o', filePath, url);
  return args;
}

/**
 * Parsed progress info from a yt-dlp --newline progress line.
 * Lines look like:
 *   [download]  42.3% of    3.42MiB at    1.10MiB/s ETA 00:03
 */
function parseProgressLine(line) {
  const percentMatch = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/i);
  if (!percentMatch) return null;
  const info = { percent: parseFloat(percentMatch[1]) };
  const speedMatch = line.match(/at\s+([\d.]+\s*[KMG]?iB\/s)/i);
  if (speedMatch) info.speed = speedMatch[1].trim();
  const etaMatch = line.match(/ETA\s+(\d+:\d+(?::\d+)?)/i);
  if (etaMatch) info.eta = etaMatch[1];
  return info;
}

/**
 * Download a single video.
 * @returns {ChildProcess} the spawned yt-dlp process
 */
function downloadVideo({ url, title, outputDir, format = 'mp4', quality = 'best', videoId, io, onComplete, onError }) {
  const isAudio = FORMATS.audio.includes(format);

  try {
    if (!url || typeof url !== 'string') throw new Error('Invalid URL');
    if (!title || typeof title !== 'string') throw new Error('Invalid title');

    ensureDir(outputDir);
    const safeTitle = sanitizeFilename(title);
    // Pre-allocate a non-colliding target path (avoids overwriting).
    const filePath = uniqueFilePath(outputDir, `${safeTitle}.${format}`);

    console.log(`[Downloader] "${title}" -> ${filePath} [${format}, ${quality}]`);
    const args = buildArgs({ url, format, quality, filePath });
    const process_ = spawnYtDlp(args);

    let lastPercent = -1;
    let stderrOutput = '';

    process_.stdout.on('data', (chunk) => {
      for (const line of chunk.toString().split('\n')) {
        const info = parseProgressLine(line);
        if (!info) continue;

        // yt-dlp reports video then audio phases; a big drop in percent
        // means a new phase (merge) started — emit immediately so the UI
        // can reset its bar instead of jumping backwards.
        const isNewPhase = lastPercent > 20 && info.percent < lastPercent - 5;
        if (isNewPhase || Math.abs(info.percent - lastPercent) >= 1 || info.percent === 100) {
          lastPercent = info.percent;
          ioSafeEmit(io, 'download-progress', {
            id: videoId,
            url,
            progress: Math.min(info.percent, 100),
            status: 'downloading',
            phase: isNewPhase ? 'merge' : 'download',
            speed: info.speed,
            eta: info.eta,
          });
        }
      }
    });

    process_.stderr.on('data', (chunk) => {
      stderrOutput += chunk.toString();
    });

    process_.on('close', (code) => {
      if (code === 0) {
        ioSafeEmit(io, 'download-complete', { id: videoId, url, filePath });
        if (onComplete) onComplete(filePath);
      } else if (code !== null) {
        // code null = killed (cancelled); handled elsewhere
        const message = friendlyYtdlpError(stderrOutput);
        console.error(`[Downloader] Failed (${code}): ${title} — ${message}`);
        ioSafeEmit(io, 'download-error', { id: videoId, url, error: message });
        if (onError) onError(new Error(message));
      }
    });

    process_.on('error', (err) => {
      const message = err.code === 'ENOENT'
        ? 'yt-dlp not found on the server. Please install it.'
        : 'Failed to start download';
      console.error(`[Downloader] spawn error: ${err.message}`);
      ioSafeEmit(io, 'download-error', { id: videoId, url, error: message });
      if (onError) onError(new Error(message));
    });

    return process_;
  } catch (error) {
    console.error(`[Downloader] ${error.message}`);
    ioSafeEmit(io, 'download-error', { id: videoId, url, error: error.message });
    if (onError) onError(error);
    return null;
  }
}

function ioSafeEmit(io, event, payload) {
  if (io) io.emit(event, payload);
}

module.exports = { downloadVideo, buildArgs, parseProgressLine };
