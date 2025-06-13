const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const cron = require('node-cron');
const ytdlp = require('yt-dlp-exec');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
require('dotenv').config();





const app = express();
const PORT = 3000;
const CACHE_DIR = path.resolve(__dirname, 'cache');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR);
  console.log(`[Init] Created cache directory at ${CACHE_DIR}`);
}
// change
app.use(express.static(path.join(__dirname, 'public')));

const downloadMap = {}; // videoId -> { process, status, filePath }
const downloadTimeouts = {}; // videoId -> timeoutId

function startDownload(videoId, url) {
  const filePath = path.join(CACHE_DIR, `${videoId}.webm`);
  if (downloadMap[videoId]) {
    console.log(`[Info] Download already in progress or completed for videoId: ${videoId}`);
    return filePath;
  }

  console.log(`[Start] Starting download for videoId: ${videoId} from URL: ${url}`);

  // yt-dlp download best audio only
  const ytdlp = spawn('yt-dlp', ['-f', 'bestaudio[ext=webm]/bestaudio/best', '-o', filePath, url]);


  downloadMap[videoId] = { process: ytdlp, status: 'downloading', filePath };

  ytdlp.stdout.on('data', (data) => {
    console.log(`[yt-dlp stdout][${videoId}] ${data.toString().trim()}`);
  });

  ytdlp.stderr.on('data', (data) => {
    console.error(`[yt-dlp stderr][${videoId}] ${data.toString().trim()}`);
  });

  ytdlp.on('error', (err) => {
    console.error(`[yt-dlp error][${videoId}] ${err.message}`);
  });

  ytdlp.on('close', (code) => {
  const partFile = filePath + '.part';

  if (code === 0) {
    console.log(`[Success] Download completed for videoId: ${videoId}`);
    downloadMap[videoId].status = 'complete';

    downloadTimeouts[videoId] = setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Cleanup] Deleted cached file for videoId: ${videoId}`);
      }
      if (fs.existsSync(partFile)) {
        fs.unlinkSync(partFile);
        console.log(`[Cleanup] Deleted part file for videoId: ${videoId}`);
      }
      delete downloadMap[videoId];
      delete downloadTimeouts[videoId];
    }, 10 * 60 * 1000);

  } else {
    console.error(`[Error] Download failed for videoId: ${videoId} with exit code ${code}`);
    delete downloadMap[videoId];
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Cleanup] Deleted incomplete file for videoId: ${videoId}`);
    }
    if (fs.existsSync(partFile)) {
      fs.unlinkSync(partFile);
      console.log(`[Cleanup] Deleted leftover .part file for videoId: ${videoId}`);
    }
  }
});

  return filePath;
}

function cancelOtherDownloads(activeVideoId) {
  for (const [vid, data] of Object.entries(downloadMap)) {
    if (vid !== activeVideoId && data.status === 'downloading') {
      console.log(`[Cancel] Killing download for videoId: ${vid}`);
      data.process.kill();
      delete downloadMap[vid];
      if (fs.existsSync(data.filePath)) {
        fs.unlinkSync(data.filePath);
        console.log(`[Cleanup] Deleted partial file for canceled download videoId: ${vid}`);
      }
    }
  }
}

// Get duration of video/audio
app.get('/duration', (req, res) => {
  const videoId = req.query.videoId;
  if (!videoId) {
    console.error(`[Duration] Missing videoId parameter`);
    return res.status(400).json({ error: 'Missing videoId parameter' });
  }

  console.log(`[Duration] Fetching duration for videoId: ${videoId}`);

  const ytDl = spawn('yt-dlp', ['--get-duration', `https://www.youtube.com/watch?v=${videoId}`]);

  let output = '';
  ytDl.stdout.on('data', (data) => {
    output += data.toString();
  });

  ytDl.stderr.on('data', (data) => {
    console.error(`[yt-dlp stderr][duration][${videoId}] ${data.toString().trim()}`);
  });

  ytDl.on('error', (err) => {
    console.error(`[yt-dlp error][duration][${videoId}] ${err.message}`);
  });

  ytDl.on('close', (code) => {
    if (code === 0) {
      console.log(`[Duration] Duration fetched for videoId: ${videoId} -> ${output.trim()}`);
      res.json({ duration: output.trim() });
    } else {
      console.error(`[Duration] Failed to fetch duration for videoId: ${videoId} with exit code ${code}`);
      res.status(500).json({ error: 'Duration fetch failed' });
    }
  });
});

// Search songs on YouTube using YouTube Data API v3
app.get('/search', async (req, res) => {
  const query = req.query.song;
  if (!query) {
    console.error('[Search] Missing song query parameter');
    return res.status(400).json({ error: 'Missing song query parameter' });
  }

  console.log(`[Search] Searching for: ${query}`);

  const key = process.env.API_KEY; //  API key
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&maxResults=5&type=video&key=${key}`;

  try {
    const ytRes = await fetch(url);
    if (!ytRes.ok) {
      console.error(`[Search] YouTube API responded with status: ${ytRes.status}`);
      return res.status(500).json({ error: 'YouTube API error' });
    }

    const ytData = await ytRes.json();

    if (!ytData.items || ytData.items.length === 0) {
      console.log(`[Search] No results found for query: ${query}`);
      return res.json([]);
    }

    const results = ytData.items.map(i => {
      const videoId = i.id.videoId;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      startDownload(videoId, videoUrl); // prefetch audio
      return {
        videoId,
        title: i.snippet.title,
        thumbnail: i.snippet.thumbnails.default.url,
        channelTitle: i.snippet.channelTitle,
        publishedAt: i.snippet.publishedAt,
      };
    });

    res.json(results);
  } catch (err) {
    console.error(`[Search] Error fetching YouTube API: ${err.message}`);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Stream cached audio file with support for range requests
app.get('/stream/:videoId', (req, res) => {
  const videoId = req.params.videoId;
  if (!videoId) {
    console.error('[Stream] Missing videoId param');
    return res.status(400).send('Missing videoId');
  }

  const filePath = path.join(CACHE_DIR, `${videoId}.webm`);
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  console.log(`[Stream] Requested stream for videoId: ${videoId}`);

  cancelOtherDownloads(videoId);
  startDownload(videoId, videoUrl);

  const sendStream = () => {
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunksize = (end - start) + 1;

        console.log(`[Stream] Sending range ${start}-${end} for videoId: ${videoId}`);

        const file = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'audio/webm',
        });
        file.pipe(res);
      } else {
        console.log(`[Stream] Sending full file for videoId: ${videoId}`);

        res.writeHead(200, {
          'Content-Length': stat.size,
          'Content-Type': 'audio/webm',
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } else {
      console.log(`[Stream] File not ready yet for videoId: ${videoId}, retrying in 500ms`);
      setTimeout(sendStream, 500);
    }
  };

  sendStream();
});

// login part .........

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());


passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: '/auth/google/callback',
  scope: ['profile', 'email', 'https://www.googleapis.com/auth/youtube.readonly']
}, (accessToken, refreshToken, profile, done) => {
  // Save profile and tokens to session
  profile.accessToken = accessToken;
  return done(null, profile);
}));

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Start login
app.get('/auth/google', passport.authenticate('google'));

// OAuth callback
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Success: Redirect to homepage (index.html)
    res.redirect('/index.html');
  }
);

app.get('/playlists', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const accessToken = req.user.accessToken;

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=25`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Playlist Fetch Error]', err);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});




app.get("/authenticate", (req, res) => {
  if (req.isAuthenticated()) {
    return res.json({ authenticated: true, user: req.user });
  } else {
    return res.json({ authenticated: false });
  }
});

// route for getting songs inside an playlist...

  /// pagination 
  async function fetchAllPlaylistItems(accessToken, playlistId) {
  let items = [];
  let nextPageToken = '';
  const maxResults = 50;

  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${maxResults}&playlistId=${playlistId}&pageToken=${nextPageToken}`;
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const data = await res.json();
    if (data.items) {
      items.push(...data.items);
    }

    nextPageToken = data.nextPageToken || '';
  } while (nextPageToken);

  return items;
}


app.get('/playlistItems', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const accessToken = req.user.accessToken;
  const playlistId = req.query.playlistId;

  try {
    const items = await fetchAllPlaylistItems(accessToken, playlistId);
    res.json({ items });
  } catch (err) {
    console.error('[Fetch All Playlist Items Error]', err);
    res.status(500).json({ error: 'Failed to fetch playlist items' });
  }
});






app.listen(PORT, () => console.log(`[Server] Running at http://localhost:${PORT}`));