import React from 'react';

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

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
  const isDownloading = status === 'downloading' || status === 'queued';
  const isComplete = status === 'complete';
  const isError = status === 'error';
  const duration = formatDuration(video.duration);

  const statusColor = isComplete
    ? 'text-green-600 font-semibold'
    : isError
      ? 'text-red-600 font-medium'
      : isDownloading
        ? 'text-primary-600 font-semibold'
        : 'text-gray-500';

  const statusIcon = isComplete ? '✓' : isError ? '⚠' : isDownloading ? '↓' : '';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row gap-4 transition-all hover:shadow-md">
      <div className="flex-shrink-0 relative group">
        <img
          src={video.thumbnail}
          alt=""
          loading="lazy"
          className="w-full sm:w-48 h-32 object-cover rounded-lg shadow-sm bg-gray-100"
        />
        <div className="absolute top-2 left-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onToggleSelect(video.id, e.target.checked)}
            aria-label={`Select ${video.title}`}
            className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 focus:ring-2 border-gray-300 shadow-sm cursor-pointer"
          />
        </div>
        {duration && (
          <span className="absolute bottom-2 right-2 bg-black/75 text-white text-xs px-1.5 py-0.5 rounded">
            {duration}
          </span>
        )}
      </div>

      <div className="flex-grow flex flex-col justify-between min-w-0">
        <div>
          <h3 className="text-base font-semibold text-gray-900 line-clamp-2 mb-1" title={video.title}>
            {video.title}
          </h3>
          <p className={`text-sm flex items-center gap-1 ${statusColor}`} aria-live="polite">
            {statusIcon && <span aria-hidden="true">{statusIcon}</span>}
            {isComplete
              ? 'Download Complete'
              : isError
                ? `Error: ${state.error || 'Unknown'}`
                : isDownloading
                  ? `Downloading: ${Math.round(state.progress || 0)}%${state.speed ? ` • ${state.speed}` : ''}${state.eta ? ` • ETA ${state.eta}` : ''}`
                  : status === 'queued'
                    ? 'Waiting in queue…'
                    : status === 'cancelled'
                      ? 'Cancelled'
                      : 'Ready to download'}
          </p>
        </div>

        <div className="mt-3">
          {(isDownloading || isComplete) && (
            <div className="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${isComplete ? 'bg-green-500' : 'bg-primary-600'}`}
                style={{ width: `${state.progress || 0}%` }}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isComplete && hostedMode ? (
              <a
                href={onOpenFolder(video.id)}
                download
                className="flex-1 sm:flex-none bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium py-2 px-4 rounded-lg border border-gray-300 transition-colors inline-flex items-center justify-center gap-2"
              >
                <DownloadIcon />
                Save to device
              </a>
            ) : isComplete ? (
              <button
                onClick={() => onOpenFolder(state.filePath)}
                className="flex-1 sm:flex-none bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium py-2 px-4 rounded-lg border border-gray-300 transition-colors inline-flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
                Open Folder
              </button>
            ) : (
              <button
                onClick={() => onDownload(video)}
                disabled={status === 'queued' || status === 'downloading'}
                className={`flex-1 sm:flex-none text-sm font-medium py-2 px-4 rounded-lg transition-colors shadow-sm inline-flex items-center justify-center gap-2 ${
                  status === 'error'
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                    : 'bg-primary-600 hover:bg-primary-700 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {status === 'error' ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retry
                  </>
                ) : (
                  <>
                    <DownloadIcon />
                    Download
                  </>
                )}
              </button>
            )}

            {isDownloading && (
              <button
                onClick={() => onCancel(video)}
                className="flex-1 sm:flex-none bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium py-2 px-4 rounded-lg transition-colors border border-red-200 inline-flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
