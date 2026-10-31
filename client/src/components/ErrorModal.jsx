import React, { useEffect } from 'react';
import { CircleAlert, X, Settings, Lightbulb } from 'lucide-react';

/**
 * Contextual tips keyed off the raw error text. Each entry: test → tips[].
 * The first match wins, so order from most to least specific.
 */
const GUIDANCE = [
  {
    test: /sign in to confirm|not a bot|cookies/i,
    title: 'YouTube is asking you to sign in',
    tips: [
      'Open Settings → Authentication and enable “Use cookies from your browser”, or paste a cookies.txt.',
      'Make sure you are logged into YouTube in that browser.',
    ],
    showSettings: true,
  },
  {
    test: /format is not available|no formats|requested format/i,
    title: 'That format is not available for this video',
    tips: [
      'Try a different Quality (e.g. “Best Available”) or container (MKV is the most permissive).',
      'Some videos are age- or region-restricted — enable browser cookies in Settings.',
      'Keep yt-dlp up to date from Settings → Engine.',
    ],
    showSettings: true,
  },
  {
    test: /429|too many requests|rate/i,
    title: 'YouTube rate-limited the request',
    tips: [
      'Wait a minute and retry.',
      'Reducing concurrent downloads (Settings) helps avoid this.',
      'A signed-in session via cookies raises the limit.',
    ],
    showSettings: true,
  },
  {
    test: /private|members-only|age.?restrict|unavailable/i,
    title: 'This video is private or restricted',
    tips: [
      'You need cookies from an account that can view it (member / age-verified).',
      'If the video was removed, there is nothing to download.',
    ],
    showSettings: true,
  },
  {
    test: /403|forbidden/i,
    title: 'Access denied',
    tips: [
      'The video may be restricted, or your session expired.',
      'Refresh your cookies in Settings and retry.',
    ],
    showSettings: true,
  },
  {
    test: /network|timeout|timed out|connection|econn/i,
    title: 'Network problem',
    tips: ['Check your internet connection and try again.', 'Large playlists can time out — retry the failed items.'],
  },
];

export default function ErrorModal({ error, onClose, onOpenSettings, canOpenSettings }) {
  useEffect(() => {
    if (!error) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [error, onClose]);

  if (!error) return null;

  const detail = error.subMessage || error.message || '';
  const guidance = GUIDANCE.find((g) => g.test.test(detail)) || null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-modal-title"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-[28px] border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line/70 bg-danger-50 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-danger-100 text-danger-600">
              <CircleAlert className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <h2 id="error-modal-title" className="font-display text-lg font-extrabold tracking-tight text-danger-700">
                {guidance?.title || error.message || 'Download failed'}
              </h2>
              {guidance && error.message && (
                <p className="mt-0.5 text-xs font-semibold text-danger-600/80">{error.message}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 rounded-full p-1.5 text-danger-600 transition-colors hover:bg-danger-100"
          >
            <X className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {detail && (
            <p className="break-words rounded-2xl bg-surface-muted px-4 py-3 font-mono text-xs leading-relaxed text-ink-secondary">
              {detail}
            </p>
          )}

          {guidance && (
            <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3.5">
              <div className="mb-2 flex items-center gap-2 text-brand-700">
                <Lightbulb className="h-4 w-4" strokeWidth={2.2} />
                <span className="text-xs font-extrabold uppercase tracking-wide">How to fix it</span>
              </div>
              <ul className="space-y-1.5">
                {guidance.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-secondary">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-line/70 bg-surface-muted/50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-bold text-ink-secondary transition-colors hover:bg-black/5"
          >
            Dismiss
          </button>
          {guidance?.showSettings && canOpenSettings && (
            <button
              onClick={() => {
                onClose?.();
                onOpenSettings?.();
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-brand transition-colors hover:bg-brand-700"
            >
              <Settings className="h-4 w-4" strokeWidth={2.2} />
              Open Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
