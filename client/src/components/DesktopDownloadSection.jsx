import React, { useEffect, useMemo, useState } from 'react';
import {
    Download,
    Tag,
    ExternalLink,
    Sparkles,
    Monitor,
    Apple,
    Laptop,
    ShieldCheck,
    Zap,
    Cookie,
    Info,
} from 'lucide-react';

const REPO = import.meta.env.VITE_GITHUB_REPO || 'abrhamkindie/yt-playlist-downloader';
const VERSION = import.meta.env.VITE_APP_VERSION || '1.2.0';

const RELEASES_URL = `https://github.com/${REPO}/releases`;
const LATEST_URL = `https://github.com/${REPO}/releases/latest`;

const OS_TABS = [
    {
        id: 'windows',
        label: 'Windows',
        icon: <Monitor className="h-4 w-4" strokeWidth={2.2} />,
        note: 'Windows 10 / 11 · x64',
        assets: [
            {
                label: 'Installer (.exe)',
                href: `https://github.com/${REPO}/releases/download/v${VERSION}/StreamPull-Setup-${VERSION}.exe`,
                primary: true,
                size: '~90 MB',
            },
        ],
    },
    {
        id: 'macos',
        label: 'macOS',
        icon: <Apple className="h-4 w-4" strokeWidth={2.2} />,
        note: 'Apple Silicon & Intel',
        assets: [
            {
                label: 'Disk Image (.dmg)',
                href: `https://github.com/${REPO}/releases/download/v${VERSION}/StreamPull-${VERSION}.dmg`,
                primary: true,
                size: '~110 MB',
            },
        ],
    },
    {
        id: 'linux',
        label: 'Linux',
        icon: <Laptop className="h-4 w-4" strokeWidth={2.2} />,
        note: 'x86_64 · AppImage or .deb',
        assets: [
            {
                label: 'AppImage',
                href: `https://github.com/${REPO}/releases/download/v${VERSION}/StreamPull-${VERSION}-x86_64.AppImage`,
                primary: true,
                size: '~105 MB',
            },
            {
                label: 'Debian (.deb)',
                href: `https://github.com/${REPO}/releases/download/v${VERSION}/StreamPull-${VERSION}-amd64.deb`,
                primary: false,
                size: '~95 MB',
            },
        ],
    },
];

const PERKS = [
    {
        icon: <ShieldCheck className="h-4 w-4" strokeWidth={2.2} />,
        tint: 'bg-success-50 text-success-700',
        title: 'No bot checks',
        text: 'Runs on your own residential IP — no datacenter blocklists.',
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

function detectOS() {
    if (typeof navigator === 'undefined') return 'linux';
    const ua = navigator.userAgent || '';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Mac|iPhone|iPad/i.test(ua)) return 'macos';
    return 'linux';
}

const BTN_PRIMARY =
    'inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-700';
const BTN_SECONDARY =
    'inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-bold text-ink-secondary shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700';
const BTN_GHOST =
    'inline-flex items-center gap-2 rounded-full border border-line bg-canvas px-4 py-2.5 text-xs font-bold text-ink-secondary transition-colors hover:bg-surface-muted';

export default function DesktopDownloadSection() {
    const [active, setActive] = useState('linux');

    useEffect(() => {
        setActive(detectOS());
    }, []);

    const tab = useMemo(() => OS_TABS.find((t) => t.id === active) || OS_TABS[2], [active]);

    return (
        <section
            id="desktop"
            className="relative mt-16 overflow-hidden rounded-[32px] border border-line bg-surface px-5 py-12 shadow-panel sm:px-10 sm:py-16"
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
                    Take StreamPull{' '}
                    <span className="text-brand-600">with you</span>
                </h2>

                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-secondary sm:text-base">
                    The hosted version is a demo. The desktop app runs on your own machine, uses your residential
                    IP, and unlocks cookies, self-updates, and unlimited downloads.
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
                            {t.icon}
                            <span className="hidden sm:inline">{t.label}</span>
                        </button>
                    ))}
                </div>

                {/* Download card */}
                <div className="mx-auto mt-6 max-w-2xl rounded-3xl border border-line bg-canvas p-6 text-left shadow-soft">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                                {tab.icon}
                            </span>
                            <div>
                                <h3 className="font-display text-base font-extrabold text-ink">
                                    {tab.label} build
                                </h3>
                                <p className="text-xs text-ink-secondary">{tab.note}</p>
                            </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-700">
                            v{VERSION}
                        </span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2.5">
                        {tab.assets.map((asset) => (
                            <a
                                key={asset.label}
                                href={asset.href}
                                className={asset.primary ? BTN_PRIMARY : BTN_SECONDARY}
                            >
                                <Download className="h-4 w-4" strokeWidth={2.4} />
                                {asset.label}
                                <span className="ml-1 text-[10px] font-semibold opacity-70">{asset.size}</span>
                            </a>
                        ))}
                        <a href={RELEASES_URL} target="_blank" rel="noreferrer" className={BTN_GHOST}>
                            <Tag className="h-3.5 w-3.5" strokeWidth={2.2} />
                            All releases
                            <ExternalLink className="h-3 w-3" strokeWidth={2.2} />
                        </a>
                    </div>

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
                            className="rounded-2xl border border-line bg-surface p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
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
