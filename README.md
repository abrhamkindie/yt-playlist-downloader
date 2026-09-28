# YouTube Playlist Downloader

A modern YouTube playlist downloader with a React frontend and Node.js backend. Download videos and playlists in various formats with real-time progress tracking.

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
- 🌐 Hosted mode: files stream back to the browser ("Save to device")
- 🖥️ Desktop mode (Electron): true local saving with native folder picker
- 🛡️ Security hardened: no shell interpolation, rate limiting, path confinement
- 🔄 Cancel individual downloads or everything at once

## Modes

| | 🌐 Hosted (e.g. Render) | 🖥️ Desktop / Electron |
|---|---|---|
| Trigger | `NODE_ENV=production` and not Electron | Electron (`npm run app`) or plain `npm start` locally |
| Download path | Server-managed (`DOWNLOADS_DIR` env, default `server/downloads`) | Your local disk via native folder picker |
| Get files | "Save to device" button (`GET /api/files/:id`) | "Open Folder" button |
| Path/open-folder APIs | Disabled for security | Enabled |

## Project Structure

```
├── client/                     # React 19 + Vite + Tailwind v4
│   └── src/
│       ├── components/         # Header, HeroSection, VideoList, VideoCard, VideoControls,
│       │                       # SummaryBar, StatusBanner, Footer
│       ├── hooks/
│       │   └── useDownloadSocket.js  # single socket connection + download state
│       ├── lib/
│       │   ├── api.js          # fetch wrapper for all endpoints
│       │   └── constants.js    # formats/qualities (mirrors server)
│       ├── App.jsx
│       └── main.jsx
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

## Tests & Lint

```bash
cd server && npm test          # node:test unit tests (queue, errors, sanitizing, parsing)
cd client && npm run lint      # ESLint
cd client && npm run build     # production build
```

## Fixing YouTube Bot Detection

If you see "Sign in to confirm you're not a bot":

1. **Update yt-dlp** (most common fix):
   ```bash
   cd server && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp && chmod +x yt-dlp
   ```
2. **Provide cookies** (never commit them!):
   - Export cookies with a browser extension ("Get cookies.txt LOCALLY")
   - Save as `server/cookies.txt` locally, **or**
   - Set `YOUTUBE_COOKIES_B64` (base64) / `YOUTUBE_COOKIES` env var on the server
3. Newer yt-dlp versions use well-tuned default player clients — avoid forcing `player_client` overrides unless debugging.

## API

| Method | Endpoint | Notes |
|---|---|---|
| POST | `/api/analyze` | `{ url }` → `{ videos: [...] }` (rate limited) |
| POST | `/api/download` | `{ url, format?, quality?, title?, id?, downloadPath?, createSubfolder?, playlistTitle? }` |
| GET | `/api/status` | Queue snapshot + all download records + `hosted` flag |
| GET | `/api/status/:id` | Single download record |
| POST | `/api/cancel/:id` | Kill active or remove queued |
| POST | `/api/cancel-all` | Stop everything |
| GET | `/api/files/:id` | Hosted mode only — stream a finished file |
| GET | `/api/pick-directory` | Local mode only — native picker |
| POST | `/api/open-folder` | Local mode only — arg-array based, no shell |

## WebSocket events (server → client)

`download-progress` (`{ id, progress, speed, eta, phase }`) · `download-complete` (`{ id, url, filePath }`) · `download-error` (`{ id, url, error }`) · `cancelled` (`{ id, url }`) · `queue-update` (snapshot)

## Configuration

**Client (`.env`):**
```env
VITE_API_URL=http://localhost:3000   # empty = same-origin/proxy
```

**Server:**
```env
PORT=3000
CLIENT_URL=http://localhost:5173     # comma-separated origins
NODE_ENV=development
DOWNLOADS_DIR=/data/downloads        # hosted-mode storage root
YTDLP_PATH=/usr/local/bin/yt-dlp     # optional explicit binary path
YOUTUBE_COOKIES_B64=...              # optional cookies
```

## Deployment (Render)

`render.yaml` builds the client, installs server deps, and pip-installs yt-dlp. Note the free tier has an **ephemeral disk** — downloaded files disappear on redeploy/restart. For persistence, mount a disk and point `DOWNLOADS_DIR` at it.

## Security notes

- `/api/open-folder` and `/api/pick-directory` are **disabled in hosted mode** and use argument-array `execFile` (never shell string interpolation).
- In hosted mode, client-supplied `downloadPath` is ignored; downloads are confined to `DOWNLOADS_ROOT` and `/api/files/:id` refuses paths outside it.
- Rate limiting on `/api/analyze` (10/min) and `/api/download` (30/min); JSON body limited to 100kb; helmet enabled.
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
