import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Header from './Header';
import Footer from './Footer';
import HeroSection from './HeroSection';
import VideoList from './VideoList';
import StatusBanner from './StatusBanner';
import SummaryBar from './SummaryBar';
import SettingsPanel from './SettingsPanel';
import ErrorModal from './ErrorModal';
import { useDownloadSocket } from '../hooks/useDownloadSocket';
import { api } from '../lib/api';
import { MAX_PLAYLIST_VIDEOS, isYouTubeUrl } from '../lib/constants';

/**
 * The downloader itself — desktop only.
 *
 * It runs against the local server that ships inside the app, so downloads are
 * written straight to the user's disk with their own IP and cookies. The hosted
 * website never renders this tree (see HostedPortal).
 */
export default function DesktopApp() {
    const [videos, setVideos] = useState([]);
    const [selectedVideos, setSelectedVideos] = useState(new Set());
    const [playlistUrl, setPlaylistUrl] = useState('');
    const [downloadPath, setDownloadPath] = useState('');
    const [createSubfolder, setCreateSubfolder] = useState(true);
    const [format, setFormat] = useState('mp4');
    const [quality, setQuality] = useState('best');
    const [status, setStatus] = useState(null);
    const [errorModal, setErrorModal] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [search, setSearch] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    // undefined = probing, null = server has no desktop info (old build), object = confirmed desktop
    const [desktopInfo, setDesktopInfo] = useState(undefined);

    const abortControllerRef = useRef(null);

    // Route notifications: errors open a modal; everything else is an inline banner.
    const handleNotify = useCallback((notification) => {
        if (!notification) return;
        if (notification.type === 'error') {
            setErrorModal(notification);
        } else {
            setStatus(notification);
        }
    }, []);

    const {
        videoStates,
        setVideoStates,
        activeDownloads,
        registerActive,
        setVideosByIds,
        resetAll,
        markCancelledLocally,
        onEvent,
    } = useDownloadSocket({ onNotify: handleNotify });

    const refreshDesktop = useCallback(() => {
        api
            .desktopInfo()
            .then(setDesktopInfo)
            .catch(() => setDesktopInfo(null));
    }, []);

    useEffect(() => {
        refreshDesktop();
    }, [refreshDesktop]);

    // The app checks for yt-dlp updates in the background at startup. A manual
    // update started from Settings is the same socket event — while that dialog is
    // open it already reports the result inline, and the banner below the fold
    // would only resurface as stale text after the dialog closes.
    useEffect(() => {
        return onEvent((event, payload) => {
            if (event === 'ytdlp-updated') {
                if (payload?.updated && !settingsOpen) {
                    setStatus({ type: 'success', message: `yt-dlp updated to ${payload.version}`, subMessage: 'Newer engine is active for the next download.' });
                }
                refreshDesktop();
            } else if (event === 'ytdlp-status' || event === 'ytdlp-update-error') {
                refreshDesktop();
            }
        });
    }, [onEvent, refreshDesktop, settingsOpen]);

    const handleAnalyze = useCallback(async () => {
        const trimmedUrl = playlistUrl.trim();
        if (!trimmedUrl) {
            handleNotify({ type: 'error', message: 'Please enter a playlist URL' });
            return;
        }
        if (!isYouTubeUrl(trimmedUrl)) {
            handleNotify({
                type: 'error',
                message: "That doesn't look like a valid YouTube link",
                subMessage: 'Paste a full playlist or video URL, e.g. https://www.youtube.com/playlist?list=…',
            });
            return;
        }

        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsAnalyzing(true);
        setStatus({
            type: 'loading',
            message: 'Analyzing playlist…',
            subMessage: 'Fetching the video list. This may take a moment.',
        });
        setVideos([]);
        setSelectedVideos(new Set());
        resetAll();

        try {
            const data = await api.analyze(trimmedUrl, controller.signal);
            if (data.videos.length > MAX_PLAYLIST_VIDEOS) {
                handleNotify({
                    type: 'error',
                    message: `Playlist too large (${data.videos.length} videos). Max is ${MAX_PLAYLIST_VIDEOS}.`,
                });
                return;
            }
            setVideos(data.videos);
            setVideosByIds(data.videos);
            const relatedCount = data.videos.filter((v) => v.isRelated).length;
            setStatus(
                relatedCount > 0
                    ? {
                        type: 'success',
                        message: 'Video loaded!',
                        subMessage: `Plus ${relatedCount} related ${relatedCount === 1 ? 'video' : 'videos'}`,
                    }
                    : {
                        type: 'success',
                        message: 'Playlist loaded successfully!',
                        subMessage: `Found ${data.videos.length} videos`,
                    },
            );
        } catch (error) {
            if (error.name === 'AbortError') {
                setStatus({ type: 'info', message: 'Analysis cancelled' });
                return;
            }
            handleNotify({
                type: 'error',
                message: 'Failed to analyze playlist',
                subMessage: error.message,
            });
        } finally {
            setIsAnalyzing(false);
            abortControllerRef.current = null;
        }
    }, [playlistUrl, resetAll, setVideosByIds, handleNotify]);

    const handleCancelAnalysis = useCallback(() => {
        abortControllerRef.current?.abort();
        setIsAnalyzing(false);
        setStatus(null);
    }, []);

    /** Local folder to write into: remembered path → OS picker → browser picker. */
    const ensureDownloadPath = useCallback(async () => {
        if (downloadPath) return downloadPath;

        try {
            const data = await api.pickDirectory();
            if (data.path) {
                setDownloadPath(data.path);
                return data.path;
            }
        } catch {
            /* fall through to browser picker */
        }

        if ('showDirectoryPicker' in window) {
            try {
                const handle = await window.showDirectoryPicker();
                setDownloadPath(handle.name);
                return handle.name;
            } catch (err) {
                if (err.name === 'AbortError') return null;
            }
        }

        handleNotify({
            type: 'error',
            message: 'No download folder selected',
            subMessage: 'Pick a folder where the files should be saved, then download again.',
        });
        return null;
    }, [downloadPath, handleNotify]);

    const handleDownload = useCallback(
        async (video, explicitPath = null) => {
            const currentPath = explicitPath || (await ensureDownloadPath());
            if (!currentPath) return;

            // Optimistic update
            setVideoStates((prev) => ({
                ...prev,
                [video.id]: { status: 'queued', progress: 0 },
            }));

            try {
                const data = await api.download({
                    url: video.url,
                    title: video.title,
                    id: video.id,
                    downloadPath: currentPath,
                    createSubfolder,
                    format,
                    quality,
                    playlistTitle: 'StreamPull',
                });
                if (data.downloadId) {
                    registerActive(video.url, data.downloadId);
                }
            } catch (error) {
                setVideoStates((prev) => ({
                    ...prev,
                    [video.id]: { status: 'error', error: error.message },
                }));
            }
        },
        [createSubfolder, ensureDownloadPath, format, quality, registerActive, setVideoStates],
    );

    const handleDownloadSelected = useCallback(async () => {
        const currentPath = downloadPath || (await ensureDownloadPath());
        if (!currentPath) return;
        for (const id of selectedVideos) {
            const video = videos.find((v) => v.id === id);
            if (video) await handleDownload(video, currentPath);
        }
    }, [downloadPath, ensureDownloadPath, handleDownload, selectedVideos, videos]);

    const handleCancel = useCallback(
        async (video) => {
            const downloadId = activeDownloads.get(video.url);
            if (!downloadId) return;
            try {
                await api.cancel(downloadId);
            } catch (error) {
                console.error('Cancel failed', error);
            }
        },
        [activeDownloads],
    );

    const handleCancelAll = useCallback(async () => {
        try {
            await api.cancelAll();
            markCancelledLocally();
            setStatus({ type: 'info', message: 'All downloads cancelled' });
        } catch (error) {
            console.error('Cancel all failed', error);
        }
    }, [markCancelledLocally]);

    const handleOpenFolder = useCallback(
        (filePath) => api.openFolder(filePath).catch((e) => console.error('Open folder failed', e)),
        [],
    );

    const handleSelectAll = useCallback(
        (checked) => setSelectedVideos(checked ? new Set(videos.map((v) => v.id)) : new Set()),
        [videos],
    );

    const handleToggleSelect = useCallback((id, checked) => {
        setSelectedVideos((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);

    const filteredVideos = useMemo(() => {
        if (!search.trim()) return videos;
        const q = search.toLowerCase();
        return videos.filter((v) => v.title.toLowerCase().includes(q));
    }, [videos, search]);

    const isAllSelected = videos.length > 0 && selectedVideos.size === videos.length;
    const isIndeterminate = selectedVideos.size > 0 && selectedVideos.size < videos.length;

    // Only surface desktop affordances once /api/desktop/info has answered —
    // that endpoint only exists on the local server shipped inside the app.
    const isDesktop = Boolean(desktopInfo);

    return (
        <div className="flex min-h-screen flex-col bg-canvas font-sans text-ink">
            <Header
                desktopMode={isDesktop}
                updateAvailable={Boolean(desktopInfo?.ytdlp?.updateAvailable || desktopInfo?.app?.updateAvailable)}
                onOpenSettings={() => setSettingsOpen(true)}
            />

            <main className="mx-auto w-full max-w-6xl flex-grow px-4 py-8 sm:px-6 lg:px-8">
                <HeroSection
                    playlistUrl={playlistUrl}
                    setPlaylistUrl={setPlaylistUrl}
                    onAnalyze={handleAnalyze}
                    isAnalyzing={isAnalyzing}
                    downloadPath={downloadPath}
                    setDownloadPath={setDownloadPath}
                    onPickDirectory={ensureDownloadPath}
                    createSubfolder={createSubfolder}
                    setCreateSubfolder={setCreateSubfolder}
                />

                <StatusBanner
                    status={status}
                    isAnalyzing={isAnalyzing}
                    onCancelAnalysis={handleCancelAnalysis}
                    onDismiss={() => setStatus(null)}
                />

                <SummaryBar videos={videos} videoStates={videoStates} />

                <VideoList
                    videos={filteredVideos}
                    totalCount={videos.length}
                    isAnalyzing={isAnalyzing}
                    videoStates={videoStates}
                    selectedVideos={selectedVideos}
                    onToggleSelect={handleToggleSelect}
                    onSelectAll={handleSelectAll}
                    isAllSelected={isAllSelected}
                    isIndeterminate={isIndeterminate}
                    onDownload={handleDownload}
                    onCancel={handleCancel}
                    onOpenFolder={handleOpenFolder}
                    format={format}
                    setFormat={setFormat}
                    quality={quality}
                    setQuality={setQuality}
                    search={search}
                    setSearch={setSearch}
                    onDownloadSelected={handleDownloadSelected}
                    onCancelAll={handleCancelAll}
                    activeDownloadsCount={activeDownloads.size}
                />
            </main>

            <Footer />

            {/* Kept mounted while open so a refresh that stops answering still shows
          the "unavailable" dialog instead of silently swallowing the panel. It
          reports its own results inline — the global banner would sit behind the
          modal backdrop and outlive the dialog it described. */}
            {(isDesktop || settingsOpen) && (
                <SettingsPanel
                    open={settingsOpen}
                    onClose={() => setSettingsOpen(false)}
                    info={desktopInfo ?? null}
                    refresh={refreshDesktop}
                />
            )}

            <ErrorModal
                error={errorModal}
                onClose={() => setErrorModal(null)}
                onOpenSettings={() => setSettingsOpen(true)}
                canOpenSettings={isDesktop}
            />
        </div>
    );
}
