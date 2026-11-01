const { test, describe } = require('node:test');
const assert = require('node:assert');
const { sanitizeFilename, uniqueFilePath } = require('../lib/files');
const { friendlyYtdlpError } = require('../lib/errors');
const { parseYouTubeUrl } = require('../lib/urls');
const { parseProgressLine, buildArgs } = require('../services/downloader');
const { isRealPlaylist, extractYtInitialData, collectRelatedVideos } = require('../services/scraper');
const { validateLocalDownloadPath } = require('../lib/config');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('sanitizeFilename', () => {
  test('keeps readable characters', () => {
    assert.strictEqual(sanitizeFilename('My Video — 2024 (HD)'), 'My Video — 2024 (HD)');
  });

  test('strips filesystem-illegal characters', () => {
    assert.strictEqual(sanitizeFilename('a<b>c:d"e/f\\g|h?i*j'), 'abcdefghij');
  });

  test('collapses whitespace and trims dots', () => {
    assert.strictEqual(sanitizeFilename('  spaced   out  '), 'spaced out');
    assert.strictEqual(sanitizeFilename('...weird..'), 'weird');
  });

  test('falls back to untitled', () => {
    assert.strictEqual(sanitizeFilename(''), 'untitled');
    assert.strictEqual(sanitizeFilename(null), 'untitled');
    assert.strictEqual(sanitizeFilename('///'), 'untitled');
  });

  test('enforces max length', () => {
    const out = sanitizeFilename('x'.repeat(300));
    assert.ok(out.length <= 150);
  });
});

describe('uniqueFilePath', () => {
  test('appends (2), (3) on collisions', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-test-'));
    try {
      const first = uniqueFilePath(dir, 'video.mp4');
      fs.writeFileSync(first, '');
      const second = uniqueFilePath(dir, 'video.mp4');
      fs.writeFileSync(second, '');
      const third = uniqueFilePath(dir, 'video.mp4');

      assert.ok(first.endsWith('video.mp4'));
      assert.ok(second.endsWith('video (2).mp4'));
      assert.ok(third.endsWith('video (3).mp4'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('friendlyYtdlpError', () => {
  test('maps bot detection', () => {
    const msg = friendlyYtdlpError('ERROR: Sign in to confirm you are not a bot');
    assert.match(msg, /bot detection/i);
  });

  test('maps 404', () => {
    assert.match(friendlyYtdlpError('HTTP Error 404: Not Found'), /not found/i);
  });

  test('maps private videos', () => {
    assert.match(friendlyYtdlpError('This video is private'), /private/i);
  });

  test('falls back to first stderr line', () => {
    const msg = friendlyYtdlpError('ERROR: something unusual happened\nWARNING: ignored');
    assert.match(msg, /something unusual/);
  });

  test('uses fallback for empty stderr', () => {
    assert.strictEqual(friendlyYtdlpError('', 'Download failed. Please try again.'), 'Download failed. Please try again.');
  });

  test('maps invalid URL errors instead of leaking raw yt-dlp output', () => {
    const msg = friendlyYtdlpError("ERROR: [generic] 'not a url' is not a valid URL");
    assert.match(msg, /valid YouTube URL/);
  });
});

describe('parseYouTubeUrl', () => {
  test('accepts playlist, watch and youtu.be links', () => {
    assert.ok(parseYouTubeUrl('https://www.youtube.com/playlist?list=PL123'));
    assert.ok(parseYouTubeUrl('https://youtube.com/watch?v=abc'));
    assert.ok(parseYouTubeUrl('https://youtu.be/abc'));
    assert.ok(parseYouTubeUrl('https://music.youtube.com/playlist?list=PL123'));
  });

  test('prefixes relative youtube paths', () => {
    assert.strictEqual(parseYouTubeUrl('/watch?v=abc'), 'https://www.youtube.com/watch?v=abc');
  });

  test('rejects non-URL text with a friendly 400', () => {
    assert.throws(
      () => parseYouTubeUrl('Add skeleton loading placeholders for the video list while analyzing'),
      (err) => err.status === 400 && /valid URL/.test(err.message) && !/yt-dlp/.test(err.message),
    );
  });

  test('rejects non-YouTube hosts', () => {
    assert.throws(() => parseYouTubeUrl('https://example.com/video'), (err) => err.status === 400);
  });

  test('rejects non-http protocols', () => {
    assert.throws(() => parseYouTubeUrl('file:///etc/passwd'), (err) => err.status === 400);
  });

  test('rejects empty or non-string input', () => {
    assert.throws(() => parseYouTubeUrl(''), (err) => err.status === 400);
    assert.throws(() => parseYouTubeUrl(null), (err) => err.status === 400);
    assert.throws(() => parseYouTubeUrl(12345), (err) => err.status === 400);
  });
});

describe('parseProgressLine', () => {
  test('parses percent, speed and ETA', () => {
    const info = parseProgressLine('[download]  42.3% of    3.42MiB at    1.10MiB/s ETA 00:03');
    assert.strictEqual(info.percent, 42.3);
    assert.strictEqual(info.speed, '1.10MiB/s');
    assert.strictEqual(info.eta, '00:03');
  });

  test('parses percent only', () => {
    const info = parseProgressLine('[download] 100% of 1MiB');
    assert.strictEqual(info.percent, 100);
  });

  test('returns null for non-progress lines', () => {
    assert.strictEqual(parseProgressLine('[youtube] extracting info'), null);
  });
});

describe('buildArgs', () => {
  test('video: includes format selector and merge format', () => {
    const args = buildArgs({ url: 'https://youtu.be/x', format: 'mp4', quality: '720p', filePath: '/tmp/v.mp4' });
    const fIdx = args.indexOf('-f');
    assert.strictEqual(args[fIdx + 1], 'bestvideo*[height<=720]+bestaudio/best[height<=720]/best');
    assert.ok(args.includes('--merge-output-format'));
    assert.ok(!args.includes('-x'));
  });

  test('audio: includes extraction flags', () => {
    const args = buildArgs({ url: 'https://youtu.be/x', format: 'mp3', quality: 'best', filePath: '/tmp/v.mp3' });
    assert.ok(args.includes('-x'));
    assert.deepStrictEqual(args.slice(args.indexOf('--audio-format'), args.indexOf('--audio-format') + 2), ['--audio-format', 'mp3']);
  });

  test('best quality has no height filter', () => {
    const args = buildArgs({ url: 'u', format: 'mp4', quality: 'best', filePath: '/t.mp4' });
    assert.strictEqual(args[args.indexOf('-f') + 1], 'bestvideo*+bestaudio/best');
  });

  test('always pins single-video mode, whatever URL it is given', () => {
    // A watch URL carrying a list= id must not turn one download task into the
    // whole playlist (yt-dlp's default for such a URL is to expand it).
    const args = buildArgs({
      url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa&list=PLbbbbbbbbbbbbbbbb',
      format: 'mp4',
      quality: 'best',
      filePath: '/t.mp4',
    });
    assert.ok(args.includes('--no-playlist'));
    assert.ok(!args.includes('--yes-playlist'));
  });

  test('retry (fallback) attempt keeps single-video mode', () => {
    const args = buildArgs({ url: 'u', format: 'mp4', quality: 'best', filePath: '/t.mp4', fallback: true });
    assert.ok(args.includes('--no-playlist'));
    assert.strictEqual(args[args.indexOf('-f') + 1], 'b');
  });
});

describe('validateLocalDownloadPath', () => {
  test('accepts an existing absolute directory', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-path-'));
    try {
      assert.strictEqual(validateLocalDownloadPath(tmp), path.resolve(tmp));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('rejects relative and nonexistent paths', () => {
    assert.throws(() => validateLocalDownloadPath('relative/path'));
    assert.throws(() => validateLocalDownloadPath('/definitely/does/not/exist/xyz'));
    assert.throws(() => validateLocalDownloadPath(''));
  });
});

describe('isRealPlaylist', () => {
  test('treats explicit playlist pages and user playlists as playlists', () => {
    assert.ok(isRealPlaylist('https://www.youtube.com/playlist?list=PL123'));
    assert.ok(isRealPlaylist('https://www.youtube.com/watch?v=abc&list=PL123'));
    assert.ok(isRealPlaylist('https://youtube.com/watch?v=abc&list=UU123'));
  });

  test('ignores auto-generated lists so a single video stays single', () => {
    // Mix / Radio
    assert.ok(!isRealPlaylist('https://www.youtube.com/watch?v=abc&list=RDMx9SzqJr0'));
    // Liked videos
    assert.ok(!isRealPlaylist('https://www.youtube.com/watch?v=abc&list=LLx9SzqJr0'));
    // Watch later
    assert.ok(!isRealPlaylist('https://www.youtube.com/watch?v=abc&list=WL'));
    // Plain watch URL with no list at all
    assert.ok(!isRealPlaylist('https://www.youtube.com/watch?v=abc'));
    assert.ok(!isRealPlaylist('https://youtu.be/abc'));
  });
});

describe('extractYtInitialData / collectRelatedVideos', () => {
  test('brace-matches the ytInitialData object out of HTML', () => {
    const html = '<script>var ytInitialData = {"a":{"b":"}"},"c":1};</script>rest';
    const data = extractYtInitialData(html);
    assert.deepStrictEqual(data, { a: { b: '}' }, c: 1 });
  });

  test('returns null when the marker is missing', () => {
    assert.strictEqual(extractYtInitialData('<html>nope</html>'), null);
  });

  test('decodes the hex-escaped string form YouTube currently ships', () => {
    const payload = {
      items: [
        { lockupViewModel: { contentId: 'ddddddddddd', metadata: { lockupMetadataViewModel: { title: { content: 'Hex Vid' } } } } },
      ],
    };
    const escaped = JSON.stringify(payload).replace(
      /[^\w]/g,
      (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`,
    );
    const html = `<script>var ytInitialData = '${escaped}';</script>`;

    const data = extractYtInitialData(html);
    assert.deepStrictEqual(data, payload);

    const out = [];
    collectRelatedVideos(data, out);
    assert.deepStrictEqual(out.map((v) => [v.id, v.title]), [['ddddddddddd', 'Hex Vid']]);
  });

  test('collects videoRenderer, lockupViewModel and videoWithContextRenderer entries', () => {
    const data = {
      contents: {
        rails: [
          { videoRenderer: { videoId: 'aaaaaaaaaaa', title: { runs: [{ text: 'Vid A' }] } } },
          { lockupViewModel: { contentId: 'bbbbbbbbbbb', metadata: { lockupMetadataViewModel: { title: { content: 'Vid B' } } } } },
          { lockupViewModel: { contentId: 'notavideoidlonger' } },
          { videoWithContextRenderer: { videoId: 'ccccccccccc', headline: { runs: [{ text: 'Vid C' }] }, lengthText: { simpleText: '4:20' } } },
        ],
      },
    };
    const out = [];
    collectRelatedVideos(data, out);
    assert.deepStrictEqual(
      out.map((v) => [v.id, v.title]),
      [['aaaaaaaaaaa', 'Vid A'], ['bbbbbbbbbbb', 'Vid B'], ['ccccccccccc', 'Vid C']]
    );
  });
});
