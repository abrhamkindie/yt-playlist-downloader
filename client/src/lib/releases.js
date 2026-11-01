/**
 * Single source of truth for the desktop-app download portal.
 *
 * Links point at `/releases/latest/download/<asset>` so they keep working when
 * a new version is published — the visible version badge is cosmetic and is
 * injected at build time from the root package.json (see client/vite.config.js).
 */

const REPO = import.meta.env.VITE_GITHUB_REPO || 'abrhamkindie/yt-playlist-downloader';

export const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'latest';

export const RELEASES_URL = `https://github.com/${REPO}/releases`;
export const LATEST_URL = `https://github.com/${REPO}/releases/latest`;
export const REPO_URL = `https://github.com/${REPO}`;

const DIRECT_ASSET_URL = `${LATEST_URL}/download`;

/**
 * Terminal install for Linux. Served from the default branch (`HEAD`) rather
 * than from a release asset so the command works the moment it is merged — the
 * script itself always installs from `releases/latest`.
 */
export const INSTALL_SCRIPT_URL = `https://raw.githubusercontent.com/${REPO}/HEAD/scripts/install.sh`;
export const INSTALL_CMD = `curl -fsSL ${INSTALL_SCRIPT_URL} | bash`;

/**
 * iconKey is resolved to a component by the UI (this module stays JSX-free).
 */
export const OS_TABS = [
    {
        id: 'windows',
        label: 'Windows',
        iconKey: 'monitor',
        note: 'Windows 10 / 11 · x64',
        assets: [
            {
                label: 'Installer (.exe)',
                href: `${DIRECT_ASSET_URL}/StreamPull-Setup.exe`,
                primary: true,
                size: '~124 MB',
            },
        ],
    },
    {
        id: 'macos',
        label: 'macOS',
        iconKey: 'apple',
        note: 'Apple Silicon (M1–M4)',
        assets: [
            {
                label: 'Disk Image (.dmg)',
                href: `${DIRECT_ASSET_URL}/StreamPull-arm64.dmg`,
                primary: true,
                size: '~152 MB',
            },
        ],
    },
    {
        id: 'linux',
        label: 'Linux',
        iconKey: 'laptop',
        note: 'x86_64 · AppImage, .deb, .rpm or tarball',
        installCommand: INSTALL_CMD,
        assets: [
            {
                label: 'AppImage',
                href: `${DIRECT_ASSET_URL}/StreamPull-x86_64.AppImage`,
                primary: true,
                size: '~173 MB',
            },
            {
                label: 'Debian (.deb)',
                href: `${DIRECT_ASSET_URL}/StreamPull-amd64.deb`,
                primary: false,
                size: '~132 MB',
            },
            {
                label: 'Fedora/openSUSE (.rpm)',
                href: `${DIRECT_ASSET_URL}/StreamPull-x86_64.rpm`,
                primary: false,
                size: null,
            },
            {
                label: 'Tarball (.tar.gz)',
                href: `${DIRECT_ASSET_URL}/StreamPull-x64.tar.gz`,
                primary: false,
                ghost: true,
                size: '~166 MB',
            },
        ],
    },
];

/** Best-effort visitor OS detection — defaults to Linux (our primary audience). */
export function detectOS() {
    if (typeof navigator === 'undefined') return 'linux';
    const ua = navigator.userAgent || '';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Mac|iPhone|iPad/i.test(ua)) return 'macos';
    return 'linux';
}

export function getOsTab(id) {
    return OS_TABS.find((t) => t.id === id) || OS_TABS[OS_TABS.length - 1];
}

/** The one-click download for a platform (first `primary` asset). */
export function getPrimaryAsset(id) {
    const tab = getOsTab(id);
    return tab.assets.find((a) => a.primary) || tab.assets[0];
}
