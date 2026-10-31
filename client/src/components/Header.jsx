import React from 'react';
import { Settings, MonitorSmartphone, CircleCheck, Download } from 'lucide-react';

export default function Header({ desktopMode = false, hostedMode = false, updateAvailable = false, onOpenSettings }) {
  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <a href="/" className="group flex items-center gap-3">
          <img
            src="/icon.png"
            alt="StreamPull logo"
            className="h-10 w-10 rounded-2xl shadow-brand transition-transform group-hover:-rotate-6"
          />
          <span className="font-display text-lg font-extrabold tracking-tight text-ink">
            Stream<span className="text-brand-600">Pull</span>
          </span>
        </a>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          {desktopMode && (
            <button
              onClick={onOpenSettings}
              aria-label="Open desktop settings"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink-secondary shadow-soft transition-all hover:-translate-y-0.5 hover:text-brand-600 hover:shadow-card-hover"
            >
              <Settings className="h-[18px] w-[18px]" strokeWidth={2} />
              {updateAvailable && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-500 opacity-60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-accent-600 ring-2 ring-canvas" />
                </span>
              )}
            </button>
          )}

          {/* Hosted mode: promote the desktop app. Scrolls to the download section. */}
          {hostedMode && (
            <a
              href="#desktop"
              className="hidden items-center gap-2 rounded-full bg-accent-600 px-4 py-2 text-xs font-bold text-white shadow-accent transition-all hover:-translate-y-0.5 hover:bg-accent-700 sm:inline-flex"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2.4} />
              Get Desktop App
            </a>
          )}

          <span className="hidden items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink-secondary shadow-soft md:flex">
            {desktopMode ? (
              <>
                <MonitorSmartphone className="h-3.5 w-3.5 text-brand-600" strokeWidth={2.2} />
                Desktop
              </>
            ) : (
              <>
                <CircleCheck className="h-3.5 w-3.5 text-success-600" strokeWidth={2.2} />
                Ready
              </>
            )}
          </span>
        </div>
      </div>
    </header>
  );
}
