# Error Handling Documentation

## ✅ Comprehensive Error Handling Implemented

This document outlines all error handling mechanisms implemented across the application.

---

## 🎯 Error Handling by Component

### 1. **Server (server.js)**

#### Global Error Handler
```javascript
app.use((err, req, res, next) => {
    console.error('[Server Error]', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
```

#### Request Logging
- All requests are logged with timestamp
- Helps track issues and debug problems

#### Graceful Shutdown
- Handles SIGTERM and SIGINT signals
- Closes server gracefully
- Prevents data loss

#### Uncaught Exceptions
- Logs uncaught exceptions
- Continues in production (doesn't crash)
- Exits in development for debugging

#### Port Conflicts
- Detects EADDRINUSE errors
- Provides clear error message
- Exits gracefully

---

### 2. **Playlist Analysis (/api/analyze)**

#### Input Validation
- ✅ Checks if URL is provided
- ✅ Validates URL is a string
- ✅ Trims whitespace
- ✅ Validates YouTube domain

#### Error Responses
| Error | Status | Message |
|-------|--------|---------|
| No URL | 400 | "Valid URL is required" |
| Invalid URL | 400 | "Please provide a valid YouTube URL" |
| No videos found | 404 | "No videos found in playlist" |
| yt-dlp error | 500 | Specific error message |

#### Specific Error Messages
- **404**: "Playlist not found. Please check the URL."
- **Private**: "Playlist is private or unavailable."
- **Network**: "Network error. Please check your connection."

---

### 3. **Download (/api/download)**

#### Input Validation
- ✅ URL validation (required, string)
- ✅ Title validation (required, string)
- ✅ Format validation (mp4, mkv, webm, mp3, m4a, wav)
- ✅ Download path validation (exists)

#### Error Responses
| Error | Status | Message |
|-------|--------|---------|
| No URL | 400 | "Valid URL is required" |
| No title | 400 | "Valid title is required" |
| Invalid format | 400 | "Invalid format" |
| Path not found | 400 | "Download path does not exist" |
| Queue error | 500 | "Failed to queue download" |

#### Default Values
- Format: 'mp4' if not specified
- Quality: 'best' if not specified

---

### 4. **Scraper (scraper.js)**

#### Pre-execution Checks
- ✅ Verifies yt-dlp exists
- ✅ Returns clear error if missing

#### Timeout Protection
- 60-second spawn timeout
- 65-second overall timeout
- Prevents hanging requests

#### Error Detection
- ✅ 404 errors → "Playlist not found"
- ✅ Private/unavailable → "Playlist is private or unavailable"
- ✅ Network errors → "Network error. Please check your connection"
- ✅ Empty response → "No data received from yt-dlp"
- ✅ Invalid JSON → "Failed to parse playlist data"

#### Data Validation
- Filters out invalid entries
- Provides fallback thumbnails
- Handles missing titles
- Validates video count

---

### 5. **Downloader (downloader.js)**

#### Input Validation
- ✅ URL validation
- ✅ Title validation
- ✅ Safe filename generation

#### Directory Handling
- ✅ Creates directories if missing
- ✅ Handles permission errors
- ✅ Falls back to default path

#### Process Management
- ✅ Catches spawn errors
- ✅ Handles ENOENT (yt-dlp not found)
- ✅ Monitors stderr output

#### Progress Tracking
- Reduces socket spam (1% increments)
- Caps progress at 100%
- Handles malformed progress data

#### Download Errors
| Error Type | User Message |
|------------|--------------|
| HTTP 403 | "Access denied. Video may be restricted." |
| HTTP 404 | "Video not found." |
| Private | "Video is private." |
| Unavailable | "Video is unavailable." |
| Network | "Network error. Please try again." |
| Generic | "Download failed. Please try again." |

#### File Handling
- Checks if file exists (skip duplicate)
- Validates output directory
- Handles write permissions

---

### 6. **Download Manager (downloadManager.js)**

#### Queue Validation
- ✅ Validates task structure
- ✅ Checks for required properties
- ✅ Skips invalid tasks

#### Process Handling
- ✅ Validates child process returned
- ✅ Handles null processes
- ✅ Catches start() errors

#### Error Propagation
- Logs all errors
- Converts errors to strings
- Emits error events
- Continues queue processing

#### Cancellation
- Handles active downloads
- Handles queued downloads
- Kills process groups
- Fallback to direct kill

---

## 🔍 Error Flow

### Analyze Playlist Flow
```
User Input
    ↓
Validation (URL, format)
    ↓
Scraper
    ├─ yt-dlp exists? → Error if not
    ├─ Spawn process → Error if fails
    ├─ Timeout? → Error after 60s
    ├─ Parse JSON → Error if invalid
    └─ Validate data → Error if empty
    ↓
Success Response
```

### Download Flow
```
User Request
    ↓
Validation (URL, title, format, path)
    ↓
Queue Manager
    ├─ Valid task? → Error if not
    └─ Add to queue
    ↓
Downloader
    ├─ Create directory → Error if fails
    ├─ Spawn yt-dlp → Error if fails
    ├─ Monitor progress → Update UI
    ├─ Check errors → Parse and report
    └─ Complete/Error → Notify UI
    ↓
Success/Error Response
```

---

## 📊 Error Categories

### 1. **User Errors** (400)
- Invalid input
- Missing required fields
- Invalid format
- Path not found

### 2. **Not Found** (404)
- Playlist not found
- Video not found
- No videos in playlist

### 3. **Server Errors** (500)
- yt-dlp not found
- Spawn failures
- Network errors
- Parsing errors

---

## 🛡️ Protection Mechanisms

### 1. **Input Sanitization**
- Trim whitespace
- Validate types
- Check formats
- Verify paths

### 2. **Timeout Protection**
- 60s spawn timeout
- 65s overall timeout
- Prevents hanging

### 3. **Resource Protection**
- Max 3 concurrent downloads
- Queue management
- Process cleanup

### 4. **Graceful Degradation**
- Fallback to defaults
- Continue on non-critical errors
- Skip invalid entries

---

## 🔧 Error Logging

### Console Logging
```javascript
[2025-12-13T14:38:25.177Z] POST /api/analyze
[Server] Broadcasting cancelled event for 123
[DownloadManager] Request to cancel: 123
[Downloader] Spawned yt-dlp with PID: 12345
```

### Error Logging
```javascript
console.error('[Server Error]', err);
console.error('[DownloadManager] Error for download 123:', error);
console.error('Failed to parse yt-dlp output:', err);
```

---

## 🧪 Testing Error Handling

### Test Cases

1. **Invalid URL**
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "Content-Type: application/json" \
     -d '{"url": "invalid"}'
   ```
   Expected: 400 error

2. **Missing URL**
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
   Expected: 400 error

3. **Private Playlist**
   - Use private playlist URL
   - Expected: "Playlist is private or unavailable"

4. **Network Error**
   - Disconnect internet
   - Expected: "Network error. Please check your connection"

5. **Invalid Format**
   ```bash
   curl -X POST http://localhost:3000/api/download \
     -H "Content-Type: application/json" \
     -d '{"url": "...", "title": "...", "format": "invalid"}'
   ```
   Expected: 400 error

---

## 📝 Best Practices Implemented

1. ✅ **Always validate input**
2. ✅ **Provide specific error messages**
3. ✅ **Log errors for debugging**
4. ✅ **Handle timeouts**
5. ✅ **Clean up resources**
6. ✅ **Graceful degradation**
7. ✅ **User-friendly messages**
8. ✅ **Don't expose internal errors**
9. ✅ **Continue on non-critical errors**
10. ✅ **Test error paths**

---

## 🚀 Production Considerations

### Environment Variables
```bash
NODE_ENV=production  # Hides internal error details
PORT=3000           # Server port
```

### Monitoring
- Log all errors to file
- Set up error tracking (Sentry, etc.)
- Monitor server health
- Track error rates

### Alerts
- Server crashes
- High error rates
- yt-dlp failures
- Disk space issues

---

## 📞 Troubleshooting

### Common Issues

1. **"yt-dlp not found"**
   - Install yt-dlp: `pip install yt-dlp`
   - Check PATH

2. **"Failed to analyze playlist"**
   - Check URL is valid
   - Check internet connection
   - Check yt-dlp is updated

3. **"Download failed"**
   - Check disk space
   - Check write permissions
   - Check video availability

4. **"Port already in use"**
   - Change PORT environment variable
   - Kill process using port

---

**Last Updated**: December 2025
**Status**: ✅ Comprehensive Error Handling Implemented
