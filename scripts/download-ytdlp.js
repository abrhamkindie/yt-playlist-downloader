#!/usr/bin/env node
/**
 * Downloads a standalone yt-dlp binary into server/ so the packaged desktop
 * app ships with its own copy (no Python / no PATH dependency required).
 *
 * Usage:
 *   node scripts/download-ytdlp.js [--force]
 *
 * The asset chosen depends on the current platform/arch, matching what
 * electron-builder packages. Build for a given OS on that OS (or via a CI
 * matrix) so the bundled binary matches the target.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const SERVER_ROOT = path.join(__dirname, '..', 'server');

function assetForPlatform() {
    const plat = process.platform;
    const arch = process.arch;
    if (plat === 'win32') return 'yt-dlp.exe';
    if (plat === 'darwin') return 'yt-dlp_macos';
    if (plat === 'linux') {
        return arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
    }
    throw new Error(`Unsupported platform for bundled yt-dlp: ${plat}/${arch}`);
}

/** Follow redirects (GitHub /latest/download/... 302s to the tagged asset). */
function download(url, dest, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 5) return reject(new Error('Too many redirects'));
        https
            .get(url, { headers: { 'User-Agent': 'StreamPull-build' } }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return resolve(download(res.headers.location, dest, redirects + 1));
                }
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
                }
                const tmp = `${dest}.download`;
                const file = fs.createWriteStream(tmp);
                res.pipe(file);
                file.on('finish', () => {
                    file.close(() => {
                        fs.renameSync(tmp, dest);
                        resolve(dest);
                    });
                });
                file.on('error', reject);
            })
            .on('error', reject);
    });
}

async function main() {
    const force = process.argv.includes('--force');
    const asset = process.env.YTDLP_ASSET || assetForPlatform();
    const url =
        process.env.YTDLP_URL ||
        `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
    const dest = path.join(SERVER_ROOT, asset);

    if (fs.existsSync(dest) && !force) {
        console.log(`[yt-dlp] Already present at ${dest} (use --force to refresh).`);
        return;
    }

    console.log(`[yt-dlp] Downloading ${asset} -> ${dest}`);
    await download(url, dest);

    if (process.platform !== 'win32') {
        fs.chmodSync(dest, 0o755);
    }
    const sizeMb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1);
    console.log(`[yt-dlp] Done (${sizeMb} MB).`);
}

main().catch((err) => {
    console.error('[yt-dlp] Failed:', err.message);
    process.exit(1);
});
