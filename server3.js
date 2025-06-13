// server.js using aria2 JSON-RPC
const express = require('express');
const path = require('path');
const fs = require('fs');
const Aria2 = require('aria2');
const ytdlp = require('yt-dlp-exec');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;
const CACHE_DIR = path.resolve(__dirname, 'cache');

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

app.use(express.static(path.join(__dirname, 'public')));

const aria2 = new Aria2({
  host: 'localhost',
  port: 6800,
  secure: false,
  secret: '',
  path: '/jsonrpc'
});

const downloadMap = {}; // videoId -> { gid, filePath }
const downloadTimeouts = {}; // videoId -> timeout

async function extractAudioURL(videoId) {
  const info = await ytdlp(`https://www.youtube.com/watch?v=${videoId}`, {
    dumpSingleJson: true,
    preferFreeFormats: true,
    noWarnings: true,
    noCallHome: true,
    skipDownload: true,
  });
  return info.url;
}

async function downloadWithAria2(videoId, url) {
  await aria2.open();
  const filePath = path.join(CACHE_DIR, `${videoId}.webm`);
  const options = {
    out: `${videoId}.webm`,
    dir: CACHE_DIR
  };
  const gid = await aria2.call('addUri', [[url], options]);
  downloadMap[videoId] = { gid, filePath };

  downloadTimeouts[videoId] = setTimeout(() => {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    delete downloadMap[videoId];
    delete downloadTimeouts[videoId];
  }, 10 * 60 * 1000);
}

async function cancelOtherDownloads(activeId) {
  for (const [vid, { gid, filePath }] of Object.entries(downloadMap)) {
    if (vid !== activeId) {
      await aria2.call('remove', gid);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      delete downloadMap[vid];
      clearTimeout(downloadTimeouts[vid]);
      delete downloadTimeouts[vid];
    }
  }
}

app.get('/search', async (req, res) => {
  const query = req.query.song;
  if (!query) return res.status(400).json({ error: 'Missing song parameter' });

  const key = 'AIzaSyBfg3S7Wki_1A8IaoDCiCOYCR75DYghCtU';
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&maxResults=5&type=video&key=${key}`;

  try {
    const ytRes = await fetch(url);
    const data = await ytRes.json();

    const results = await Promise.all(data.items.map(async (item) => {
      const videoId = item.id.videoId;
      const audioUrl = await extractAudioURL(videoId);
      await downloadWithAria2(videoId, audioUrl);

      return {
        videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.default.url,
        channelTitle: item.snippet.channelTitle,
      };
    }));

    res.json(results);
  } catch (e) {
    console.error("[Search]", e);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const filePath = path.join(CACHE_DIR, `${videoId}.webm`);
  await cancelOtherDownloads(videoId);

  const streamFile = () => {
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      const range = req.headers.range;

      if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(startStr);
        const end = endStr ? parseInt(endStr) : stat.size - 1;
        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': 'audio/webm'
        });
        stream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': stat.size,
          'Content-Type': 'audio/webm'
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } else {
      setTimeout(streamFile, 500);
    }
  };

  streamFile();
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));