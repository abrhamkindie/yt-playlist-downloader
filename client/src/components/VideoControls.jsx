import React from 'react';
import { FORMATS, QUALITIES } from '../lib/constants';

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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-col lg:flex-row items-center justify-between gap-4 sticky top-20 z-40">
      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        <div className="flex items-center gap-2">
          <label htmlFor="formatSelect" className="text-sm font-medium text-gray-600">Format:</label>
          <select
            id="formatSelect"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 p-2 outline-none"
          >
            <optgroup label="Video">
              {FORMATS.video.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
            </optgroup>
            <optgroup label="Audio">
              {FORMATS.audio.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
            </optgroup>
          </select>
        </div>

        <div className={`flex items-center gap-2 ${isAudio ? 'opacity-50 pointer-events-none' : ''}`}>
          <label htmlFor="qualitySelect" className="text-sm font-medium text-gray-600">Quality:</label>
          <select
            id="qualitySelect"
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            disabled={isAudio}
            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 p-2 outline-none"
          >
            {QUALITIES.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
          </select>
        </div>

        <div className="relative flex-grow min-w-[10rem]">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter videos…"
            aria-label="Filter videos by title"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="selectAllCheckbox"
            checked={isAllSelected}
            ref={(el) => el && (el.indeterminate = isIndeterminate)}
            onChange={(e) => onSelectAll(e.target.checked)}
            className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
          />
          <label htmlFor="selectAllCheckbox" className="text-sm font-medium text-gray-700">Select All</label>
          <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full ml-1">
            {selectedCount} selected
          </span>
        </div>

        {activeDownloadsCount > 0 && (
          <button
            onClick={onCancelAll}
            className="bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2 px-4 rounded-lg transition-colors shadow-sm text-sm flex items-center gap-2 border border-red-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel All
          </button>
        )}

        <button
          onClick={onDownloadSelected}
          disabled={selectedCount === 0}
          className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-6 rounded-lg transition-colors shadow-sm text-sm flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </button>
      </div>
    </div>
  );
}
