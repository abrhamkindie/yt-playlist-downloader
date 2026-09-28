const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.join(__dirname, '..');

let cachedResolver = null;

/**
 * Locate a yt-dlp binary, preferring:
 *  1. $YTDLP_PATH env var
 *  2. ./server/yt-dlp local binary (dev convenience)
 *  3. system yt-dlp on PATH
 * Throws when none is found.
 */
function resolveYtDlp() {
  if (cachedResolver) return cachedResolver;

  const candidates = [];
  if (process.env.YTDLP_PATH) candidates.push(process.env.YTDLP_PATH);
  candidates.push(path.join(SERVER_ROOT, 'yt-dlp'), 'yt-dlp');

  for (const candidate of candidates) {
    if (candidate.includes(path.sep) || candidate.includes('/')) {
      if (fs.existsSync(candidate)) {
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

/** Is the resolved binary our committed local binary (deprecated)? */
function usingLocalBinary() {
  const resolved = resolveYtDlp();
  return resolved.includes('server') && resolved.endsWith('yt-dlp');
}

const DEFAULT_UA =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36';

/**
 * Spawn yt-dlp with shared defaults. Never uses a shell.
 * @returns {import('child_process').ChildProcess}
 */
function spawnYtDlp(args, { timeoutMs = 0, extraEnv = {} } = {}) {
  const ytDlpPath = resolveYtDlp();
  const finalArgs = [...args];

  const cookiesPath = path.join(SERVER_ROOT, 'cookies.txt');
  if (fs.existsSync(cookiesPath)) {
    finalArgs.push('--cookies', cookiesPath);
    console.log('[ytdlp] Using cookies for authentication');
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

module.exports = { spawnYtDlp, resolveYtDlp, usingLocalBinary, DEFAULT_UA };
