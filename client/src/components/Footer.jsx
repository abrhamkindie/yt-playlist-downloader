import React from 'react';
import { Heart, Compass, Download } from 'lucide-react';

export default function Footer({ hostedMode = false }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-20 border-t border-line/70 bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white shadow-brand">
            <Compass className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <p className="font-display text-sm font-extrabold tracking-tight text-ink">
            Stream<span className="text-brand-600">Pull</span>
          </p>
          <span className="hidden text-xs text-ink-muted sm:inline">·</span>
          <p className="hidden text-xs text-ink-secondary sm:block">
            &copy; {year}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          {hostedMode && (
            <a
              href="#desktop"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 underline-offset-4 transition-colors hover:text-brand-800 hover:underline"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2.4} />
              Get the Desktop App
            </a>
          )}
          <p className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
            Made with
            <Heart className="h-3.5 w-3.5 fill-accent-500 text-accent-500" strokeWidth={2.4} />
            for creators.
          </p>
        </div>
      </div>
    </footer>
  );
}
