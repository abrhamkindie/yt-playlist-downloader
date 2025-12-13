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
    io.emit('downloadError', { id, error });
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
        console.error('Error analyzing playlist:', error);
        res.status(500).json({ error: 'Failed to analyze playlist' });
    }
});

app.post('/api/download', async (req, res) => {
    try {
        let { url, format, quality, title, id } = req.body;
        
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
        const downloadPath = path.join(__dirname, 'downloads');
        if (!fs.existsSync(downloadPath)) {
            fs.mkdirSync(downloadPath, { recursive: true });
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
                        downloadPath, 
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
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, closing server gracefully');
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
