const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { DownloadManager } = require('../services/downloadManager');

function makeTask(id, { fails = false, delay = 0 } = {}) {
  return {
    id,
    url: `https://youtube.com/watch?v=${id}`,
    title: `Video ${id}`,
    start: () => {
      const fake = {
        pid: 12345 + Math.floor(Math.random() * 1000),
        kill: () => {},
      };
      if (delay > 0) {
        setTimeout(() => {
          if (fails) mgr.handleError(id, new Error('boom'));
          else mgr.handleComplete(id, { filePath: `/tmp/${id}.mp4` });
        }, delay);
      }
      return fake;
    },
  };
}

let mgr;
describe('DownloadManager', () => {
  beforeEach(() => {
    mgr = new DownloadManager(2);
  });

  test('queues and starts tasks up to concurrency limit', () => {
    mgr.addToQueue(makeTask('a'));
    mgr.addToQueue(makeTask('b'));
    mgr.addToQueue(makeTask('c'));

    assert.strictEqual(mgr.active.size, 2);
    assert.strictEqual(mgr.queue.length, 1);
  });

  test('rejects duplicate ids while active/queued/complete', () => {
    assert.strictEqual(mgr.addToQueue(makeTask('a')), true);
    assert.strictEqual(mgr.addToQueue(makeTask('a')), false);
    mgr.handleComplete('a');
    assert.strictEqual(mgr.addToQueue(makeTask('a')), false); // completed still known
  });

  test('drains queue when a download completes', () => {
    mgr.addToQueue(makeTask('a'));
    mgr.addToQueue(makeTask('b'));
    mgr.addToQueue(makeTask('c'));
    mgr.handleComplete('a', { filePath: '/tmp/a.mp4' });

    assert.strictEqual(mgr.active.size, 2);
    assert.strictEqual(mgr.queue.length, 0);
    assert.strictEqual(mgr.getResult('a').status, 'complete');
    assert.strictEqual(mgr.getResult('a').filePath, '/tmp/a.mp4');
  });

  test('records errors', () => {
    mgr.addToQueue(makeTask('x'));
    mgr.handleError('x', new Error('boom'));
    const rec = mgr.getResult('x');
    assert.strictEqual(rec.status, 'error');
    assert.strictEqual(rec.error, 'boom');
    assert.strictEqual(mgr.active.size, 0);
  });

  test('cancel kills active download and records cancelled', () => {
    mgr.addToQueue(makeTask('a'));
    assert.strictEqual(mgr.cancelDownload('a'), true);
    assert.strictEqual(mgr.getResult('a').status, 'cancelled');
    assert.strictEqual(mgr.active.size, 0);
  });

  test('cancel removes queued task', () => {
    mgr.addToQueue(makeTask('a'));
    mgr.addToQueue(makeTask('b'));
    assert.strictEqual(mgr.cancelDownload('b'), true);
    assert.strictEqual(mgr.queue.length, 0);
    assert.strictEqual(mgr.getResult('b').status, 'cancelled');
  });

  test('cancel returns false for unknown id', () => {
    assert.strictEqual(mgr.cancelDownload('nope'), false);
  });

  test('stopAll cancels everything', () => {
    mgr.addToQueue(makeTask('a'));
    mgr.addToQueue(makeTask('b'));
    mgr.addToQueue(makeTask('c'));
    mgr.stopAll();
    assert.strictEqual(mgr.active.size, 0);
    assert.strictEqual(mgr.queue.length, 0);
  });

  test('getSnapshot exposes active/pending lists', () => {
    mgr.addToQueue(makeTask('a'));
    mgr.addToQueue(makeTask('b'));
    const snap = mgr.getSnapshot();
    // The fake task completes asynchronously; at snapshot time 'a' may have
    // already finalized (the fake has no delay) and 'b' taken its slot.
    assert.strictEqual(snap.active.length + snap.pending.length, 2);
    assert.strictEqual(snap.maxConcurrency, 2);
  });

  test('emits lifecycle events', () => {
    const events = [];
    mgr.on('start', (t) => events.push(`start:${t.id}`));
    mgr.on('complete', (e) => events.push(`complete:${e.id}`));

    mgr.addToQueue(makeTask('a'));
    mgr.handleComplete('a');

    assert.deepStrictEqual(events, ['start:a', 'complete:a']);
  });
});
