const fs = require('fs');
const path = require('path');

/**
 * Sanitize a title for use as a filename.
 * Keeps unicode letters, digits, spaces, dashes and dots — friendlier than
 * the old "everything becomes _" approach — while removing characters that
 * are illegal on common filesystems.
 */
function sanitizeFilename(name, { maxLength = 150 } = {}) {
  if (!name || typeof name !== 'string') return 'untitled';
  let safe = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // illegal on Windows/most FS
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, ''); // no leading/trailing dots/spaces
  if (!safe) return 'untitled';
  if (safe.length > maxLength) safe = safe.slice(0, maxLength).trim();
  return safe;
}

/** Create a directory recursively, swallowing "already exists". */
function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    return dirPath;
  }
}

/**
 * Return a file path that does not collide with an existing file by
 * appending " (2)", " (3)", ... before the extension.
 */
function uniqueFilePath(dir, filename) {
  const ext = path.extname(filename);
  const base = filename.slice(0, filename.length - ext.length) || filename;
  let candidate = path.join(dir, filename);
  let n = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base} (${n})${ext}`);
    n += 1;
    if (n > 999) break; // safety valve
  }
  return candidate;
}

/** Recursively delete a directory; no-op when it doesn't exist. */
function removeDir(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (err) {
    console.error(`[files] Failed to remove ${dirPath}: ${err.message}`);
  }
}

module.exports = { sanitizeFilename, ensureDir, uniqueFilePath, removeDir };
