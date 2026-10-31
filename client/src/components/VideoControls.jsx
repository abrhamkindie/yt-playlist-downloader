import React from 'react';
import { ChevronDown, Search, Download, OctagonX, CheckSquare } from 'lucide-react';
import { FORMATS, QUALITIES } from '../lib/constants';

const SELECT_CLASS =
  'appearance-none rounded-full border border-line bg-surface py-2.5 pl-4 pr-9 text-sm font-semibold text-ink shadow-soft ring-focus transition-colors hover:border-brand-300';

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
      strokeWidth={2.2}
    />
  );
}

export default function VideoControls({
  format,
  setFormat,
  quality,
  setQuality,
  search,
  setSearch,
  selectedCount,
  onSelectAll,
  isAllSelected,
  isIndeterminate,
  activeDownloadsCount,
  onCancelAll,
  onDownloadSelected,
}) {
  const isAudio = FORMATS.audio.includes(format);

  return (
    <div className="sticky top-[84px] z-40 mb-6 rounded-3xl border border-line bg-surface/95 p-4 shadow-soft backdrop-blur-md">
      <div className="flex flex-col items-center justify-between gap-3 xl:flex-row">
        {/* Left: selects + search */}
        <div className="flex w-full flex-wrap items-center gap-2.5 xl:w-auto">
          <div className="relative">
            <label htmlFor="formatSelect" className="sr-only">
              Format
            </label>
            <select
              id="formatSelect"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className={SELECT_CLASS}
            >
              <optgroup label="Video">
                {FORMATS.video.map((f) => (
                  <option key={f} value={f}>{f.toUpperCase()}</option>
                ))}
              </optgroup>
              <optgroup label="Audio">
                {FORMATS.audio.map((f) => (
                  <option key={f} value={f}>{f.toUpperCase()}</option>
                ))}
              </optgroup>
            </select>
            <SelectChevron />
          </div>

          <div className={`relative ${isAudio ? 'pointer-events-none opacity-50' : ''}`}>
            <label htmlFor="qualitySelect" className="sr-only">
              Quality
            </label>
            <select
              id="qualitySelect"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              disabled={isAudio}
              className={SELECT_CLASS}
            >
              {QUALITIES.map((q) => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
            <SelectChevron />
          </div>

          <div className="relative min-w-[11rem] flex-grow xl:w-56 xl:flex-grow-0">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              strokeWidth={2.2}
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter videos…"
              aria-label="Filter videos by title"
              className="ring-focus w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-sm font-medium text-ink shadow-soft placeholder:text-ink-muted"
            />
          </div>
        </div>

        {/* Right: select-all + actions */}
        <div className="flex w-full flex-wrap items-center justify-between gap-2.5 xl:w-auto xl:justify-end">
          <label className="flex cursor-pointer select-none items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-secondary shadow-soft transition-colors hover:border-brand-300">
            <input
              type="checkbox"
              id="selectAllCheckbox"
              checked={isAllSelected}
              ref={(el) => el && (el.indeterminate = isIndeterminate)}
              onChange={(e) => onSelectAll(e.target.checked)}
              className="h-4 w-4 rounded border-line-strong text-brand-600 focus:ring-brand-500"
            />
            Select all
          </label>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-bold text-brand-700">
            <CheckSquare className="h-3 w-3" strokeWidth={2.4} />
            {selectedCount} selected
          </span>

          {activeDownloadsCount > 0 && (
            <button
              onClick={onCancelAll}
              className="inline-flex items-center gap-2 rounded-full border border-danger-200 bg-danger-50 px-4 py-2 text-sm font-bold text-danger-700 transition-colors hover:bg-danger-100"
            >
              <OctagonX className="h-4 w-4" strokeWidth={2.2} />
              Cancel all
            </button>
          )}

          <button
            onClick={onDownloadSelected}
            disabled={selectedCount === 0}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <Download className="h-4 w-4" strokeWidth={2.4} />
            Download selected
          </button>
        </div>
      </div>
    </div>
  );
}
