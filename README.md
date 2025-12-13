# YouTube Playlist Downloader

A modern YouTube playlist downloader with a React frontend and Node.js backend. Download videos and playlists in various formats with real-time progress tracking.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)

## Features

- 📺 Download individual videos or entire playlists
- 🎵 Audio-only downloads (MP3)
- 🎬 Video downloads (MP4, WebM)
- 📊 Real-time progress tracking
- 🎯 Quality selection (Best, 1080p, 720p, 480p)
- 🚀 Concurrent downloads with queue management
- 🎨 Beautiful React UI with Tailwind CSS
- ⚡ Real-time updates via WebSocket
- 🛡️ Comprehensive error handling
- 🔄 Cancel downloads in progress

## Project Structure

```
youtube-playlist-downloader/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
├── server/              # Node.js backend
│   ├── index.js
│   ├── scraper.js
│   ├── downloader.js
│   ├── downloadManager.js
│   ├── downloads/
│   ├── yt-dlp
│   └── package.json
│
├── README.md
├── LICENSE
└── .gitignore
```

## Quick Start

### 1. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Setup yt-dlp

```bash
cd server

# Linux/Mac
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
chmod +x yt-dlp

# Windows (PowerShell)
Invoke-WebRequest -Uri https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -OutFile yt-dlp.exe
```

### 3. Run the Application

**Terminal 1 - Start Backend:**
```bash
cd server
npm start
```

**Terminal 2 - Start Frontend:**
```bash
cd client
npm run dev
```

**Open Browser:**
```
http://localhost:5173
```

## Fixing YouTube Bot Detection

If you see errors like "Sign in to confirm you're not a bot", try these solutions:

### Solution 1: Update yt-dlp (Recommended)

```bash
cd server

# Linux/Mac
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
chmod +x yt-dlp

# Windows
Invoke-WebRequest -Uri https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -OutFile yt-dlp.exe
```

### Solution 2: Use Cookies (Advanced)

1. Install a browser extension to export cookies (e.g., "Get cookies.txt LOCALLY")
2. Export YouTube cookies to `server/cookies.txt`
3. Restart the server

The application will automatically use cookies if the file exists.

### Solution 3: Use Android Client (Already Configured)

The application is already configured to use YouTube's Android client API, which helps bypass bot detection. Make sure you're using the latest version of yt-dlp.

## Tech Stack

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- Socket.io Client

**Backend:**
- Node.js
- Express
- Socket.io
- yt-dlp
- ffmpeg-static

## Configuration

### Client Environment (.env)
```env
VITE_API_URL=http://localhost:3000
```

### Server Environment
```env
PORT=3000
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

## API Endpoints

### POST /api/download
Download videos or playlists

**Request:**
```json
{
  "url": "https://youtube.com/watch?v=...",
  "format": "mp4",
  "quality": "best"
}
```

**Response:**
```json
{
  "videos": [...],
  "message": "Downloads queued"
}
```

### POST /api/cancel/:id
Cancel a download in progress

## WebSocket Events

- `downloadProgress` - Progress updates
- `downloadComplete` - Download finished
- `downloadError` - Download failed

## Production Build

```bash
# Build frontend
cd client
npm run build

# The built files will be in client/dist/
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### yt-dlp Not Found
```bash
cd server
chmod +x yt-dlp
./yt-dlp --version
```

### Downloads Not Working
- Ensure yt-dlp is executable and in the server directory
- Check server logs for errors
- Verify the URL is a valid YouTube link
- Update yt-dlp to the latest version
- Try using cookies if bot detection occurs

### Bot Detection Errors
- Update yt-dlp to the latest version
- Export YouTube cookies and place in `server/cookies.txt`
- Wait a few minutes and try again
- Try a different video/playlist

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube downloader
- [React](https://react.dev/) - Frontend framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Socket.io](https://socket.io/) - Real-time communication

## Disclaimer

This tool is for personal use only. Please respect YouTube's Terms of Service and copyright laws. Only download content you have the right to download.
