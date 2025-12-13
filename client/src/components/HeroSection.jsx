import React from 'react';

export default function HeroSection({
    playlistUrl,
    setPlaylistUrl,
    onAnalyze,
    isAnalyzing,
    downloadPath,
    setDownloadPath,
    onOpenFolder,
    createSubfolder,
    setCreateSubfolder
}) {
    return (
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-10 mb-8 border border-gray-100">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Download Your Favorite Playlists</h2>
                <p className="text-gray-500">Paste a YouTube playlist URL below to get started.</p>
            </div>

            <div className="flex flex-col gap-4 max-w-3xl mx-auto">
                {/* URL Input */}
                <div className="relative">
                    <input 
                        type="text" 
                        value={playlistUrl}
                        onChange={(e) => setPlaylistUrl(e.target.value)}
                        className="w-full pl-5 pr-36 py-4 rounded-full border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-gray-700 placeholder-gray-400 shadow-sm"
                        placeholder="Paste YouTube Playlist URL here..."
                    />
                    <button 
                        onClick={onAnalyze}
                        disabled={isAnalyzing}
                        className="absolute right-2 top-2 bottom-2 bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 rounded-full transition-colors shadow-md flex items-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                        {isAnalyzing ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Analyzing...</span>
                            </>
                        ) : (
                            <>
                                <span>Analyze</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </>
                        )}
                    </button>
                </div>

                {/* Path Input & Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative flex-grow">
                        <input 
                            type="text" 
                            value={downloadPath}
                            onChange={(e) => setDownloadPath(e.target.value)}
                            className="w-full pl-5 pr-32 py-3 rounded-full border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm text-gray-700 placeholder-gray-400 bg-gray-50"
                            placeholder="Custom Download Path (Optional)"
                        />
                        <button 
                            onClick={onOpenFolder}
                            className="absolute right-1.5 top-1.5 bottom-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium px-4 rounded-full border border-gray-200 transition-colors shadow-sm"
                        >
                            Open Folder
                        </button>
                    </div>
                    
                    <div className="flex items-center justify-center md:justify-start px-4 py-3 bg-gray-50 rounded-full border border-gray-200">
                        <label className="flex items-center cursor-pointer select-none">
                            <div className="relative">
                                <input 
                                    type="checkbox" 
                                    checked={createSubfolder}
                                    onChange={(e) => setCreateSubfolder(e.target.checked)}
                                    className="sr-only" 
                                />
                                <div className={`w-10 h-6 rounded-full shadow-inner transition-colors ${createSubfolder ? 'bg-primary-600' : 'bg-gray-200'}`}></div>
                                <div className={`absolute w-4 h-4 bg-white rounded-full shadow left-1 top-1 transition-transform ${createSubfolder ? 'translate-x-4' : ''}`}></div>
                            </div>
                            <span className="ml-3 text-sm font-medium text-gray-700">Create Subfolder</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
}
