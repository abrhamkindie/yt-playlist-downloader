import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { api } from '../lib/api';

/**
 * Single long-lived socket connection + download state.
 *
 * Fixes the old bug where the socket effect depended on `videos` and was
 * torn down / recreated on every analysis. Events are matched by id, so no
 * stale-closure lookups against `videos` are needed at all.
 */
export function useDownloadSocket({ onNotify }) {
  const [videoStates, setVideoStates] = useState({});
  const [activeDownloads, setActiveDownloads] = useState(new Map()); // url -> id
  const notifyRef = useRef(onNotify);

  useEffect(() => {
    notifyRef.current = onNotify;
  }, [onNotify]);

  const socketRef = useRef(null);

  // Connect once.
  useEffect(() => {
    const socket = io(api.baseUrl);
    socketRef.current = socket;

    socket.on('connect', () => console.log('Socket connected'));
    socket.on('disconnect', () => console.log('Socket disconnected'));

    socket.on('download-progress', ({ id, progress, speed, eta, phase }) => {
      setVideoStates((prev) => ({
        ...prev,
        [id]: { ...prev[id], status: 'downloading', progress, speed, eta, phase },
      }));
    });

    socket.on('download-complete', ({ id, filePath }) => {
      setVideoStates((prev) => ({
        ...prev,
        [id]: { status: 'complete', progress: 100, filePath },
      }));
      removeFromActive(setActiveDownloads, id);
    });

    socket.on('download-error', ({ id, error }) => {
      setVideoStates((prev) => ({
        ...prev,
        [id]: { status: 'error', error },
      }));
      removeFromActive(setActiveDownloads, id);
      notifyRef.current?.({
        type: 'error',
        message: 'Download failed',
        subMessage: error,
      });
    });

    socket.on('cancelled', ({ id }) => {
      setVideoStates((prev) => ({
        ...prev,
        [id]: { status: 'cancelled', progress: 0 },
      }));
      removeFromActive(setActiveDownloads, id);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  const registerActive = useCallback((url, id) => {
    setActiveDownloads((prev) => new Map(prev).set(url, id));
  }, []);

  const setVideosByIds = useCallback((list) => {
    // Seed states for newly loaded videos without wiping in-flight ones.
    setVideoStates((prev) => {
      const next = { ...prev };
      for (const v of list) {
        if (!next[v.id]) next[v.id] = { status: 'ready', progress: 0 };
      }
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setVideoStates({});
    setActiveDownloads(new Map());
  }, []);

  const markCancelledLocally = useCallback(() => {
    setVideoStates((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (next[id].status === 'queued' || next[id].status === 'downloading') {
          next[id] = { ...next[id], status: 'cancelled', progress: 0 };
        }
      }
      return next;
    });
    setActiveDownloads(new Map());
  }, []);

  return {
    videoStates,
    setVideoStates,
    activeDownloads,
    registerActive,
    setVideosByIds,
    resetAll,
    markCancelledLocally,
  };
}

function removeFromActive(setActiveDownloads, id) {
  setActiveDownloads((prev) => {
    const next = new Map(prev);
    for (const [url, activeId] of prev) {
      if (activeId === id) next.delete(url);
    }
    return next;
  });
}
