

export default function VideoList({
    videos,
    videoStates,
    selectedVideos,
    setSelectedVideos,
    onDownload,
    onCancel,
    onOpenFolder,
    format,
    setFormat,
    quality,
    setQuality,
    onDownloadSelected,
    onCancelAll,
    activeDownloadsCount
}) {
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedVideos(new Set(videos.map(v => v.id)));
        } else {
            setSelectedVideos(new Set());
        }
    };

    const handleSelectVideo = (id, checked) => {
        const newSelected = new Set(selectedVideos);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedVideos(newSelected);
    };



    const isAllSelected = videos.length > 0 && selectedVideos.size === videos.length;
    const isIndeterminate = selectedVideos.size > 0 && selectedVideos.size < videos.length;

    return (
        <>
            {/* Controls Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-20 z-40">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                        <label htmlFor="formatSelect" className="text-sm font-medium text-gray-600">Format:</label>
                        <select 
                            id="formatSelect" 
                            value={format}
                            onChange={(e) => setFormat(e.target.value)}
                            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2 outline-none"
                        >
                            <optgroup label="Video">
                                <option value="mp4">MP4</option>
                                <option value="mkv">MKV</option>
                                <option value="webm">WEBM</option>
                            </optgroup>
                            <optgroup label="Audio">
                                <option value="mp3">MP3</option>
                                <option value="m4a">M4A</option>
                                <option value="wav">WAV</option>
                            </optgroup>
                        </select>
                    </div>
                    <div className={`flex items-center gap-2 ${['mp3', 'm4a', 'wav'].includes(format) ? 'opacity-50 pointer-events-none' : ''}`}>
                        <label htmlFor="qualitySelect" className="text-sm font-medium text-gray-600">Quality:</label>
                        <select 
                            id="qualitySelect"
                            value={quality}
                            onChange={(e) => setQuality(e.target.value)}
                            disabled={['mp3', 'm4a', 'wav'].includes(format)}
                            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2 outline-none"
                        >
                            <option value="best">Best Available</option>
                            <option value="2160p">4K (2160p)</option>
                            <option value="1440p">2K (1440p)</option>
                            <option value="1080p">1080p</option>
                            <option value="720p">720p</option>
                            <option value="480p">480p</option>
                            <option value="360p">360p</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="selectAllCheckbox" 
                            checked={isAllSelected}
                            ref={el => el && (el.indeterminate = isIndeterminate)}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <label htmlFor="selectAllCheckbox" className="text-sm font-medium text-gray-700">Select All</label>
                        <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full ml-1">{selectedVideos.size} selected</span>
                    </div>
                    {activeDownloadsCount > 0 && (
                        <button 
                            onClick={onCancelAll}
                            className="bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2 px-6 rounded-lg transition-colors shadow-sm text-sm flex items-center gap-2 border border-red-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            Cancel All
                        </button>
                    )}
                    <button 
                        onClick={onDownloadSelected}
                        disabled={selectedVideos.size === 0}
                        className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-6 rounded-lg transition-colors shadow-sm text-sm flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                    </button>
                </div>
            </div>

            {/* Video List */}
            <div className="grid grid-cols-1 gap-4">
                {videos.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>No videos loaded yet. Analyze a playlist to see videos here.</p>
                    </div>
                ) : (
                    videos.map(video => {
                        const state = videoStates[video.id] || { status: 'ready', progress: 0 };
                        const isDownloading = state.status === 'downloading' || state.status === 'queued';
                        const isComplete = state.status === 'complete';
                        const isError = state.status === 'error';

                        return (
                            <div key={video.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row gap-4 transition-all hover:shadow-md">
                                <div className="flex-shrink-0 relative group">
                                    <img src={video.thumbnail} alt="Thumbnail" className="w-full sm:w-48 h-32 object-cover rounded-lg shadow-sm" />
                                    <div className="absolute top-2 left-2">
                                        <label className="cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedVideos.has(video.id)}
                                                onChange={(e) => handleSelectVideo(video.id, e.target.checked)}
                                                className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 border-gray-300 shadow-sm" 
                                            />
                                        </label>
                                    </div>
                                </div>
                                
                                <div className="flex-grow flex flex-col justify-between min-w-0">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 mb-1" title={video.title}>{video.title}</h3>
                                        <p className={`text-sm flex items-center gap-1 ${
                                            isComplete ? 'text-green-600 font-semibold' : 
                                            isError ? 'text-red-600 font-medium' : 
                                            isDownloading ? 'text-primary-600 font-semibold' : 'text-gray-500'
                                        }`}>
                                            {isComplete && <svg className="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                                            {isError && <svg className="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                                            {isDownloading && <svg className="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>}
                                            
                                            {isComplete ? 'Download Complete' : 
                                             isError ? `Error: ${state.error || 'Unknown'}` : 
                                             isDownloading ? `Downloading: ${state.progress}%` : 
                                             state.status === 'queued' ? 'Waiting in queue...' :
                                             state.status === 'cancelled' ? 'Cancelled by user' : 'Ready to download'}
                                        </p>
                                    </div>
                                    
                                    <div className="mt-3">
                                        {(isDownloading || isComplete) && (
                                            <div className="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden">
                                                <div 
                                                    className={`h-2 rounded-full transition-all duration-300 ${isComplete ? 'bg-green-500' : isError ? 'bg-red-500' : 'bg-primary-600'}`} 
                                                    style={{ width: `${state.progress}%` }}
                                                ></div>
                                            </div>
                                        )}
                                        
                                        <div className="flex flex-wrap gap-2">
                                            {isComplete ? (
                                                <button 
                                                    onClick={() => onOpenFolder(state.filePath)}
                                                    className="flex-1 sm:flex-none bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium py-2 px-4 rounded-lg border border-gray-300 transition-colors inline-flex items-center justify-center gap-2"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/></svg>
                                                    Open Folder
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => onDownload(video)}
                                                    disabled={state.status === 'queued' || state.status === 'downloading' || state.status === 'analyzing'}
                                                    className={`flex-1 sm:flex-none text-sm font-medium py-2 px-4 rounded-lg transition-colors shadow-sm inline-flex items-center justify-center gap-2 ${
                                                        state.status === 'error' 
                                                            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200' 
                                                            : 'bg-primary-600 hover:bg-primary-700 text-white'
                                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                >
                                                    {state.status === 'error' ? (
                                                        <>
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                                                            Retry
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                                            Download
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                            
                                            {isDownloading && (
                                                <button 
                                                    onClick={() => onCancel(video)}
                                                    className="flex-1 sm:flex-none bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium py-2 px-4 rounded-lg transition-colors border border-red-200 inline-flex items-center justify-center gap-2"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                                                    </svg>
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </>
    );
}
