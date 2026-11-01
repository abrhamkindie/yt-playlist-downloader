/**
 * Desktop-mode plumbing: writable settings/cookies + yt-dlp self-update.
 * These are the pieces that keep a packaged build usable, so the pure logic
 * is covered here without touching the network.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const settings = require('../lib/settings');
const updater = require('../services/ytdlpUpdater');
const appUpdater = require('../services/appUpdater');
const { friendlyYtdlpError } = require('../lib/errors');

let dataDir;
let prevDataDirEnv;

beforeEach(() => {
    prevDataDirEnv = process.env.STREAMPULL_DATA_DIR;
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streampull-data-'));
    process.env.STREAMPULL_DATA_DIR = dataDir;
});

afterEach(() => {
    if (prevDataDirEnv === undefined) delete process.env.STREAMPULL_DATA_DIR;
    else process.env.STREAMPULL_DATA_DIR = prevDataDirEnv;
    delete process.env.APP_VERSION;
    fs.rmSync(dataDir, { recursive: true, force: true });
});

const VALID_COOKIES = [
    '# Netscape HTTP Cookie File',
    '# https://curl.haxx.se/docs/http-cookies.html',
    '.youtube.com\tTRUE\t/\tFALSE\t1893456000\tSACSID\tAQwRAQABAQ',
    '.youtube.com\tTRUE\t/\tFALSE\t1893456000\t__Secure-1PSID\ta.b.c',
].join('\n');

describe('validateCookiesText', () => {
    test('accepts a Netscape export and counts the cookies', () => {
        const res = settings.validateCookiesText(VALID_COOKIES);
        assert.strictEqual(res.ok, true);
        assert.strictEqual(res.count, 2);
    });

    test('accepts a bare cookie line without the header comment', () => {
        assert.strictEqual(settings.validateCookiesText('.youtube.com\tTRUE\t/\tFALSE\t1893456000\tX\tY').ok, true);
    });

    test('rejects pasted HTML with a friendly message', () => {
        const res = settings.validateCookiesText('<html><body><h1>Sign in</h1></body></html>');
        assert.strictEqual(res.ok, false);
        assert.match(res.error, /Netscape/);
    });

    test('rejects empty input and header-only files', () => {
        assert.strictEqual(settings.validateCookiesText('').ok, false);
        assert.strictEqual(settings.validateCookiesText('# Netscape HTTP Cookie File').ok, false);
        assert.strictEqual(settings.validateCookiesText(null).ok, false);
    });

    test('rejects an absurdly large payload', () => {
        const res = settings.validateCookiesText('x'.repeat(1_100_000));
        assert.strictEqual(res.ok, false);
        assert.match(res.error, /large/);
    });
});

describe('saveCookies / clearCookies', () => {
    test('writes into the writable data dir, not the app bundle', () => {
        const saved = settings.saveCookies(VALID_COOKIES);
        assert.strictEqual(saved.path, path.join(dataDir, 'cookies.txt'));
        assert.ok(fs.existsSync(saved.path));
        if (process.platform !== 'win32') {
            assert.strictEqual(fs.statSync(saved.path).mode & 0o777, 0o600);
        }
    });

    test('throws INVALID_COOKIES instead of writing junk', () => {
        assert.throws(
            () => settings.saveCookies('not a cookie file'),
            (err) => err.code === 'INVALID_COOKIES' && /Netscape/.test(err.message),
        );
        assert.strictEqual(settings.activeCookiesFile(), null);
    });

    test('clearCookies removes the saved file', () => {
        settings.saveCookies(VALID_COOKIES);
        assert.ok(settings.activeCookiesFile());
        const removed = settings.clearCookies();
        assert.strictEqual(removed.length, 1);
        assert.strictEqual(settings.activeCookiesFile(), null);
    });
});

describe('browser cookie sources', () => {
    test('normalizes names and drops unknown ones', () => {
        assert.strictEqual(settings.normalizeBrowserSource('  Chrome '), 'chrome');
        assert.strictEqual(settings.normalizeBrowserSource('firefox:Profile 1'), 'firefox');
        assert.strictEqual(settings.normalizeBrowserSource('safari'), 'safari');
        assert.strictEqual(settings.normalizeBrowserSource('none'), null);
        assert.strictEqual(settings.normalizeBrowserSource(''), null);
        assert.strictEqual(settings.normalizeBrowserSource(null), null);
        assert.strictEqual(settings.normalizeBrowserSource('notepad'), null);
        assert.strictEqual(settings.normalizeBrowserSource('../../etc/passwd'), null);
    });

    test('extracts the profile but ignores the implicit Default', () => {
        assert.strictEqual(settings.browserProfile('firefox:Profile 1'), 'Profile 1');
        assert.strictEqual(settings.browserProfile('chrome:Default'), null);
        assert.strictEqual(settings.browserProfile('chrome'), null);
    });
});

describe('resolveCookieConfig', () => {
    test('a cookies.txt file wins over a browser source', () => {
        settings.writeSettings({ cookiesFromBrowser: 'chrome' });
        settings.saveCookies(VALID_COOKIES);
        const cfg = settings.resolveCookieConfig();
        assert.strictEqual(cfg.method, 'file');
        assert.deepStrictEqual(cfg.args, ['--cookies', path.join(dataDir, 'cookies.txt')]);
    });

    test('falls back to --cookies-from-browser with the profile preserved', () => {
        const cfg = settings.resolveCookieConfig({ cookiesFromBrowser: 'firefox:Profile 1' });
        assert.strictEqual(cfg.method, 'browser');
        assert.deepStrictEqual(cfg.args, ['--cookies-from-browser', 'firefox:Profile 1']);
    });

    test('returns no auth flags when nothing is configured', () => {
        assert.deepStrictEqual(settings.resolveCookieConfig({}), { args: [], method: 'none', detail: null });
    });

    test('ignores an unknown persisted browser value instead of passing a bad flag', () => {
        const cfg = settings.resolveCookieConfig({ cookiesFromBrowser: 'totally-legit; rm -rf /' });
        assert.strictEqual(cfg.method, 'none');
        assert.deepStrictEqual(cfg.args, []);
    });
});

describe('settings store', () => {
    test('survives a corrupt file and merges patches', () => {
        fs.writeFileSync(path.join(dataDir, 'settings.json'), '{ not json');
        assert.deepStrictEqual(settings.readSettings(), {});
        settings.writeSettings({ a: 1 });
        settings.writeSettings({ b: 2 });
        assert.deepStrictEqual(settings.readSettings(), { a: 1, b: 2 });
    });
});

describe('ytdlpUpdater.compareVersions', () => {
    test('orders dotted releases correctly', () => {
        assert.strictEqual(updater.compareVersions('2026.10.28', '2026.10.28'), 0);
        assert.strictEqual(updater.compareVersions('2026.10.29', '2026.10.28'), 1);
        assert.strictEqual(updater.compareVersions('2026.9.9', '2026.10.1'), -1);
        assert.strictEqual(updater.compareVersions('2025.12.31', '2026.1.1'), -1);
        assert.strictEqual(updater.compareVersions('2026.10.28.234512', '2026.10.28'), 1);
        assert.strictEqual(updater.compareVersions('2026.10', '2026.10.0'), 0);
        assert.strictEqual(updater.compareVersions('', '2026.1.1'), -1);
    });
});

describe('ytdlpUpdater.needsFetch', () => {
    // Regression: "Reinstall" used to answer "already current" and download
    // nothing. The button label is a promise, so the flag has to win.
    test('an explicit reinstall always downloads, even when current and managed', () => {
        assert.strictEqual(
            updater.needsFetch({
                reinstall: true,
                currentVersion: '2026.10.26',
                latestVersion: '2026.10.26',
                source: 'managed',
            }),
            true,
        );
    });

    test('a current managed copy needs no fetch for a plain update click', () => {
        assert.strictEqual(
            updater.needsFetch({
                reinstall: false,
                currentVersion: '2026.10.26',
                latestVersion: '2026.10.26',
                source: 'managed',
            }),
            false,
        );
    });

    test('a newer release is always fetched', () => {
        assert.strictEqual(
            updater.needsFetch({
                reinstall: false,
                currentVersion: '2025.1.15',
                latestVersion: '2026.10.26',
                source: 'managed',
            }),
            true,
        );
    });

    test('an unreadable installed version self-heals', () => {
        assert.strictEqual(updater.needsFetch({ currentVersion: null, latestVersion: '2026.10.26', source: 'managed' }), true);
        assert.strictEqual(updater.needsFetch({ currentVersion: '', latestVersion: '2026.10.26', source: 'managed' }), true);
    });

    test('a current but bundled/system copy is pulled into the managed dir', () => {
        // Otherwise future updates have nothing writable to replace.
        for (const source of ['bundled', 'system', 'env', null]) {
            assert.strictEqual(
                updater.needsFetch({ reinstall: false, currentVersion: '2026.10.26', latestVersion: '2026.10.26', source }),
                true,
                `source ${source} should be migrated`,
            );
        }
    });

    test('no arguments at all means fetch, never a silent no-op', () => {
        assert.strictEqual(updater.needsFetch(), true);
    });
});

describe('ytdlpUpdater asset selection', () => {
    test('picks a standalone binary per platform', () => {
        assert.strictEqual(updater.assetForPlatform('win32', 'x64'), 'yt-dlp.exe');
        assert.strictEqual(updater.assetForPlatform('darwin', 'arm64'), 'yt-dlp_macos');
        assert.strictEqual(updater.assetForPlatform('linux', 'x64'), 'yt-dlp_linux');
        assert.strictEqual(updater.assetForPlatform('linux', 'arm64'), 'yt-dlp_linux_aarch64');
    });

    test('getStatus reports the resolved binary and its tier', () => {
        const status = updater.getStatus();
        assert.ok(status.asset);
        // Never throw when nothing is installed — the UI must still render.
        assert.ok(status.current === null || ['env', 'managed', 'bundled', 'system'].includes(status.current.source));
    });
});

describe('ytdlpUpdater.getStatus update flags', () => {
    test('an unknown installed version means the engine must be fetched', () => {
        settings.writeSettings({ ytdlp: { latestVersion: '2026.10.26' } });
        const status = updater.getStatus();
        assert.strictEqual(status.updateAvailable, true);
        assert.strictEqual(status.upToDate, false);
    });

    test('a current version is reported up to date', () => {
        settings.writeSettings({ ytdlp: { latestVersion: '2026.10.26', currentVersion: '2026.10.26' } });
        const status = updater.getStatus();
        assert.strictEqual(status.updateAvailable, false);
        assert.strictEqual(status.upToDate, true);
    });

    test('an older copy reports an available update', () => {
        settings.writeSettings({ ytdlp: { latestVersion: '2026.10.26', currentVersion: '2025.1.15' } });
        assert.strictEqual(updater.getStatus().updateAvailable, true);
    });

    test('nothing is promised before the first successful check', () => {
        settings.writeSettings({ ytdlp: {} });
        const status = updater.getStatus();
        assert.strictEqual(status.updateAvailable, false);
        assert.strictEqual(status.latest, null);
    });
});

describe('appUpdater.compareVersions', () => {
    test('treats a leading v and short forms as equal', () => {
        assert.strictEqual(appUpdater.compareVersions('v1.2.1', '1.2.1'), 0);
        assert.strictEqual(appUpdater.compareVersions('1.2', '1.2.0'), 0);
    });

    test('orders semver numerically, not lexically', () => {
        assert.strictEqual(appUpdater.compareVersions('1.10.0', '1.9.9'), 1);
        assert.strictEqual(appUpdater.compareVersions('1.2.0', '1.2.1'), -1);
        assert.strictEqual(appUpdater.compareVersions('', '1.0.0'), -1);
    });

    test('ignores pre-release/build suffixes', () => {
        assert.strictEqual(appUpdater.compareVersions('1.2.1-rc1', '1.2.1'), 0);
        assert.strictEqual(appUpdater.compareVersions('1.2.1+build7', '1.2.0'), 1);
    });
});

describe('appUpdater.getStatus update flags', () => {
    test('a newer published release reports an available update', () => {
        process.env.APP_VERSION = '1.2.1';
        settings.writeSettings({ app: { latestVersion: '1.3.0' } });
        const status = appUpdater.getStatus();
        assert.strictEqual(status.currentVersion, '1.2.1');
        assert.strictEqual(status.updateAvailable, true);
        assert.strictEqual(status.upToDate, false);
    });

    test('the running build being newest reports up to date', () => {
        process.env.APP_VERSION = '1.3.0';
        settings.writeSettings({ app: { latestVersion: '1.3.0' } });
        const status = appUpdater.getStatus();
        assert.strictEqual(status.updateAvailable, false);
        assert.strictEqual(status.upToDate, true);
    });

    test('nothing is promised before the first successful check', () => {
        process.env.APP_VERSION = '1.2.1';
        settings.writeSettings({ app: {} });
        const status = appUpdater.getStatus();
        assert.strictEqual(status.updateAvailable, false);
        assert.strictEqual(status.upToDate, false);
        assert.strictEqual(status.latestVersion, null);
    });

    test('falls back to the public releases page for the download link', () => {
        process.env.APP_VERSION = '1.0.0';
        settings.writeSettings({ app: { latestVersion: '9.9.9' } });
        assert.match(appUpdater.getStatus().releaseUrl, /github\.com\/.+\/releases\/latest$/);
    });
});

describe('cookie-aware error messages', () => {
    test('a locked/undecryptable browser cookie store points at Settings', () => {
        const msg = friendlyYtdlpError('ERROR: could not decrypt cookie store for key: bad decrypt');
        assert.match(msg, /Cookie source failed/);
        assert.match(msg, /Settings/);
    });

    test('bot detection tells the user to enable cookies and update', () => {
        const msg = friendlyYtdlpError('ERROR: Sign in to confirm you are not a bot');
        assert.match(msg, /bot detection/i);
        assert.match(msg, /Settings/);
    });
});

describe('yt-dlp binary resolution prefers the managed copy', () => {
    test('a self-updated binary in the data dir beats the bundled one', () => {
        const { resetYtDlpCache, resolveYtDlp, describeBinary, managedPathFor } = require('../lib/ytdlp');
        resetYtDlpCache();
        try {
            const dest = managedPathFor(updater.assetForPlatform());
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, '#!/bin/sh\nexit 0\n', { mode: 0o755 });

            assert.strictEqual(resolveYtDlp(), dest);
            assert.strictEqual(describeBinary(dest).source, 'managed');
        } finally {
            resetYtDlpCache();
        }
    });
});
