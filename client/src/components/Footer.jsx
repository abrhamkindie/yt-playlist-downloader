import React from 'react';
import { Download, Code, Bug, Scale } from 'lucide-react';
import { REPO_URL, APP_VERSION } from '../lib/releases';

export default function Footer({ hostedMode = false }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-20 border-t border-line/70 bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
          <img
            src="/icon.png"
            alt="StreamPull logo"
            className="h-8 w-8 rounded-xl shadow-brand"
          />
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
            <>
              <a
                href="#desktop"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 underline-offset-4 transition-colors hover:text-brand-800 hover:underline"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2.4} />
                Get the Desktop App
              </a>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-secondary underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                <Code className="h-3.5 w-3.5" strokeWidth={2.2} />
                Source code
              </a>
              <a
                href={`${REPO_URL}/issues`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-secondary underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                <Bug className="h-3.5 w-3.5" strokeWidth={2.2} />
                Report an issue
              </a>
            </>
          )}
          {/* Facts a visitor can check, instead of a sentiment. */}
          <p className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
            <Scale className="h-3.5 w-3.5 text-brand-600" strokeWidth={2.2} />
            MIT licensed
            <span className="text-ink-muted">·</span>
            <span className="font-semibold">v{APP_VERSION}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
