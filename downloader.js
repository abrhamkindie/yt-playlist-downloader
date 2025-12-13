const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

const downloadsDir = path.join(__dirname, 'downloads');

if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}

function downloadVideo(url, title, customPath, format, quality, options, io, onComplete, onError) {
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    // Use custom path if provided and exists, otherwise default
    let outputDir = downloadsDir;
    if (customPath && fs.existsSync(customPath)) {
        outputDir = customPath;
    }

    // Create subfolder if requested
    if (options && options.createSubfolder && options.playlistTitle) {
        const safePlaylistTitle = options.playlistTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        outputDir = path.join(outputDir, safePlaylistTitle);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
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
            io.emit('download-complete', { url, filePath });
        }
        if (onComplete) onComplete();
        return null; // No process started
    }

    const ytDlpPath = path.join(__dirname, 'yt-dlp');

    console.log(`Starting download for: ${title} to ${filePath} [Format: ${format}, Quality: ${quality}]`);

    let args = [];

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

        // Priority: Requested resolution & container -> Best video & audio -> Best single file
        // Note: 'mergeall' or explicit merge is handled by yt-dlp automatically when video+audio are selected
        const formatSelector = `bestvideo${heightFilter}[ext=${format}]+bestaudio[ext=m4a]/bestvideo${heightFilter}+bestaudio/best${heightFilter}`;

        args = [
            '-f', formatSelector,
            '--merge-output-format', format, // Ensure final container matches requested format
            '--ffmpeg-location', ffmpegPath,
            '-o', filePath,
            '--newline',
            '--no-mtime',
            '-N', '4', // Concurrent fragments
            '--resize-buffer',
            '--http-chunk-size', '10M',
            url
        ];
    }

    const process = spawn(ytDlpPath, args, { detached: true });
    console.log(`[Downloader] Spawned yt-dlp with PID: ${process.pid}`);

    process.stdout.on('data', (data) => {
        const output = data.toString();
        // console.log(output); // Verbose logging

        // Parse progress
        const match = output.match(/(\d+(\.\d+)?)%/);
        if (match && match[1]) {
            const percent = parseFloat(match[1]);
            if (io) {
                io.emit('download-progress', { url, percent });
            }
        }
    });

    process.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    process.on('close', (code) => {
        if (code === 0) {
            console.log(`Download complete: ${title}`);
            if (io) {
                io.emit('download-complete', { url, filePath });
            }
            if (onComplete) onComplete();
        } else {
            // Code null means killed (cancelled)
            if (code !== null) {
                console.error(`Download failed with code ${code}`);
                if (io) {
                    io.emit('download-error', { url, error: `Process exited with code ${code}` });
                }
                if (onError) onError(`Process exited with code ${code}`);
            }
        }
    });

    process.on('error', (err) => {
        console.error(`Failed to start yt-dlp: ${err}`);
        if (io) {
            io.emit('download-error', { url, error: err.message });
        }
        if (onError) onError(err.message);
    });
    
    return process;
}

module.exports = { downloadVideo };
