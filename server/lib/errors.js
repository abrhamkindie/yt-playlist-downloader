/**
 * Maps raw yt-dlp stderr output to friendly, user-facing messages.
 * Order matters — most specific patterns first.
 */

const RULES = [
  { test: /sign in to confirm|confirm you'?re not a bot|cookies/i, message: 'YouTube bot detection: update yt-dlp or provide fresh cookies.' },
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
