// Regression guards for the two behaviours that decide what a paste expands to:
//   1. only real playlists (PL/UU/PU/OU or a /playlist page) are expanded,
//      auto-generated lists (RD/LL/WL/FL…) stay a single video;
//   2. the "related videos" enrichment happens ONLY when the caller asks for it
//      (/analyze), never on the download path, and never for a playlist.
//
// services/scraper.js destructures spawnYtDlp at load time, so the stubs have to
// be installed before the very first require of it — hence the ordering below.
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');

const ytdlp = require('../lib/ytdlp');

const realSpawn = ytdlp.spawnYtDlp;
const realFetch = globalThis.fetch;
const realLog = console.log;
const realWarn = console.warn;

let spawnImpl = () => {
    throw new Error('spawnYtDlp stub not configured');
};
let fetchImpl = async () => {
    throw new Error('fetch stub not configured');
};

const spawnCalls = [];
const fetchCalls = [];

beforeEach(() => {
    spawnCalls.length = 0;
    fetchCalls.length = 0;
});

before(() => {
    ytdlp.spawnYtDlp = (args, opts) => {
        spawnCalls.push(args);
        return spawnImpl(args, opts);
    };
    globalThis.fetch = (url, opts) => {
        fetchCalls.push({ url, opts });
        return fetchImpl(url, opts);
    };
    console.log = () => { };
    console.warn = () => { };
});

after(() => {
    ytdlp.spawnYtDlp = realSpawn;
    globalThis.fetch = realFetch;
    console.log = realLog;
    console.warn = realWarn;
});

const { scrapePlaylist } = require('../services/scraper');

const MAIN_ID = 'mainvideo01';
const WATCH_URL = `https://www.youtube.com/watch?v=${MAIN_ID}`;

/** Minimal stand-in for the child process runScrape expects. */
function fakeChild({ stdout = '', stderr = '', code = 0 } = {}) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => { };
    setImmediate(() => {
        if (stdout) child.stdout.emit('data', Buffer.from(stdout));
        if (stderr) child.stderr.emit('data', Buffer.from(stderr));
        child.emit('close', code);
    });
    return child;
}

const singleVideoJson = JSON.stringify({
    id: MAIN_ID,
    title: 'Main video',
    webpage_url: WATCH_URL,
    duration: 61,
});

const playlistJson = JSON.stringify({
    _type: 'playlist',
    entries: [1, 2, 3].map((n) => ({
        id: `playlistvid${n}`,
        title: `Playlist video ${n}`,
        url: `https://www.youtube.com/watch?v=playlistvid${n}`,
    })),
});

/** Watch-page HTML carrying `count` related videos in the desktop rail. */
function watchPageHtml(count, extraIds = []) {
    const ids = [...extraIds, ...Array.from({ length: count }, (_, i) => `rel${String(i).padStart(8, '0')}`)];
    const data = {
        contents: {
            twoColumnWatchNextResults: {
                secondaryResults: {
                    secondaryResults: {
                        results: ids.map((id, i) => ({
                            videoRenderer: {
                                videoId: id,
                                title: { runs: [{ text: `Related ${i + 1}` }] },
                                lengthText: { simpleText: '4:04' },
                            },
                        })),
                    },
                },
            },
        },
    };
    return `<html><script>var ytInitialData = ${JSON.stringify(data)};</script></html>`;
}

function fakeResponse(html, status = 200) {
    return { ok: status >= 200 && status < 300, status, text: async () => html };
}

describe('scrapePlaylist — playlist vs single classification', () => {
    test('an auto-generated list (RD mix) is scraped as a single video', async () => {
        spawnImpl = () => fakeChild({ stdout: singleVideoJson });
        fetchImpl = async () => fakeResponse(watchPageHtml(0));

        await scrapePlaylist(`${WATCH_URL}&list=RDMx9SzqJr0`, { includeRelated: true });

        assert.ok(spawnCalls[0].includes('--no-playlist'));
        assert.ok(!spawnCalls[0].includes('--yes-playlist'));
    });

    test('a real playlist id (PL) is expanded', async () => {
        spawnImpl = () => fakeChild({ stdout: playlistJson });
        fetchImpl = async () => fakeResponse(watchPageHtml(0));

        const videos = await scrapePlaylist(`https://www.youtube.com/playlist?list=PLMx9SzqJr0`, {
            includeRelated: true,
        });

        assert.ok(spawnCalls[0].includes('--yes-playlist'));
        assert.strictEqual(videos.length, 3);
    });
});

describe('scrapePlaylist — related-video enrichment', () => {
    test('appends related videos, capped and flagged, for the analyze path', async () => {
        spawnImpl = () => fakeChild({ stdout: singleVideoJson });
        fetchImpl = async () => fakeResponse(watchPageHtml(25));

        const videos = await scrapePlaylist(WATCH_URL, { includeRelated: true });

        // 1 main + RELATED_VIDEOS_LIMIT (10), not all 25 from the rail.
        assert.strictEqual(videos.length, 11);
        assert.strictEqual(videos[0].id, MAIN_ID);
        assert.strictEqual(videos[0].isRelated, false);
        assert.ok(videos.slice(1).every((v) => v.isRelated === true));
        assert.strictEqual(new Set(videos.map((v) => v.id)).size, 11);
        assert.ok(videos[1].url.includes(videos[1].id));
    });

    test('scrapes the rail with a desktop user agent', async () => {
        // The mobile watch page lazy-loads the rail, so ytInitialData has no
        // related videos there — a desktop UA is required for this to work at all.
        spawnImpl = () => fakeChild({ stdout: singleVideoJson });
        fetchImpl = async () => fakeResponse(watchPageHtml(1));

        await scrapePlaylist(WATCH_URL, { includeRelated: true });

        assert.strictEqual(fetchCalls.length, 1);
        assert.ok(/X11; Linux x86_64/.test(fetchCalls[0].opts.headers['User-Agent']));
    });

    test('the download path (no includeRelated) never touches the watch page', async () => {
        spawnImpl = () => fakeChild({ stdout: singleVideoJson });
        fetchImpl = async () => {
            throw new Error('related fetch must not run on the download path');
        };

        const videos = await scrapePlaylist(WATCH_URL);

        assert.strictEqual(fetchCalls.length, 0);
        assert.strictEqual(videos.length, 1);
        assert.strictEqual(videos[0].isRelated, undefined);
    });

    test('a playlist is never enriched, even when includeRelated is set', async () => {
        spawnImpl = () => fakeChild({ stdout: playlistJson });
        fetchImpl = async () => fakeResponse(watchPageHtml(5));

        const videos = await scrapePlaylist('https://www.youtube.com/watch?v=x&list=PLMx9SzqJr0', {
            includeRelated: true,
        });

        assert.strictEqual(fetchCalls.length, 0);
        assert.strictEqual(videos.length, 3);
        assert.ok(videos.every((v) => v.isRelated === undefined));
    });

    test('the main video is dropped from the related list', async () => {
        spawnImpl = () => fakeChild({ stdout: singleVideoJson });
        fetchImpl = async () => fakeResponse(watchPageHtml(3, [MAIN_ID, MAIN_ID]));

        const videos = await scrapePlaylist(WATCH_URL, { includeRelated: true });

        assert.strictEqual(videos.filter((v) => v.id === MAIN_ID).length, 1);
        assert.strictEqual(videos.length, 4);
    });

    test('a failing related fetch degrades to the single video', async () => {
        spawnImpl = () => fakeChild({ stdout: singleVideoJson });
        fetchImpl = async () => {
            throw new Error('ENETUNREACH');
        };

        const videos = await scrapePlaylist(WATCH_URL, { includeRelated: true });

        assert.strictEqual(videos.length, 1);
        assert.strictEqual(videos[0].id, MAIN_ID);
    });

    test('a non-200 watch-page response degrades to the single video', async () => {
        spawnImpl = () => fakeChild({ stdout: singleVideoJson });
        fetchImpl = async () => fakeResponse('', 503);

        const videos = await scrapePlaylist(WATCH_URL, { includeRelated: true });

        assert.strictEqual(videos.length, 1);
    });

    test('an empty rail leaves the result untouched', async () => {
        spawnImpl = () => fakeChild({ stdout: singleVideoJson });
        fetchImpl = async () => fakeResponse('<html><body>consent wall</body></html>');

        const videos = await scrapePlaylist(WATCH_URL, { includeRelated: true });

        assert.strictEqual(videos.length, 1);
        assert.strictEqual(videos[0].isRelated, undefined);
    });

    test('scrape errors propagate untouched (no enrichment masking)', async () => {
        spawnImpl = () => fakeChild({ stderr: 'ERROR: unable to download', code: 1 });
        fetchImpl = async () => fakeResponse(watchPageHtml(5));

        await assert.rejects(() => scrapePlaylist(WATCH_URL, { includeRelated: true }), /Failed to fetch playlist|unable to download/);
        assert.strictEqual(fetchCalls.length, 0);
    });
});
