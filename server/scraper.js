const { spawn } = require('child_process');
const path = require('path');

async function scrapePlaylist(url) {
    return new Promise((resolve, reject) => {
        const ytDlpPath = path.join(__dirname, 'yt-dlp');
        
        // Check if yt-dlp exists
        const fs = require('fs');
        if (!fs.existsSync(ytDlpPath)) {
            return reject(new Error('yt-dlp not found. Please install yt-dlp.'));
        }
        
        // --flat-playlist: Get video info without downloading
        // -J: Dump JSON output
        const args = [
            '--flat-playlist',
            '-J',
            '--no-warnings',
            '--extractor-args', 'youtube:player_client=android,web',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            url
        ];

        console.log(`Fetching playlist metadata with yt-dlp: ${url}`);
        
        const process = spawn(ytDlpPath, args, {
            timeout: 60000 // 60 second timeout
        });

        let stdoutData = '';
        let stderrData = '';
        let hasError = false;

        process.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        process.on('error', (error) => {
            hasError = true;
            console.error(`Failed to spawn yt-dlp: ${error.message}`);
            reject(new Error(`Failed to start yt-dlp: ${error.message}`));
        });

        process.on('close', (code) => {
            if (hasError) return; // Already handled in error event

            if (code !== 0) {
                console.error(`yt-dlp error: ${stderrData}`);
                
                // Parse common errors
                let errorMessage = 'Failed to fetch playlist';
                if (stderrData.includes('404') || stderrData.includes('not found')) {
                    errorMessage = 'Playlist not found. Please check the URL.';
                } else if (stderrData.includes('private') || stderrData.includes('unavailable')) {
                    errorMessage = 'Playlist is private or unavailable.';
                } else if (stderrData.includes('network') || stderrData.includes('timeout')) {
                    errorMessage = 'Network error. Please check your connection.';
                }
                
                return reject(new Error(errorMessage));
            }

            if (!stdoutData || stdoutData.trim() === '') {
                return reject(new Error('No data received from yt-dlp'));
            }

            try {
                const data = JSON.parse(stdoutData);
                
                if (!data) {
                    return reject(new Error('Invalid response from yt-dlp'));
                }
                
                if (!data.entries) {
                    // It might be a single video if not a playlist
                    if (data.id && data.title) {
                         return resolve([{
                            title: data.title || 'Untitled',
                            url: data.webpage_url || data.url || url,
                            thumbnail: data.thumbnail || `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`,
                            id: data.id
                        }]);
                    }
                    return resolve([]);
                }

                const videos = data.entries
                    .filter(entry => entry && entry.id) // Filter out invalid entries
                    .map(entry => {
                        let thumbnail = `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;
                        if (entry.thumbnails && entry.thumbnails.length > 0) {
                            thumbnail = entry.thumbnails[entry.thumbnails.length - 1].url;
                        }

                        return {
                            title: entry.title || 'Untitled',
                            url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
                            thumbnail: thumbnail,
                            id: entry.id
                        };
                    });

                if (videos.length === 0) {
                    return reject(new Error('No videos found in playlist'));
                }

                resolve(videos);
            } catch (err) {
                console.error('Failed to parse yt-dlp output:', err);
                reject(new Error('Failed to parse playlist data'));
            }
        });

        // Timeout handler
        setTimeout(() => {
            if (!hasError && process.exitCode === null) {
                process.kill();
                reject(new Error('Request timed out. Please try again.'));
            }
        }, 65000); // 65 seconds (5 seconds after spawn timeout)
    });
}

module.exports = { scrapePlaylist };
