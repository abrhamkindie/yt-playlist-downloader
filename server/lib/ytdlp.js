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

// undefined = not probed yet, null = none found, string = absolute path to a
// JS runtime (node/deno/bun) that yt-dlp uses to solve YouTube's signature
// cipher. Without a runtime, modern yt-dlp reports "format not available".
let cachedRuntime;
// True when cachedRuntime is the Electron binary (needs ELECTRON_RUN_AS_NODE=1).
let cachedRuntimeIsElectron = false;

/** Locate a JS runtime yt-dlp can use for signature extraction. */
function resolveJsRuntime() {
  if (cachedRuntime !== undefined) return cachedRuntime;

  cachedRuntimeIsElectron = false;

  // Explicit override wins (e.g. a bundled deno shipped with the app).
  const override = process.env.YTDLP_JS_RUNTIME;
  if (override && isExecutable(override)) {
    cachedRuntime = override;
    return cachedRuntime;
  }

  const exe = process.platform === 'win32' ? 'node.exe' : 'node';
  const candidates = [];

  // 1. Anything named node/deno/bun on PATH.
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    candidates.push(
      path.join(dir, exe),
      path.join(dir, process.platform === 'win32' ? 'deno.exe' : 'deno'),
      path.join(dir, process.platform === 'win32' ? 'bun.exe' : 'bun'),
    );
  }

  // 2. Common absolute install locations.
  candidates.push(
    '/usr/bin/node',
    '/usr/local/bin/node',
    '/opt/homebrew/bin/node',
    '/usr/bin/deno',
    '/usr/local/bin/deno',
    path.join(process.env.HOME || '', '.deno', 'bin', 'deno'),
  );

  for (const c of candidates) {
    if (c && isExecutable(c)) {
      cachedRuntime = c;
      return cachedRuntime;
    }
  }

  // 3. No system runtime — reuse the Node.js baked into Electron. The Electron
  //    binary behaves exactly like node when ELECTRON_RUN_AS_NODE=1 is set in
  //    the spawned environment (handled in spawnYtDlp). This keeps packaged
  //    desktop apps working on machines that have no node/deno installed.
  if (process.versions && process.versions.electron) {
    cachedRuntime = process.execPath;
    cachedRuntimeIsElectron = true;
    return cachedRuntime;
  }

  cachedRuntime = null;
  return cachedRuntime;
}

/** Human label for the resolved runtime, surfaced in the settings UI. */
function describeJsRuntime() {
  const r = resolveJsRuntime();
  if (!r) return null;
  return { path: r, name: cachedRuntimeIsElectron ? 'electron (bundled node)' : path.basename(r) };
}

/**
 * Spawn yt-dlp with shared defaults. Never uses a shell.
 * @returns {import('child_process').ChildProcess}
 */
function spawnYtDlp(args, { timeoutMs = 0, extraEnv = {}, cookies = undefined } = {}) {
  const ytDlpPath = resolveYtDlp();
  const finalArgs = [...args];

  // Prepend a JS runtime so yt-dlp can solve YouTube's signature cipher and
  // actually see the available formats. Skip if the caller already set one.
  const runtime = resolveJsRuntime();
  const spawnEnv = { ...process.env, ...extraEnv };
  if (runtime && !finalArgs.includes('--js-runtimes')) {
    const kind = /deno/i.test(runtime) ? 'deno' : /bun/i.test(runtime) ? 'bun' : 'node';
    finalArgs.unshift('--js-runtimes', `${kind}:${runtime}`);
    // When reusing Electron's node, the child (yt-dlp) must pass ELECTRON_RUN_AS_NODE
    // down to the runtime it spawns so the Electron binary behaves as plain node.
    if (cachedRuntimeIsElectron) spawnEnv.ELECTRON_RUN_AS_NODE = '1';
  }

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
    env: spawnEnv,
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
  resolveJsRuntime,
  describeJsRuntime,
  DEFAULT_UA,
};
