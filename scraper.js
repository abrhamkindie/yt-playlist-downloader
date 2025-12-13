const { spawn } = require('child_process');
const path = require('path');

async function scrapePlaylist(url) {
    return new Promise((resolve, reject) => {
        const ytDlpPath = path.join(__dirname, 'yt-dlp');
        
        // --flat-playlist: Get video info without downloading
        // -J: Dump JSON output
        const args = [
            '--flat-playlist',
            '-J',
            url
        ];

        console.log(`Fetching playlist metadata with yt-dlp: ${url}`);
        const process = spawn(ytDlpPath, args);

        let stdoutData = '';
        let stderrData = '';

        process.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        process.on('close', (code) => {
            if (code !== 0) {
                console.error(`yt-dlp error: ${stderrData}`);
                return reject(new Error(`yt-dlp exited with code ${code}`));
            }

            try {
                const data = JSON.parse(stdoutData);
                
                if (!data.entries) {
                    // It might be a single video if not a playlist
                    if (data.id && data.title) {
                         return resolve([{
                            title: data.title,
                            url: data.webpage_url || data.url,
                            thumbnail: data.thumbnail || `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`,
                            id: data.id
                        }]);
                    }
                    return resolve([]);
                }

                const videos = data.entries.map(entry => {
                    // yt-dlp flat-playlist might not return full thumbnail url in some versions,
                    // but usually it does or we can construct it.
                    // For flat playlist, 'thumbnails' might be missing or limited.
                    // Safe fallback: https://i.ytimg.com/vi/<id>/hqdefault.jpg
                    
                    let thumbnail = `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;
                    if (entry.thumbnails && entry.thumbnails.length > 0) {
                        // Get the last one (usually highest quality)
                        thumbnail = entry.thumbnails[entry.thumbnails.length - 1].url;
                    }

                    return {
                        title: entry.title,
                        url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
                        thumbnail: thumbnail,
                        id: entry.id
                    };
                });

                resolve(videos);
            } catch (err) {
                console.error('Failed to parse yt-dlp output:', err);
                reject(err);
            }
        });
    });
}

module.exports = { scrapePlaylist };
