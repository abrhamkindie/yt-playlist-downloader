import React, { Suspense, lazy, useEffect, useState } from 'react';
import HostedPortal from './components/HostedPortal';
import { api } from './lib/api';

// Code-split: a visitor on the download portal never downloads the downloader
// (socket.io client, video list, settings panel) — the desktop app does.
const DesktopApp = lazy(() => import('./components/DesktopApp'));

/**
 * How long we wait for the local/hosted server to say who it is before we
 * default to the hosted portal. A desktop app answers in milliseconds because
 * the server runs on the same machine; a cold free-tier backend can take much
 * longer — and in that case the portal is the safe answer.
 */
const PROBE_TIMEOUT_MS = 5000;

/** Neutral splash while the mode is unknown — shows neither UI by mistake. */
function BootSplash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas font-sans text-ink">
      <img src="/icon.png" alt="StreamPull logo" className="h-14 w-14 animate-pulse rounded-2xl shadow-brand" />
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-muted">
        <div className="skeleton h-full w-full rounded-full" />
      </div>
      <p className="text-xs font-semibold text-ink-muted">Starting StreamPull…</p>
    </div>
  );
}

/**
 * Decides which app the user gets:
 *
 *   • hosted server (the public website) → download portal for the desktop app.
 *     Downloads cannot run in a browser tab, so the site does not pretend they
 *     can — it points visitors at the build for their OS.
 *   • local server inside Electron / `npm run app:dev` → the full downloader.
 *
 * The answer comes from `GET /api/status` (`{ hosted }`). Anything else — an
 * error, a timeout, an unreachable backend — is treated as hosted, because a
 * desktop app always has its own server answering.
 */
export default function App() {
  const [mode, setMode] = useState(null); // null = probing, true = portal, false = desktop

  useEffect(() => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      setMode(value);
    };
    const timer = setTimeout(() => finish(true), PROBE_TIMEOUT_MS);

    api
      .status()
      .then((data) => finish(Boolean(data.hosted)))
      .catch(() => finish(true)); // no reachable local server → portal

    return () => {
      settled = true;
      clearTimeout(timer);
    };
  }, []);

  if (mode === null) return <BootSplash />;
  if (mode) return <HostedPortal />;
  return (
    <Suspense fallback={<BootSplash />}>
      <DesktopApp />
    </Suspense>
  );
}
