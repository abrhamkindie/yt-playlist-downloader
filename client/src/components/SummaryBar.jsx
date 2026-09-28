import React from 'react';

/**
 * Aggregate progress bar for the whole batch:
 * "12 of 25 done • 2 failed" + a stacked progress bar.
 */
export default function SummaryBar({ videos, videoStates }) {
  if (!videos.length) return null;

  let complete = 0;
  let failed = 0;
  let active = 0;

  for (const v of videos) {
    const s = videoStates[v.id]?.status;
    if (s === 'complete') complete += 1;
    else if (s === 'error') failed += 1;
    else if (s === 'downloading' || s === 'queued') active += 1;
  }

  if (complete + failed + active === 0) return null;

  const total = videos.length;
  const pct = Math.round((complete / total) * 100);
  const failedPct = Math.round((failed / total) * 100);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="font-medium text-gray-700">
          {complete} of {total} downloaded
          {active > 0 && <span className="text-gray-400"> • {active} in progress</span>}
          {failed > 0 && <span className="text-red-500"> • {failed} failed</span>}
        </span>
        <span className="text-gray-400">{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden flex" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${pct}%` }} />
        <div className="h-full bg-red-400 transition-all duration-300" style={{ width: `${failedPct}%` }} />
      </div>
    </div>
  );
}
