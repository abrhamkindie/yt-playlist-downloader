const path = require('path');
const fs = require('fs');

const SERVER_ROOT = path.join(__dirname, '..');
const PROJECT_ROOT = path.join(SERVER_ROOT, '..');

const IS_PROD = process.env.NODE_ENV === 'production';
const IS_ELECTRON = Boolean(process.versions.electron);

/**
 * "Hosted" = running on a public server (e.g. Render), not on the user's
 * machine. In hosted mode we never trust client-provided download paths and
 * we expose finished files for streaming back to the browser instead of
 * opening local folders.
 */
const IS_HOSTED = IS_PROD && !IS_ELECTRON;

const PORT = Number(process.env.PORT) || 3000;

// Directory downloads are saved to when the client doesn't provide one.
const DEFAULT_DOWNLOADS_DIR = path.join(SERVER_ROOT, 'downloads');

// In hosted mode downloads are always confined to this root.
const HOSTED_DOWNLOAD_ROOT = process.env.DOWNLOADS_DIR || DEFAULT_DOWNLOADS_DIR;

const CLIENT_ORIGINS = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((s) => s.trim()).filter(Boolean)
  : ['https://streampull.vercel.app', 'http://localhost:5173'];

/**
 * Validate a client-provided download path for local (non-hosted) usage.
 * Rules:
 *  - must be an absolute path (no relative traversal games)
 *  - must not contain null bytes
 *  - must exist and be a directory
 * Returns the normalized path or throws.
 */
function validateLocalDownloadPath(userPath) {
  if (typeof userPath !== 'string' || !userPath.trim()) {
    throw new Error('Download path is required');
  }
  if (userPath.includes('\0')) {
    throw new Error('Invalid download path');
  }
  const resolved = path.resolve(userPath.trim());
  if (!path.isAbsolute(resolved)) {
    throw new Error('Download path must be absolute');
  }
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    throw new Error('Download path does not exist');
  }
  if (!stat.isDirectory()) {
    throw new Error('Download path is not a directory');
  }
  return resolved;
}

/** Resolve the directory a download should be written to. */
function resolveDownloadDir({ downloadPath, playlistTitle, createSubfolder }) {
  if (IS_HOSTED || !downloadPath) {
    // Hosted mode: always confine to the hosted root.
    return appendPlaylistSubfolder(HOSTED_DOWNLOAD_ROOT, createSubfolder, playlistTitle);
  }
  const base = validateLocalDownloadPath(downloadPath);
  return appendPlaylistSubfolder(base, createSubfolder, playlistTitle);
}

function appendPlaylistSubfolder(base, createSubfolder, playlistTitle) {
  if (createSubfolder && playlistTitle) {
    const { sanitizeFilename } = require('./files');
    return path.join(base, sanitizeFilename(playlistTitle));
  }
  return base;
}

const COOKIES_PATH = path.join(SERVER_ROOT, 'cookies.txt');

module.exports = {
  SERVER_ROOT,
  PROJECT_ROOT,
  IS_PROD,
  IS_ELECTRON,
  IS_HOSTED,
  PORT,
  DEFAULT_DOWNLOADS_DIR,
  HOSTED_DOWNLOAD_ROOT,
  CLIENT_ORIGINS,
  COOKIES_PATH,
  validateLocalDownloadPath,
  resolveDownloadDir,
};
