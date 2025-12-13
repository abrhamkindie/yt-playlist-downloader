# Render Deployment Guide

## ⚠️ Important Limitations on Render

### What Works ✅
- ✅ Analyzing playlists
- ✅ Viewing video lists
- ✅ Selecting videos
- ✅ Queueing downloads

### What Doesn't Work ❌
- ❌ **"Open Folder" button** - No GUI on server
- ❌ **Custom download paths** - Server-side only
- ❌ **Persistent downloads** - Free tier has ephemeral storage
- ❌ **Large downloads** - Limited disk space (1GB)

---

## 🚀 Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Deploy to Render"
git push
```

### 2. Create Render Service
1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   ```
   Name: youtube-playlist-downloader
   Environment: Node
   Build Command: npm install && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp && chmod a+rx yt-dlp
   Start Command: node server.js
   ```

### 3. Environment Variables
Add these in Render dashboard:
```
NODE_ENV=production
PORT=10000
RENDER=true
```

### 4. Deploy
Click "Create Web Service" and wait for deployment.

---

## 🔧 Troubleshooting

### Issue: "yt-dlp not found"

**Solution 1: Update Build Command**
```bash
npm install && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp && chmod a+rx yt-dlp
```

**Solution 2: Check Logs**
- Go to Render dashboard
- Click on your service
- Check "Logs" tab
- Look for yt-dlp download errors

### Issue: "Downloads fail"

**Possible Causes:**
1. **Disk space full** - Free tier has 1GB limit
2. **yt-dlp not installed** - Check build logs
3. **Network timeout** - Render may have timeouts

**Solutions:**
- Use smaller quality (720p instead of 4K)
- Download fewer videos at once
- Check Render logs for specific errors

### Issue: "Open Folder doesn't work"

**This is expected!** 
- Render is a server environment
- No GUI to open folders
- Downloads are stored on server
- Use for testing/demo only

---

## 📊 Check Deployment Health

Visit: `https://your-app.onrender.com/health`

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-13T14:38:25.177Z",
  "environment": "production",
  "ytdlp": "installed",
  "platform": "linux"
}
```

If `ytdlp: "missing"`, rebuild with correct build command.

---

## 💡 Recommendations

### For Testing/Demo
✅ **Use Render** - Good for showcasing the UI

### For Actual Use
❌ **Don't use Render** - Use one of these instead:

1. **Self-Hosted** (Best)
   ```bash
   npm start
   ```
   - Full functionality
   - Unlimited downloads
   - Free

2. **VPS** (DigitalOcean, Linode)
   - Full control
   - Persistent storage
   - $5/month

3. **Railway** (Better than Render)
   - Better free tier
   - More storage
   - Easier setup

---

## 🎯 What to Tell Users

If deploying on Render for demo:

**Add this notice to your README:**
```markdown
## ⚠️ Demo Deployment Notice

This is a demo deployment on Render. Limitations:
- Downloads are stored on the server (not your computer)
- "Open Folder" button is disabled
- Limited storage space
- For full functionality, please run locally:
  ```bash
  git clone https://github.com/yourusername/youtube-playlist-downloader.git
  cd youtube-playlist-downloader
  npm install
  npm start
  ```
```

---

## 🔄 Update Deployment

When you push to GitHub, Render auto-deploys:
```bash
git add .
git commit -m "Update"
git push
```

Render will:
1. Pull latest code
2. Run build command
3. Restart server
4. Deploy new version

---

## 📝 Build Command Explained

```bash
npm install && \
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp && \
chmod a+rx yt-dlp
```

1. `npm install` - Install Node.js dependencies
2. `curl -L ...` - Download yt-dlp binary
3. `chmod a+rx` - Make yt-dlp executable

---

## 🐛 Common Errors

### Error: "Cannot find module 'express'"
**Fix:** Check build logs, ensure `npm install` completed

### Error: "Port 10000 already in use"
**Fix:** This shouldn't happen on Render, check logs

### Error: "ENOSPC: no space left on device"
**Fix:** Free tier disk full, delete old downloads or upgrade plan

### Error: "Request timeout"
**Fix:** Render free tier may timeout, try smaller downloads

---

## 📞 Support

If deployment fails:
1. Check Render logs
2. Visit `/health` endpoint
3. Check GitHub Actions (if configured)
4. Open issue on GitHub

---

**Remember:** Render free tier is for demos only. For actual use, run locally or use a VPS!
