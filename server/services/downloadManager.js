const EventEmitter = require('events');
const { MAX_CONCURRENT_DOWNLOADS, RECORD_TTL_MS } = require('../lib/constants');

/**
 * Manages the download queue and active downloads.
 * Emits: start, complete, download-error, cancelled, queue-update
 * (Note: "download-error" not "error" — an unlistened "error" event throws.)
 *
 * A "task" is { id, url, title, start: () => ChildProcess|null }.
 */
class DownloadManager extends EventEmitter {
  constructor(maxConcurrency = MAX_CONCURRENT_DOWNLOADS) {
    super();
    this.queue = [];
    this.active = new Map(); // id -> { process, info }
    this.maxConcurrency = maxConcurrency;
    this.results = new Map(); // id -> { id, status, title, url, filePath?, error?, startedAt, finishedAt }
    this._pruneTimer = setInterval(() => this._prune(), RECORD_TTL_MS / 4);
    if (typeof this._pruneTimer.unref === 'function') this._pruneTimer.unref();
  }

  /** Queue a task. Returns false if this video is already queued/active/done. */
  addToQueue(task) {
    if (this._isKnown(task.id)) {
      console.log(`[DownloadManager] Duplicate ignored: ${task.id}`);
      return false;
    }
    this.queue.push(task);
    this.emit('queue-update', this.getSnapshot());
    this._drain();
    return true;
  }

  _isKnown(id) {
    return (
      this.active.has(id) ||
      this.queue.some((t) => t.id === id) ||
      (this.results.has(id) && ['queued', 'downloading', 'complete'].includes(this.results.get(id).status))
    );
  }

  _drain() {
    while (this.active.size < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task || typeof task.start !== 'function') {
        console.error('[DownloadManager] Invalid task; skipping');
        continue;
      }

      this.active.set(task.id, { process: null, info: task });
      this.results.set(task.id, {
        id: task.id,
        status: 'downloading',
        title: task.title,
        url: task.url,
        startedAt: Date.now(),
      });
      this.emit('start', task);
      this.emit('queue-update', this.getSnapshot());

      try {
        const child = task.start();
        if (!child) {
          // start() already reported the error via its onError callback.
          continue;
        }
        this.active.get(task.id).process = child;
      } catch (err) {
        console.error('[DownloadManager] Error starting task:', err.message);
        this.handleError(task.id, err);
      }
    }
  }

  _finalize(id, status, extra = {}) {
    const activeEntry = this.active.get(id);
    if (activeEntry) {
      this.active.delete(id);
      const prev = this.results.get(id) || {};
      this.results.set(id, {
        id,
        title: prev.title || activeEntry.info.title,
        url: prev.url || activeEntry.info.url,
        startedAt: prev.startedAt,
        status,
        ...extra,
        finishedAt: Date.now(),
      });
      this.emit(status === 'error' ? 'download-error' : status, { id, ...extra });
      this.emit('queue-update', this.getSnapshot());
      this._drain();
      return true;
    }

    // Not active (cancelled while queued, or unknown) — record if we know it.
    if (this.results.has(id)) {
      const prev = this.results.get(id);
      this.results.set(id, { ...prev, status, ...extra, finishedAt: Date.now() });
      return true;
    }
    return false;
  }

  handleComplete(id, { filePath } = {}) {
    return this._finalize(id, 'complete', { filePath });
  }

  handleError(id, error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[DownloadManager] Error for ${id}: ${message}`);
    return this._finalize(id, 'error', { error: message });
  }

  /** Cancel by id: kills the active process or removes a queued task. */
  cancelDownload(id) {
    const active = this.active.get(id);
    if (active) {
      if (active.process) this._killTree(active.process);
      this.active.delete(id);
      const prev = this.results.get(id) || {};
      this.results.set(id, { ...prev, id, status: 'cancelled', finishedAt: Date.now() });
      this.emit('cancelled', { id, url: prev.url || active.info.url });
      this.emit('queue-update', this.getSnapshot());
      this._drain();
      return true;
    }

    const queueIndex = this.queue.findIndex((t) => t.id === id);
    if (queueIndex !== -1) {
      const [task] = this.queue.splice(queueIndex, 1);
      const prev = this.results.get(id) || { url: task.url };
      this.results.set(id, { ...prev, id, status: 'cancelled', finishedAt: Date.now() });
      this.emit('cancelled', { id, url: task.url });
      this.emit('queue-update', this.getSnapshot());
      return true;
    }

    console.log(`[DownloadManager] Cancel: id not found ${id}`);
    return false;
  }

  stopAll() {
    console.log('[DownloadManager] Stopping all downloads...');
    for (const task of this.queue.splice(0)) {
      const prev = this.results.get(task.id) || { url: task.url };
      this.results.set(task.id, { ...prev, id: task.id, status: 'cancelled', finishedAt: Date.now() });
      this.emit('cancelled', { id: task.id, url: task.url });
    }
    for (const id of [...this.active.keys()]) {
      this.cancelDownload(id);
    }
    this.emit('queue-update', this.getSnapshot());
  }

  _killTree(child) {
    try {
      // Child is spawned detached → kill the whole process group.
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      try { child.kill('SIGKILL'); } catch { /* already dead */ }
    }
  }

  getSnapshot() {
    return {
      active: [...this.active.values()].map((d) => ({ id: d.info.id, url: d.info.url, title: d.info.title })),
      pending: this.queue.map((t) => ({ id: t.id, url: t.url, title: t.title })),
      maxConcurrency: this.maxConcurrency,
    };
  }

  /** All known download records, for /api/status refresh-restore. */
  getAllResults() {
    return [...this.results.values()];
  }

  getResult(id) {
    return this.results.get(id);
  }

  _prune() {
    const now = Date.now();
    for (const [id, rec] of this.results) {
      if (
        (rec.status === 'complete' || rec.status === 'error' || rec.status === 'cancelled') &&
        rec.finishedAt &&
        now - rec.finishedAt > RECORD_TTL_MS
      ) {
        this.results.delete(id);
      }
    }
  }

  destroy() {
    clearInterval(this._pruneTimer);
  }
}

module.exports = new DownloadManager();
module.exports.DownloadManager = DownloadManager;
