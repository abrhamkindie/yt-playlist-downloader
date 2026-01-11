const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { scrapePlaylist } = require('./scraper');
const { downloadVideo } = require('./downloader');
const downloadManager = require('./downloadManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || ["https://streampull.vercel.app", "http://localhost:5173"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

const PORT = process.env.PORT || 3000;

// CORS for React dev server
app.use(cors({
    origin: process.env.CLIENT_URL || ["https://streampull.vercel.app", "http://localhost:5173"],
    credentials: true
}));

// Serve static files from client/dist in production
app.use(express.static(path.join(__dirname, '../client/dist')));
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[Server Error]', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Listen to download manager events and broadcast to clients
downloadManager.on('cancelled', ({ id, url }) => {
    console.log(`[Server] Broadcasting cancelled event for ${id}`);
    io.emit('cancelled', { id, url });
});

// Handle download manager errors
downloadManager.on('error', ({ id, error }) => {
    console.log(`[Server] Broadcasting error event for ${id}: ${error}`);
    io.emit('download-error', { id, error });
});

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

app.post('/api/analyze', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        console.log(`Analyzing playlist: ${url}`);
        const videos = await scrapePlaylist(url);
        
        if (!videos || videos.length === 0) {
            return res.status(404).json({ error: 'No videos found' });
        }

        res.json({ videos, message: 'Playlist analyzed successfully' });
    } catch (error) {
        console.error('Error analyzing playlist:', error.message);
        res.status(500).json({ error: error.message || 'Failed to analyze playlist' });
    }
});

    app.post('/api/download', async (req, res) => {
    try {
        let { url, format, quality, title, id, downloadPath, createSubfolder, playlistTitle } = req.body;
        
        // Validation
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'Valid URL is required' });
        }

        url = url.trim();
        
        // Handle relative URLs
        if (url.startsWith('/')) {
            url = `https://www.youtube.com${url}`;
        }

        // Basic URL validation
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            return res.status(400).json({ error: 'Please provide a valid YouTube URL' });
        }

        // Validate format
        const validFormats = ['mp4', 'webm', 'mp3'];
        if (format && !validFormats.includes(format)) {
            return res.status(400).json({ error: 'Invalid format' });
        }

        let videos = [];
        
        // Optimization: If we already have the video metadata, skip scraping
        if (title && id) {
            console.log(`Using provided metadata for: ${title}`);
            videos = [{
                id,
                url,
                title,
                thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
            }];
        } else {
            console.log(`Analyzing and downloading: ${url}`);
            videos = await scrapePlaylist(url);
        }
        
        if (!videos || videos.length === 0) {
            return res.status(404).json({ error: 'No videos found' });
        }

        // Queue all videos for download
        // Use provided downloadPath or default
        let finalDownloadPath = downloadPath || path.join(__dirname, 'downloads');
        
        // Handle subfolder creation
        if (createSubfolder && playlistTitle) {
            // Sanitize playlist title to be safe for directory name
            const sanitizedTitle = playlistTitle.replace(/[<>:"/\\|?*]+/g, '_').trim();
            finalDownloadPath = path.join(finalDownloadPath, sanitizedTitle);
        }
        
        if (!fs.existsSync(finalDownloadPath)) {
            try {
                fs.mkdirSync(finalDownloadPath, { recursive: true });
            } catch (err) {
                console.error('Failed to create download directory:', err);
                return res.status(500).json({ error: 'Failed to create download directory' });
            }
        }

        videos.forEach(video => {
            const task = {
                id: video.id,
                url: video.url,
                title: video.title,
                start: () => {
                    return downloadVideo(
                        video.url, 
                        video.title, 
                        finalDownloadPath, 
                        format || 'mp4', 
                        quality || 'best', 
                        {}, 
                        io,
                        () => downloadManager.handleComplete(video.id),
                        (err) => downloadManager.handleError(video.id, err),
                        video.id
                    );
                }
            };

            downloadManager.addToQueue(task);
        });

        const response = { videos, message: 'Downloads queued' };
        if (videos.length === 1) {
            response.downloadId = videos[0].id;
        }

        res.json(response);
    } catch (error) {
        console.error('Error processing download:', error);
        const errorMessage = error.message.includes('yt-dlp') 
            ? 'Failed to fetch video(s). Please check the URL and try again.'
            : 'Failed to process download';
        res.status(500).json({ error: errorMessage });
    }
});

app.post('/api/cancel/:id', (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Download ID required' });

    const success = downloadManager.cancelDownload(id);
    if (success) {
        res.json({ message: 'Download cancelled' });
    } else {
        res.status(404).json({ error: 'Download not found' });
    }
});

app.post('/api/cancel-all', (req, res) => {
    downloadManager.stopAll();
    res.json({ message: 'All downloads cancelled' });
});

app.get('/api/pick-directory', async (req, res) => {
    try {
        // Try to use Electron dialog if running in Electron
        if (process.versions.electron) {
            const { dialog } = require('electron');
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory']
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
                return res.json({ path: result.filePaths[0] });
            } else {
                return res.json({ path: null, cancelled: true });
            }
        }
        
        // Fallback for standard Node.js on Linux (using zenity)
        if (process.platform === 'linux') {
            const { exec } = require('child_process');
            // Check if zenity is available
            try {
                require('child_process').execSync('which zenity', { stdio: 'ignore' });
                
                // Use zenity to pick directory
                // --file-selection --directory: pick directory
                // --title: set title
                return new Promise((resolve) => {
                    exec('zenity --file-selection --directory --title="Select Download Folder"', (error, stdout, stderr) => {
                        if (error) {
                            // User likely cancelled (exit code 1) or error
                            console.log('Zenity picker cancelled or failed:', error.message);
                            resolve(res.json({ path: null, cancelled: true }));
                        } else {
                            const selectedPath = stdout.trim();
                            if (selectedPath) {
                                resolve(res.json({ path: selectedPath }));
                            } else {
                                resolve(res.json({ path: null, cancelled: true }));
                            }
                        }
                    });
                });
            } catch (e) {
                console.log('Zenity not found, falling back to client picker');
            }
        } else if (process.platform === 'win32') {
             // Windows fallback could use PowerShell script, but for now we rely on client picker
             // or could implement later if needed.
        }
        
        // Fallback to client-side picker if server-side tools unavailable
        res.json({ path: null, error: 'Server-side picker unavailable' });
        
    } catch (error) {
        console.error('Pick directory error:', error);
        res.status(500).json({ error: 'Failed to pick directory' });
    }
});

app.post('/api/open-folder', (req, res) => {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'File path required' });

    try {
        if (process.versions.electron) {
            const { shell } = require('electron');
            shell.showItemInFolder(filePath);
            res.json({ message: 'Folder opened' });
        } else {
            // Fallback for standard Node.js
            const { exec } = require('child_process');
            let command;
            
            // Determine platform-specific command
            switch (process.platform) {
                case 'win32':
                    // Windows: explorer /select,"path"
                    command = `explorer /select,"${filePath.replace(/\//g, '\\')}"`;
                    break;
                case 'darwin':
                    // macOS: open -R "path"
                    command = `open -R "${filePath}"`;
                    break;
                default:
                    // Linux/Other
                    // Try to detect file manager for file selection
                    const { execSync } = require('child_process');
                    try {
                        // Check for nautilus (GNOME)
                        try {
                            execSync('which nautilus', { stdio: 'ignore' });
                            command = `nautilus --select "${filePath}"`;
                        } catch (e) {
                            // Check for dolphin (KDE)
                            try {
                                execSync('which dolphin', { stdio: 'ignore' });
                                command = `dolphin --select "${filePath}"`;
                            } catch (e2) {
                                // Check for nemo (Cinnamon)
                                try {
                                    execSync('which nemo', { stdio: 'ignore' });
                                    command = `nemo "${filePath}"`; // Nemo opens folder and selects file by default if path is file
                                } catch (e3) {
                                    throw new Error('No supported file manager found');
                                }
                            }
                        }
                    } catch (e) {
                        // Fallback to opening folder with xdg-open
                        const dirPath = path.dirname(filePath);
                        command = `xdg-open "${dirPath}"`;
                    }
                    break;
            }

            console.log(`[Server] Opening folder with command: ${command}`);
            
            exec(command, (error) => {
                if (error) {
                    console.error('[Server] Failed to open folder:', error);
                }
            });
            
            res.json({ message: 'Folder open requested' });
        }
    } catch (error) {
        console.error('Failed to open folder:', error);
        res.status(500).json({ error: 'Failed to open folder' });
    }
});

// Serve index.html for all non-API routes (React Router support)
app.use((req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
        return next();
    }
    
    const indexPath = path.join(__dirname, '../client/dist/index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Application not built. Run: cd client && npm run build');
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server gracefully');
    downloadManager.stopAll();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, closing server gracefully');
    downloadManager.stopAll();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Decode cookies from environment variable if provided
if (process.env.YOUTUBE_COOKIES_B64) {
    try {
        const cookiesContent = Buffer.from(process.env.YOUTUBE_COOKIES_B64, 'base64').toString();
        fs.writeFileSync(path.join(__dirname, 'cookies.txt'), cookiesContent);
        console.log('YouTube cookies loaded from environment variable');
    } catch (err) {
        console.error('Failed to decode cookies:', err.message);
    }
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Client URL: ${process.env.CLIENT_URL || '*'}`);
}).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        console.error('Server error:', error);
        process.exit(1);
    }
});
