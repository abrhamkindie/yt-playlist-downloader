/**
 * Keeps the DESKTOP APP itself fresh.
 *
 * The yt-dlp engine updater (services/ytdlpUpdater) keeps downloads working, but
 * it can't deliver new app features — those ship as GitHub Releases
 * (AppImage / .deb / .dmg / .exe). On startup and on demand from the Desktop
 * settings UI we compare the running version against the latest published
 * release and surface a one-click "Download update" that opens the release page
 * in the user's browser.
 *
 * We deliberately do NOT auto-install: replacing a running, unsigned Electron
 * app reliably across Linux/Windows/macOS needs code signing + a privileged
 * updater. Pointing the user at the official release is honest and safe.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const { PROJECT_ROOT } = require('../lib/config');
const { readSettings, writeSettings } = require('../lib/settings');

const REPO = process.env.APP_REPO || 'abrhamkindie/yt-playlist-downloader';
const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;

/** How often we bother hitting the GitHub API on our own. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const RELEASE_TIMEOUT_MS = 15_000;

const state = { checking: false, lastError: null };

/** The version of the running app: Electron's authoritative value, else package.json. */
function currentVersion() {
    if (process.env.APP_VERSION) return String(process.env.APP_VERSION).replace(/^v/, '');
    try {
        if (process.versions && process.versions.electron) {
            // eslint-disable-next-line global-require
            const { app } = require('electron');
            if (app && typeof app.getVersion === 'function') {
                return String(app.getVersion()).replace(/^v/, '');
            }
        }
    } catch {
        /* app not available (renderer / plain node) */
    }
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
        return String(pkg.version || '').replace(/^v/, '') || null;
    } catch {
        return null;
    }
}

/**
 * Compare dotted numeric semver ("1.2.1" vs "1.10.0"). Missing segments count
 * as 0; a leading "v" and any pre-release/build suffix are ignored.
 * @returns {-1|0|1}
 */
function compareVersions(a = '', b = '') {
    const clean = (s) =>
        String(s)
            .trim()
            .replace(/^v/i, '')
            .split(/[+-]/)[0];
    const pa = clean(a).split('.').map((n) => parseInt(n, 10) || 0);
    const pb = clean(b).split('.').map((n) => parseInt(n, 10) || 0);
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
        req.setTimeout(RELEASE_TIMEOUT_MS, () => req.destroy(new Error('Update check timed out')));
    });
}

/** What we know right now, for the UI. */
function getStatus() {
    const app = readSettings().app || {};
    const current = currentVersion();
    const latest = app.latestVersion || null;
    const updateAvailable = Boolean(latest && current && compareVersions(latest, current) > 0);

    return {
        checking: state.checking,
        currentVersion: current,
        latestVersion: latest,
        updateAvailable,
        upToDate: Boolean(latest && current && compareVersions(latest, current) <= 0),
        releaseUrl: app.releaseUrl || `https://github.com/${REPO}/releases/latest`,
        publishedAt: app.publishedAt || null,
        lastCheckedAt: app.lastCheckAt || null,
        lastError: state.lastError || app.checkError || null,
        repo: REPO,
    };
}

/** Compare running app vs the newest GitHub Release. Cached until stale. */
async function checkForUpdates({ force = false } = {}) {
    const settings = readSettings();
    const last = (settings.app || {}).lastCheckAt || 0;

    if (!force && Date.now() - last < CHECK_INTERVAL_MS && (settings.app || {}).latestVersion) {
        return { ...getStatus(), cached: true };
    }

    state.checking = true;
    state.lastError = null;
    try {
        const json = await requestJson(LATEST_RELEASE_API);
        const version = String(json.tag_name || '').replace(/^v/, '');
        if (!version) throw new Error('Update server did not report a version');

        writeSettings({
            app: {
                ...(settings.app || {}),
                latestVersion: version,
                releaseUrl: json.html_url || `https://github.com/${REPO}/releases/tag/${json.tag_name}`,
                publishedAt: json.published_at || null,
                lastCheckAt: Date.now(),
                checkError: null,
            },
        });

        return getStatus();
    } catch (err) {
        state.lastError = err.message;
        writeSettings({
            app: { ...(readSettings().app || {}), checkError: err.message, lastCheckAt: Date.now() },
        });
        throw err;
    } finally {
        state.checking = false;
    }
}

module.exports = {
    REPO,
    LATEST_RELEASE_API,
    CHECK_INTERVAL_MS,
    currentVersion,
    compareVersions,
    getStatus,
    checkForUpdates,
};
