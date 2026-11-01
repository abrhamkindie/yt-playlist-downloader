import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    X,
    Cpu,
    Package,
    RefreshCw,
    DownloadCloud,
    ExternalLink,
    ShieldCheck,
    Globe,
    ChevronDown,
    CheckCircle2,
    TriangleAlert,
    Trash2,
    Settings as SettingsIcon,
    Info,
} from 'lucide-react';
import { api } from '../lib/api';

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

const BTN_PRIMARY =
    'inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-700 disabled:opacity-60 disabled:hover:translate-y-0';
const BTN_SECONDARY =
    'inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold text-ink-secondary shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700 disabled:opacity-60 disabled:hover:translate-y-0';
const BTN_GHOST =
    'inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-50';

const PILL_SUCCESS =
    'inline-flex items-center gap-1.5 rounded-full border border-success-600/25 bg-success-50 px-3 py-1 text-[11px] font-bold text-success-700';
const PILL_UPDATE =
    'inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-700';
const PILL_PLAIN =
    'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-bold text-ink-secondary';

/**
 * Desktop-only maintenance dialog, in two questions:
 *   • am I up to date?   (app bundle + yt-dlp engine, one check, one action)
 *   • am I signed in?    (which browser session the downloads should use)
 *
 * Every outcome is one line of text under the button that caused it. Nothing is
 * reported through the app's global banner: it renders behind this modal's
 * backdrop, so the user never saw it and it lingered as a stale banner after the
 * dialog closed.
 */
export default function SettingsPanel({ open, onClose, info, refresh }) {
    const [busy, setBusy] = useState(null);
    // { tone: 'ok'|'warn', where: 'updates'|'auth', text, sticky }. A success fades
    // on its own; a failure stays until the next action so it can be read and
    // retried. Only one result exists at a time — they can never stack up.
    const [result, setResult] = useState(null);
    // null = "show what the server resolved"; a string = the user's pending pick.
    const [browserDraft, setBrowserDraft] = useState(null);
    const panelRef = useRef(null);

    const ytdlp = info?.ytdlp || {};
    const app = info?.app || {};
    const auth = info?.auth || {};
    const browsers = auth.browsers || [];
    const browser = browserDraft ?? (auth.savedBrowserSource || 'none');

    const engineUpdate = Boolean(ytdlp.updateAvailable);
    const appUpdate = Boolean(app.updateAvailable);
    const engineCurrent = ytdlp.current?.version || ytdlp.managed?.version || null;
    const checkedAt = Math.max(app.lastCheckedAt || 0, ytdlp.lastCheckedAt || 0) || null;
    const checkError = [app.lastError, ytdlp.lastError].filter(Boolean).join(' · ');

    const authLabel =
        auth.method === 'file'
            ? 'cookies.txt file'
            : auth.method === 'browser'
                ? `${auth.detail || 'browser'} session`
                : 'Not set';

    // Closing is the only moment state should be dropped: doing it here instead
    // of in an effect keeps a stale "Engine reinstalled" line from flashing when
    // the dialog is opened again.
    const closePanel = useCallback(() => {
        setResult(null);
        setBrowserDraft(null);
        onClose?.();
    }, [onClose]);

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (e) => e.key === 'Escape' && closePanel();
        window.addEventListener('keydown', onKeyDown);
        panelRef.current?.focus();
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, closePanel]);

    useEffect(() => {
        if (!result || result.sticky) return undefined;
        const timer = setTimeout(() => setResult(null), 8000);
        return () => clearTimeout(timer);
    }, [result]);

    const resultLine = (where) =>
        result?.where === where ? (
            <p
                role="status"
                className={`mt-3 flex items-start gap-2 text-sm font-semibold ${result.tone === 'ok' ? 'text-success-700' : 'text-danger-700'
                    }`}
            >
                {result.tone === 'ok' ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2.4} />
                ) : (
                    <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2.4} />
                )}
                <span>{result.text}</span>
            </p>
        ) : null;

    async function run(key, action, success, where = 'updates') {
        setBusy(key);
        try {
            const res = await action();
            const text = success(res);
            setResult({ tone: 'ok', where, text: res?.warning ? `${text} — ${res.warning}` : text });
        } catch (error) {
            setResult({ tone: 'warn', where, text: error.message, sticky: true });
        } finally {
            setBusy(null);
            refresh?.();
        }
    }

    async function handleCheck() {
        setBusy('check');
        try {
            const check = await api.checkAll();
            const failed = [check?.errors?.app, check?.errors?.ytdlp].filter(Boolean);
            const parts = [];
            if (check?.ytdlp?.updateAvailable) parts.push(`engine ${check.ytdlp.latest}`);
            if (check?.app?.updateAvailable) parts.push(`app v${check.app.latestVersion}`);

            if (parts.length) {
                setResult({
                    tone: 'ok',
                    where: 'updates',
                    text: `Update available: ${parts.join(' and ')}`,
                    sticky: failed.length > 0,
                });
            } else if (failed.length) {
                setResult({ tone: 'warn', where: 'updates', text: `Could not check: ${failed.join(' · ')}`, sticky: true });
            } else {
                setResult({ tone: 'ok', where: 'updates', text: "You're on the latest version" });
            }
        } catch (error) {
            setResult({
                tone: 'warn',
                where: 'updates',
                text: `Could not check for updates: ${error.message}`,
                sticky: true,
            });
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
                                The local server did not answer <code>/api/desktop/info</code>. It may still be
                                starting up — try again, or close this dialog.
                            </p>
                        </div>
                    </div>
                    <div className="mt-5 flex gap-2.5">
                        <button onClick={() => refresh?.()} className={`${BTN_PRIMARY} flex-grow justify-center`}>
                            <RefreshCw className="h-4 w-4" strokeWidth={2.2} />
                            Try again
                        </button>
                        <button onClick={onClose} className={BTN_SECONDARY}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm sm:p-8"
            onClick={closePanel}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label="Desktop settings"
                onClick={(e) => e.stopPropagation()}
                // The header stays put and the body scrolls inside the card: on a
                // short window the alternative is the whole modal scrolling away,
                // which buries the close button above the fold.
                className="ring-focus my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-line bg-surface shadow-pop outline-none sm:max-h-[calc(100dvh-4rem)]"
            >
                {/* Header */}
                <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-line bg-canvas px-6 py-5 sm:px-8">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-brand">
                            <SettingsIcon className="h-5 w-5" strokeWidth={2.2} />
                        </span>
                        <div>
                            <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">
                                Desktop settings
                            </h2>
                            <p className="mt-0.5 text-sm text-ink-secondary">
                                Your app, its download engine and your YouTube sign-in.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={closePanel}
                        aria-label="Close settings"
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-muted shadow-soft transition-colors hover:bg-surface-muted hover:text-ink"
                    >
                        <X className="h-4 w-4" strokeWidth={2.4} />
                    </button>
                </div>

                <div className="min-h-0 flex-grow space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
                    {/* ---------------- Updates: app + engine ---------------- */}
                    <section className="rounded-2xl border border-line bg-canvas p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="flex items-center gap-2.5 text-sm font-bold text-ink">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                                    <Package className="h-4 w-4" strokeWidth={2.2} />
                                </span>
                                Updates
                            </h3>
                            <span className={engineUpdate || appUpdate ? PILL_UPDATE : PILL_SUCCESS}>
                                {engineUpdate || appUpdate ? (
                                    <>
                                        <DownloadCloud className="h-3 w-3" strokeWidth={2.4} />
                                        Update available
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-3 w-3" strokeWidth={2.4} />
                                        Up to date
                                    </>
                                )}
                            </span>
                        </div>

                        <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                            <div className="flex items-center justify-between gap-3 px-4 py-3">
                                <span className="flex items-center gap-2.5 text-sm font-semibold text-ink-secondary">
                                    <Package className="h-4 w-4 text-ink-muted" strokeWidth={2.2} />
                                    Application
                                </span>
                                <span className="text-sm font-bold text-ink">
                                    v{app.currentVersion || 'unknown'}
                                    {appUpdate && (
                                        <span className="ml-2 font-semibold text-brand-700">→ v{app.latestVersion}</span>
                                    )}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 px-4 py-3">
                                <span className="flex items-center gap-2.5 text-sm font-semibold text-ink-secondary">
                                    <Cpu className="h-4 w-4 text-ink-muted" strokeWidth={2.2} />
                                    Download engine
                                </span>
                                <span className="text-sm font-bold text-ink">
                                    {engineCurrent || 'unknown'}
                                    {engineUpdate && (
                                        <span className="ml-2 font-semibold text-brand-700">→ {ytdlp.latest}</span>
                                    )}
                                </span>
                            </div>
                        </div>

                        {checkError && (
                            <p className="mt-3 flex items-start gap-2 text-xs font-medium text-danger-700">
                                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" strokeWidth={2.4} />
                                <span className="break-all">Last check failed: {checkError}</span>
                            </p>
                        )}

                        <div className="mt-5 flex flex-wrap items-center gap-2">
                            <button onClick={handleCheck} disabled={busy !== null} className={BTN_SECONDARY}>
                                <RefreshCw className={`h-4 w-4 ${busy === 'check' ? 'animate-spin' : ''}`} strokeWidth={2.2} />
                                {busy === 'check' ? 'Checking…' : 'Check for updates'}
                            </button>

                            {engineUpdate && (
                                <button
                                    onClick={() =>
                                        run('update', () => api.updateYtdlp(), (r) =>
                                            r.updated ? `Engine updated to ${r.version}` : 'Engine was already current',
                                        )
                                    }
                                    disabled={busy !== null}
                                    className={BTN_PRIMARY}
                                >
                                    <DownloadCloud className={`h-4 w-4 ${busy === 'update' ? 'animate-pulse' : ''}`} strokeWidth={2.2} />
                                    {busy === 'update' ? 'Downloading…' : `Update engine to ${ytdlp.latest}`}
                                </button>
                            )}

                            {appUpdate && (
                                <a
                                    href={app.releaseUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={BTN_PRIMARY}
                                >
                                    <ExternalLink className="h-4 w-4" strokeWidth={2.2} />
                                    Download v{app.latestVersion}
                                </a>
                            )}

                            {!engineUpdate && !appUpdate && (
                                <button
                                    onClick={() =>
                                        run(
                                            'update',
                                            () => api.updateYtdlp({ reinstall: true }),
                                            (r) => `Engine reinstalled (${r.version})`,
                                        )
                                    }
                                    disabled={busy !== null}
                                    className={BTN_GHOST}
                                >
                                    <DownloadCloud className={`h-3.5 w-3.5 ${busy === 'update' ? 'animate-pulse' : ''}`} strokeWidth={2.2} />
                                    {busy === 'update' ? 'Downloading…' : 'Reinstall engine'}
                                </button>
                            )}

                            <span className="ml-auto text-xs text-ink-muted">Checked {relativeTime(checkedAt)}</span>
                        </div>

                        {resultLine('updates')}
                    </section>

                    {/* ---------------- YouTube sign-in ---------------- */}
                    <section className="rounded-2xl border border-line bg-canvas p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="flex items-center gap-2.5 text-sm font-bold text-ink">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
                                    <ShieldCheck className="h-4 w-4" strokeWidth={2.2} />
                                </span>
                                YouTube sign-in
                            </h3>
                            <span className={auth.method ? PILL_SUCCESS : PILL_PLAIN}>
                                {auth.method && <CheckCircle2 className="h-3 w-3" strokeWidth={2.4} />}
                                {authLabel}
                            </span>
                        </div>

                        <p className="mt-2 text-sm text-ink-secondary">
                            If YouTube says &ldquo;Sign in to confirm you&rsquo;re not a bot&rdquo;, let the app use a
                            browser you are actually logged into.
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
                                    run(
                                        'browser',
                                        () => api.setCookiesFromBrowser(browser),
                                        (r) => r.message,
                                        'auth',
                                    ).then(() => setBrowserDraft(null))
                                }
                                disabled={busy !== null || browser === (auth.savedBrowserSource || 'none')}
                                className={`${BTN_PRIMARY} sm:ml-auto`}
                            >
                                <CheckCircle2 className={`h-4 w-4 ${busy === 'browser' ? 'animate-pulse' : ''}`} strokeWidth={2.2} />
                                {busy === 'browser' ? 'Saving…' : 'Apply'}
                            </button>
                        </div>

                        {resultLine('auth')}

                        {browser !== 'none' && (
                            <p className="mt-3 text-xs text-ink-muted">
                                Close {browser} first — its cookies are locked while it runs.
                            </p>
                        )}

                        {auth.method === 'file' && (
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                                <span className="text-xs text-ink-secondary">
                                    A saved cookies.txt is being used instead of the browser above.
                                </span>
                                <button
                                    onClick={() => run('clear', api.clearCookies, () => 'cookies.txt removed', 'auth')}
                                    disabled={busy !== null}
                                    className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold text-ink-secondary shadow-soft transition-all hover:-translate-y-0.5 hover:border-danger-200 hover:bg-danger-50 hover:text-danger-700 disabled:opacity-60 disabled:hover:translate-y-0"
                                >
                                    <Trash2 className={`h-4 w-4 ${busy === 'clear' ? 'animate-pulse' : ''}`} strokeWidth={2.2} />
                                    {busy === 'clear' ? 'Removing…' : 'Remove it'}
                                </button>
                            </div>
                        )}
                    </section>

                    <p className="truncate text-center text-xs text-ink-muted" title={info?.dataDir || ''}>
                        Settings and the engine live in <code className="font-mono">{info?.dataDir || '—'}</code>
                    </p>
                </div>
            </div>
        </div>
    );
}
