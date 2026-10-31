import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import HeroSection from './components/HeroSection';
import VideoList from './components/VideoList';
import StatusBanner from './components/StatusBanner';
import SummaryBar from './components/SummaryBar';
import SettingsPanel from './components/SettingsPanel';
import DesktopDownloadSection from './components/DesktopDownloadSection';
import ErrorModal from './components/ErrorModal';
import { useDownloadSocket } from './hooks/useDownloadSocket';
import { api } from './lib/api';
import { MAX_PLAYLIST_VIDEOS, isYouTubeUrl } from './lib/constants';

function App() {
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
  const [hostedMode, setHostedMode] = useState(null); // null = probing
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [desktopInfo, setDesktopInfo] = useState(undefined); // undefined = probing, null = confirmed not desktop

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

  // Detect hosted mode once (drives UI: hide path controls, show save-to-device).
  useEffect(() => {
    api
      .status()
      .then((data) => setHostedMode(Boolean(data.hosted)))
      .catch(() => {
        // If /api/status fails, the backend is unreachable.
        // The desktop app always has a local server, so a failure here
        // almost certainly means we're on the hosted site with a cold/slow
        // backend. Leave hostedMode as null → treated as hosted (safe).
      });
  }, []);

  const refreshDesktop = useCallback(() => {
    api
      .desktopInfo()
      .then(setDesktopInfo)
      .catch(() => setDesktopInfo(null)); // hosted build, or server too old
  }, []);


  useEffect(() => {
    // Probe desktop capabilities only after we know we are NOT hosted.
    if (hostedMode === null) return; // still probing
    if (hostedMode) {
      setDesktopInfo(null); // definite: no desktop info on hosted server
      return;
    }
    refreshDesktop();
  }, [hostedMode, refreshDesktop]);

  // The app checks for yt-dlp updates in the background at startup.
  useEffect(() => {
    if (hostedMode) return undefined;
    return onEvent((event, payload) => {
      if (event === 'ytdlp-updated') {
        if (payload?.updated) {
          setStatus({ type: 'success', message: `yt-dlp updated to ${payload.version}`, subMessage: 'Newer engine is active for the next download.' });
        }
        refreshDesktop();
      } else if (event === 'ytdlp-status' || event === 'ytdlp-update-error') {
        refreshDesktop();
      }
    });
  }, [hostedMode, onEvent, refreshDesktop]);

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
      setStatus({
        type: 'success',
        message: 'Playlist loaded successfully!',
        subMessage: `Found ${data.videos.length} videos`,
      });
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

  const ensureDownloadPath = useCallback(async () => {
    if (hostedMode !== false) return null; // hosted or still probing — server decides the path
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
      subMessage: 'Pick a folder or run the desktop app for local saving.',
    });
    return null;
  }, [downloadPath, hostedMode, handleNotify]);

  const handleDownload = useCallback(
    async (video, explicitPath = null) => {
      let currentPath = explicitPath;
      if (hostedMode === false && !currentPath) {
        currentPath = await ensureDownloadPath();
        if (!currentPath) return;
      }

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
          downloadPath: currentPath || undefined,
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
    [createSubfolder, ensureDownloadPath, format, hostedMode, quality, registerActive, setVideoStates],
  );

  const handleDownloadSelected = useCallback(async () => {
    let currentPath = downloadPath;
    if (hostedMode === false && !currentPath) {
      currentPath = await ensureDownloadPath();
      if (!currentPath) return;
    }
    for (const id of selectedVideos) {
      const video = videos.find((v) => v.id === id);
      if (video) await handleDownload(video, currentPath);
    }
  }, [downloadPath, ensureDownloadPath, handleDownload, hostedMode, selectedVideos, videos]);

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

  // Only surface desktop affordances when we've CONFIRMED we're in the desktop
  // app — a successful /api/desktop/info response. Avoids the deployed site
  // showing a Settings button that opens a permanently-loading panel.
  const isDesktop = Boolean(desktopInfo);
  // Treat "still probing" (hostedMode === null) as hosted so path controls do
  // not flash in before /api/status resolves. Confirmed desktop = false.
  const isHosted = hostedMode !== false;

  return (
    <div className="flex min-h-screen flex-col bg-canvas font-sans text-ink">
      <Header
        desktopMode={isDesktop}
        hostedMode={isHosted}
        updateAvailable={Boolean(desktopInfo?.ytdlp?.updateAvailable)}
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
          hostedMode={isHosted}
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
          hostedMode={isHosted}
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

        {/* On the hosted site, promote the desktop app; in the desktop app itself, hide it. */}
        {isHosted && <DesktopDownloadSection />}
      </main>

      <Footer hostedMode={isHosted} />

      {isDesktop && (
        <SettingsPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          info={desktopInfo}
          refresh={refreshDesktop}
          onNotify={handleNotify}
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

export default App;
