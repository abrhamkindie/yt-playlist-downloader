/**
 * Keeps yt-dlp fresh at runtime.
 *
 * This is the whole reason the desktop app works: YouTube changes something
 * upstream every few weeks and yt-dlp ships a fix within days. A packaged app
 * with a frozen binary would silently die, so on startup (and on demand from
 * the UI) we compare the bundled copy against the latest upstream release and
 * install the standalone binary for this platform into the per-user data dir.
 * `lib/ytdlp.js` prefers that managed copy over the bundled one.
 *
 * Never mutates the app bundle — it is read-only inside an AppImage/.deb.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

const { managedPathFor, resetYtDlpCache, describeBinary } = require('../lib/ytdlp');
const { readSettings, writeSettings, ensureDataDir } = require('../lib/settings');

const LATEST_RELEASE_API = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest';
const DIRECT_ASSET_URL = (asset) => `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;

/** How often we bother hitting the GitHub API on our own. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const VERSION_TIMEOUT_MS = 15_000;
const RELEASE_TIMEOUT_MS = 20_000;

/** In-flight/last result, so the UI can render immediately. */
const state = {
    checking: false,
    updating: false,
    lastResult: null,
    lastError: null,
};

function assetForPlatform(platform = process.platform, arch = process.arch) {
    if (platform === 'win32') return 'yt-dlp.exe';
    if (platform === 'darwin') return 'yt-dlp_macos';
    if (platform === 'linux') return arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
    return 'yt-dlp';
}

/**
 * Compare dotted numeric yt-dlp versions ("2026.10.28" vs "2026.9.9",
 * or a nightly like "2026.10.28.234512"). Missing segments count as 0.
 * @returns {-1|0|1}
 */
function compareVersions(a = '', b = '') {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i += 1) {
        const x = pa[i] || 0;
        const y = pb[i] || 0;
        if (x > y) return 1;
        if (x < y) return -1;
    }
    return 0;
}

function requestJson(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 5) return reject(new Error('Too many redirects'));
        const req = https.get(
            url,
            { headers: { 'User-Agent': 'StreamPull-desktop', Accept: 'application/vnd.github+json' } },
            (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    res.resume();
                    return resolve(requestJson(new URL(res.headers.location, url).href, redirects + 1));
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }
                let body = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    body += chunk;
                    if (body.length > 4_000_000) {
                        req.destroy();
                        reject(new Error('Response too large'));
                    }
                });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch {
                        reject(new Error('Invalid JSON from update server'));
                    }
                });
            },
        );
        req.on('error', reject);
        req.setTimeout(RELEASE_TIMEOUT_MS, () => {
            req.destroy(new Error('Update check timed out'));
        });
    });
}

function downloadFile(url, dest, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 5) return reject(new Error('Too many redirects'));
        const req = https.get(url, { headers: { 'User-Agent': 'StreamPull-desktop' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                return resolve(downloadFile(new URL(res.headers.location, url).href, dest, redirects + 1));
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${res.statusCode} while downloading yt-dlp`));
            }
            const tmp = `${dest}.download`;
            const file = fs.createWriteStream(tmp);
            let size = 0;
            res.on('data', (c) => {
                size += c.length;
            });
            res.pipe(file);
            file.on('finish', () => file.close(() => resolve({ tmp, size })));
            file.on('error', (err) => {
                fs.rmSync(tmp, { force: true });
                reject(err);
            });
        });
        req.on('error', (err) => reject(err));
        req.setTimeout(120_000, () => req.destroy(new Error('Download timed out')));
    });
}

/** Run `<bin> --version` and read the leading version token. */
function getVersion(bin, timeoutMs = VERSION_TIMEOUT_MS) {
    return new Promise((resolve) => {
        let child;
        try {
            child = spawn(bin, ['--version'], { shell: false });
        } catch {
            return resolve(null);
        }
        let out = '';
        const timer = setTimeout(() => {
            try {
                child.kill('SIGKILL');
            } catch {
                /* ignore */
            }
        }, timeoutMs);

        child.stdout.on('data', (d) => {
            out += d.toString();
        });
        child.on('error', () => {
            clearTimeout(timer);
            resolve(null);
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            const match = out.trim().match(/(\d+(?:\.\d+)+)/);
            resolve(code === 0 && match ? match[1] : null);
        });
    });
}

/**
 * Ask GitHub for the newest stable release.
 * @returns {Promise<{version: string, asset: string, url: string}>}
 */
async function getLatestRelease() {
    const json = await requestJson(LATEST_RELEASE_API);
    const version = String(json.tag_name || '').replace(/^v/, '');
    if (!version) throw new Error('Update server did not report a version');

    const asset = assetForPlatform();
    const names = new Set((json.assets || []).map((a) => a.name));
    // The zipapp `yt-dlp` is useless without Python — insist on a standalone.
    if (names.size > 0 && !names.has(asset)) {
        throw new Error(`Latest release has no ${asset} asset`);
    }
    return { version, asset, url: DIRECT_ASSET_URL(asset) };
}

/** What we know right now, for the UI. */
function getStatus() {
    const settings = readSettings();
    const ytdlp = settings.ytdlp || {};
    const binary = describeBinary();

    const currentVersion = ytdlp.currentVersion || null;
    const latestVersion = ytdlp.latestVersion || null;
    // No version on record means we could not run a binary at all — treat that
    // as "needs an update" so a machine without yt-dlp self-heals on first start.
    const updateAvailable = Boolean(
        latestVersion && (!currentVersion || compareVersions(latestVersion, currentVersion) > 0),
    );

    return {
        checking: state.checking,
        updating: state.updating,
        current: binary.path ? { path: binary.path, source: binary.source, version: currentVersion } : null,
        managed: ytdlp.managedVersion ? { version: ytdlp.managedVersion, installedAt: ytdlp.installedAt || null } : null,
        latest: latestVersion,
        lastCheckedAt: ytdlp.lastCheckAt || null,
        updateAvailable,
        upToDate: Boolean(currentVersion && compareVersions(latestVersion || '', currentVersion) <= 0),
        lastError: state.lastError || ytdlp.checkError || null,
        asset: assetForPlatform(),
    };
}

/** Compare installed vs upstream. Cached results are reused until stale. */
async function checkForUpdates({ force = false } = {}) {
    const settings = readSettings();
    const last = (settings.ytdlp || {}).lastCheckAt || 0;

    if (!force && Date.now() - last < CHECK_INTERVAL_MS && settings.ytdlp && settings.ytdlp.latestVersion) {
        return { ...getStatus(), cached: true };
    }

    state.checking = true;
    state.lastError = null;
    try {
        const release = await getLatestRelease();
        const binary = describeBinary();
        const currentVersion = binary.path ? await getVersion(binary.path) : null;

        writeSettings({
            ytdlp: {
                ...(settings.ytdlp || {}),
                latestVersion: release.version,
                currentVersion: currentVersion || (settings.ytdlp || {}).currentVersion || null,
                lastCheckAt: Date.now(),
                checkError: null,
            },
        });

        const result = {
            ...getStatus(),
            currentVersion,
            latestVersion: release.version,
            upToDate: Boolean(currentVersion && compareVersions(release.version, currentVersion) <= 0),
        };
        state.lastResult = result;
        return result;
    } catch (err) {
        state.lastError = err.message;
        writeSettings({ ytdlp: { ...(readSettings().ytdlp || {}), checkError: err.message, lastCheckAt: Date.now() } });
        throw err;
    } finally {
        state.checking = false;
    }
}

/**
 * Download the latest standalone binary into the managed dir and activate it.
 * @returns {Promise<{updated: boolean, version: string, path: string}>}
 */
async function updateNow() {
    if (state.updating) throw new Error('An update is already running');

    ensureDataDir();
    state.updating = true;
    try {
        const release = await getLatestRelease();
        const binary = describeBinary();
        const currentVersion = binary.path ? await getVersion(binary.path) : null;

        if (currentVersion && compareVersions(release.version, currentVersion) <= 0 && binary.source === 'managed') {
            return { updated: false, version: currentVersion, path: binary.path, reason: 'up-to-date' };
        }

        const dest = managedPathFor(release.asset);
        fs.mkdirSync(path.dirname(dest), { recursive: true });

        const { tmp, size } = await downloadFile(release.url, dest);
        try {
            fs.chmodSync(tmp, 0o755);

            // A truncated download must never replace a working binary.
            if (size < 1_000_000 || !fs.existsSync(tmp)) {
                throw new Error(`Downloaded file looks truncated (${size} bytes)`);
            }

            // Validate the candidate before it can break every download.
            const candidateVersion = await getVersion(tmp);
            if (!candidateVersion) {
                throw new Error('Downloaded yt-dlp did not run on this system — update aborted');
            }
            if (compareVersions(candidateVersion, release.version) < 0) {
                console.warn(`[ytdlp-updater] expected ${release.version}, binary reports ${candidateVersion}`);
            }

            const previous = fs.existsSync(dest) ? `${dest}.prev` : null;
            if (previous) {
                try {
                    fs.renameSync(dest, previous);
                } catch {
                    fs.rmSync(dest, { force: true });
                }
            }
            fs.renameSync(tmp, dest);
            fs.chmodSync(dest, 0o755);
            if (previous) fs.rmSync(previous, { force: true });

            resetYtDlpCache();
            const settings = readSettings();
            writeSettings({
                ytdlp: {
                    ...(settings.ytdlp || {}),
                    managedVersion: candidateVersion,
                    currentVersion: candidateVersion,
                    latestVersion: release.version,
                    installedAt: Date.now(),
                    lastCheckAt: Date.now(),
                    checkError: null,
                },
            });

            console.log(`[ytdlp-updater] installed ${candidateVersion} (${(size / (1024 * 1024)).toFixed(1)} MB) -> ${dest}`);
            return { updated: true, version: candidateVersion, path: dest };
        } finally {
            fs.rmSync(tmp, { force: true });
        }
    } finally {
        state.updating = false;
    }
}

/**
 * Background refresh on app start: check, and update when a newer release
 * exists. Failures are logged and surfaced through the UI — they must never
 * block the app from opening.
 * @param {object} [options]
 * @param {(event: string, payload: any) => void} [options.emit] socket emitter
 * @param {() => boolean} [options.isBusy] true while downloads are running
 */
async function autoUpdate({ emit, isBusy } = {}) {
    const safeEmit = (event, payload) => {
        try {
            if (emit) emit(event, payload);
        } catch {
            /* socket not ready */
        }
    };

    try {
        const check = await checkForUpdates();
        safeEmit('ytdlp-status', check);
        if (!check.updateAvailable) return check;

        if (isBusy && isBusy()) {
            console.log('[ytdlp-updater] update available but downloads are active — deferring');
            return { ...check, deferred: true };
        }

        const result = await updateNow();
        safeEmit('ytdlp-updated', result);
        return result;
    } catch (err) {
        state.lastError = err.message;
        console.error(`[ytdlp-updater] ${err.message}`);
        safeEmit('ytdlp-update-error', { error: err.message });
        return { error: err.message };
    }
}

module.exports = {
    assetForPlatform,
    compareVersions,
    getLatestRelease,
    getVersion,
    getStatus,
    checkForUpdates,
    updateNow,
    autoUpdate,
    CHECK_INTERVAL_MS,
    LATEST_RELEASE_API,
};
