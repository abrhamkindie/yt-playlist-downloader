/**
 * Persistent, per-user settings for the desktop app.
 *
 * Why this exists: inside a packaged build (AppImage / .deb / NSIS) the app
 * bundle lives on a READ-ONLY or root-owned path, so anything the user has to
 * create by hand — cookies.txt, an updated yt-dlp binary — cannot live next to
 * the code. Everything writable therefore goes into a per-user data dir.
 *
 * Resolution order for the data dir:
 *   1. $STREAMPULL_DATA_DIR (tests / power users)
 *   2. Electron `app.getPath('userData')` (packaged desktop app)
 *   3. <server>/.appdata (plain `npm start` during development)
 */

const path = require('path');
const fs = require('fs');

const SERVER_ROOT = path.join(__dirname, '..');

/** Browsers yt-dlp knows how to pull cookies from (`--cookies-from-browser`). */
const BROWSER_SOURCES = [
    'brave',
    'chrome',
    'chromium',
    'edge',
    'firefox',
    'librewolf',
    'opera',
    'safari',
    'vivaldi',
    'whale',
];

function isElectron() {
    return Boolean(process.versions.electron);
}

function getDataDir() {
    if (process.env.STREAMPULL_DATA_DIR) return process.env.STREAMPULL_DATA_DIR;

    if (isElectron()) {
        try {
            const { app } = require('electron');
            if (app && typeof app.getPath === 'function') return app.getPath('userData');
        } catch {
            /* fall through to the dev location */
        }
    }
    return path.join(SERVER_ROOT, '.appdata');
}

/** Create (if needed) and return the writable data directory. */
function ensureDataDir() {
    const dir = getDataDir();
    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
        console.error(`[settings] could not create data dir ${dir}: ${err.message}`);
    }
    return dir;
}

const SETTINGS_FILE = () => path.join(getDataDir(), 'settings.json');

function readSettings() {
    try {
        const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8'));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

/** Shallow-merge `patch` into the stored settings and persist them. */
function writeSettings(patch = {}) {
    const next = { ...readSettings(), ...patch };
    try {
        ensureDataDir();
        fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(next, null, 2), { mode: 0o600 });
    } catch (err) {
        console.error(`[settings] write failed: ${err.message}`);
    }
    return next;
}

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------

/** Writable location the desktop UI saves cookies into. */
const cookiesFilePath = () => path.join(getDataDir(), 'cookies.txt');

/** Legacy/dev location (also the hosted-mode target written from env vars). */
const legacyCookiesPath = () => path.join(SERVER_ROOT, 'cookies.txt');

function isReadableFile(p) {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/**
 * Locations searched for a cookies.txt, most authoritative first.
 * An explicit $STREAMPULL_DATA_DIR means "this directory is the whole state",
 * which also keeps tests isolated from a stray cookies.txt in the repo.
 */
function cookieCandidatePaths() {
    return process.env.STREAMPULL_DATA_DIR
        ? [cookiesFilePath()]
        : [cookiesFilePath(), legacyCookiesPath()];
}

/** The cookies.txt actually in use, or null. */
function activeCookiesFile() {
    return cookieCandidatePaths().find(isReadableFile) || null;
}

/**
 * `chrome`, `firefox:Profile 1`, `brave:` — only the browser name is validated.
 * Returns null when the value is empty/`none`/unknown so we never pass a
 * garbage flag to yt-dlp.
 */
function normalizeBrowserSource(value) {
    if (typeof value !== 'string') return null;
    const name = value.trim().toLowerCase().split(':')[0];
    if (!name || name === 'none' || name === 'auto') return null;
    return BROWSER_SOURCES.includes(name) ? name : null;
}

/** `profile` part of a `browser:profile` spec, or null. */
function browserProfile(value) {
    if (typeof value !== 'string') return null;
    const parts = value.trim().split(':');
    const profile = parts.slice(1).join(':').trim();
    return profile && profile !== 'Default' ? profile : null;
}

/**
 * yt-dlp auth flags for the current configuration.
 * A cookies.txt file always wins (it is explicit and works with any browser);
 * otherwise we fall back to reading the user's live browser cookie store.
 * @returns {{ args: string[], method: 'file'|'browser'|'none', detail: string|null }}
 */
function resolveCookieConfig(settings) {
    const cfg = settings || readSettings();

    const file = activeCookiesFile();
    if (file) return { args: ['--cookies', file], method: 'file', detail: file };

    const browser = normalizeBrowserSource(cfg.cookiesFromBrowser);
    if (browser) {
        const profile = browserProfile(cfg.cookiesFromBrowser);
        const spec = profile ? `${browser}:${profile}` : browser;
        return { args: ['--cookies-from-browser', spec], method: 'browser', detail: spec };
    }

    return { args: [], method: 'none', detail: null };
}

/**
 * Sanity-check Netscape-format cookie text before writing it to disk, so a
 * pasted HTML page or a truncated export fails here with a clear message
 * instead of as a cryptic yt-dlp error on every download.
 * @returns {{ ok: boolean, count: number, error?: string }}
 */
function validateCookiesText(text) {
    if (typeof text !== 'string' || !text.trim()) {
        return { ok: false, count: 0, error: 'Cookie text is empty.' };
    }
    if (text.includes('\0')) {
        return { ok: false, count: 0, error: 'Cookie text is not valid text.' };
    }
    if (text.length > 1_000_000) {
        return { ok: false, count: 0, error: 'Cookie file is unexpectedly large (max 1 MB).' };
    }

    const lines = text.split(/\r?\n/);
    let count = 0;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const fields = line.split('\t');
        // Netscape format: domain, subdomain-flag, path, secure, expiry, name, value
        const looksLikeCookie =
            fields.length >= 7 &&
            /^(true|false)$/i.test(fields[3].trim()) &&
            /^[\d.]+$/.test(fields[4].trim()) &&
            fields[5].trim().length > 0;

        if (!looksLikeCookie) {
            return {
                ok: false,
                count,
                error: "This doesn't look like a Netscape cookies.txt file. Export with a “Get cookies.txt” style extension.",
            };
        }
        count += 1;
    }

    if (count === 0) {
        return { ok: false, count: 0, error: 'No cookies found in that text.' };
    }
    return { ok: true, count };
}

/** Persist pasted cookie text. Returns the path written. Throws on invalid input. */
function saveCookies(text) {
    const check = validateCookiesText(text);
    if (!check.ok) {
        const err = new Error(check.error);
        err.code = 'INVALID_COOKIES';
        throw err;
    }
    ensureDataDir();
    const dest = cookiesFilePath();
    fs.writeFileSync(dest, text.endsWith('\n') ? text : `${text}\n`, { mode: 0o600 });
    return { path: dest, count: check.count };
}

/** Remove saved cookies (both the writable copy and a stray legacy one). */
function clearCookies() {
    const removed = [];
    for (const p of cookieCandidatePaths()) {
        try {
            if (isReadableFile(p)) {
                fs.rmSync(p);
                removed.push(p);
            }
        } catch (err) {
            console.error(`[settings] could not remove ${p}: ${err.message}`);
        }
    }
    return removed;
}

module.exports = {
    SERVER_ROOT,
    BROWSER_SOURCES,
    getDataDir,
    ensureDataDir,
    readSettings,
    writeSettings,
    cookiesFilePath,
    legacyCookiesPath,
    cookieCandidatePaths,
    activeCookiesFile,
    resolveCookieConfig,
    normalizeBrowserSource,
    browserProfile,
    validateCookiesText,
    saveCookies,
    clearCookies,
};
