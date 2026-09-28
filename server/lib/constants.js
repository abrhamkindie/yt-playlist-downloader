/**
 * Shared constants — single source of truth for the server.
 * Keep in sync with client/src/lib/constants.js.
 */

const FORMATS = {
  video: ['mp4', 'webm', 'mkv'],
  audio: ['mp3', 'm4a', 'wav'],
};

const ALL_FORMATS = [...FORMATS.video, ...FORMATS.audio];

const QUALITIES = ['best', '2160p', '1440p', '1080p', '720p', '480p', '360p'];

const HEIGHT_FILTERS = {
  '2160p': '[height<=2160]',
  '1440p': '[height<=1440]',
  '1080p': '[height<=1080]',
  '720p': '[height<=720]',
  '480p': '[height<=480]',
  '360p': '[height<=360]',
};

// Download queue — tune with MAX_CONCURRENT_DOWNLOADS env var
const MAX_CONCURRENT_DOWNLOADS = Math.max(1, Number(process.env.MAX_CONCURRENT_DOWNLOADS) || 3);
const MAX_PLAYLIST_VIDEOS = 500;

// Retention of finished/failed records in memory (ms) before pruning
const RECORD_TTL_MS = 60 * 60 * 1000; // 1 hour

module.exports = {
  FORMATS,
  ALL_FORMATS,
  QUALITIES,
  HEIGHT_FILTERS,
  MAX_CONCURRENT_DOWNLOADS,
  MAX_PLAYLIST_VIDEOS,
  RECORD_TTL_MS,
};
