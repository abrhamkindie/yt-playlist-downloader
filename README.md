# 🎬 YouTube Playlist Downloader

A modern, feature-rich YouTube playlist downloader with a beautiful web interface. Download entire playlists or individual videos with ease!

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey.svg)

## ✨ Features

### Core Functionality
- 🎵 **Multiple Format Support**: MP4, MKV, WEBM, MP3, M4A, WAV
- 🎯 **Quality Selection**: 4K, 2K, 1080p, 720p, 480p, 360p, or Best Available
- 📦 **Bulk Downloads**: Download multiple videos simultaneously (3 concurrent downloads)
- ⏸️ **Download Management**: Queue system with cancel functionality
- 📊 **Real-time Progress**: Live progress tracking with animated progress bars
- 📁 **Custom Paths**: Choose your download location
- 🗂️ **Auto Organization**: Optional playlist subfolder creation

### User Interface
- 🎨 **Modern Design**: Clean, professional Tailwind CSS interface
- 📱 **Fully Responsive**: Works perfectly on mobile, tablet, and desktop
- 🌙 **Smooth Animations**: Polished transitions and loading states
- ✅ **Status Icons**: Visual feedback for every download state
- 🔄 **Real-time Updates**: Socket.IO for instant progress updates

### Download States
- ⏱️ **Queued**: Waiting in download queue
- ⬇️ **Downloading**: Active download with percentage
- ✅ **Complete**: Successfully downloaded
- ⚠️ **Error**: Failed with error message
- 🚫 **Cancelled**: User cancelled download

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Python 3.x (for yt-dlp)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/youtube-playlist-downloader.git
   cd youtube-playlist-downloader
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   node server.js
   ```

4. **Open your browser**
   ```
   http://localhost:3000
   ```

## 📖 Usage

### Basic Usage

1. **Paste Playlist URL**
   - Copy a YouTube playlist URL
   - Paste it into the input field
   - Click "Analyze"

2. **Select Videos**
   - Check individual videos or use "Select All"
   - Choose format (Video/Audio)
   - Select quality

3. **Download**
   - Click "Download Selected" or individual download buttons
   - Watch real-time progress
   - Videos download 3 at a time automatically

### Advanced Options

- **Custom Download Path**: Specify where to save files
- **Create Subfolder**: Organize downloads in playlist-specific folders
- **Format Selection**: Choose between video formats (MP4, MKV, WEBM) or audio (MP3, M4A, WAV)
- **Quality Control**: Select specific quality or let it choose the best available

## 🛠️ Technology Stack

### Backend
- **Node.js**: Server runtime
- **Express**: Web framework
- **Socket.IO**: Real-time communication
- **yt-dlp**: YouTube download engine
- **ffmpeg**: Media processing

### Frontend
- **Vanilla JavaScript**: No framework overhead
- **Tailwind CSS**: Modern utility-first CSS
- **Socket.IO Client**: Real-time updates
- **Heroicons**: Beautiful SVG icons

## 📁 Project Structure

```
youtube-playlist-downloader/
├── public/
│   ├── index.html          # Main HTML file
│   ├── script.js           # Frontend JavaScript
│   └── style.css           # Tailwind CSS styles
├── downloads/              # Default download directory
├── server.js               # Express server
├── scraper.js              # Playlist scraping logic
├── downloader.js           # Download handling
├── downloadManager.js      # Queue management
├── package.json            # Dependencies
└── README.md              # This file
```

## ⚙️ Configuration

### Download Manager
Edit `downloadManager.js` to change concurrent downloads:
```javascript
constructor(maxConcurrency = 3) {  // Change this number
    this.maxConcurrency = maxConcurrency;
}
```

### Server Port
Edit `server.js` to change the port:
```javascript
const PORT = process.env.PORT || 3000;  // Change port here
```

## 🎯 Features in Detail

### Concurrent Downloads
- Downloads 3 videos simultaneously
- Automatic queue management
- FIFO (First In, First Out) system
- No manual intervention needed

### Progress Tracking
- Real-time percentage updates
- Animated progress bars
- Color-coded status messages
- Download speed indicators

### Error Handling
- Network error recovery
- Invalid URL detection
- File system error handling
- User-friendly error messages

## 📱 Responsive Design

### Mobile (< 640px)
- Stacked layout
- Full-width buttons
- Checkbox overlay on thumbnails
- Optimized touch targets

### Tablet (640px - 768px)
- Transitional layout
- Side-by-side controls
- Improved spacing

### Desktop (> 768px)
- Multi-column layout
- Separate checkbox column
- Hover effects
- Optimal spacing

## 🔧 Troubleshooting

### yt-dlp not found
```bash
# Install yt-dlp
pip install yt-dlp
# Or download binary and place in project root
```

### Port already in use
```bash
# Change port in server.js or use environment variable
PORT=8080 node server.js
```

### Downloads not starting
- Check yt-dlp is installed
- Verify ffmpeg is available
- Check download path permissions
- Ensure valid YouTube URL

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This tool is for personal use only. Please respect YouTube's Terms of Service and copyright laws. Only download content you have the right to download.

## 🙏 Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube download engine
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Heroicons](https://heroicons.com/) - Icon library
- [Socket.IO](https://socket.io/) - Real-time communication

## 📧 Contact

Your Name - [@yourtwitter](https://twitter.com/yourtwitter)

Project Link: [https://github.com/yourusername/youtube-playlist-downloader](https://github.com/yourusername/youtube-playlist-downloader)

---

Made with ❤️ by [Your Name]
