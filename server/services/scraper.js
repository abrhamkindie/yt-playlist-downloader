const { spawnYtDlp } = require('../lib/ytdlp');
const { friendlyYtdlpError, HttpError } = require('../lib/errors');

const SCRAPE_TIMEOUT_MS = 60_000;
const RELATED_TIMEOUT_MS = 15_000;
const RELATED_VIDEOS_LIMIT = 10;

// Related-video rail is only present in the *desktop* watch page's initial
// data; the mobile page (the app's DEFAULT_UA) lazy-loads it. Force a desktop
// UA for this HTML scrape.
const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/**
 * Decide whether a URL should be expanded into a full playlist.
 *
 * Only *real* user playlists are expanded:
 *   - an explicit playlist page:  youtube.com/playlist?list=…
 *   - a watch URL carrying a user-playlist id: list=PL…
 *
 * Auto-generated lists that YouTube silently appends to share links —
 * Mix/Radio (RD…), Likes (LL…), Watch-Later (WL…), History, Favorites (FL…)
 * — are NOT treated as playlists. They can hold hundreds of videos and would
 * otherwise turn a single-video paste into a huge, slow fetch. For those we
 * return just the one video.
 *
 * @param {string} url
 * @returns {boolean}
 */
function isRealPlaylist(url) {
  if (url.includes('/playlist')) return true;

  // Only keep the playlist when its id starts with "PL" (a genuine playlist).
  // Uploads playlists (UU/PU/OU) are also legitimate channels-of-videos.
  const match = url.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (!match) return false;
  return /^(PL|UU|PU|OU)/.test(match[1]);
}

/**
 * Scrape metadata for a YouTube video or playlist URL.
 * Returns an array of { id, title, url, thumbnail, duration }.
 *
 * @param {string} url
 * @param {{ includeRelated?: boolean }} [opts] when true and the URL resolves
 *   to a single non-playlist video, append up to RELATED_VIDEOS_LIMIT related
 *   videos (best effort). Used by /analyze; NOT used by the download path so a
 *   single-video download never accidentally enqueues its related list.
 * @throws {HttpError} with a friendly message on failure
 */
async function scrapePlaylist(url, { includeRelated = false } = {}) {
  const isPlaylist = isRealPlaylist(url);
  const videos = await runScrape(url, isPlaylist);

  // A single, non-playlist video: enrich with a small "more like this" list so
  // the user gets options without the giant/slow playlist fetch. Any failure
  // here is swallowed — we always return at least the main video.
  if (includeRelated && !isPlaylist && videos.length === 1) {
    try {
      const related = await fetchRelatedVideos(videos[0].id);
      const seen = new Set(videos.map((v) => v.id));
      const extra = related
        .filter((v) => v && v.id && !seen.has(v.id))
        .slice(0, RELATED_VIDEOS_LIMIT)
        .map((v) => ({ ...v, isRelated: true }));
      if (extra.length) {
        console.log(`[Scraper] Adding ${extra.length} related videos`);
        return [{ ...videos[0], isRelated: false }, ...extra];
      }
    } catch (err) {
      console.warn(`[Scraper] related-video fetch failed: ${err.message}`);
    }
  }

  return videos;
}

/**
 * Core yt-dlp metadata fetch for a video or playlist. Returns the base list
 * with no related-video enrichment.
 */
function runScrape(url, isPlaylist) {
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

/**
 * Pull the `ytInitialData` JSON blob out of a YouTube watch-page HTML string.
 *
 * YouTube emits it two ways depending on the page build:
 *   - legacy:  `var ytInitialData = { … };`   (a raw JS object literal)
 *   - current: `var ytInitialData = '\x7b\x22…';` (a JS *string* whose JSON is
 *     hex-escaped, so `{`→\x7b, `"`→\x22, etc.)
 *
 * We scan every `ytInitialData =` assignment and try both forms until one
 * parses. A lazy regex can't stop at the right `}`, so the object form is
 * brace-matched (respecting string literals/escapes) and the string form is
 * read to its closing quote and JS-unescaped.
 * @returns {object|null}
 */
function extractYtInitialData(html) {
  const re = /ytInitialData\s*=\s*/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const start = m.index + m[0].length;
    const ch = html[start];

    let jsonText = null;
    if (ch === '{') {
      jsonText = readBalancedObject(html, start);
    } else if (ch === "'" || ch === '"') {
      const raw = readQuotedLiteral(html, start);
      if (raw !== null) jsonText = unescapeJs(raw);
    }

    if (jsonText) {
      try {
        const obj = JSON.parse(jsonText);
        if (obj && typeof obj === 'object') return obj;
      } catch {
        /* try the next occurrence */
      }
    }
  }
  return null;
}

/** Return the `{…}` slice starting at idx by matching braces (quote-aware). */
function readBalancedObject(str, idx) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = idx; i < str.length; i++) {
    const c = str[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) return str.slice(idx, i + 1);
    }
  }
  return null;
}

/** idx points at the opening quote; return the inner text (escapes intact). */
function readQuotedLiteral(str, idx) {
  const quote = str[idx];
  let out = '';
  for (let i = idx + 1; i < str.length; i++) {
    const c = str[i];
    if (c === '\\') {
      out += c + (str[i + 1] ?? '');
      i++;
    } else if (c === quote) {
      return out;
    } else {
      out += c;
    }
  }
  return null;
}

/** Decode JS string-literal escapes (\xHH, \uHHHH, \\, \', \n, …). */
function unescapeJs(str) {
  return str.replace(/\\(x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4}|.)/g, (match, seq) => {
    const type = seq[0];
    if (type === 'x') return String.fromCharCode(parseInt(seq.slice(1), 16));
    if (type === 'u') return String.fromCharCode(parseInt(seq.slice(1), 16));
    switch (seq) {
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case 'b': return '\b';
      case 'f': return '\f';
      case '0': return '\0';
      default: return seq; // \\ \' \" \/ etc. collapse to the char itself
    }
  });
}

/**
 * Recursively walk ytInitialData and collect video entries from both the
 * legacy `videoRenderer` shape and the newer `lockupViewModel` shape YouTube
 * is migrating to. Anything malformed/unrecognised is simply skipped.
 */
function collectRelatedVideos(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) collectRelatedVideos(child, out);
    return;
  }

  const vr = node.videoRenderer;
  if (vr && vr.videoId) {
    out.push({
      id: vr.videoId,
      title: vr.title?.runs?.[0]?.text || 'Untitled',
      url: `https://www.youtube.com/watch?v=${vr.videoId}`,
      thumbnail:
        vr.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
        `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`,
      duration: vr.lengthText?.simpleText,
    });
  }

  const lv = node.lockupViewModel;
  if (lv && typeof lv.contentId === 'string' && /^[\w-]{11}$/.test(lv.contentId)) {
    out.push({
      id: lv.contentId,
      title: lv.metadata?.lockupMetadataViewModel?.title?.content || 'Untitled',
      url: `https://www.youtube.com/watch?v=${lv.contentId}`,
      thumbnail: `https://i.ytimg.com/vi/${lv.contentId}/hqdefault.jpg`,
    });
  }

  // Mobile watch pages put the sidebar entries in videoWithContextRenderer.
  const vwr = node.videoWithContextRenderer;
  if (vwr && vwr.videoId) {
    out.push({
      id: vwr.videoId,
      title: vwr.headline?.runs?.[0]?.text || vwr.title?.runs?.[0]?.text || 'Untitled',
      url: `https://www.youtube.com/watch?v=${vwr.videoId}`,
      thumbnail:
        vwr.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
        `https://i.ytimg.com/vi/${vwr.videoId}/hqdefault.jpg`,
      duration: vwr.lengthText?.simpleText,
    });
  }

  for (const key of Object.keys(node)) {
    if (key === 'videoRenderer' || key === 'lockupViewModel' || key === 'videoWithContextRenderer') continue;
    collectRelatedVideos(node[key], out);
  }
}

/**
 * Best-effort fetch of the videos YouTube shows next to a watch page (the
 * "related" / "more videos" rail). Returns [] on any failure so the caller can
 * always fall back to just the main video.
 * @param {string} videoId
 * @returns {Promise<Array<{id,title,url,thumbnail,duration?}>>}
 */
async function fetchRelatedVideos(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RELATED_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': DESKTOP_UA,
        'Accept-Language': 'en-US,en;q=0.9',
        // Skip the EU consent interstitial so ytInitialData is present.
        Cookie: 'CONSENT=YES+cb; SOCS=CAI',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const data = extractYtInitialData(html);
    if (!data) return [];

    const found = [];
    collectRelatedVideos(data, found);

    // De-duplicate by id, preserving order.
    const seen = new Set();
    return found.filter((v) => (seen.has(v.id) ? false : seen.add(v.id)));
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  scrapePlaylist,
  isRealPlaylist,
  extractYtInitialData,
  collectRelatedVideos,
  SCRAPE_TIMEOUT_MS,
};
