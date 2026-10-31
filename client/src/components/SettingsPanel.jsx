import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    X,
    Cpu,
    RefreshCw,
    DownloadCloud,
    ShieldCheck,
    KeyRound,
    Globe,
    Info,
    CheckCircle2,
    ChevronDown,
    Settings as SettingsIcon,
} from 'lucide-react';
import { api } from '../lib/api';

const SOURCE_LABELS = {
    managed: 'auto-updated copy',
    bundled: 'bundled with the app',
    system: 'system install (PATH)',
    env: 'YTDLP_PATH override',
    missing: 'not installed',
};

function relativeTime(ms) {
    if (!ms) return 'never';
    const diff = Date.now() - ms;
    if (diff < 60_000) return 'just now';
    const mins = Math.round(diff / 60_000);
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 48) return `${hours} h ago`;
    return `${Math.round(hours / 24)} d ago`;
}

/**
 * Desktop-only maintenance dialog.
 *
 * Two things decide whether a packaged build keeps working weeks after it was
 * shipped: yt-dlp must stay current (YouTube breaks it every few weeks) and
 * the request must look like a real signed-in user. Both live here because
 * neither is reachable through the app bundle on a read-only install.
 */
export default function SettingsPanel({ open, onClose, info, refresh, onNotify }) {
    const [busy, setBusy] = useState(null);
    // null = "show what the server resolved"; a string = the user's pending pick.
    const [browserDraft, setBrowserDraft] = useState(null);
    const [cookieText, setCookieText] = useState('');
    const panelRef = useRef(null);

    const ytdlp = info?.ytdlp || {};
    const auth = info?.auth || {};
    const browsers = auth.browsers || [];
    const browser = browserDraft ?? (auth.savedBrowserSource || 'none');

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (e) => e.key === 'Escape' && onClose?.();
        window.addEventListener('keydown', onKeyDown);
        panelRef.current?.focus();
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    const cookieCount = useMemo(
        () => cookieText.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#')).length,
        [cookieText],
    );

    async function run(key, action, success) {
        setBusy(key);
        try {
            const result = await action();
            onNotify?.({
                type: 'success',
                message: success(result),
                subMessage: result?.warning || undefined,
            });
        } catch (error) {
            onNotify?.({ type: 'error', message: 'That did not work', subMessage: error.message });
        } finally {
            setBusy(null);
            refresh?.();
        }
    }

    if (!open) return null;

    if (!info) {
        return (
            <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
                onClick={onClose}
            >
                <div
                    role="dialog"
                    aria-modal="true"
                    className="w-full max-w-md rounded-[28px] border border-line bg-surface p-6 shadow-pop"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                            <Info className="h-5 w-5" strokeWidth={2.2} />
                        </span>
                        <div className="min-w-0 flex-grow">
                            <h2 className="font-display text-base font-extrabold tracking-tight text-ink">
                                Desktop settings unavailable
                            </h2>
                            <p className="mt-1 text-sm text-ink-secondary">
                                This looks like a hosted deployment — cookies and the yt-dlp updater only work
                                inside the desktop app.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="mt-5 w-full rounded-full bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-700"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    const currentVersion = ytdlp.current?.version || ytdlp.managed?.version || null;
    const updateAvailable = Boolean(ytdlp.updateAvailable);

    return (
        <div
            className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm sm:p-8"
            onClick={onClose}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label="Desktop settings"
                onClick={(e) => e.stopPropagation()}
                className="ring-focus my-auto w-full max-w-2xl overflow-hidden rounded-[28px] border border-line bg-surface shadow-pop outline-none"
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b border-line bg-canvas px-6 py-5 sm:px-8">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-brand">
                            <SettingsIcon className="h-5 w-5" strokeWidth={2.2} />
                        </span>
                        <div>
                            <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">
                                Desktop settings
                            </h2>
                            <p className="mt-0.5 text-sm text-ink-secondary">
                                The two reasons the desktop app keeps working when a hosted server gets blocked.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close settings"
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-muted shadow-soft transition-colors hover:bg-surface-muted hover:text-ink"
                    >
                        <X className="h-4 w-4" strokeWidth={2.4} />
                    </button>
                </div>

                <div className="space-y-5 px-6 py-6 sm:px-8">
                    {/* ---------------- Downloader engine ---------------- */}
                    <section className="rounded-2xl border border-line bg-canvas p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                                    <Cpu className="h-4 w-4" strokeWidth={2.2} />
                                </span>
                                <h3 className="text-sm font-bold text-ink">Downloader engine</h3>
                            </div>
                            <span
                                className={
                                    updateAvailable
                                        ? 'inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-700'
                                        : 'inline-flex items-center gap-1.5 rounded-full border border-success-600/25 bg-success-50 px-3 py-1 text-[11px] font-bold text-success-700'
                                }
                            >
                                {updateAvailable ? (
                                    <>
                                        <DownloadCloud className="h-3 w-3" strokeWidth={2.4} />
                                        Update: {ytdlp.latest}
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-3 w-3" strokeWidth={2.4} />
                                        Up to date
                                    </>
                                )}
                            </span>
                        </div>

                        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                            <div className="flex items-baseline justify-between gap-3 sm:justify-start sm:gap-3">
                                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Version</dt>
                                <dd className="font-bold text-ink sm:ml-auto">{currentVersion || 'unknown'}</dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3 sm:justify-start sm:gap-3">
                                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Source</dt>
                                <dd className="font-bold text-ink sm:ml-auto">{SOURCE_LABELS[ytdlp.current?.source] || '—'}</dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3 sm:justify-start sm:gap-3">
                                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Latest</dt>
                                <dd className="font-bold text-ink sm:ml-auto">{ytdlp.latest || 'unknown'}</dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3 sm:justify-start sm:gap-3">
                                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Checked</dt>
                                <dd className="font-bold text-ink sm:ml-auto">{relativeTime(ytdlp.lastCheckedAt)}</dd>
                            </div>
                        </dl>

                        {ytdlp.lastError && (
                            <p className="mt-3 flex items-start gap-2 rounded-xl bg-danger-50 px-3 py-2 text-xs font-medium text-danger-700">
                                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" strokeWidth={2.4} />
                                Update check failed: {ytdlp.lastError}
                            </p>
                        )}

                        <div className="mt-5 flex flex-wrap gap-2">
                            <button
                                onClick={() => run('check', api.checkYtdlp, () => 'Checked for yt-dlp updates')}
                                disabled={busy !== null}
                                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold text-ink-secondary shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700 disabled:opacity-60 disabled:hover:translate-y-0"
                            >
                                <RefreshCw className={`h-4 w-4 ${busy === 'check' ? 'animate-spin' : ''}`} strokeWidth={2.2} />
                                {busy === 'check' ? 'Checking…' : 'Check for updates'}
                            </button>
                            <button
                                onClick={() =>
                                    run('update', api.updateYtdlp, (r) =>
                                        r.updated ? `yt-dlp updated to ${r.version}` : 'yt-dlp was already current',
                                    )
                                }
                                disabled={busy !== null}
                                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-700 disabled:opacity-60 disabled:hover:translate-y-0"
                            >
                                <DownloadCloud className={`h-4 w-4 ${busy === 'update' ? 'animate-pulse' : ''}`} strokeWidth={2.2} />
                                {busy === 'update' ? 'Downloading…' : updateAvailable ? `Update to ${ytdlp.latest}` : 'Reinstall latest'}
                            </button>
                        </div>

                        <p className="mt-4 flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700">
                            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" strokeWidth={2.4} />
                            Checked automatically at startup (max every 6 h). Downloads are never interrupted — an update is
                            skipped while anything is in progress.
                        </p>
                    </section>

                    {/* ---------------- YouTube sign-in ---------------- */}
                    <section className="rounded-2xl border border-line bg-canvas p-5">
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
                                <ShieldCheck className="h-4 w-4" strokeWidth={2.2} />
                            </span>
                            <h3 className="text-sm font-bold text-ink">YouTube sign-in (bot detection)</h3>
                        </div>
                        <p className="mt-2 text-sm text-ink-secondary">
                            Requests go out from your own connection, which already helps a lot. If YouTube still says
                            &ldquo;Sign in to confirm you&rsquo;re not a bot&rdquo;, let yt-dlp use the session you are
                            actually logged into.
                        </p>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <label className="flex items-center gap-2 text-sm font-bold text-ink-secondary" htmlFor="cookie-browser">
                                <Globe className="h-4 w-4 text-brand-600" strokeWidth={2.2} />
                                Use cookies from
                            </label>
                            <div className="relative w-full sm:max-w-xs">
                                <select
                                    id="cookie-browser"
                                    value={browser}
                                    onChange={(e) => setBrowserDraft(e.target.value)}
                                    className="ring-focus w-full appearance-none rounded-full border border-line bg-surface py-2.5 pl-4 pr-10 text-sm font-semibold text-ink shadow-soft"
                                >
                                    <option value="none">Nothing (no cookies)</option>
                                    {browsers.map((b) => (
                                        <option key={b} value={b}>
                                            {b.charAt(0).toUpperCase() + b.slice(1)}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown
                                    className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                                    strokeWidth={2.4}
                                />
                            </div>
                            <button
                                onClick={() =>
                                    run('browser', () => api.setCookiesFromBrowser(browser), (r) => r.message).then(
                                        () => setBrowserDraft(null),
                                    )
                                }
                                disabled={busy !== null}
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-700 disabled:opacity-60 disabled:hover:translate-y-0 sm:ml-auto"
                            >
                                <CheckCircle2 className={`h-4 w-4 ${busy === 'browser' ? 'animate-pulse' : ''}`} strokeWidth={2.2} />
                                {busy === 'browser' ? 'Saving…' : 'Apply'}
                            </button>
                        </div>

                        <p className="mt-3 text-xs text-ink-muted">
                            Close the browser you pick — its cookie database is locked while it runs.
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-surface px-4 py-3 shadow-soft">
                            <KeyRound className="h-4 w-4 text-brand-600" strokeWidth={2.2} />
                            <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">Currently used</span>
                            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                                {auth.method === 'file'
                                    ? `cookies.txt (${auth.cookiesFile?.split(/[\\/]/).pop()})`
                                    : auth.method === 'browser'
                                        ? `cookies from ${auth.detail}`
                                        : 'no cookies — bot checks may fail'}
                            </span>
                        </div>

                        <div className="mt-5 border-t border-line pt-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-sm font-bold text-ink">…or paste a cookies.txt export</h4>
                                {auth.method === 'file' ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-success-600/25 bg-success-50 px-3 py-1 text-[11px] font-bold text-success-700">
                                        <CheckCircle2 className="h-3 w-3" strokeWidth={2.4} />
                                        Active: {auth.cookiesFile?.split('/').pop()}
                                    </span>
                                ) : null}
                            </div>

                            <textarea
                                value={cookieText}
                                onChange={(e) => setCookieText(e.target.value)}
                                rows={4}
                                spellCheck={false}
                                aria-label="cookies.txt contents"
                                placeholder={'# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tFALSE\t1893456000\t__Secure-1PSID\t…'}
                                className="ring-focus mt-3 w-full rounded-2xl border border-line bg-surface p-4 font-mono text-xs text-ink shadow-soft transition-shadow placeholder:text-ink-muted"
                            />

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => run('cookies', () => api.saveCookies(cookieText), (r) => r.message)}
                                    disabled={busy !== null || cookieCount === 0}
                                    className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-700 disabled:opacity-60 disabled:hover:translate-y-0"
                                >
                                    <KeyRound className={`h-4 w-4 ${busy === 'cookies' ? 'animate-pulse' : ''}`} strokeWidth={2.2} />
                                    {busy === 'cookies' ? 'Saving…' : `Save ${cookieCount ? `(${cookieCount})` : ''}`}
                                </button>
                                <button
                                    onClick={async () => {
                                        await run('clear', api.clearCookies, (r) => r.message);
                                        setCookieText('');
                                    }}
                                    disabled={busy !== null || auth.method !== 'file'}
                                    className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold text-ink-secondary shadow-soft transition-all hover:-translate-y-0.5 hover:border-danger-200 hover:bg-danger-50 hover:text-danger-700 disabled:opacity-60 disabled:hover:translate-y-0"
                                >
                                    <X className="h-4 w-4" strokeWidth={2.4} />
                                    Remove saved cookies
                                </button>
                                <span className="text-xs text-ink-muted">A saved file always takes priority over the browser source.</span>
                            </div>
                        </div>
                    </section>

                    <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-4 py-3 text-xs font-medium text-sky-700">
                        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" strokeWidth={2.4} />
                        <span className="break-all">
                            Settings and downloads of the engine are stored in{' '}
                            <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[11px]">{info?.dataDir || '—'}</code> — a
                            writable folder that survives app updates.
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
}
