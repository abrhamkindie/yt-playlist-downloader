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

/**
 * True when the value parses as an http(s) YouTube URL.
 * Mirrors the server-side check in server/lib/urls.js so obviously
 * invalid input is rejected locally before any network call.
 */
export function isYouTubeUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'youtu.be' ||
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host.endsWith('.youtube-nocookie.com')
    );
  } catch {
    return false;
  }
}
