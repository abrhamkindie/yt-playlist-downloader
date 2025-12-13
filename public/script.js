const socket = io();
const analyzeBtn = document.getElementById('analyzeBtn');
const playlistInput = document.getElementById('playlistUrl');
const downloadPathInput = document.getElementById('downloadPath');
const openFolderBtn = document.getElementById('openFolderBtn');
const videoList = document.getElementById('videoList');
const statusMessage = document.getElementById('statusMessage');

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    statusMessage.textContent = 'Connection error. Please refresh the page.';
});

const formatSelect = document.getElementById('formatSelect');
const qualitySelect = document.getElementById('qualitySelect');
const qualityGroup = document.getElementById('qualityGroup');
const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const selectionCount = document.getElementById('selectionCount');
const createSubfolderCheckbox = document.getElementById('createSubfolderCheckbox');

let currentVideos = [];
let playlistTitle = "Playlist";
let activeDownloads = new Map();

formatSelect.addEventListener('change', () => {
    const audioFormats = ['mp3', 'm4a', 'wav'];
    if (audioFormats.includes(formatSelect.value)) {
        qualityGroup.style.opacity = '0.5';
        qualitySelect.disabled = true;
    } else {
        qualityGroup.style.opacity = '1';
        qualitySelect.disabled = false;
    }
});

openFolderBtn.addEventListener('click', async () => {
    const downloadPath = downloadPathInput.value.trim();
    try {
        await fetch('/api/open-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ downloadPath })
        });
    } catch (error) {
        console.error('Failed to open folder:', error);
    }
});

analyzeBtn.addEventListener('click', async () => {
    const url = playlistInput.value.trim();
    console.log('Analyze button clicked. URL:', url);
    
    if (!url) {
        console.log('No URL provided');
        statusMessage.textContent = 'Please enter a playlist URL';
        return;
    }

    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<svg class="w-4 h-4 animate-spin inline-block mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Analyzing...';
    
    statusMessage.className = 'bg-blue-50 border-l-4 border-primary-500 text-primary-800 px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-3';
    statusMessage.innerHTML = '<svg class="w-5 h-5 animate-spin flex-shrink-0 text-primary-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><div><div class="font-semibold">Analyzing playlist...</div><div class="text-sm text-primary-700 mt-0.5">This may take a moment. Please wait while we fetch the video list.</div></div>';
    
    videoList.innerHTML = '';
    currentVideos = [];
    updateSelectionUI();

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (data.error) {
            statusMessage.className = 'bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-3';
            statusMessage.innerHTML = '<svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg><span><strong>Error:</strong> ' + data.error + '</span>';
        } else {
            const pathMsg = downloadPathInput.value.trim() ? downloadPathInput.value.trim() : 'default downloads folder';
            statusMessage.className = 'bg-primary-50 border-l-4 border-primary-500 text-primary-800 px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-3';
            statusMessage.innerHTML = '<svg class="w-5 h-5 flex-shrink-0 text-primary-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg><div><div class="font-semibold">Playlist loaded successfully!</div><div class="text-sm text-primary-700 mt-0.5">Found <strong>' + data.videos.length + '</strong> videos • Saving to <strong>' + pathMsg + '</strong></div></div>';
            currentVideos = data.videos;
            renderVideos(data.videos);
        }
    } catch (error) {
        statusMessage.className = 'bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-3';
        statusMessage.innerHTML = '<svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg><span><strong>Connection Error:</strong> Failed to connect to server. Please check your connection and try again.</span>';
        console.error(error);
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<span>Analyze</span><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>';
    }
});

function renderVideos(videos) {
    videoList.innerHTML = '';
    videos.forEach(video => {
        const card = document.createElement('div');
        // Tailwind Card Styles
        card.className = 'bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row gap-4 transition-all hover:shadow-md video-card';
        card.dataset.id = video.id;
        
        card.innerHTML = `
            <div class="flex-shrink-0 relative group">
                <img src="${video.thumbnail}" alt="Thumbnail" class="w-full sm:w-48 h-32 object-cover rounded-lg shadow-sm">
                <div class="absolute top-2 left-2">
                    <label class="checkbox-container cursor-pointer">
                        <input type="checkbox" class="video-checkbox w-5 h-5 text-primary-600 rounded focus:ring-primary-500 border-gray-300 shadow-sm" data-id="${video.id}" onchange="updateSelectionUI()">
                    </label>
                </div>
            </div>
            
            <div class="flex-grow flex flex-col justify-between min-w-0">
                <div>
                    <h3 class="text-lg font-semibold text-gray-900 line-clamp-2 mb-1 video-title" title="${video.title}">${video.title}</h3>
                    <p class="text-sm text-gray-500 status-text" id="status-${video.id}">Ready to download</p>
                </div>
                
                <div class="mt-3">
                    <div class="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden progress-container" id="progress-${video.id}" style="display:none;">
                        <div class="bg-primary-600 h-2 rounded-full transition-all duration-300 progress-bar" style="width: 0%"></div>
                    </div>
                    
                    <div class="flex flex-wrap gap-2 action-buttons">
                        <button class="flex-1 sm:flex-none bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors shadow-sm download-btn inline-flex items-center justify-center gap-2" 
                            data-action="download" data-id="${video.id}" data-url="${video.url}" data-title="${video.title.replace(/"/g, '&quot;')}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                            </svg>
                            Download
                        </button>
                        <button class="flex-1 sm:flex-none bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium py-2 px-4 rounded-lg transition-colors border border-red-200 cancel-btn inline-flex items-center justify-center gap-2" 
                            data-action="cancel" data-id="${video.id}" data-url="${video.url}" style="display:none;">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        videoList.appendChild(card);
    });
    
    selectAllCheckbox.checked = false;
    updateSelectionUI();
}

videoList.addEventListener('click', (e) => {
    const target = e.target;
    const btn = target.closest('button');
    
    if (!btn) return;
    
    const action = btn.dataset.action;
    if (!action) return;

    const id = btn.dataset.id;
    const url = btn.dataset.url;

    if (action === 'download') {
        const title = btn.dataset.title;
        downloadVideo(url, title, id);
    } else if (action === 'cancel') {
        cancelDownload(url, id);
    } else if (action === 'open-folder') {
        const filePath = btn.dataset.path;
        openFileLocation(filePath);
    }
});

selectAllCheckbox.addEventListener('change', () => {
    const checkboxes = document.querySelectorAll('.video-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
    updateSelectionUI();
});

window.updateSelectionUI = () => {
    const checkboxes = document.querySelectorAll('.video-checkbox:checked');
    const count = checkboxes.length;
    selectionCount.textContent = count + ' selected';
    downloadSelectedBtn.disabled = count === 0;
    
    const allCheckboxes = document.querySelectorAll('.video-checkbox');
    if (allCheckboxes.length > 0 && count === allCheckboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else if (count > 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    }
};

downloadSelectedBtn.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.video-checkbox:checked');
    checkboxes.forEach(cb => {
        const id = cb.getAttribute('data-id');
        const video = currentVideos.find(v => v.id === id);
        if (video) {
            downloadVideo(video.url, video.title, video.id);
        }
    });
});

async function downloadVideo(url, title, id) {
    const btn = document.querySelector('button[data-action="download"][data-id="' + id + '"]');
    const cancelBtn = document.querySelector('button[data-action="cancel"][data-id="' + id + '"]');
    const statusText = document.getElementById('status-' + id);
    const progressContainer = document.getElementById('progress-' + id);
    const downloadPath = downloadPathInput.value.trim();
    const format = formatSelect.value;
    const quality = qualitySelect.value;
    const createSubfolder = createSubfolderCheckbox.checked;

    if (btn) {
        btn.disabled = true;
        btn.className = 'flex-1 sm:flex-none bg-gray-300 text-gray-600 text-sm font-medium py-2 px-4 rounded-lg cursor-not-allowed download-btn inline-flex items-center justify-center gap-2';
        btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Queued';
    }

    if (progressContainer) progressContainer.style.display = 'block';
    if (statusText) {
        statusText.className = 'text-sm text-gray-500 status-text flex items-center gap-1';
        statusText.innerHTML = '<svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Waiting in queue...';
    }

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                url, 
                title, 
                downloadPath, 
                format, 
                quality,
                createSubfolder,
                playlistTitle: "Playlist Downloads"
            })
        });
        const data = await response.json();
        
        if (data.downloadId) {
            if (!btn.classList.contains('done')) {
                activeDownloads.set(url, data.downloadId);
                if (cancelBtn) cancelBtn.style.display = 'inline-flex';
            }
        }
    } catch (error) {
        console.error('Download request failed', error);
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Retry';
            btn.classList.remove('downloading');
        }
        if (statusText) statusText.textContent = 'Request failed';
    }
}

async function openFileLocation(filePath) {
    console.log('Opening file location:', filePath);
    try {
        const response = await fetch('/api/open-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath })
        });
        
        if (!response.ok) {
            const data = await response.json();
            alert('Failed to open folder: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Failed to open file location:', error);
        alert('Failed to open folder. See console for details.');
    }
}

async function cancelDownload(url, id) {
    console.log('Cancelling download for URL: ' + url + ', ID: ' + id);
    const downloadId = activeDownloads.get(url);
    console.log('Mapped Download ID: ' + downloadId);
    
    if (!downloadId) {
        console.error('No active download ID found for this URL');
        return;
    }

    try {
        const response = await fetch('/api/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ downloadId })
        });
        const data = await response.json();
        console.log('Cancel response:', data);
    } catch (error) {
        console.error('Cancel failed', error);
    }
}

socket.on('download-progress', ({ url, percent }) => {
    const btn = document.querySelector('button[data-action="download"][data-url="' + url + '"]');
    if (btn) {
        const card = btn.closest('.video-card');
        const progressContainer = card.querySelector('.progress-container');
        const progressBar = card.querySelector('.progress-bar');
        const statusText = card.querySelector('.status-text');
        const cancelBtn = card.querySelector('.cancel-btn');
        
        if (progressContainer) progressContainer.style.display = 'block';
        if (progressBar) progressBar.style.width = percent + '%';
        if (statusText) {
            statusText.className = 'text-sm text-primary-600 font-semibold status-text flex items-center gap-1';
            statusText.innerHTML = '<svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Downloading: ' + percent + '%';
        }
        if (!btn.innerHTML.includes('animate-spin')) {
            btn.disabled = true;
            btn.className = 'flex-1 sm:flex-none bg-primary-400 text-white text-sm font-medium py-2 px-4 rounded-lg cursor-not-allowed download-btn inline-flex items-center justify-center gap-2';
            btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Downloading...';
        }
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    }
});

socket.on('download-complete', ({ url, filePath }) => {
    const btn = document.querySelector('button[data-action="download"][data-url="' + url + '"]');
    if (btn) {
        btn.disabled = false;
        btn.className = 'flex-1 sm:flex-none bg-green-50 text-green-700 hover:bg-green-100 text-sm font-medium py-2 px-4 rounded-lg border border-green-200 transition-colors download-btn inline-flex items-center justify-center gap-2';
        btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/></svg>Open Folder';
        
        btn.dataset.action = 'open-folder';
        btn.dataset.path = filePath;
        
        const card = btn.closest('.video-card');
        const statusText = card.querySelector('.status-text');
        const cancelBtn = card.querySelector('.cancel-btn');
        const progressBar = card.querySelector('.progress-bar');
        
        if (statusText) {
            statusText.className = 'text-sm text-green-600 font-semibold status-text flex items-center gap-1';
            statusText.innerHTML = '<svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Download Complete';
        }
        if (progressBar) {
            progressBar.style.width = '100%';
            progressBar.className = 'bg-green-500 h-2 rounded-full transition-all duration-300 progress-bar';
        }
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }
        
        activeDownloads.delete(url);
    }
});

socket.on('download-error', ({ url, error }) => {
    const btn = document.querySelector('button[data-action="download"][data-url="' + url + '"]');
    if (btn) {
        btn.textContent = 'Retry';
        btn.disabled = false;
        btn.classList.remove('opacity-75', 'cursor-not-allowed');
        
        const card = btn.closest('.video-card');
        const statusText = card.querySelector('.status-text');
        const cancelBtn = card.querySelector('.cancel-btn');
        const progressBar = card.querySelector('.progress-bar');
        
        if (statusText) {
            statusText.className = 'text-sm text-red-600 font-medium status-text flex items-center gap-1';
            statusText.innerHTML = '<svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Error: ' + error;
        }
        if (progressBar) {
            progressBar.classList.remove('bg-primary-600');
            progressBar.classList.add('bg-red-500');
        }
        if (cancelBtn) cancelBtn.style.display = 'none';
        
        activeDownloads.delete(url);
    }
});

socket.on('cancelled', ({ id, url }) => {
    const btn = document.querySelector('button[data-action="download"][data-url="' + url + '"]');
    if (btn) {
        btn.disabled = false;
        btn.className = 'flex-1 sm:flex-none bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors shadow-sm download-btn inline-flex items-center justify-center gap-2';
        btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Download';
        
        btn.dataset.action = 'download';
        
        const card = btn.closest('.video-card');
        const statusText = card.querySelector('.status-text');
        const progressBar = card.querySelector('.progress-bar');
        const cancelBtn = card.querySelector('.cancel-btn');
        const progressContainer = card.querySelector('.progress-container');
        
        if (statusText) {
            statusText.className = 'text-sm text-gray-500 status-text flex items-center gap-1';
            statusText.innerHTML = '<svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>Cancelled by user';
        }
        if (progressBar) progressBar.style.width = '0%';
        if (progressContainer) progressContainer.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        
        activeDownloads.delete(url);
    }
});
