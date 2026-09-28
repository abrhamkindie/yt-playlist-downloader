import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import HeroSection from './components/HeroSection';
import VideoList from './components/VideoList';
import StatusBanner from './components/StatusBanner';
import SummaryBar from './components/SummaryBar';
import { useDownloadSocket } from './hooks/useDownloadSocket';
import { api } from './lib/api';
import { MAX_PLAYLIST_VIDEOS } from './lib/constants';

function App() {
  const [videos, setVideos] = useState([]);
  const [selectedVideos, setSelectedVideos] = useState(new Set());
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [downloadPath, setDownloadPath] = useState('');
  const [createSubfolder, setCreateSubfolder] = useState(true);
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('best');
  const [status, setStatus] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [search, setSearch] = useState('');
  const [hostedMode, setHostedMode] = useState(false);

  const abortControllerRef = useRef(null);

  const {
    videoStates,
    setVideoStates,
    activeDownloads,
    registerActive,
    setVideosByIds,
    resetAll,
    markCancelledLocally,
  } = useDownloadSocket({ onNotify: setStatus });

  // Detect hosted mode once (drives UI: hide path controls, show save-to-device).
  useEffect(() => {
    api
      .status()
      .then((data) => setHostedMode(Boolean(data.hosted)))
      .catch(() => setHostedMode(false));
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!playlistUrl) {
      setStatus({ type: 'error', message: 'Please enter a playlist URL' });
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
      const data = await api.analyze(playlistUrl, controller.signal);
      if (data.videos.length > MAX_PLAYLIST_VIDEOS) {
        setStatus({
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
      setStatus({
        type: 'error',
        message: 'Failed to analyze playlist',
        subMessage: error.message,
      });
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  }, [playlistUrl, resetAll, setVideosByIds]);

  const handleCancelAnalysis = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsAnalyzing(false);
    setStatus(null);
  }, []);

  const ensureDownloadPath = useCallback(async () => {
    if (hostedMode) return null; // server decides the path
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

    setStatus({
      type: 'error',
      message: 'No download folder selected',
      subMessage: 'Pick a folder or run the desktop app for local saving.',
    });
    return null;
  }, [downloadPath, hostedMode]);

  const handleDownload = useCallback(
    async (video, explicitPath = null) => {
      let currentPath = explicitPath;
      if (!hostedMode && !currentPath) {
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
          playlistTitle: 'Playlist Downloads',
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
    if (!hostedMode && !currentPath) {
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

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen flex flex-col font-sans">
      <Header />

      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
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
          hostedMode={hostedMode}
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
          videoStates={videoStates}
          selectedVideos={selectedVideos}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          isAllSelected={isAllSelected}
          isIndeterminate={isIndeterminate}
          onDownload={handleDownload}
          onCancel={handleCancel}
          onOpenFolder={handleOpenFolder}
          hostedMode={hostedMode}
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
    </div>
  );
}

export default App;
