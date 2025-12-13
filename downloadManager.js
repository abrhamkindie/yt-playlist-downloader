const EventEmitter = require('events');

class DownloadManager extends EventEmitter {
    constructor(maxConcurrency = 3) {
        super();
        this.queue = [];
        this.activeDownloads = new Map(); // id -> { process, info }
        this.maxConcurrency = maxConcurrency;
    }

    addToQueue(downloadTask) {
        this.queue.push(downloadTask);
        this.emit('queue-update', this.getQueueStatus());
        this.processQueue();
    }

    async processQueue() {
        if (this.activeDownloads.size >= this.maxConcurrency || this.queue.length === 0) {
            return;
        }

        const task = this.queue.shift();
        this.activeDownloads.set(task.id, { process: null, info: task });
        
        this.emit('start', task);
        this.emit('queue-update', this.getQueueStatus());

        try {
            // task.start() should return the child process
            const childProcess = task.start();
            
            if (this.activeDownloads.has(task.id)) {
                this.activeDownloads.get(task.id).process = childProcess;
            }

            // Wait for completion (handled by the task's internal promise or event listener)
            // We assume task.start() triggers the actual download logic
            
        } catch (error) {
            this.handleError(task.id, error);
        }
    }

    handleComplete(id) {
        if (this.activeDownloads.has(id)) {
            this.activeDownloads.delete(id);
            this.emit('complete', { id });
            this.emit('queue-update', this.getQueueStatus());
            this.processQueue();
        }
    }

    handleError(id, error) {
        if (this.activeDownloads.has(id)) {
            this.activeDownloads.delete(id);
            this.emit('error', { id, error });
            this.emit('queue-update', this.getQueueStatus());
            this.processQueue();
        }
    }

    cancelDownload(id) {
        console.log(`[DownloadManager] Request to cancel: ${id}`);
        
        // Check active downloads
        if (this.activeDownloads.has(id)) {
            const { process: childProc, info } = this.activeDownloads.get(id);
            console.log(`[DownloadManager] Found active download. PID: ${childProc ? childProc.pid : 'null'}`);
            
            if (childProc) {
                console.log(`[DownloadManager] Killing process group for PID: ${childProc.pid}`);
                try {
                    // Kill the process group (negative PID) using global process
                    // This ensures that any child processes spawned by the shell/yt-dlp are also killed
                    process.kill(-childProc.pid, 'SIGKILL'); 
                } catch (e) {
                    console.error(`[DownloadManager] Failed to kill process group: ${e.message}`);
                    // Fallback to simple kill if group kill fails (e.g. if not in a separate group)
                    try {
                        childProc.kill('SIGKILL');
                    } catch (e2) {
                        console.error(`[DownloadManager] Failed to kill process directly: ${e2.message}`);
                    }
                }
            }
            
            this.activeDownloads.delete(id);
            // Emit cancelled event immediately so UI updates
            this.emit('cancelled', { id, url: info.url });
            this.emit('queue-update', this.getQueueStatus());
            
            // Process next in queue
            this.processQueue();
            return true;
        }

        // Check queue
        const queueIndex = this.queue.findIndex(t => t.id === id);
        if (queueIndex !== -1) {
            console.log(`[DownloadManager] Found in queue. Removing.`);
            const task = this.queue[queueIndex];
            this.queue.splice(queueIndex, 1);
            this.emit('cancelled', { id, url: task.url });
            this.emit('queue-update', this.getQueueStatus());
            return true;
        }

        console.log(`[DownloadManager] ID not found: ${id}`);
        return false;
    }

    getQueueStatus() {
        return {
            active: Array.from(this.activeDownloads.values()).map(d => d.info),
            pending: this.queue,
            maxConcurrency: this.maxConcurrency
        };
    }
}

module.exports = new DownloadManager();
