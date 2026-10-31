import React from 'react';
import { CircleCheck, CircleX, Loader2, Info, X } from 'lucide-react';

const STYLES = {
  error: 'border-danger-200 bg-danger-50 text-danger-700',
  success: 'border-success-600/25 bg-success-50 text-success-700',
  loading: 'border-brand-200 bg-brand-50 text-brand-700',
  info: 'border-line bg-surface text-ink-secondary',
};

const ICONS = {
  success: <CircleCheck className="h-5 w-5 flex-shrink-0 text-success-600" strokeWidth={2.2} />,
  error: <CircleX className="h-5 w-5 flex-shrink-0 text-danger-600" strokeWidth={2.2} />,
  loading: <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-brand-600" strokeWidth={2.2} />,
  info: <Info className="h-5 w-5 flex-shrink-0 text-brand-600" strokeWidth={2.2} />,
};

export default function StatusBanner({ status, isAnalyzing, onCancelAnalysis, onDismiss }) {
  if (!status) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-6 flex items-start justify-between gap-3 rounded-2xl border px-5 py-4 text-sm shadow-soft ${STYLES[status.type] || STYLES.info}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        {ICONS[status.type] || ICONS.info}
        <div className="min-w-0">
          <div className="font-bold">{status.message}</div>
          {status.subMessage && (
            <div className="mt-0.5 break-words font-medium opacity-80">{status.subMessage}</div>
          )}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {isAnalyzing && (
          <button
            onClick={onCancelAnalysis}
            className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-bold text-ink-secondary transition-colors hover:bg-surface-muted"
          >
            Cancel
          </button>
        )}
        <button
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="rounded-full p-1.5 transition-colors hover:bg-black/5"
        >
          <X className="h-4 w-4" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
