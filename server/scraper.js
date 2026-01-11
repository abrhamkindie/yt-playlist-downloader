const { spawn } = require('child_process');
const path = require('path');

async function scrapePlaylist(url) {
    return new Promise((resolve, reject) => {
        const fs = require('fs');
        
        // Try to find yt-dlp - first check local binary, then use system command
        let ytDlpPath = path.join(__dirname, 'yt-dlp');
        let useSystemYtDlp = false;
        
        // In production (Render) or if local binary doesn't exist, use system command
        if (process.env.NODE_ENV === 'production' || !fs.existsSync(ytDlpPath)) {
            ytDlpPath = 'yt-dlp';
            useSystemYtDlp = true;
            console.log('[Scraper] Using system yt-dlp (pip installed)');
        } else {
            console.log('[Scraper] Using local yt-dlp binary');
        }
        
        // Detect if URL is a playlist
        const isPlaylist = url.includes('list=') || url.includes('/playlist');
        
        // --flat-playlist: Get video info without downloading
        // -J: Dump JSON output
        const args = [
            '--flat-playlist',
            '-J',
            '--no-warnings',
            '--socket-timeout', '30',
        ];
        
        // Add --yes-playlist flag if it's a playlist URL
        if (isPlaylist) {
            args.push('--yes-playlist');
            console.log('[Scraper] Detected playlist URL, using --yes-playlist flag');
        } else {
            args.push('--no-playlist');
            console.log('[Scraper] Detected single video URL, using --no-playlist flag');
        }
        
        // Add robust bypass options for bot detection
        // Using android,web is generally more stable and was working locally
        args.push('--extractor-args', 'youtube:player_client=android,web');
        args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        args.push('--http-chunk-size', '10M');
        
        args.push(url);
        
        console.log(`[Scraper] Full command: yt-dlp ${args.join(' ')}`);
        console.log(`Fetching playlist metadata with yt-dlp: ${url}`);
        
        const ytDlpProcess = spawn(ytDlpPath, args, {
            timeout: 60000,
            shell: false // Don't use shell to avoid syntax errors with special chars in args
            // Force update
        });

        let stdoutData = '';
        let stderrData = '';
        let hasError = false;

        ytDlpProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        ytDlpProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        ytDlpProcess.on('error', (error) => {
            hasError = true;
            console.error(`Failed to spawn yt-dlp: ${error.message}`);
            reject(new Error(`Failed to start yt-dlp: ${error.message}`));
        });

        ytDlpProcess.on('close', (code) => {
            if (hasError) return; // Already handled in error event

            if (code !== 0) {
                console.error(`yt-dlp error output: ${stderrData}`);
                
                // Parse common errors with more detail
                let errorMessage = 'Failed to fetch playlist';
                const errLower = stderrData.toLowerCase();
                
                if (errLower.includes('sign in') || errLower.includes('cookies')) {
                     errorMessage = 'YouTube requires sign-in. This content might be age-restricted or premium.';
                } else if (errLower.includes('429') || errLower.includes('too many requests')) {
                    errorMessage = 'Rate limit exceeded (429). Please try again later.';
                } else if (errLower.includes('404') || errLower.includes('not found')) {
                    errorMessage = 'Playlist not found. Please check the URL.';
                } else if (errLower.includes('private') || errLower.includes('unavailable')) {
                    errorMessage = 'Playlist is private or unavailable.';
                } else if (errLower.includes('network') || errLower.includes('timeout')) {
                    errorMessage = 'Network error. Please check your connection.';
                } else if (stderrData.length > 0) {
                    // Include the actual error message if it's not one of the above
                    errorMessage = `yt-dlp error: ${stderrData.split('\n')[0]}`; 
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
                        console.log('[Scraper] Single video detected, returning 1 video');
                         return resolve([{
                            title: data.title || 'Untitled',
                            url: data.webpage_url || data.url || url,
                            thumbnail: data.thumbnail || `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`,
                            id: data.id
                        }]);
                    }
                    console.log('[Scraper] No entries found in response');
                    return resolve([]);
                }

                const videos = data.entries
                    .filter(entry => entry && entry.id) // Filter out invalid entries
                    .map(entry => {
                        let thumbnail = `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;
                        if (entry.thumbnails && entry.thumbnails.length > 0) {
                            // Try to find a medium quality thumbnail
                            const mediumThumb = entry.thumbnails.find(t => t.height >= 360) || entry.thumbnails[entry.thumbnails.length - 1];
                            thumbnail = mediumThumb.url;
                        }

                        return {
                            title: entry.title || 'Untitled',
                            url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
                            thumbnail: thumbnail,
                            id: entry.id,
                            duration: entry.duration
                        };
                    });

                if (videos.length === 0) {
                    console.log('[Scraper] No valid videos found in playlist entries');
                    return reject(new Error('No videos found in playlist'));
                }

                console.log(`[Scraper] Successfully extracted ${videos.length} videos from playlist`);
                resolve(videos);
            } catch (err) {
                console.error('Failed to parse yt-dlp output:', err);
                console.error('Raw output start:', stdoutData.substring(0, 200));
                reject(new Error('Failed to parse playlist data'));
            }
        });

        // Timeout handler
        setTimeout(() => {
            if (!hasError && ytDlpProcess.exitCode === null) {
                ytDlpProcess.kill();
                reject(new Error('Request timed out. Please try again.'));
            }
        }, 65000); // 65 seconds
    });
}

module.exports = { scrapePlaylist };
