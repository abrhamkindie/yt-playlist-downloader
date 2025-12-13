const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { scrapePlaylist } = require('./scraper');
const { downloadVideo } = require('./downloader');
const downloadManager = require('./downloadManager');

const app = express();
const server = http.createServer(app);

// Allow requests from the frontend URL (or all if not specified)
const CLIENT_URL = process.env.CLIENT_URL || '*';

const io = socketIo(server, {
    cors: {
        origin: CLIENT_URL,
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Error handling middleware
app.use(cors({ origin: CLIENT_URL }));
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

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

app.post('/api/analyze', async (req, res) => {
    try {
        let { url } = req.body;
        
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

        console.log(`Analyzing playlist: ${url}`);
        const videos = await scrapePlaylist(url);
        
        if (!videos || videos.length === 0) {
            return res.status(404).json({ error: 'No videos found in playlist' });
        }

        res.json({ videos });
    } catch (error) {
        console.error('Error analyzing playlist:', error);
        const errorMessage = error.message.includes('yt-dlp') 
            ? 'Failed to fetch playlist. Please check the URL and try again.'
            : 'Failed to analyze playlist';
        res.status(500).json({ error: errorMessage });
    }
});

app.post('/api/download', async (req, res) => {
    try {
        const { url, title, downloadPath, format, quality, createSubfolder, playlistTitle } = req.body;
        
        // Validation
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'Valid URL is required' });
        }
        
        if (!title || typeof title !== 'string') {
            return res.status(400).json({ error: 'Valid title is required' });
        }

        // Validate format
        const validFormats = ['mp4', 'mkv', 'webm', 'mp3', 'm4a', 'wav'];
        if (format && !validFormats.includes(format)) {
            return res.status(400).json({ error: 'Invalid format' });
        }

        // Validate download path if provided
        if (downloadPath && !fs.existsSync(downloadPath)) {
            return res.status(400).json({ error: 'Download path does not exist' });
        }

        // Create a unique ID for this download session
        const downloadId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        
        const task = {
            id: downloadId,
            url,
            title,
            start: () => {
                return downloadVideo(
                    url, 
                    title, 
                    downloadPath, 
                    format || 'mp4', 
                    quality || 'best', 
                    { createSubfolder, playlistTitle }, 
                    io,
                    () => downloadManager.handleComplete(downloadId),
                    (err) => downloadManager.handleError(downloadId, err)
                );
            }
        };

        downloadManager.addToQueue(task);
        res.json({ message: 'Download queued', downloadId });
    } catch (error) {
        console.error('Error queueing download:', error);
        res.status(500).json({ error: 'Failed to queue download' });
    }
});

app.post('/api/cancel', (req, res) => {
    const { downloadId } = req.body;
    if (!downloadId) return res.status(400).json({ error: 'Download ID required' });

    const success = downloadManager.cancelDownload(downloadId);
    if (success) {
        res.json({ message: 'Download cancelled' });
    } else {
        res.status(404).json({ error: 'Download not found' });
    }
});

app.post('/api/open-folder', (req, res) => {
    const { downloadPath, filePath } = req.body;
    console.log('[Open Folder] Request received:', req.body);
    
    let targetPath = downloadPath || (filePath ? path.dirname(filePath) : path.join(__dirname, 'downloads'));
    
    // If filePath is provided, we try to open the folder. 
    // On some OSs we could highlight the file, but for now we'll just open the dir.
    
    if (!targetPath) {
        targetPath = path.join(__dirname, 'downloads');
    }

    console.log('[Open Folder] Target Path:', targetPath);

    // Ensure the path exists
    if (!fs.existsSync(targetPath)) {
         console.error('[Open Folder] Path does not exist:', targetPath);
         return res.status(400).json({ error: 'Path does not exist' });
    }

    let command;
    let args = [];

    if (filePath && fs.existsSync(filePath)) {
        // "Reveal" logic
        switch (process.platform) {
            case 'darwin':
                command = 'open';
                args = ['-R', filePath];
                break;
            case 'win32':
                command = 'explorer';
                args = [`/select,${filePath}`];
                break;
            default: // linux
                // Try using DBus (standard for modern desktops like GNOME, KDE, XFCE)
                // This calls org.freedesktop.FileManager1.ShowItems
                try {
                    console.log('[Open Folder] Attempting DBus selection...');
                    const { execSync } = require('child_process');
                    // Format path as file URI
                    const fileUri = `file://${filePath}`;
                    const dbusCommand = `dbus-send --session --print-reply --dest=org.freedesktop.FileManager1 /org/freedesktop/FileManager1 org.freedesktop.FileManager1.ShowItems array:string:"${fileUri}" string:""`;
                    
                    execSync(dbusCommand);
                    console.log('[Open Folder] DBus command successful');
                    return res.json({ message: 'Folder opened via DBus' });
                } catch (dbusErr) {
                    console.log('[Open Folder] DBus failed, falling back to binary detection:', dbusErr.message);
                }

                // Fallback to binary detection
                if (fs.existsSync('/usr/bin/nautilus')) {
                    command = 'nautilus';
                    args = ['--select', filePath];
                } else if (fs.existsSync('/usr/bin/dolphin')) {
                    command = 'dolphin';
                    args = ['--select', filePath];
                } else if (fs.existsSync('/usr/bin/nemo')) {
                    command = 'nemo';
                    args = [filePath]; 
                } else if (fs.existsSync('/usr/bin/thunar')) {
                    command = 'thunar';
                    args = [filePath];
                } else {
                    command = 'xdg-open';
                    args = [path.dirname(filePath)];
                }
                break;
        }
    } else {
        // Open directory logic
        switch (process.platform) {
            case 'darwin':
                command = 'open';
                args = [targetPath];
                break;
            case 'win32':
                command = 'explorer';
                args = [targetPath];
                break;
            default: // linux
                command = 'xdg-open';
                args = [targetPath];
                break;
        }
    }

    console.log(`[Open Folder] Executing: ${command} ${args.join(' ')}`);

    const child = require('child_process').spawn(command, args, { detached: true, stdio: 'ignore' });
    
    child.on('error', (err) => {
        console.error('[Open Folder] Spawn error:', err);
    });

    child.unref();

    res.json({ message: 'Folder opened' });
});

app.get('/api/pick-directory', (req, res) => {
    let command;
    let args = [];

    switch (process.platform) {
        case 'linux':
            command = 'zenity';
            args = ['--file-selection', '--directory'];
            break;
        case 'win32':
            command = 'powershell';
            args = [
                '-NoProfile', 
                '-Command', 
                "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.ShowDialog() | Out-Null; $f.SelectedPath"
            ];
            break;
        case 'darwin':
            command = 'osascript';
            args = ['-e', 'POSIX path of (choose folder)'];
            break;
        default:
            return res.status(500).json({ error: 'Platform not supported' });
    }

    console.log(`[Pick Directory] Executing: ${command} ${args.join(' ')}`);

    const child = require('child_process').spawn(command, args);
    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (data) => {
        stdoutData += data.toString();
    });

    child.stderr.on('data', (data) => {
        stderrData += data.toString();
    });

    child.on('close', (code) => {
        if (code !== 0 && stdoutData.trim() === '') {
            // User likely cancelled or error
            console.log('[Pick Directory] Cancelled or failed');
            return res.json({ path: null });
        }
        
        const selectedPath = stdoutData.trim();
        console.log(`[Pick Directory] Selected: ${selectedPath}`);
        res.json({ path: selectedPath });
    });
    
    child.on('error', (err) => {
        console.error('[Pick Directory] Spawn error:', err);
        res.status(500).json({ error: 'Failed to spawn picker' });
    });
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
    // Don't exit in production, log and continue
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        console.error('Server error:', error);
        process.exit(1);
    }
});
