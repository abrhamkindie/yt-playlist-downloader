import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Header from './components/Header';
import Footer from './components/Footer';
import HeroSection from './components/HeroSection';
import VideoList from './components/VideoList';

function App() {
  const [socket, setSocket] = useState(null);
  const [videos, setVideos] = useState([]);
  const [selectedVideos, setSelectedVideos] = useState(new Set());
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [downloadPath, setDownloadPath] = useState('');
  const [createSubfolder, setCreateSubfolder] = useState(true);
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('best');
  const [status, setStatus] = useState(null); 
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [videoStates, setVideoStates] = useState({});
  const [activeDownloads, setActiveDownloads] = useState(new Map()); // url -> downloadId
  const [dirHandle, setDirHandle] = useState(null);

  // Use environment variable for API URL, fallback to relative path (proxy) for dev
  const API_BASE_URL = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    console.log('🔌 API Base URL:', API_BASE_URL || '(relative/proxy)');
    if (!API_BASE_URL && import.meta.env.PROD) {
        console.warn('⚠️ VITE_API_URL is missing! The app may try to connect to itself instead of the backend.');
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    const newSocket = io(API_BASE_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => console.log('Connected to server'));
    newSocket.on('disconnect', () => console.log('Disconnected'));
    
    newSocket.on('download-progress', ({ url, percent }) => {
       setVideoStates(prev => {
         const video = videos.find(v => v.url === url);
         if (!video) return prev;
         return {
           ...prev,
           [video.id]: { ...prev[video.id], status: 'downloading', progress: percent }
         };
       });
    });

    newSocket.on('download-complete', ({ url, filePath }) => {
       setVideoStates(prev => {
         const video = videos.find(v => v.url === url);
         if (!video) return prev;
         return {
           ...prev,
           [video.id]: { ...prev[video.id], status: 'complete', progress: 100, filePath }
         };
       });
       setActiveDownloads(prev => {
           const newMap = new Map(prev);
           newMap.delete(url);
           return newMap;
       });
    });

    newSocket.on('download-error', ({ url, error }) => {
       setVideoStates(prev => {
         const video = videos.find(v => v.url === url);
         if (!video) return prev;
         return {
           ...prev,
           [video.id]: { ...prev[video.id], status: 'error', error }
         };
       });
       setActiveDownloads(prev => {
           const newMap = new Map(prev);
           newMap.delete(url);
           return newMap;
       });
    });

    newSocket.on('cancelled', ({ id, url }) => {
       setVideoStates(prev => {
         const video = videos.find(v => v.url === url); 
         if (!video) return prev;
         return {
           ...prev,
           [video.id]: { ...prev[video.id], status: 'cancelled', progress: 0 }
         };
       });
       setActiveDownloads(prev => {
           const newMap = new Map(prev);
           newMap.delete(url);
           return newMap;
       });
    });

    return () => newSocket.close();
  }, [videos]); 

  const handleAnalyze = async () => {
    if (!playlistUrl) {
        setStatus({ type: 'error', message: 'Please enter a playlist URL' });
        return;
    }
    
    setIsAnalyzing(true);
    setStatus({ type: 'loading', message: 'Analyzing playlist...', subMessage: 'This may take a moment. Please wait while we fetch the video list.' });
    setVideos([]);
    setVideoStates({});
    setSelectedVideos(new Set());

    try {
        const response = await fetch(`${API_BASE_URL}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: playlistUrl })
        });
        const data = await response.json();

        if (data.error) {
            setStatus({ type: 'error', message: data.error });
        } else {
            setVideos(data.videos);
            const pathMsg = downloadPath || 'default downloads folder';
            setStatus({ type: 'success', message: 'Playlist loaded successfully!', subMessage: `Found ${data.videos.length} videos • Saving to ${pathMsg}` });
        }
    } catch (error) {
        setStatus({ type: 'error', message: 'Connection Error: Failed to connect to server.' });
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleDownload = async (video) => {
      // Optimistic update
      setVideoStates(prev => ({
          ...prev,
          [video.id]: { status: 'queued', progress: 0 }
      }));

      try {
          const response = await fetch(`${API_BASE_URL}/api/download`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  url: video.url,
                  title: video.title,
                  downloadPath: null, // Always use default server path for cloud downloads
                  format,
                  quality,
                  createSubfolder,
                  playlistTitle: "Playlist Downloads" 
              })
          });
          const data = await response.json();
          
          if (data.downloadId) {
              setActiveDownloads(prev => new Map(prev).set(video.url, data.downloadId));
          } else {
              throw new Error(data.error || 'Failed to queue');
          }
      } catch (error) {
          setVideoStates(prev => ({
              ...prev,
              [video.id]: { status: 'error', error: error.message || 'Request failed' }
          }));
      }
  };

  const handleCancel = async (video) => {
      const downloadId = activeDownloads.get(video.url);
      if (!downloadId) return;

      try {
          await fetch(`${API_BASE_URL}/api/cancel`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ downloadId })
          });
      } catch (error) {
          console.error('Cancel failed', error);
      }
  };

  const handlePickDirectory = async () => {
      // Try to use File System Access API first (Chrome/Edge/Opera)
      if ('showDirectoryPicker' in window) {
          try {
              const handle = await window.showDirectoryPicker();
              setDirHandle(handle);
              setDownloadPath(handle.name); // Just show the folder name
              return;
          } catch (err) {
              if (err.name === 'AbortError') return; // User cancelled
              console.error('Directory picker error:', err);
              // Fallback to server picker if client picker fails (unlikely but safe)
          }
      }

      // Fallback for other browsers or if API fails
      try {
          const response = await fetch(`${API_BASE_URL}/api/pick-directory`);
          const data = await response.json();
          if (data.path) {
              setDownloadPath(data.path);
          } else {
              setStatus({ 
                  type: 'loading', 
                  message: 'Directory selection unavailable', 
                  subMessage: 'Your browser doesn\'t support direct folder selection. Downloads will be saved to your default Downloads folder.' 
              });
              setTimeout(() => setStatus(null), 5000);
          }
      } catch (error) {
          console.error('Failed to pick directory', error);
      }
  };

  const handleOpenFolder = async (filePath) => {
      try {
          await fetch(`${API_BASE_URL}/api/open-folder`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ downloadPath, filePath })
          });
      } catch (error) {
          console.error('Failed to open folder', error);
      }
  };

  const handleDownloadSelected = () => {
      selectedVideos.forEach(id => {
          const video = videos.find(v => v.id === id);
          if (video) handleDownload(video);
      });
  };

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
                onOpenFolder={handlePickDirectory}
                createSubfolder={createSubfolder}
                setCreateSubfolder={setCreateSubfolder}
            />

            {status && (
                <div className={`mb-4 border-l-4 px-4 py-3 rounded-lg text-sm flex items-center gap-3 ${
                    status.type === 'error' ? 'bg-red-50 border-red-500 text-red-700' :
                    status.type === 'success' ? 'bg-primary-50 border-primary-500 text-primary-800' :
                    status.type === 'loading' ? 'bg-blue-50 border-primary-500 text-primary-800' : ''
                }`}>
                    {status.type === 'loading' && (
                        <svg className="w-5 h-5 flex-shrink-0 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    )}
                    {status.type === 'success' && (
                        <svg className="w-5 h-5 flex-shrink-0 text-primary-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                    )}
                    {status.type === 'error' && (
                        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
                    )}
                    
                    <div>
                        <div className="font-semibold">{status.message}</div>
                        {status.subMessage && <div className="text-sm mt-0.5 opacity-90">{status.subMessage}</div>}
                    </div>
                </div>
            )}

            <VideoList 
                videos={videos}
                videoStates={videoStates}
                selectedVideos={selectedVideos}
                setSelectedVideos={setSelectedVideos}
                onDownload={handleDownload}
                onCancel={handleCancel}
                onOpenFolder={handleOpenFolder}
                format={format}
                setFormat={setFormat}
                quality={quality}
                setQuality={setQuality}
                onDownloadSelected={handleDownloadSelected}
                dirHandle={dirHandle}
            />
        </main>

        <Footer />
    </div>
  );
}

export default App;
