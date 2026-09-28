/**
 * Shared constants — keep in sync with server/lib/constants.js.
 */

export const FORMATS = {
  video: ['mp4', 'webm', 'mkv'],
  audio: ['mp3', 'm4a', 'wav'],
};

export const ALL_FORMATS = [...FORMATS.video, ...FORMATS.audio];

export const QUALITIES = [
  { value: 'best', label: 'Best Available' },
  { value: '2160p', label: '4K (2160p)' },
  { value: '1440p', label: '2K (1440p)' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
  { value: '360p', label: '360p' },
];

export const MAX_PLAYLIST_VIDEOS = 500;
