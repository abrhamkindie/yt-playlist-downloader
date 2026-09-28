const { test, describe } = require('node:test');
const assert = require('node:assert');
const { sanitizeFilename, uniqueFilePath } = require('../lib/files');
const { friendlyYtdlpError } = require('../lib/errors');
const { parseProgressLine, buildArgs } = require('../services/downloader');
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
    assert.strictEqual(args[fIdx + 1], 'bestvideo[height<=720]+bestaudio/best[height<=720]');
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
    assert.strictEqual(args[args.indexOf('-f') + 1], 'bestvideo+bestaudio/best');
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
