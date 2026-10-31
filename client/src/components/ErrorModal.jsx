import React, { useEffect } from 'react';
import { CircleAlert, X, Settings, ChevronRight } from 'lucide-react';

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
        test: /format is not available|no formats|requested format|no compatible format|different quality or format/i,
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
        test: /403|forbidden|access denied/i,
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

    const raw = (error.subMessage || error.message || '').trim();
    const guidance = GUIDANCE.find((g) => g.test.test(raw)) || null;
    const headline = guidance?.title || (error.message || '').trim() || 'Something went wrong';
    // When we have a friendly title + steps, don't repeat the raw line up top;
    // demote it to a collapsed "Error details" disclosure instead.
    const description = !guidance && raw && raw !== headline ? raw : null;
    const technical = guidance && raw && raw !== headline ? raw : null;

    return (
        <div
            className="animate-fade fixed inset-0 z-[70] flex items-center justify-center bg-navy-900/50 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="error-modal-title"
        >
            <div
                className="animate-modal w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start gap-4 px-6 pt-6">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-100">
                        <CircleAlert className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                        <h2 id="error-modal-title" className="font-display text-base font-bold tracking-tight text-ink">
                            {headline}
                        </h2>
                        {description && (
                            <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{description}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="-mr-1.5 -mt-1 flex-shrink-0 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-canvas hover:text-ink-secondary"
                    >
                        <X className="h-5 w-5" strokeWidth={2} />
                    </button>
                </div>

                {/* Body */}
                {(guidance || technical) && (
                    <div className="px-6 pt-5">
                        {guidance && (
                            <div>
                                <p className="text-xs font-semibold text-ink-muted">What to try</p>
                                <ol className="mt-2.5 space-y-2.5">
                                    {guidance.tips.map((tip, i) => (
                                        <li key={i} className="flex gap-2.5 text-sm text-ink-secondary">
                                            <span className="mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-600 ring-1 ring-inset ring-brand-100">
                                                {i + 1}
                                            </span>
                                            <span className="leading-relaxed">{tip}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {technical && (
                            <details className="group mt-5">
                                <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-ink-muted transition-colors hover:text-ink-secondary [&::-webkit-details-marker]:hidden">
                                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" strokeWidth={2.5} />
                                    Error details
                                </summary>
                                <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-muted">
                                    {technical}
                                </pre>
                            </details>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="mt-6 flex items-center justify-end gap-2 border-t border-line px-6 py-4">
                    <button
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-canvas"
                    >
                        Dismiss
                    </button>
                    {guidance?.showSettings && canOpenSettings && (
                        <button
                            onClick={() => {
                                onClose?.();
                                onOpenSettings?.();
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
                        >
                            <Settings className="h-4 w-4" strokeWidth={2} />
                            Open Settings
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
