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
  analyze: (url, signal) =>
    request('/api/analyze', { method: 'POST', body: JSON.stringify({ url }), signal }),

  download: (payload) => request('/api/download', { method: 'POST', body: JSON.stringify(payload) }),

  cancel: (id) => request(`/api/cancel/${encodeURIComponent(id)}`, { method: 'POST' }),

  cancelAll: () => request('/api/cancel-all', { method: 'POST' }),

  status: () => request('/api/status'),

  pickDirectory: () => request('/api/pick-directory'),

  openFolder: (filePath) =>
    request('/api/open-folder', { method: 'POST', body: JSON.stringify({ filePath }) }),

  /** Hosted mode only — direct file URL for "save to device". */
  fileUrl: (id) => `${API_BASE_URL}/api/files/${encodeURIComponent(id)}`,

  baseUrl: API_BASE_URL,
};
