const { publicDecrypt } = require('crypto');
const { exec } = require('child_process');
const { spawn } = require('child_process');
// spawn spawn() lets you run shell commands or other executables (like yt-dlp) as a separate process from your Node.js server.
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

const YOUTUBE_API_KEY = "AIzaSyBfg3S7Wki_1A8IaoDCiCOYCR75DYghCtU";

app.use(express.static(path.join(__dirname, 'public')));

// for song duration 
app.get('/duration', (req, res) => {
  const videoId = req.query.videoId; // get from query
  const info = spawn('yt-dlp', ['--get-duration', `https://www.youtube.com/watch?v=${videoId}`]);

  let output = '';
  let errorOutput = '';

  info.stdout.on('data', (data) => {
    output += data.toString();
  });

  info.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  info.on('close', (code) => {
    if (code === 0) {
      res.json({ duration: output.trim() });
    } else {
      res.status(500).json({ error: 'Failed to fetch duration', details: errorOutput });
    }
  });
});
//searching using
app.get('/search', async (req, res) => {
  const query = req.query.song;
  if (!query) {
    return res.status(400).json({ error: 'Missing song query' });
  }

  try {
    console.log('Received query:', query);

    const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&maxResults=10&type=video&key=${YOUTUBE_API_KEY}`;

    console.log('Fetching URL:', ytUrl);

    const ytResponse = await fetch(ytUrl);

    console.log('YouTube API status:', ytResponse.status);

    if (!ytResponse.ok) {
      const errText = await ytResponse.text();
      console.error('YouTube API error response:', errText);
      return res.status(500).json({ error: 'Failed to fetch YouTube data' });
    }

    const ytData = await ytResponse.json();
    console.log('YouTube API response data:', ytData);

    const results = ytData.items.map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.default.url,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
    }));

    res.json(results);

  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ error: 'Failed to fetch YouTube data' });
  }
});

app.get('/stream/:videoId', (req, res) => {
  const videoId = req.params.videoId;

  const ytStream  = spawn('yt-dlp', [
  '--retries', 'infinite',
  '--fragment-retries', 'infinite',
  '--no-check-certificate',
  '-f', '140/251/250/249',
  '-o', '-',
  `https://www.youtube.com/watch?v=${videoId}`
])


  // Set content-type early before any data is sent
  res.set({
    'Content-Type': 'audio/mp4',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache'
  });

  // Pipe the audio stream
  ytStream.stdout.pipe(res);

  // Log errors but don't try to send another response if headers were sent
  ytStream.stderr.on('data', (data) => {
    console.error(`yt-dlp stderr: ${data}`);
  });

  ytStream.on('close', (code) => {
    if (code !== 0) {
      console.error(`yt-dlp exited with code ${code}`);
      // No res.send here because response might have already started
      // Instead, just destroy the stream
      if (!res.writableEnded) {
        res.destroy(); // closes connection cleanly
      }
    }
  });

  ytStream.on('error', (err) => {
    console.error('Failed to start yt-dlp process:', err);
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    } else {
      res.destroy();
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
