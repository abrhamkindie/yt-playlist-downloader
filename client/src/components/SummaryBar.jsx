import React from 'react';
import { CircleCheck, Loader2, CircleX } from 'lucide-react';

/**
 * Aggregate progress for the whole batch:
 * stat pills (done / in progress / failed) + a gradient progress bar.
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

  const stats = [
    {
      label: 'Downloaded',
      value: `${complete}/${total}`,
      icon: <CircleCheck className="h-4 w-4 text-brand-600" strokeWidth={2.2} />,
      tint: 'border-brand-200 bg-brand-50',
    },
    {
      label: 'In progress',
      value: String(active),
      icon: <Loader2 className={`h-4 w-4 text-accent-600 ${active > 0 ? 'animate-spin' : ''}`} strokeWidth={2.2} />,
      tint: 'border-accent-100 bg-accent-50',
    },
    {
      label: 'Failed',
      value: String(failed),
      icon: <CircleX className="h-4 w-4 text-danger-600" strokeWidth={2.2} />,
      tint: 'border-danger-200 bg-danger-50',
    },
  ];

  return (
    <div className="mb-8 rounded-3xl border border-line bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {stats.map((s) => (
            <span
              key={s.label}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold ${s.tint}`}
            >
              {s.icon}
              <span className="text-ink">{s.value}</span>
              <span className="font-semibold text-ink-secondary">{s.label}</span>
            </span>
          ))}
        </div>
        <span className="font-display text-lg font-extrabold tabular-nums text-ink">{pct}%</span>
      </div>

      <div
        className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
        <div className="h-full bg-danger-600/70 transition-all duration-300" style={{ width: `${failedPct}%` }} />
      </div>
    </div>
  );
}
