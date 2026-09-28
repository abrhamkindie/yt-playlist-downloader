const { spawnYtDlp, DEFAULT_UA } = require('../lib/ytdlp');
const { friendlyYtdlpError, HttpError } = require('../lib/errors');

const SCRAPE_TIMEOUT_MS = 60_000;

/**
 * Scrape metadata for a YouTube video or playlist URL.
 * Returns an array of { id, title, url, thumbnail, duration }.
 * @throws {HttpError} with a friendly message on failure
 */
async function scrapePlaylist(url) {
  const isPlaylist = url.includes('list=') || url.includes('/playlist');

  const args = [
    '--flat-playlist',
    '-J',
    '--no-warnings',
    '--socket-timeout', '30',
    isPlaylist ? '--yes-playlist' : '--no-playlist',
    // NOTE: no player_client override here — forcing android/web clients
    // breaks playlist (tab page) extraction on recent yt-dlp versions.
    // The default client set handles tabs correctly and still bypasses
    // most bot checks for metadata.
    '--http-chunk-size', '10M',
    url,
  ];

  console.log(`[Scraper] Fetching metadata (${isPlaylist ? 'playlist' : 'single'}): ${url}`);

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, value) => {
      if (!settled) {
        settled = true;
        fn(value);
      }
    };

    const child = spawnYtDlp(args, { timeoutMs: SCRAPE_TIMEOUT_MS });
    let stdoutData = '';
    let stderrData = '';
    let spawnFailed = false;

    child.stdout.on('data', (d) => { stdoutData += d.toString(); });
    child.stderr.on('data', (d) => { stderrData += d.toString(); });

    child.on('error', (err) => {
      spawnFailed = true;
      console.error(`[Scraper] spawn failed: ${err.message}`);
      done(reject, new HttpError(500, `Failed to start yt-dlp: ${err.message}`));
    });

    child.on('close', (code) => {
      if (spawnFailed) return;
      if (code !== 0) {
        console.error(`[Scraper] yt-dlp exited ${code}: ${stderrData.slice(0, 500)}`);
        return done(reject, new HttpError(502, friendlyYtdlpError(stderrData, 'Failed to fetch playlist')));
      }
      if (!stdoutData.trim()) {
        return done(reject, new HttpError(502, 'No data received from yt-dlp'));
      }

      try {
        const data = JSON.parse(stdoutData);

        // Single video (no entries)
        if (!data.entries) {
          if (data.id && data.title) {
            return done(resolve, [{
              id: data.id,
              title: data.title || 'Untitled',
              url: data.webpage_url || data.url || url,
              thumbnail: data.thumbnail || `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`,
              duration: data.duration,
            }]);
          }
          return done(resolve, []);
        }

        const videos = data.entries
          .filter((entry) => entry && entry.id)
          .map((entry) => ({
            id: entry.id,
            title: entry.title || 'Untitled',
            url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
            thumbnail:
              (entry.thumbnails && entry.thumbnails.find((t) => t.height >= 360))?.url ||
              (entry.thumbnails && entry.thumbnails[entry.thumbnails.length - 1]?.url) ||
              `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
            duration: entry.duration,
          }));

        if (videos.length === 0) {
          return done(reject, new HttpError(404, 'No videos found in playlist'));
        }
        console.log(`[Scraper] Extracted ${videos.length} videos`);
        return done(resolve, videos);
      } catch {
        return done(reject, new HttpError(502, 'Failed to parse playlist data'));
      }
    });
  });
}

module.exports = { scrapePlaylist, SCRAPE_TIMEOUT_MS };
