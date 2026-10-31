import React from 'react';
import { Link as LinkIcon, ArrowRight, Loader2, FolderOpen, Compass, Zap, Layers } from 'lucide-react';

export default function HeroSection({
  playlistUrl,
  setPlaylistUrl,
  onAnalyze,
  isAnalyzing,
  downloadPath,
  setDownloadPath,
  onPickDirectory,
  createSubfolder,
  setCreateSubfolder,
  hostedMode,
}) {
  return (
    <section className="relative mb-10 overflow-hidden rounded-[32px] border border-line bg-surface px-5 py-10 shadow-panel sm:px-10 sm:py-14">
      {/* Decorative layers: dot grid + soft blobs */}
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-sky-100/80 blur-2xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-accent-100/70 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-3xl text-center">
        {/* Eyebrow badge */}
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-bold tracking-wide text-brand-700 uppercase">
          <Compass className="h-3.5 w-3.5" strokeWidth={2.4} />
          Playlist downloader
        </span>

        {/* Headline */}
        <h1 className="font-display mt-5 text-[34px] leading-[1.12] font-extrabold tracking-tight text-ink sm:text-[44px]">
          Save entire playlists,
          <br className="hidden sm:block" />{' '}
          <span className="relative inline-block text-brand-600">
            straight to your library
            <svg
              className="absolute -bottom-1.5 left-0 w-full text-accent-500"
              viewBox="0 0 200 12"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M3 9C40 3 90 2 127 5c26 2 48 3 70 1" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            </svg>
          </span>
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-ink-secondary sm:text-base">
          {hostedMode
            ? 'Paste a playlist link — finished files can be saved straight to your device.'
            : 'Paste a playlist link to fetch the video list, then pick exactly what to download.'}
        </p>

        {/* Search pill */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-grow">
            <LinkIcon
              className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted"
              strokeWidth={2}
            />
            <input
              type="text"
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isAnalyzing && onAnalyze()}
              aria-label="YouTube playlist URL"
              className="ring-focus w-full rounded-full border border-line bg-surface py-4 pl-14 pr-5 text-sm font-medium text-ink shadow-soft transition-shadow placeholder:text-ink-muted"
              placeholder="https://www.youtube.com/playlist?list=…"
            />
          </div>
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand-600 px-8 py-4 text-sm font-bold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} />
                <span>Analyzing…</span>
              </>
            ) : (
              <>
                <span>Analyze</span>
                <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
              </>
            )}
          </button>
        </div>

        {!hostedMode && (
          <div className="mt-4 grid grid-cols-1 gap-3 text-left md:grid-cols-2">
            <div className="relative">
              <FolderOpen
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                strokeWidth={2}
              />
              <input
                type="text"
                value={downloadPath}
                onChange={(e) => setDownloadPath(e.target.value)}
                aria-label="Download path"
                className="ring-focus w-full rounded-full border border-line bg-surface py-3 pl-11 pr-24 text-sm font-medium text-ink shadow-soft transition-shadow placeholder:text-ink-muted"
                placeholder="Download folder (optional)"
              />
              <button
                onClick={onPickDirectory}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-surface-muted px-4 py-1.5 text-xs font-bold text-ink-secondary transition-colors hover:bg-line"
              >
                Browse…
              </button>
            </div>

            <label className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-full border border-line bg-surface px-5 py-3 shadow-soft">
              <span className="text-sm font-semibold text-ink-secondary">Subfolder per playlist</span>
              <div className="relative">
                <input
                  type="checkbox"
                  role="switch"
                  checked={createSubfolder}
                  onChange={(e) => setCreateSubfolder(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="h-6 w-11 rounded-full bg-line-strong transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/35" />
                <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
              </div>
            </label>
          </div>
        )}

        {/* Trust chips */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas px-4 py-2 text-xs font-semibold text-ink-secondary">
            <Zap className="h-3.5 w-3.5 text-accent-600" strokeWidth={2.4} />
            Up to 4K &amp; MP3
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas px-4 py-2 text-xs font-semibold text-ink-secondary">
            <Layers className="h-3.5 w-3.5 text-brand-600" strokeWidth={2.4} />
            Batch downloads
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas px-4 py-2 text-xs font-semibold text-ink-secondary">
            <Compass className="h-3.5 w-3.5 text-success-600" strokeWidth={2.4} />
            Live progress
          </span>
        </div>
      </div>
    </section>
  );
}
