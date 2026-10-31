import React from 'react';
import { Download, FolderOpen, RefreshCw, OctagonX, Play, HardDriveDownload } from 'lucide-react';
import { api } from '../lib/api';

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

const STATUS_BADGE = {
  ready: { label: 'Ready', className: 'bg-surface-muted text-ink-secondary' },
  queued: { label: 'In queue', className: 'bg-brand-50 text-brand-700' },
  downloading: null,
  complete: { label: 'Complete', className: 'bg-success-50 text-success-700' },
  error: { label: 'Failed', className: 'bg-danger-50 text-danger-700' },
  cancelled: { label: 'Cancelled', className: 'bg-surface-muted text-ink-muted' },
};

const BTN_PRIMARY =
  'inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:flex-none';

const BTN_SECONDARY =
  'inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-bold text-ink-secondary shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700 sm:flex-none';

const BTN_DANGER =
  'inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-danger-200 bg-danger-50 px-5 py-2.5 text-sm font-bold text-danger-700 transition-all hover:-translate-y-0.5 hover:bg-danger-100 sm:flex-none';

const BTN_RETRY =
  'inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-danger-200 bg-danger-50 px-5 py-2.5 text-sm font-bold text-danger-700 transition-all hover:-translate-y-0.5 hover:bg-danger-100 sm:flex-none';

export default function VideoCard({
  video,
  state,
  isSelected,
  onToggleSelect,
  onDownload,
  onCancel,
  onOpenFolder,
  hostedMode,
}) {
  const status = state?.status || 'ready';
  const isDownloading = status === 'downloading';
  const isComplete = status === 'complete';
  const isError = status === 'error';
  const duration = formatDuration(video.duration);

  const badge =
    status === 'downloading'
      ? { label: `${Math.round(state.progress || 0)}%`, className: 'bg-brand-50 text-brand-700' }
      : STATUS_BADGE[status] || STATUS_BADGE.ready;

  return (
    <div className="group flex flex-col gap-4 rounded-3xl border border-line bg-surface p-4 shadow-soft transition-all hover:shadow-card-hover sm:flex-row">
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 overflow-hidden rounded-2xl">
        <img
          src={video.thumbnail}
          alt=""
          loading="lazy"
          className="h-44 w-full bg-surface-muted object-cover transition-transform duration-300 group-hover:scale-[1.03] sm:h-[112px] sm:w-[196px]"
        />
        {/* Play overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/0 transition-colors group-hover:bg-ink/10">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-brand-600 opacity-0 shadow-soft transition-opacity group-hover:opacity-100">
            <Play className="ml-0.5 h-4 w-4 fill-current" strokeWidth={0} />
          </span>
        </div>
        {/* Checkbox */}
        <label className="absolute left-2.5 top-2.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl bg-white/95 shadow-soft backdrop-blur transition-colors hover:bg-white">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onToggleSelect(video.id, e.target.checked)}
            aria-label={`Select ${video.title}`}
            className="h-4 w-4 cursor-pointer rounded border-line-strong text-brand-600 focus:ring-brand-500"
          />
        </label>
        {/* Duration */}
        {duration && (
          <span className="absolute bottom-2.5 right-2.5 rounded-full bg-ink/75 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white backdrop-blur">
            {duration}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-grow flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-[15px] font-bold text-ink transition-colors group-hover:text-brand-700" title={video.title}>
              {video.title}
            </h3>
            <span
              className={`flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-bold tabular-nums ${badge.className}`}
              aria-live="polite"
            >
              {badge.label}
            </span>
          </div>

          {isDownloading && (
            <p className="mt-1.5 flex items-center gap-2 text-xs font-semibold tabular-nums text-ink-secondary">
              {state.speed && (
                <span className="inline-flex items-center gap-1">
                  <Download className="h-3 w-3 text-brand-600" strokeWidth={2.4} />
                  {state.speed}
                </span>
              )}
              {state.speed && state.eta && <span className="text-ink-muted">·</span>}
              {state.eta && <span>ETA {state.eta}</span>}
            </p>
          )}
          {isError && (
            <p className="mt-1.5 line-clamp-2 text-xs font-semibold text-danger-700" title={state.error}>
              {state.error || 'Something went wrong. Try again.'}
            </p>
          )}
        </div>

        <div className="mt-4">
          {(isDownloading || status === 'queued' || isComplete) && (
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full rounded-full transition-all duration-300 ${isComplete ? 'bg-success-600' : 'bg-gradient-to-r from-brand-400 to-brand-600'}`}
                style={{ width: `${isComplete ? 100 : (state.progress || 0)}%` }}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isComplete && hostedMode ? (
              <a href={api.fileUrl(video.id)} download className={BTN_PRIMARY}>
                <HardDriveDownload className="h-4 w-4" strokeWidth={2.2} />
                Save to device
              </a>
            ) : isComplete ? (
              <button onClick={() => onOpenFolder(state.filePath)} className={BTN_SECONDARY}>
                <FolderOpen className="h-4 w-4" strokeWidth={2.2} />
                Open folder
              </button>
            ) : (
              <button
                onClick={() => onDownload(video)}
                disabled={status === 'queued' || isDownloading}
                className={isError ? BTN_RETRY : BTN_PRIMARY}
              >
                {isError ? (
                  <>
                    <RefreshCw className="h-4 w-4" strokeWidth={2.2} />
                    Retry
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" strokeWidth={2.2} />
                    {status === 'queued' ? 'Queued' : isDownloading ? 'Downloading' : 'Download'}
                  </>
                )}
              </button>
            )}

            {(isDownloading || status === 'queued') && (
              <button onClick={() => onCancel(video)} className={BTN_DANGER}>
                <OctagonX className="h-4 w-4" strokeWidth={2.2} />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
