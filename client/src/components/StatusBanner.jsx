import React from 'react';

const STYLES = {
  error: 'bg-red-50 border-red-500 text-red-700',
  success: 'bg-primary-50 border-primary-500 text-primary-800',
  loading: 'bg-blue-50 border-primary-500 text-primary-800',
  info: 'bg-gray-100 border-gray-500 text-gray-800',
};

const ICONS = {
  success: (
    <svg className="w-5 h-5 flex-shrink-0 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  ),
  loading: (
    <svg className="w-5 h-5 flex-shrink-0 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
};

export default function StatusBanner({ status, isAnalyzing, onCancelAnalysis, onDismiss }) {
  if (!status) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-4 border-l-4 px-4 py-3 rounded-lg text-sm flex items-start gap-3 justify-between ${STYLES[status.type] || STYLES.info}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        {ICONS[status.type]}
        <div className="min-w-0">
          <div className="font-semibold">{status.message}</div>
          {status.subMessage && <div className="text-sm mt-0.5 opacity-90 break-words">{status.subMessage}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isAnalyzing && (
          <button
            onClick={onCancelAnalysis}
            className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-medium hover:bg-gray-50 text-gray-700"
          >
            Cancel
          </button>
        )}
        <button
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="p-1 rounded hover:bg-black/5 text-current"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
