import React from 'react';

export default function Header() {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <img src="/logo.svg" alt="Logo" className="w-8 h-8 rounded-lg" />
                <h1 className="text-xl font-bold tracking-tight text-gray-900">Playlist<span className="text-primary-600">Downloader</span></h1>
            </div>
            <div className="text-sm text-gray-500 hidden sm:block">Premium YouTube Tools</div>
        </div>
    </header>
  );
}
