# YouTube Playlist Downloader

StreamPull is a **desktop app** (Electron + yt-dlp + ffmpeg) with a React frontend and a Node.js backend that runs on your own machine. The public website is a **download portal** for that app — it never downloads anything itself.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3E18-brightgreen.svg)

## Features

- 📺 Download individual videos or entire playlists
- 🎵 Audio-only downloads (MP3, M4A, WAV)
- 🎬 Video downloads (MP4, WebM, MKV)
- 📊 Real-time progress with speed and ETA
- 🎯 Quality selection (Best → 360p)
- 🚀 Concurrent downloads with queue management (3 parallel by default)
- 🔎 Search/filter, select-all, and batch summary progress
- 🖥️ Desktop app (Electron): local saving with native folder picker, cookies, self-updating yt-dlp
- 🌐 Website (`NODE_ENV=production`): download portal — platform detection, installer links, no dead-end downloads
- 🛡️ Security hardened: no shell interpolation, rate limiting, path confinement
- 🔄 Cancel individual downloads or everything at once

## Modes

| | 🖥️ Desktop / Electron | 🌐 Hosted (e.g. Render) |
|---|---|---|
| Trigger | Electron (`npm run app`) or plain `npm start` locally | `NODE_ENV=production` and not Electron |
| What you get | The full downloader UI | A portal that links to the released builds |
| Downloads | Written to your disk via native folder picker | Not performed — `POST /api/analyze` and `/api/download` answer **410** |
| Path / open-folder / settings APIs | Enabled | Not registered |
| Cookie & yt-dlp updates | Yours (settings panel, background checks) | Irrelevant: the server never touches a video |

The client decides which of the two to render by asking `GET /api/status`; if the answer is missing, an error, or slow, it shows the portal (a desktop app always has a local server answering).

## Project Structure

```
├── client/                     # React 19 + Vite + Tailwind v4
│   └── src/
│       ├── components/
│       │   ├── HostedPortal.jsx           # website: download portal (hero + steps + builds)
│       │   ├── DesktopDownloadSection.jsx # website: platform tabs + installer links
│       │   ├── DesktopApp.jsx             # desktop: analyze → select → download
│       │   ├── Header.jsx / Footer.jsx / HeroSection.jsx
│       │   ├── VideoList.jsx / VideoCard.jsx / VideoControls.jsx
│       │   ├── SummaryBar.jsx / StatusBanner.jsx / ErrorModal.jsx
│       │   └── SettingsPanel.jsx          # desktop only: cookies + yt-dlp/app updates
│       ├── hooks/
│       │   └── useDownloadSocket.js  # single socket connection + download state
│       ├── lib/
│       │   ├── api.js          # fetch wrapper for all endpoints
│       │   ├── constants.js    # formats/qualities (mirrors server)
│       │   └── releases.js     # release URLs, per-OS assets, install command, OS detection
│       ├── App.jsx             # probes /api/status → portal or desktop app
│   └── main.jsx
│
├── scripts/
│   ├── install.sh            # Linux terminal installer (curl | bash)
│   └── download-ytdlp.js     # fetches the yt-dlp binary for the app bundle
│
├── server/
│   ├── lib/                    # config, constants, errors, files, ytdlp helpers
│   ├── services/               # scraper, downloader, downloadManager, systemPicker
│   ├── tests/                  # node:test unit tests
│   ├── server.js               # Express + Socket.IO entry
│   ├── electron-main.js        # Electron wrapper
│   └── cookies.txt             # (optional, gitignored — never commit)
│
├── render.yaml                 # Render deployment
├── README.md
└── LICENSE
```

## Quick Start

### 1. Install dependencies

```bash
# Server (also installs helmet, rate limiter, ffmpeg-static)
cd server
npm install

# Client
cd ../client
npm install
```

### 2. Setup yt-dlp

The binary is no longer committed to the repo. Install it once:

```bash
cd server

# Linux/Mac
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
chmod +x yt-dlp

# Windows (PowerShell)
Invoke-WebRequest -Uri https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -OutFile yt-dlp.exe

# ...or use pip / your system package manager, or set YTDLP_PATH
```

### 3. Run

**Terminal 1 — Backend:**
```bash
cd server
npm start
```

**Terminal 2 — Frontend (dev):**
```bash
cd client
npm run dev
```

Open **http://localhost:5173** — the Vite dev server proxies `/api` and `/socket.io` to port 3000.

**Desktop app mode:**
```bash
cd server
npm run app
```

## Get the desktop app

**Install from the terminal (Linux, x86_64):**

```bash
curl -fsSL https://raw.githubusercontent.com/abrhamkindie/yt-playlist-downloader/HEAD/scripts/install.sh | bash
```

The script picks the build that fits the system (apt → `.deb`, dnf/yum/zypper → `.rpm`, otherwise the AppImage, falling back to the tarball) and verifies it against the release's `StreamPull-checksums.txt`. Nothing else needs installing — yt-dlp and ffmpeg ship inside the app. Flags: `--format deb|rpm|appimage|tar`, `--version <tag>`, `--no-verify`, `--dry-run`, `--help`. A pinned copy of the script is published as a release asset too (`.../releases/latest/download/install.sh`).

**Every release ships** (see [Releases](https://github.com/abrhamkindie/yt-playlist-downloader/releases/latest)):

| File | Works on |
|---|---|
| `StreamPull-Setup.exe` | Windows 10/11 x64 |
| `StreamPull-arm64.dmg` | macOS on Apple Silicon |
| `StreamPull-x86_64.AppImage` | Any x86_64 distro with FUSE |
| `StreamPull-amd64.deb` | Debian, Ubuntu and derivatives |
| `StreamPull-x86_64.rpm` | Fedora, RHEL, CentOS, openSUSE |
| `StreamPull-x64.tar.gz` | Everything else — unpack and run `streampull` |

Build them yourself with `npm run dist:linux` (needs `rpm` installed for the `.rpm` target), `npm run dist:win` or `npm run dist:mac`; tagging a `v*` release runs the whole matrix in CI.

## Tests & Lint

```bash
cd server && npm test          # node:test unit tests (queue, errors, sanitizing, parsing)
cd client && npm run lint      # ESLint
cd client && npm run build     # production build
```

## Fixing YouTube Bot Detection

Only relevant where downloads actually run — your machine. The hosted portal never contacts YouTube.

1. **Update yt-dlp** (most common fix; the desktop app does this itself in the background):
   ```bash
   cd server && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp && chmod +x yt-dlp
   ```
2. **Provide cookies** (never commit them!):
   - Desktop: Settings → *Use cookies from your browser* (Chrome, Firefox, Edge…)
   - Export cookies with a browser extension ("Get cookies.txt LOCALLY") and save as `server/cookies.txt`, **or**
   - Set `YOUTUBE_COOKIES_B64` (base64) / `YOUTUBE_COOKIES` env var on **your** machine — the hosted deployment ignores them
3. Newer yt-dlp versions use well-tuned default player clients — avoid forcing `player_client` overrides unless debugging.

## API

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/status` | Queue snapshot + all download records + `hosted` flag — answered everywhere, used to pick the UI |
| POST | `/api/analyze` | Desktop only: `{ url }` → `{ videos: [...] }` (rate limited). **410 when hosted** |
| POST | `/api/download` | Desktop only: `{ url, format?, quality?, title?, id?, downloadPath?, createSubfolder?, playlistTitle? }`. **410 when hosted** |
| GET | `/api/status/:id` | Single download record |
| POST | `/api/cancel/:id` | Kill active or remove queued |
| POST | `/api/cancel-all` | Stop everything |
| GET | `/api/pick-directory` | Desktop only — native picker |
| POST | `/api/open-folder` | Desktop only — arg-array based, no shell |
| GET | `/api/desktop/info` | Desktop only — data dir, auth, yt-dlp and app update state |
| POST | `/api/settings/cookies-from-browser`, `/api/cookies`, `/api/ytdlp/check`, `/api/ytdlp/update`, `/api/app/check` | Desktop only |

## WebSocket events (server → client)

`download-progress` (`{ id, progress, speed, eta, phase }`) · `download-complete` (`{ id, url, filePath }`) · `download-error` (`{ id, url, error }`) · `cancelled` (`{ id, url }`) · `queue-update` (snapshot)

## Configuration

**Client (`.env`):**
```env
VITE_API_URL=http://localhost:3000   # empty = same-origin/proxy
VITE_GITHUB_REPO=yourname/yourrepo   # portal: where the builds live
VITE_APP_VERSION=1.2.2               # usually injected from the root package.json
```

**Server:**
```env
PORT=3000
CLIENT_URL=http://localhost:5173     # comma-separated origins
NODE_ENV=development
DOWNLOADS_DIR=/data/downloads        # default destination when no path is given
YTDLP_PATH=/usr/local/bin/yt-dlp     # optional explicit binary path
YOUTUBE_COOKIES_B64=...              # optional cookies (ignored in hosted mode)
APP_REPO=abrhamkindie/yt-playlist-downloader   # release checks + portal fallback link
DESKTOP_RELEASES_URL=https://github.com/…      # where the 410 response points
```

## Deployment (Render)

The hosted service only builds and serves the portal: `render.yaml` installs server deps, runs `npm run build` in `client/`, and starts `node server.js`. It deliberately does **not** install yt-dlp — no video is ever fetched there.

## Security notes

- On a hosted deployment the public API surface is `GET /api/status`; `/api/analyze` and `/api/download` return 410 and the local helpers (`/api/pick-directory`, `/api/open-folder`, cookies, updaters) are not registered at all. There is no route that streams server files to a browser.
- Desktop helpers use argument-array `execFile` (never shell string interpolation), and client-supplied download paths must be absolute, existing directories.
- Rate limiting on `/api/analyze` (10/min) and `/api/download` (30/min); JSON body limited to 100kb (2mb for `/api/cookies`); helmet enabled.
- Keep `cookies.txt` out of git — it contains your YouTube session credential.

## Troubleshooting

**Port already in use**
```bash
lsof -ti:3000 | xargs kill -9
```

**yt-dlp not found / ENOENT**
Install it (step 2 above) or set `YTDLP_PATH`. Verify: `./yt-dlp --version`

## Disclaimer

This tool is for personal use only. Please respect YouTube's Terms of Service and copyright laws. Only download content you have the right to download.

## License

MIT — see [LICENSE](LICENSE).
