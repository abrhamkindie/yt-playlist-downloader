import React from 'react';
import VideoControls from './VideoControls';
import VideoCard from './VideoCard';

export default function VideoList({
  videos,
  totalCount,
  videoStates,
  selectedVideos,
  onToggleSelect,
  onSelectAll,
  isAllSelected,
  isIndeterminate,
  onDownload,
  onCancel,
  onOpenFolder,
  hostedMode,
  format,
  setFormat,
  quality,
  setQuality,
  search,
  setSearch,
  onDownloadSelected,
  onCancelAll,
  activeDownloadsCount,
}) {
  if (videos.length === 0 && totalCount === 0) {
    return (
      <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>No videos loaded yet. Analyze a playlist to see videos here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <VideoControls
        format={format}
        setFormat={setFormat}
        quality={quality}
        setQuality={setQuality}
        search={search}
        setSearch={setSearch}
        selectedCount={selectedVideos.size}
        totalCount={totalCount}
        onSelectAll={onSelectAll}
        isAllSelected={isAllSelected}
        isIndeterminate={isIndeterminate}
        activeDownloadsCount={activeDownloadsCount}
        onCancelAll={onCancelAll}
        onDownloadSelected={onDownloadSelected}
      />

      {videos.length === 0 && (
        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <p>No videos match "{search}".</p>
        </div>
      )}

      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          state={videoStates[video.id]}
          isSelected={selectedVideos.has(video.id)}
          onToggleSelect={onToggleSelect}
          onDownload={onDownload}
          onCancel={onCancel}
          onOpenFolder={onOpenFolder}
          hostedMode={hostedMode}
        />
      ))}
    </div>
  );
}
