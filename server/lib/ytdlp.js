const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const { getDataDir, resolveCookieConfig } = require('./settings');

const SERVER_ROOT = path.join(__dirname, '..');

/** Standalone (no-Python) asset names, most specific first. */
const BUNDLED_ASSETS = ['yt-dlp_linux', 'yt-dlp_linux_aarch64', 'yt-dlp_macos', 'yt-dlp.exe', 'yt-dlp'];

/** Where a self-updated yt-dlp copy is installed by services/ytdlpUpdater. */
const managedDir = () => path.join(getDataDir(), 'ytdlp');

let cachedResolver = null;

function isExecutable(p) {
  try {
    if (!fs.statSync(p).isFile()) return false;
    if (process.platform !== 'win32') fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Drop the memoised lookup — called after an update installs a new binary. */
function resetYtDlpCache() {
  cachedResolver = null;
}

/**
 * Locate a yt-dlp binary, preferring:
 *  1. $YTDLP_PATH env var
 *  2. The self-updated copy in the per-user data dir (installed by
 *     services/ytdlpUpdater.js) — this is what keeps a packaged desktop app
 *     working after YouTube changes things upstream
 *  3. A standalone binary bundled in ./server by `npm run download-ytdlp`
 *  4. ./server/yt-dlp zipapp, then a system yt-dlp on PATH
 * Throws when none is found.
 */
function resolveYtDlp() {
  if (cachedResolver) return cachedResolver;

  const dirs = [managedDir(), SERVER_ROOT];
  const candidates = [
    process.env.YTDLP_PATH,
    ...dirs.flatMap((dir) => BUNDLED_ASSETS.map((name) => path.join(dir, name))),
    'yt-dlp',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes(path.sep) || candidate.includes('/')) {
      if (isExecutable(candidate)) {
        cachedResolver = candidate;
        return candidate;
      }
    } else {
      // Bare command — assume it's on PATH; spawn will ENOENT if not.
      cachedResolver = candidate;
      return candidate;
    }
  }
  throw new Error('yt-dlp not found. Install it or set YTDLP_PATH.');
}

/** Which tier satisfied the lookup — surfaced in the desktop settings UI. */
function describeBinary(resolved = undefined) {
  let bin;
  try {
    bin = resolved === undefined ? resolveYtDlp() : resolved;
  } catch (err) {
    return { path: null, source: 'missing', error: err.message };
  }
  const source =
    process.env.YTDLP_PATH === bin
      ? 'env'
      : bin.startsWith(managedDir() + path.sep)
        ? 'managed'
        : bin.startsWith(SERVER_ROOT + path.sep)
          ? 'bundled'
          : 'system';
  return { path: bin, source, asset: path.basename(bin) };
}

/** Path a self-updated copy should be written to for a given asset name. */
function managedPathFor(assetName) {
  return path.join(managedDir(), assetName);
}

/** Is the resolved binary our committed local zipapp (deprecated)? */
function usingLocalBinary() {
  return describeBinary().path === path.join(SERVER_ROOT, 'yt-dlp');
}

const DEFAULT_UA =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36';

/**
 * Spawn yt-dlp with shared defaults. Never uses a shell.
 * @returns {import('child_process').ChildProcess}
 */
function spawnYtDlp(args, { timeoutMs = 0, extraEnv = {}, cookies = undefined } = {}) {
  const ytDlpPath = resolveYtDlp();
  const finalArgs = [...args];

  // Auth: cookies.txt (writable user data dir first) → live browser cookies.
  // Callers may pass `cookies: { args }` to override (e.g. the version probe).
  const cookieConfig = cookies === undefined ? resolveCookieConfig() : cookies;
  if (cookieConfig && cookieConfig.args && cookieConfig.args.length) {
    finalArgs.push(...cookieConfig.args);
    console.log(`[ytdlp] auth: ${cookieConfig.method} (${cookieConfig.detail || '-'})`);
  }

  console.log(`[ytdlp] spawn: ${ytDlpPath} ${finalArgs.join(' ')}`);

  const child = spawn(ytDlpPath, finalArgs, {
    shell: false,
    detached: true, // own process group so we can kill the whole tree
    env: { ...process.env, ...extraEnv },
  });

  if (timeoutMs > 0) {
    const t = setTimeout(() => {
      if (child.exitCode === null && !child.killed) {
        child.kill('SIGKILL');
      }
    }, timeoutMs);
    child.once('close', () => clearTimeout(t));
  }

  return child;
}

module.exports = {
  spawnYtDlp,
  resolveYtDlp,
  describeBinary,
  resetYtDlpCache,
  managedPathFor,
  managedDir,
  usingLocalBinary,
  DEFAULT_UA,
};
