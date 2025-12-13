# Deployment Guide

## Render.com Deployment

### Prerequisites
- GitHub account
- Render.com account
- Repository pushed to GitHub

### Step 1: Prepare Your Repository

Ensure your repository has this structure:
```
youtube-playlist-downloader/
├── client/              # React frontend
├── server/              # Node.js backend
├── render.yaml          # Render configuration
└── README.md
```

### Step 2: Configure Render

The `render.yaml` file is already configured with:
- Build command: Installs dependencies for both client and server, builds React app, installs yt-dlp
- Start command: Runs the Node.js server from the server directory
- Environment: Node.js with Python support for yt-dlp

### Step 3: Deploy on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Render will automatically detect the `render.yaml` file
5. Click "Apply" to use the configuration
6. Set environment variables:
   - `NODE_ENV`: `production`
   - `CLIENT_URL`: Your frontend URL (or leave as `*` for all origins)
7. Click "Create Web Service"

### Step 4: Monitor Deployment

Watch the deployment logs for:
- ✅ Dependencies installation
- ✅ React build completion
- ✅ yt-dlp installation
- ✅ Server startup

### Step 5: Access Your Application

Once deployed, your application will be available at:
```
https://your-service-name.onrender.com
```

## Vercel Deployment (Frontend)

### Step 1: Deploy to Vercel

1. Push your code to GitHub.
2. Go to [Vercel Dashboard](https://vercel.com/dashboard).
3. Click "Add New..." -> "Project".
4. Import your repository.
5. Vercel should automatically detect the Vite settings.
   - Root Directory: `client` (Important!)
   - Build Command: `npm run build`
   - Output Directory: `dist`

### Step 2: Configure Environment Variables

**CRITICAL STEP**: You must tell the frontend where your backend is running.

1. In your Vercel Project Settings, go to **Environment Variables**.
2. Add a new variable:
   - **Key**: `VITE_API_URL`
   - **Value**: Your Render Backend URL (e.g., `https://your-app.onrender.com`) without a trailing slash.
3. Click **Save**.
4. **Redeploy** your application for the changes to take effect (Go to Deployments -> Redeploy).

## Troubleshooting

### Build Fails

**Issue**: Build command fails
**Solution**: Check that both `client/package.json` and `server/package.json` exist

### yt-dlp Not Found

**Issue**: yt-dlp binary not found
**Solution**: The build command includes `pip install yt-dlp` which installs it globally

### YouTube Bot Detection

**Issue**: "Sign in to confirm you're not a bot" errors
**Solution**: 
1. The app uses Android client emulation (already configured)
2. Update yt-dlp: `pip install --upgrade yt-dlp`
3. If issues persist, export YouTube cookies and add to server

### Port Issues

**Issue**: Port already in use
**Solution**: Render automatically assigns the PORT environment variable

### Static Files Not Serving

**Issue**: React app not loading
**Solution**: Ensure `client/dist` exists after build. Check build logs.

## Environment Variables

Set these in Render dashboard:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Sets production mode |
| `CLIENT_URL` | `*` or specific URL | CORS origin |
| `PORT` | Auto-assigned by Render | Server port |

## Manual Deployment Steps

If not using `render.yaml`:

### Build Command:
```bash
cd server && npm install && cd ../client && npm install && npm run build && cd .. && pip install yt-dlp
```

### Start Command:
```bash
cd server && node server.js
```

## Updating yt-dlp

To update yt-dlp after deployment:

1. SSH into your Render instance (if available)
2. Run: `pip install --upgrade yt-dlp`
3. Or redeploy to trigger a fresh install

## Performance Tips

1. **Free Tier**: Render free tier spins down after inactivity
2. **Cold Starts**: First request may be slow
3. **Concurrent Downloads**: Limited by server resources
4. **File Storage**: Downloads are temporary on free tier

## Alternative: Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18

# Install Python and yt-dlp
RUN apt-get update && apt-get install -y python3 python3-pip
RUN pip3 install yt-dlp

WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install

# Install client dependencies and build
COPY client/package*.json ./client/
RUN cd client && npm install
COPY client ./client
RUN cd client && npm run build

# Copy server files
COPY server ./server

WORKDIR /app/server
EXPOSE 3000

CMD ["node", "server.js"]
```

## Support

For issues:
1. Check deployment logs
2. Verify environment variables
3. Test locally first
4. Check GitHub issues
