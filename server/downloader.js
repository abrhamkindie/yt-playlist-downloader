const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

const downloadsDir = path.join(__dirname, 'downloads');

if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}

function downloadVideo(url, title, customPath, format, quality, options, io, onComplete, onError, videoId) {
    try {
        // Validate inputs
        if (!url || typeof url !== 'string') {
            throw new Error('Invalid URL');
        }
        
        if (!title || typeof title !== 'string') {
            throw new Error('Invalid title');
        }

        const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        // Use custom path if provided and exists, otherwise default
        let outputDir = downloadsDir;
        if (customPath) {
            if (fs.existsSync(customPath)) {
                outputDir = customPath;
            } else {
                console.warn(`Custom path does not exist: ${customPath}, using default`);
            }
        }

        // Create subfolder if requested
        if (options && options.createSubfolder && options.playlistTitle) {
            const safePlaylistTitle = options.playlistTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            outputDir = path.join(outputDir, safePlaylistTitle);
            try {
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }
            } catch (err) {
                console.error(`Failed to create subfolder: ${err.message}`);
                if (onError) onError(`Failed to create download directory: ${err.message}`);
                return null;
            }
        }
    
    // Determine extension based on format
    const audioFormats = ['mp3', 'm4a', 'wav'];
    const isAudio = audioFormats.includes(format);
    const ext = format; // Use the requested format as extension
    
    const filePath = path.join(outputDir, `${safeTitle}.${ext}`);
    
    // Check if file exists (simple skip logic)
    if (fs.existsSync(filePath)) {
        console.log(`File already exists: ${filePath}`);
        if (io) {
            io.emit('download-complete', { id: videoId, url, filePath });
        }
        if (onComplete) onComplete();
        return null; // No process started
    }

    // Try to find yt-dlp - first check local binary, then use system command
    let ytDlpPath = path.join(__dirname, 'yt-dlp');
    let useSystemYtDlp = false;
    
    // In production (Render) or if local binary doesn't exist, use system command
    if (process.env.NODE_ENV === 'production' || !fs.existsSync(ytDlpPath)) {
        ytDlpPath = 'yt-dlp';
        useSystemYtDlp = true;
        console.log('[Downloader] Using system yt-dlp (pip installed)');
    } else {
        console.log('[Downloader] Using local yt-dlp binary');
    }

    console.log(`Starting download for: ${title} to ${filePath} [Format: ${format}, Quality: ${quality}]`);

    let args = [];
    const cookiesPath = path.join(__dirname, 'cookies.txt');
    const hasCookies = fs.existsSync(cookiesPath);

    if (isAudio) {
        // Audio download logic
        args = [
            '-x', // Extract audio
            '--audio-format', format,
            '--audio-quality', '0', // Best quality
            '--ffmpeg-location', ffmpegPath,
            '-o', filePath,
            '--newline',
            '--no-mtime',
            '--socket-timeout', '30',
            '--http-chunk-size', '10M',
            // Use native Android client for downloads - often bypasses "Sign in" better than web
            '--extractor-args', 'youtube:player_client=android',
            '--user-agent', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
            url
        ];
    } else {
        // Video download logic
        // Construct format selector based on quality and container
        let heightFilter = '';
        
        switch (quality) {
            case '2160p': heightFilter = '[height<=2160]'; break;
            case '1440p': heightFilter = '[height<=1440]'; break;
            case '1080p': heightFilter = '[height<=1080]'; break;
            case '720p': heightFilter = '[height<=720]'; break;
            case '480p': heightFilter = '[height<=480]'; break;
            case '360p': heightFilter = '[height<=360]'; break;
            default: heightFilter = ''; // 'best'
        }

        // Priority: Requested resolution -> Best video & audio -> Best single file
        // We rely on --merge-output-format to handle the container (mp4/mkv/etc)
        // This allows downloading VP9/AV1 video (better quality) and converting to MP4
        const formatSelector = `bestvideo${heightFilter}+bestaudio/best${heightFilter}`;
        
        console.log(`[Downloader] Quality: ${quality}, Height Filter: ${heightFilter}`);
        console.log(`[Downloader] Format Selector: ${formatSelector}`);

        args = [
            '-f', formatSelector,
            '--merge-output-format', format,
            '--ffmpeg-location', ffmpegPath,
            '-o', filePath,
            '--newline',
            '--no-mtime',
            '-N', '4',
            '--resize-buffer',
            '--retries', '10',
            '--fragment-retries', '10',
            '-c', // Continue download if partially downloaded
            // Use native Android client for downloads
            '--extractor-args', 'youtube:player_client=android',
            '--user-agent', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
            url
        ];
    }

    // Add cookies if available
    if (hasCookies) {
        args.push('--cookies', cookiesPath);
        console.log('[Downloader] Using cookies for authentication');
    }

    console.log(`[Downloader] Executing yt-dlp with args: ${args.join(' ')}`);

    let downloadProcess;
    try {
        downloadProcess = spawn(ytDlpPath, args, { 
            detached: true,
            shell: false // Don't use shell to avoid syntax errors with special chars in args
        });
        console.log(`[Downloader] Spawned yt-dlp with PID: ${downloadProcess.pid}`);
    } catch (err) {
        console.error(`Failed to spawn yt-dlp: ${err.message}`);
        if (io) {
            io.emit('download-error', { url, error: 'Failed to start download' });
        }
        if (onError) onError('Failed to start download');
        return null;
    }

    let lastProgress = 0;
    let stderrOutput = '';

    downloadProcess.stdout.on('data', (data) => {
        const output = data.toString();

        // Parse progress
        const match = output.match(/(\d+(\.\d+)?)%/);
        if (match && match[1]) {
            const percent = parseFloat(match[1]);
            // Only emit if progress changed significantly (reduce socket spam)
            if (Math.abs(percent - lastProgress) >= 1 || percent === 100) {
                lastProgress = percent;
                if (io) {
                    io.emit('download-progress', { id: videoId, url, progress: Math.min(percent, 100), status: 'downloading' });
                }
            }
        }
    });

    downloadProcess.stderr.on('data', (data) => {
        const errorText = data.toString();
        stderrOutput += errorText;
        console.error(`[yt-dlp stderr]: ${errorText}`);
    });

    downloadProcess.on('close', (code) => {
        if (code === 0) {
            console.log(`Download complete: ${title}`);
            if (io) {
                io.emit('download-complete', { id: videoId, url, filePath });
            }
            if (onComplete) onComplete();
        } else {
            // Code null means killed (cancelled)
            if (code !== null) {
                console.error(`Download failed with code ${code}`);
                
                // Parse error message
                let errorMessage = 'Download failed';
                if (stderrOutput.includes('Sign in to confirm')) {
                    errorMessage = 'YouTube bot detection. Try updating yt-dlp or use cookies.';
                } else if (stderrOutput.includes('HTTP Error 403') || stderrOutput.includes('Forbidden')) {
                    errorMessage = 'Access denied. Video may be restricted.';
                } else if (stderrOutput.includes('HTTP Error 404')) {
                    errorMessage = 'Video not found.';
                } else if (stderrOutput.includes('Private video')) {
                    errorMessage = 'Video is private.';
                } else if (stderrOutput.includes('This video is unavailable')) {
                    errorMessage = 'Video is unavailable.';
                } else if (stderrOutput.includes('network') || stderrOutput.includes('timeout')) {
                    errorMessage = 'Network error. Please try again.';
                } else if (code === 1) {
                    errorMessage = 'Download failed. Please try again.';
                }
                
                if (io) {
                    io.emit('download-error', { id: videoId, url, error: errorMessage });
                }
                if (onError) onError(errorMessage);
            }
        }
    });

    downloadProcess.on('error', (err) => {
        console.error(`Failed to start yt-dlp: ${err.message}`);
        const errorMessage = err.code === 'ENOENT' 
            ? 'yt-dlp not found. Please install yt-dlp.'
            : 'Failed to start download';
        
        if (io) {
            io.emit('download-error', { id: videoId, url, error: errorMessage });
        }
        if (onError) onError(errorMessage);
    });
    
    return downloadProcess;
    
    } catch (error) {
        console.error(`Download error: ${error.message}`);
        if (io) {
            io.emit('download-error', { id: videoId, url, error: error.message });
        }
        if (onError) onError(error.message);
        return null;
    }
}

module.exports = { downloadVideo };
