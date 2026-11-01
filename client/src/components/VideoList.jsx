import React from 'react';
import { Link2, SlidersHorizontal, Download, SearchX, Compass, MapPin, Sparkles } from 'lucide-react';
import VideoControls from './VideoControls';
import VideoCard from './VideoCard';

/**
 * VoyageGo-inspired empty state: a stylized "boarding-pass" card
 * showing a playlist as a travel itinerary.
 */
function EmptyIllustration() {
  return (
    <div className="relative mx-auto mb-8 flex h-40 w-full max-w-sm items-center justify-center">
      {/* Backdrop circle */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-32 w-32 rounded-full bg-brand-50" />
      </div>
      {/* Inner card (stylized playlist) */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
        <div className="flex items-center gap-2 border-b border-line bg-surface-muted px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-line-strong" />
          <span className="h-2 w-2 rounded-full bg-line-strong" />
          <span className="h-2 w-2 rounded-full bg-line-strong" />
        </div>
        <div className="px-3 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-10 rounded-md bg-brand-100" />
            <div className="flex-grow space-y-1">
              <div className="h-2 w-full rounded bg-line" />
              <div className="h-2 w-3/5 rounded bg-line" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-10 rounded-md bg-accent-100" />
            <div className="flex-grow space-y-1">
              <div className="h-2 w-4/5 rounded bg-line" />
              <div className="h-2 w-2/5 rounded bg-line" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-10 rounded-md bg-sky-100" />
            <div className="flex-grow space-y-1">
              <div className="h-2 w-full rounded bg-line" />
              <div className="h-2 w-3/5 rounded bg-line" />
            </div>
          </div>
        </div>
      </div>
      {/* Floating pin */}
      <span className="absolute -top-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-600 text-white shadow-accent">
        <MapPin className="h-4 w-4" strokeWidth={2.4} />
      </span>
      <span className="absolute -bottom-2 -left-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-brand">
        <Compass className="h-4 w-4" strokeWidth={2.2} />
      </span>
    </div>
  );
}

const STEPS = [
  {
    icon: <Link2 className="h-5 w-5" strokeWidth={2.2} />,
    tint: 'bg-brand-50 text-brand-700',
    title: 'Paste the link',
    description: 'Any YouTube playlist or video URL',
  },
  {
    icon: <SlidersHorizontal className="h-5 w-5" strokeWidth={2.2} />,
    tint: 'bg-accent-50 text-accent-700',
    title: 'Pick format & quality',
    description: 'MP4, MP3, up to 4K',
  },
  {
    icon: <Download className="h-5 w-5" strokeWidth={2.2} />,
    tint: 'bg-sky-50 text-sky-700',
    title: 'Hit download',
    description: 'One by one, or the whole selection',
  },
];

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-dashed border-line-strong bg-surface px-6 py-14 text-center shadow-soft">
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div className="relative">
        <EmptyIllustration />

        <h3 className="font-display text-xl font-extrabold tracking-tight text-ink">
          Your destination is empty
        </h3>
        <p className="mt-1.5 text-sm text-ink-secondary">
          Analyze a playlist above and your videos will show up here.
        </p>

        <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="relative rounded-2xl border border-line bg-canvas p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <span className="absolute right-4 top-4 font-display text-xs font-extrabold tabular-nums text-ink-muted">
                0{i + 1}
              </span>
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${step.tint}`}>
                {step.icon}
              </span>
              <p className="mt-3 text-sm font-bold text-ink">{step.title}</p>
              <p className="mt-1 text-xs text-ink-secondary">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NoMatches({ search }) {
  return (
    <div className="rounded-3xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center shadow-soft">
      <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted text-ink-muted">
        <SearchX className="h-6 w-6" strokeWidth={2} />
      </span>
      <p className="text-sm font-semibold text-ink">
        Nothing matches &ldquo;{search}&rdquo;
      </p>
      <p className="mt-1 text-xs text-ink-secondary">
        Try a different keyword, or clear the filter.
      </p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-4 shadow-soft sm:flex-row">
      <div className="skeleton h-44 w-full flex-shrink-0 rounded-2xl sm:h-[112px] sm:w-[196px]" />
      <div className="flex min-w-0 flex-grow flex-col justify-between">
        <div>
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="skeleton mt-2.5 h-4 w-1/3 rounded" />
        </div>
        <div className="mt-4">
          <div className="skeleton h-1.5 w-full rounded-full" />
          <div className="mt-3 flex gap-2">
            <div className="skeleton h-9 w-28 rounded-full" />
            <div className="skeleton h-9 w-24 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="mb-6 flex flex-col items-center justify-between gap-3 rounded-3xl border border-line bg-surface p-4 shadow-soft lg:flex-row">
        <div className="flex w-full flex-wrap items-center gap-2.5 lg:w-auto">
          <div className="skeleton h-10 w-28 rounded-full" />
          <div className="skeleton h-10 w-32 rounded-full" />
          <div className="skeleton h-10 min-w-[12rem] flex-grow rounded-full lg:flex-grow-0 lg:w-56" />
        </div>
        <div className="flex w-full items-center gap-3 lg:w-auto">
          <div className="skeleton h-8 w-24 rounded-full" />
          <div className="skeleton h-8 w-24 rounded-full" />
          <div className="ml-auto skeleton h-10 w-44 rounded-full" />
        </div>
      </div>
      {Array.from({ length: 6 }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export default function VideoList({
  videos,
  totalCount,
  isAnalyzing,
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
  if (isAnalyzing) {
    return <SkeletonList />;
  }

  if (totalCount === 0) {
    return <EmptyState />;
  }

  // Split the target video(s) from any appended related videos so the UI can
  // label them. Playlists have no related entries, so everything is primary.
  const primaryVideos = videos.filter((v) => !v.isRelated);
  const relatedVideos = videos.filter((v) => v.isRelated);

  return (
    <div className="space-y-3">
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

      {videos.length === 0 ? (
        <NoMatches search={search} />
      ) : (
        <div className="space-y-3">
          {primaryVideos.map((video) => (
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

          {relatedVideos.length > 0 && (
            <>
              <div className="flex items-center gap-3 pt-4 pb-1">
                <div className="h-px flex-grow bg-line" />
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
                  Related videos
                </span>
                <div className="h-px flex-grow bg-line" />
              </div>
              {relatedVideos.map((video) => (
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
