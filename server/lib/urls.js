const { HttpError } = require('./errors');

/** Accepts youtube.com, www/m/music subdomains, youtu.be, youtube-nocookie.com. */
function isYouTubeHost(hostname) {
  const host = hostname.toLowerCase();
  return (
    host === 'youtu.be' ||
    host === 'youtube.com' ||
    host.endsWith('.youtube.com') ||
    host.endsWith('.youtube-nocookie.com')
  );
}

/**
 * Validate and normalize a user-supplied YouTube URL.
 * Throws an HttpError(400) with a friendly, non-technical message when the
 * input is not a valid http(s) YouTube URL — so raw yt-dlp errors like
 * "not a valid URL" never reach the client.
 * @param {unknown} raw
 * @returns {string} normalized href
 */
function parseYouTubeUrl(raw) {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    throw new HttpError(400, 'URL is required');
  }

  let value = raw.trim();
  // Relative YouTube paths (e.g. "/watch?v=…") are treated as youtube.com links.
  if (value.startsWith('/')) value = `https://www.youtube.com${value}`;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new HttpError(
      400,
      "That doesn't look like a valid URL. Paste a full YouTube link, e.g. https://www.youtube.com/playlist?list=…",
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HttpError(400, 'Only http(s) links are supported.');
  }

  if (!isYouTubeHost(parsed.hostname)) {
    throw new HttpError(400, 'Please provide a valid YouTube video or playlist URL.');
  }

  return parsed.href;
}

module.exports = { parseYouTubeUrl, isYouTubeHost };
