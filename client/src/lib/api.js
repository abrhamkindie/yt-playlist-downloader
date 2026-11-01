const API_BASE_URL = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* non-JSON response */
  }

  if (!response.ok) {
    const message = data?.error || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  /**
   * Answered by every build and used once at boot to decide which app to
   * render: the desktop downloader (hosted: false) or the website's download
   * portal (hosted: true).
   */
  status: () => request('/api/status'),

  // --- Desktop app only. The hosted server refuses these by design. ---
  analyze: (url, signal) =>
    request('/api/analyze', { method: 'POST', body: JSON.stringify({ url }), signal }),

  download: (payload) => request('/api/download', { method: 'POST', body: JSON.stringify(payload) }),

  cancel: (id) => request(`/api/cancel/${encodeURIComponent(id)}`, { method: 'POST' }),

  cancelAll: () => request('/api/cancel-all', { method: 'POST' }),

  pickDirectory: () => request('/api/pick-directory'),

  openFolder: (filePath) =>
    request('/api/open-folder', { method: 'POST', body: JSON.stringify({ filePath }) }),

  // --- Desktop app maintenance / settings (absent on a hosted server) ---
  desktopInfo: () => request('/api/desktop/info'),

  setCookiesFromBrowser: (browser) =>
    request('/api/settings/cookies-from-browser', {
      method: 'POST',
      body: JSON.stringify({ browser }),
    }),

  clearCookies: () => request('/api/cookies', { method: 'DELETE' }),

  // Engine + app bundle in one round trip — the settings panel has a single
  // "Check for updates" action, not one per component.
  checkAll: () => request('/api/desktop/check', { method: 'POST' }),

  // reinstall: fetch the current release again even when nothing is pending.
  updateYtdlp: ({ reinstall = false } = {}) =>
    request('/api/ytdlp/update', { method: 'POST', body: JSON.stringify({ force: true, reinstall }) }),

  baseUrl: API_BASE_URL,
};
