import React from 'react';
import {
    Download,
    ArrowDownRight,
    Code,
    Star,
    HardDriveDownload,
    ClipboardPaste,
    PackageOpen,
} from 'lucide-react';
import Header from './Header';
import Footer from './Footer';
import DesktopDownloadSection from './DesktopDownloadSection';
import { detectOS, getOsTab, getPrimaryAsset, RELEASES_URL } from '../lib/releases';

/**
 * The three things a visitor does after leaving this page. Shown before the
 * builds so the download button below has an obvious "and then…".
 */
const STEPS = [
    {
        icon: <HardDriveDownload className="h-5 w-5" strokeWidth={2.2} />,
        tint: 'bg-brand-50 text-brand-700',
        title: 'Download the app',
        text: 'One installer per platform. yt-dlp and ffmpeg come with it — nothing to install by hand.',
    },
    {
        icon: <ClipboardPaste className="h-5 w-5" strokeWidth={2.2} />,
        tint: 'bg-accent-50 text-accent-700',
        title: 'Paste the playlist link',
        text: 'The app lists every video so you pick exactly what to grab, and in what quality.',
    },
    {
        icon: <PackageOpen className="h-5 w-5" strokeWidth={2.2} />,
        tint: 'bg-sky-50 text-sky-700',
        title: 'Files land in your folder',
        text: 'Watch live progress, then open the folder when the queue is done.',
    },
];

/**
 * The hosted website: a download portal for the desktop app. The downloader UI
 * itself only ever runs locally, so this page sells it and gets out of the way.
 */
export default function HostedPortal() {
    // No state to sync: the visitor's platform is fixed for the whole session.
    const tab = getOsTab(detectOS());
    const asset = getPrimaryAsset(tab.id);

    return (
        <div className="flex min-h-screen flex-col bg-canvas font-sans text-ink">
            <Header
                hostedMode
                hostedCtaLabel={`Download for ${tab.label}`}
                hostedCtaHref={asset.href}
            />

            <main className="mx-auto w-full max-w-6xl flex-grow px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
                {/* Hero: one clear job — get the app */}
                <section className="relative overflow-hidden rounded-[32px] border border-line bg-surface px-5 py-12 shadow-panel sm:px-10 sm:py-16">
                    <div className="dot-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
                    <div
                        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-sky-100/80 blur-2xl"
                        aria-hidden="true"
                    />
                    <div
                        className="pointer-events-none absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-accent-100/70 blur-2xl"
                        aria-hidden="true"
                    />

                    <div className="relative mx-auto max-w-3xl text-center">
                        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-700">
                            <Star className="h-3.5 w-3.5" strokeWidth={2.4} />
                            Free · Open source · Windows, macOS, Linux
                        </span>

                        <h1 className="font-display mt-5 text-[34px] leading-[1.1] font-extrabold tracking-tight text-ink sm:text-[46px]">
                            Download YouTube playlists
                            <br className="hidden sm:block" />{' '}
                            <span className="relative inline-block text-brand-600">
                                straight to your device
                                <svg
                                    className="absolute -bottom-2 left-0 h-2 w-full text-accent-500"
                                    viewBox="0 0 200 12"
                                    fill="none"
                                    preserveAspectRatio="none"
                                    aria-hidden="true"
                                >
                                    <path d="M3 9C40 3 90 2 127 5c26 2 48 3 70 1" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                                </svg>
                            </span>
                        </h1>

                        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-ink-secondary sm:text-base">
                            StreamPull runs{' '}
                            <span className="font-semibold text-ink">yt-dlp and ffmpeg on your own computer</span>
                            {' '}— downloads come from your IP, land in your folder, and never touch a server.
                            This page is where you get the app.
                        </p>

                        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                            <a
                                href={asset.href}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-8 py-4 text-sm font-bold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-700 sm:w-auto"
                            >
                                <Download className="h-4 w-4" strokeWidth={2.4} />
                                Download for {tab.label}
                                <span className="text-[11px] font-semibold opacity-75">{asset.size}</span>
                            </a>
                            <a
                                href="#desktop"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line bg-canvas px-7 py-4 text-sm font-bold text-ink-secondary shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700 sm:w-auto"
                            >
                                Other platforms
                                <ArrowDownRight className="h-4 w-4" strokeWidth={2.4} />
                            </a>
                        </div>

                        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-medium text-ink-muted">
                            <span>We detected {tab.label} — every other build is one scroll away.</span>
                            <a
                                href={RELEASES_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-bold text-brand-700 hover:underline"
                            >
                                <Code className="h-3 w-3" strokeWidth={2.2} />
                                Source on GitHub
                            </a>
                        </p>
                    </div>
                </section>

                {/* What happens after you leave this page */}
                <section className="mt-12">
                    <h2 className="font-display text-center text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
                        Up and running in about a minute
                    </h2>
                    <ol className="mt-6 grid gap-3 sm:grid-cols-3">
                        {STEPS.map((step, i) => (
                            <li
                                key={step.title}
                                className="relative rounded-2xl border border-line bg-surface p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                            >
                                <span className="absolute right-4 top-4 font-display text-xs font-extrabold tabular-nums text-ink-muted">
                                    0{i + 1}
                                </span>
                                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${step.tint}`}>
                                    {step.icon}
                                </span>
                                <p className="mt-3 text-sm font-bold text-ink">{step.title}</p>
                                <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{step.text}</p>
                            </li>
                        ))}
                    </ol>
                </section>

                <DesktopDownloadSection />
            </main>

            <Footer hostedMode />
        </div>
    );
}
