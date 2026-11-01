import React, { useEffect, useRef, useState } from 'react';
import {
    Download,
    Tag,
    ExternalLink,
    Sparkles,
    Monitor,
    Apple,
    Laptop,
    ShieldCheck,
    Cookie,
    Zap,
    Info,
    Terminal,
    Copy,
    Check,
} from 'lucide-react';
import { APP_VERSION, OS_TABS, RELEASES_URL, LATEST_URL, detectOS, getOsTab } from '../lib/releases';

const TAB_ICONS = {
    monitor: <Monitor className="h-4 w-4" strokeWidth={2.2} />,
    apple: <Apple className="h-4 w-4" strokeWidth={2.2} />,
    laptop: <Laptop className="h-4 w-4" strokeWidth={2.2} />,
};

const PERKS = [
    {
        icon: <ShieldCheck className="h-4 w-4" strokeWidth={2.2} />,
        tint: 'bg-success-50 text-success-700',
        title: 'No bot checks',
        text: 'Runs on your own residential IP — no datacenter blocklists, no "confirm you are not a bot".',
    },
    {
        icon: <Cookie className="h-4 w-4" strokeWidth={2.2} />,
        tint: 'bg-accent-50 text-accent-700',
        title: 'Your YouTube session',
        text: 'Import cookies from Chrome, Firefox, Edge, or paste a cookies.txt.',
    },
    {
        icon: <Zap className="h-4 w-4" strokeWidth={2.2} />,
        tint: 'bg-brand-50 text-brand-700',
        title: 'Self-updating engine',
        text: 'yt-dlp refreshes itself so YouTube changes never break your app.',
    },
];

const BTN_PRIMARY =
    'inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-700';
const BTN_SECONDARY =
    'inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-bold text-ink-secondary shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700';
const BTN_GHOST =
    'inline-flex items-center gap-2 rounded-full border border-line bg-canvas px-4 py-2.5 text-xs font-bold text-ink-secondary transition-colors hover:bg-surface-muted';

/**
 * The heart of the hosted download portal: pick a platform, grab the build.
 * Never rendered inside the desktop app itself (it has nothing to install).
 */
export default function DesktopDownloadSection() {
    // Lazy initializer: the visitor's own platform is pre-selected, but they can
    // switch tabs freely (detectOS is pure and runs in the browser only).
    const [active, setActive] = useState(detectOS);
    const [copied, setCopied] = useState(false);
    const copiedTimer = useRef(null);

    const tab = getOsTab(active);

    useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

    // Clipboard needs a user gesture and can still throw (insecure origin, denied
    // permission), so keep a selection-based fallback and never fail the click.
    async function copyInstallCommand(command) {
        try {
            await navigator.clipboard.writeText(command);
        } catch {
            const helper = document.createElement('textarea');
            helper.value = command;
            helper.setAttribute('readonly', '');
            helper.style.position = 'fixed';
            helper.style.opacity = '0';
            document.body.appendChild(helper);
            helper.select();
            document.execCommand('copy');
            document.body.removeChild(helper);
        }
        window.clearTimeout(copiedTimer.current);
        setCopied(true);
        copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
    }

    return (
        <section
            id="desktop"
            className="relative mt-14 overflow-hidden rounded-[32px] border border-line bg-surface px-5 py-12 shadow-panel sm:px-10 sm:py-16"
        >
            {/* Decorative layers */}
            <div className="dot-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
            <div
                className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-100/60 blur-3xl"
                aria-hidden="true"
            />
            <div
                className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-brand-100/70 blur-3xl"
                aria-hidden="true"
            />

            <div className="relative mx-auto max-w-3xl text-center">
                {/* Eyebrow */}
                <span className="inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-accent-700">
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
                    Get the desktop app
                </span>

                <h2 className="font-display mt-5 text-[32px] leading-tight font-extrabold tracking-tight text-ink sm:text-[40px]">
                    Pick your platform,
                    <br className="hidden sm:block" /> <span className="text-brand-600">start downloading</span>
                </h2>

                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-secondary sm:text-base">
                    Free, open source, and built for your own machine: your IP, your cookies, your hard drive —
                    with no playlist size limits and no server waiting in between.
                </p>

                {/* OS tabs */}
                <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-line bg-canvas p-1.5 shadow-soft">
                    {OS_TABS.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setActive(t.id)}
                            aria-pressed={active === t.id}
                            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all ${active === t.id
                                ? 'bg-brand-600 text-white shadow-brand'
                                : 'text-ink-secondary hover:text-ink'
                                }`}
                        >
                            {TAB_ICONS[t.iconKey]}
                            <span className="hidden sm:inline">{t.label}</span>
                        </button>
                    ))}
                </div>

                {/* Download card */}
                <div className="mx-auto mt-6 max-w-2xl rounded-3xl border border-line bg-canvas p-6 text-left shadow-soft">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                                {TAB_ICONS[tab.iconKey]}
                            </span>
                            <div>
                                <h3 className="font-display text-base font-extrabold text-ink">
                                    {tab.label} build
                                </h3>
                                <p className="text-xs text-ink-secondary">{tab.note}</p>
                            </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-700">
                            v{APP_VERSION}
                        </span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2.5">
                        {tab.assets.map((asset) => (
                            <a
                                key={asset.label}
                                href={asset.href}
                                className={asset.primary ? BTN_PRIMARY : asset.ghost ? BTN_GHOST : BTN_SECONDARY}
                            >
                                <Download className="h-4 w-4" strokeWidth={2.4} />
                                {asset.label}
                                {asset.size && (
                                    <span className="ml-1 text-[10px] font-semibold opacity-70">{asset.size}</span>
                                )}
                            </a>
                        ))}
                        <a href={RELEASES_URL} target="_blank" rel="noreferrer" className={BTN_GHOST}>
                            <Tag className="h-3.5 w-3.5" strokeWidth={2.2} />
                            All releases
                            <ExternalLink className="h-3 w-3" strokeWidth={2.2} />
                        </a>
                    </div>

                    {/* One command instead of four buttons, for the people who
                        would rather stay in the terminal. */}
                    {tab.installCommand && (
                        <div className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-soft">
                            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                                <Terminal className="h-3.5 w-3.5" strokeWidth={2.4} />
                                Or install from the terminal
                            </p>
                            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                                <code className="flex-grow rounded-xl bg-canvas px-3 py-2 font-mono text-[11px] leading-relaxed text-ink [overflow-wrap:anywhere]">
                                    {tab.installCommand}
                                </code>
                                <button
                                    type="button"
                                    onClick={() => copyInstallCommand(tab.installCommand)}
                                    aria-label="Copy the install command"
                                    className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-canvas px-4 py-2 text-xs font-bold text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink"
                                >
                                    {copied ? (
                                        <Check className="h-3.5 w-3.5 text-success-600" strokeWidth={2.6} />
                                    ) : (
                                        <Copy className="h-3.5 w-3.5" strokeWidth={2.2} />
                                    )}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-ink-muted">
                                Picks the build that fits your distro, and checks its published checksum.
                            </p>
                        </div>
                    )}

                    <p className="mt-5 flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700">
                        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" strokeWidth={2.4} />
                        <span>
                            Builds are published on{' '}
                            <a
                                href={LATEST_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="underline decoration-sky-600/40 underline-offset-2 hover:decoration-sky-600"
                            >
                                GitHub Releases
                            </a>
                            . Binaries are unsigned, so your OS may show a &ldquo;trust this app?&rdquo; prompt on
                            first launch.
                        </span>
                    </p>
                </div>

                {/* Perks row */}
                <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
                    {PERKS.map((p) => (
                        <div
                            key={p.title}
                            className="rounded-2xl border border-line bg-canvas p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                        >
                            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${p.tint}`}>
                                {p.icon}
                            </span>
                            <p className="mt-3 text-sm font-bold text-ink">{p.title}</p>
                            <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{p.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
