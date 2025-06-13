console.log("script3.js loaded");

const style = document.createElement('style');
style.innerHTML = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}`;
document.head.appendChild(style);

const searchForm = document.getElementById('search_form');
const searchInput = document.getElementById('search_input');
const resultList = document.getElementById('resultList');
const audioPlayer = document.getElementById('audioPlayer');
const playButton = document.getElementById('playbutton');
const currentTimeEl = document.querySelector('.currenttime');
const durationEl = document.querySelector('.duration');
const seekbar = document.querySelector('.seekbar');
const circle = document.querySelector('.circle');

let currentVideoId = null;

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  resultList.innerHTML = '<li>Loading...</li>';
  try {
    const res = await fetch(`/search?song=${encodeURIComponent(query)}`);
    const results = await res.json();

    resultList.innerHTML = '';
    if (results.error || results.length === 0) {
      resultList.innerHTML = '<li>No results found</li>';
      return;
    }

    results.forEach(({ videoId, title, thumbnail, channelTitle }) => {
      const li = document.createElement('li');
      li.className = 'result-item';
      li.innerHTML = `
        <img src="${thumbnail}" alt="${title}" />
        <div class="info">
          <strong>${title}</strong><br/>
          <small>${channelTitle}</small>
        </div>
      `;
      li.addEventListener('click', () => playSong(videoId));
      resultList.appendChild(li);
    });

  } catch (err) {
    console.error("Search failed", err);
    resultList.innerHTML = '<li>Failed to fetch results</li>';
  }
});

async function playSong(videoId) {
  if (currentVideoId === videoId) {
    if (!audioPlayer.paused) {
      audioPlayer.pause();
      playButton.src = "play.svg";
    } else {
      playButton.src = "spinner.svg";
      playButton.style.animation = "spin 1s linear infinite";
      try {
        await audioPlayer.play();
        playButton.src = "pause.svg";
        playButton.style.animation = "";
      } catch (e) {
        playButton.src = "play.svg";
        playButton.style.animation = "";
      }
    }
    return;
  }

  currentVideoId = videoId;
  audioPlayer.src = `/stream/${videoId}`;
  playButton.src = "spinner.svg";
  playButton.style.animation = "spin 1s linear infinite";
  audioPlayer.load();

  try {
    await audioPlayer.play();
    playButton.src = "pause.svg";
    playButton.style.animation = "";
  } catch (e) {
    console.error("Audio play failed", e);
    playButton.src = "play.svg";
    playButton.style.animation = "";
  }
}

playButton.addEventListener('click', () => {
  if (audioPlayer.paused) {
    playButton.src = "spinner.svg";
    playButton.style.animation = "spin 1s linear infinite";
    audioPlayer.play().then(() => {
      playButton.src = "pause.svg";
      playButton.style.animation = "";
    }).catch(err => {
      console.error("Play error", err);
      playButton.src = "play.svg";
      playButton.style.animation = "";
    });
  } else {
    audioPlayer.pause();
    playButton.src = "play.svg";
    playButton.style.animation = "";
  }
});

audioPlayer.addEventListener("timeupdate", () => {
  const current = audioPlayer.currentTime;
  const duration = audioPlayer.duration;

  if (!isNaN(current)) {
    const min = Math.floor(current / 60);
    const sec = Math.floor(current % 60);
    currentTimeEl.innerText = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  if (!isNaN(duration) && durationEl) {
    const min = Math.floor(duration / 60);
    const sec = Math.floor(duration % 60);
    durationEl.innerText = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  if (circle && duration) {
    const percent = (current / duration) * 100;
    circle.style.left = `${percent}%`;
  }
});

seekbar.addEventListener("click", (e) => {
  const rect = seekbar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  if (!isNaN(audioPlayer.duration)) {
    audioPlayer.currentTime = percent * audioPlayer.duration;
  }
});

audioPlayer.addEventListener("waiting", () => {
  playButton.src = "spinner.svg";
  playButton.style.animation = "spin 1s linear infinite";
});

audioPlayer.addEventListener("canplay", () => {
  playButton.src = "pause.svg";
  playButton.style.animation = "";
});
