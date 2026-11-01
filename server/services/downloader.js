const { FORMATS, HEIGHT_FILTERS } = require('../lib/constants');
const { friendlyYtdlpError } = require('../lib/errors');
const { spawnYtDlp } = require('../lib/ytdlp');
const { sanitizeFilename, ensureDir, uniqueFilePath } = require('../lib/files');

const ffmpegPath = require('ffmpeg-static');

/**
 * Build the yt-dlp argument list for a video/audio download.
 * Exported for testing.
 * @param {object} opts
 * @param {boolean} [opts.fallback] - Use simplest format selector (for retry)
 */
function buildArgs({ url, format, quality, filePath, fallback = false }) {
  const isAudio = FORMATS.audio.includes(format);
  const args = [
    '--newline',
    '--no-mtime',
    // One task always means one video. yt-dlp expands a watch URL that still
    // carries a list= param into the whole playlist by default, which would
    // stream dozens of videos into this single output path. Related videos and
    // playlist entries are enqueued separately, so pin the single-video mode.
    '--no-playlist',
    '--retries', '10',
    '--fragment-retries', '10',
    '--socket-timeout', '30',
    '--http-chunk-size', '10M',
    '--ffmpeg-location', ffmpegPath,
    '-N', '4',
  ];

  if (isAudio) {
    args.push('-x', '--audio-format', format, '--audio-quality', '0');
  } else if (fallback) {
    // Retry mode: pick the best single file, no merging, no container constraint.
    // This handles videos that only expose one combined stream or where
    // --merge-output-format restricts selection.
    args.push('-f', 'b');
  } else {
    const heightFilter = HEIGHT_FILTERS[quality] || '';
    const formatSelector = heightFilter
      ? `bestvideo*${heightFilter}+bestaudio/best${heightFilter}/best`
      : 'bestvideo*+bestaudio/best';
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
 * Download a single video. Retries with a simpler format selector if the
 * first attempt fails with "format not available" (common for videos that
 * only expose combined streams or where merge constraints block selection).
 */
function downloadVideo({ url, title, outputDir, format = 'mp4', quality = 'best', videoId, io, onComplete, onError }) {
  const FORMAT_NOT_AVAILABLE = /requested format is not available|no formats/i;

  try {
    if (!url || typeof url !== 'string') throw new Error('Invalid URL');
    if (!title || typeof title !== 'string') throw new Error('Invalid title');

    ensureDir(outputDir);
    const safeTitle = sanitizeFilename(title);
    const filePath = uniqueFilePath(outputDir, `${safeTitle}.${format}`);

    console.log(`[Downloader] "${title}" -> ${filePath} [${format}, ${quality}]`);

    let attempted = false; // track if we already retried

    function spawnAttempt(fallback) {
      const args = buildArgs({ url, format, quality, filePath, fallback });
      const proc = spawnYtDlp(args);
      let lastPercent = -1;
      let stderrOutput = '';

      proc.stdout.on('data', (chunk) => {
        for (const line of chunk.toString().split('\n')) {
          const info = parseProgressLine(line);
          if (!info) continue;
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

      proc.stderr.on('data', (chunk) => {
        stderrOutput += chunk.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          ioSafeEmit(io, 'download-complete', { id: videoId, url, filePath });
          if (onComplete) onComplete(filePath);
          return;
        }
        // code null = killed (cancelled)
        if (code === null) return;

        // Retry with simpler format if "format not available" and we haven't tried yet
        if (!fallback && !attempted && FORMAT_NOT_AVAILABLE.test(stderrOutput)) {
          console.log(`[Downloader] Format unavailable, retrying with best single file: ${title}`);
          attempted = true;
          spawnAttempt(true);
          return;
        }

        const message = friendlyYtdlpError(stderrOutput);
        console.error(`[Downloader] Failed (${code}): ${title} — ${message}`);
        ioSafeEmit(io, 'download-error', { id: videoId, url, error: message });
        if (onError) onError(new Error(message));
      });

      proc.on('error', (err) => {
        const message = err.code === 'ENOENT'
          ? 'yt-dlp not found on the server. Please install it.'
          : 'Failed to start download';
        console.error(`[Downloader] spawn error: ${err.message}`);
        ioSafeEmit(io, 'download-error', { id: videoId, url, error: message });
        if (onError) onError(new Error(message));
      });

      return proc;
    }

    return spawnAttempt(false);
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
