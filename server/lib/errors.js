/**
 * Maps raw yt-dlp stderr output to friendly, user-facing messages.
 * Order matters — most specific patterns first.
 */

const RULES = [
  { test: /is not a valid url|unsupported url|invalid url/i, message: "That doesn't look like a valid YouTube URL. Paste a full link, e.g. https://www.youtube.com/playlist?list=…" },
  // Cookie-source problems first — they mention "cookies" too, but the fix is different.
  {
    test: /could not find .*(cooki|browser)|failed to open (cooki|browser)|no such browser|unsupported browser|unable to extract cookies|permission denied.*cooki|could not decrypt|cookie store|keyring/i,
    message: 'Cookie source failed — pick a different browser in Settings, or export cookies.txt from a logged-in tab.',
  },
  { test: /sign in to confirm|confirm you'?re not a bot/i, message: 'YouTube bot detection — open Settings, enable browser cookies (or paste a cookies.txt), then update yt-dlp.' },
  { test: /cookies/i, message: 'YouTube wants a signed-in session: enable browser cookies or paste a cookies.txt in Settings.' },
  { test: /HTTP Error 403|Forbidden/i, message: 'Access denied — the video may be restricted.' },
  { test: /HTTP Error 404|not found/i, message: 'Video or playlist not found — check the URL.' },
  { test: /private video|video is private/i, message: 'This video is private.' },
  { test: /video unavailable|members-only|age.?restrict/i, message: 'This video is unavailable or restricted.' },
  { test: /429|too many requests/i, message: 'Rate limited by YouTube (429). Please wait and try again.' },
  { test: /network|timeout|timed out|connection/i, message: 'Network error — please check connectivity and retry.' },
];

/**
 * Turn accumulated yt-dlp stderr text into a friendly message.
 * @param {string} stderr
 * @param {string} fallback message when nothing matches
 */
function friendlyYtdlpError(stderr, fallback = 'Download failed. Please try again.') {
  if (!stderr) return fallback;
  for (const rule of RULES) {
    if (rule.test.test(stderr)) return rule.message;
  }
  const firstLine = stderr.split('\n').find((l) => l.trim() && !l.trim().startsWith('WARNING'));
  return firstLine ? `yt-dlp error: ${firstLine.trim().slice(0, 200)}` : fallback;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { friendlyYtdlpError, HttpError };
