

console.log("script2.js loaded");

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
const durationEls = document.querySelectorAll('.duration');
const seekbar = document.querySelector('.seekbar');
const circle = document.querySelector('.circle');
const login = document.querySelector('.login');
const playlist = document.querySelector('.playlist');
const hamburger_icon = document.querySelector('.hamburger');
const leftSidebar = document.querySelector('.left');
const home = document.querySelector('.home');
const playbartitle = document.querySelector('.playbartitle')
const prevBtn = document.querySelector('.prev')
const nextBtn = document.querySelector('.next')

let currentVideoId = null;
let playlistSongs = [];
let currentSongIndex  = -1;


// on clicking on home clear whole page
home.addEventListener('click', ()=>{
  // making look like this icon is selected...
  document.querySelectorAll('.icon').forEach(icon => {
    icon.classList.remove('selected');
  });
  home.classList.add('selected');

  resultList.innerHTML = '';
  searchInput.value = '';
  const playlist_text = document.querySelector('.playlists')
    playlist_text.textContent = "";
  const container = document.querySelector('.card-container'); 
    container.innerHTML = '';
    
})


// searchinh for a song...
searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  // clearing playlist container
  const playlist_text = document.querySelector('.playlists')
    playlist_text.textContent = "";
  const container = document.querySelector('.card-container'); 
    container.innerHTML = '';

  const query = searchInput.value.trim();
  if (!query) {
    console.log("Search query empty");
    return;
  }
  
  resultList.innerHTML = '<li>Loading...</li>';
  console.log(`Searching for: ${query}`);

  try {
    const res = await fetch(`/search?song=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`Search request failed with status ${res.status}`);
    const results = await res.json();

    if (results.error) {
      console.error("Search error from server:", results.error);
      resultList.innerHTML = `<li>Error: ${results.error}</li>`;
      return;
    }

    console.log("Search results received:", results);

    if (results.length === 0) {
      resultList.innerHTML = '<li>No results found</li>';
      return;
    }
    // appending results as list in page...
    resultList.innerHTML = '';
    results.forEach(({ videoId, title, thumbnail, channelTitle }) => {
      const li = document.createElement('li');
      li.classList.add('result-item');
      li.innerHTML = `
        <img src="${thumbnail}" alt="${title}" />
        <div class="info">
          <strong>${title}</strong><br/>
          <small>${channelTitle}</small>
        </div>
      `;
      li.addEventListener('click', () => {
        currentSongIndex = -1;
        playlistSongs = [];
        playSong(videoId, title)});//change pass title 
      resultList.appendChild(li);
    });

  } catch (err) {
    console.error("Error during search:", err);
    resultList.innerHTML = `<li>Failed to fetch results: ${err.message}</li>`;
  }
});

// new function 16-06-25
function playSongFromPlaylist(index) {
  if (index < 0 || index >= playlistSongs.length) return;
  currentSongIndex = index;
  const song = playlistSongs[index];
  playSong(song.videoId, song.title);
}

async function playSong(videoId, title) {
  if (currentVideoId === videoId) {
    if (!audioPlayer.paused) {
      console.log("Pausing current song");
      audioPlayer.pause();
      playButton.src = "play.svg";
    } else {
      console.log("Resuming current song");
      playButton.src = "spinner.svg";
      playButton.style.animation = "spin 1s linear infinite";
      try {
        await audioPlayer.play();
        playButton.src = "pause.svg";
        playButton.style.animation = "";
      } catch (e) {
        console.error("Audio play error:", e);
        playButton.src = "play.svg";
        playButton.style.animation = "";
      }
    }
    return;
  }

  currentVideoId = videoId;
  
  audioPlayer.src = `/stream/${videoId}`;
  audioPlayer.load();
  playButton.src = "spinner.svg";
  playButton.style.animation = "spin 1s linear infinite";

  console.log(`Playing videoId: ${videoId}`);

  try {
    await audioPlayer.play();
    playButton.src = "pause.svg";
    playButton.style.animation = "";
    console.log("Playback started");
  } catch (e) {
    console.error("Playback error:", e);
    playButton.src = "play.svg";
    playButton.style.animation = "";

  }

  fetchDuration(videoId); //changing after this to insert title in playbar
  playbartitle.innerHTML = title; 

}

async function fetchDuration(videoId) {
  try {
    const res = await fetch(`/duration?videoId=${videoId}`);
    if (!res.ok) throw new Error(`Duration fetch failed with status ${res.status}`);
    const data = await res.json();
    console.log(`Duration for ${videoId}:`, data.duration);
    durationEls.forEach(el => el.innerText = data.duration);
  } catch (err) {
    console.error("Error fetching duration:", err);
  }
}

playButton.addEventListener("click", () => {
  if (audioPlayer.paused) {
    playButton.src = "spinner.svg";
    playButton.style.animation = "spin 1s linear infinite";
    audioPlayer.play().then(() => {
      playButton.src = "pause.svg";
      playButton.style.animation = "";
    }).catch(err => {
      console.error("Play button error:", err);
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
  const minutes = Math.floor(audioPlayer.currentTime / 60);
  const seconds = Math.floor(audioPlayer.currentTime % 60);
  if (currentTimeEl) {
    currentTimeEl.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  if (circle && audioPlayer.duration) {
    circle.style.left = `${(audioPlayer.currentTime / audioPlayer.duration) * 100}%`;
  }
});

seekbar.addEventListener("click", e => {
  const rect = seekbar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  if (!isNaN(audioPlayer.duration)) {
    audioPlayer.currentTime = percent * audioPlayer.duration;
    if (circle) circle.style.left = `${percent * 100}%`;
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

audioPlayer.addEventListener("ended", () => {
  if (currentSongIndex !== -1 && currentSongIndex < playlistSongs.length - 1) {
    playSongFromPlaylist(currentSongIndex + 1);
  }
});

prevBtn.addEventListener('click', () => {
  if (currentSongIndex > 0) {
    playSongFromPlaylist(currentSongIndex - 1);
  } else {
    showAlert("You're at the first song");
  }
});

nextBtn.addEventListener('click', () => {
  if (currentSongIndex < playlistSongs.length - 1) {
    playSongFromPlaylist(currentSongIndex + 1);
  } else {
    showAlert("You're at the last song");
  }
});


//// login part from here and fetching playlists after login...

window.addEventListener('DOMContentLoaded', async ()=>{
    const res = await fetch('/authenticate');
    const data = await res.json();

    if(data.authenticated){
      login.style.display = 'none';
    }
    if(!data.authenticated){
      login.style.display = 'block';

      playlist.addEventListener('click', async ()=>{
          showAlert('please login to fecth playlists', duration = 1000);
       });
    }


  })

login.addEventListener("click" , ()=>{
  window.location.href = "/auth/google";
})




 playlist.addEventListener('click', async ()=>{
  //making look like its selected

  document.querySelectorAll('.icon').forEach(icon => {
    icon.classList.remove('selected');
  });
  playlist.classList.add('selected');
  resultList.innerHTML = '';
  searchInput.value = '';
  const res = await fetch('/playlists');
  if (res.ok) {
    const playlistData = await res.json();
    console.log('Your Playlists:', playlistData);
    // text on top written playlists 
    const playlist_text = document.querySelector('.playlists')
    playlist_text.textContent = "Playlists";
    // select card_container
    const container = document.querySelector('.card-container'); 
    container.innerHTML = ''; // 

  

    // loop on playlists 
    playlistData.items.forEach(item => {
      const title_text = item.snippet.title;
      const thumbnail_image = item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url
      // create cards inside container
      const playlist_card = document.createElement('div');
      playlist_card.className = "card"
      // thumbnail image creation  
      const thumbnail_img = document.createElement('div');
      thumbnail_img.className = "thumbnail";
      thumbnail_img.innerHTML = `<img id="thumbnail" src="${thumbnail_image}" alt="${title_text}">`
      //insert image in the card 
      playlist_card.appendChild(thumbnail_img);
      // create playlist title div 
      const title_div = document.createElement('div');
      title_div.className = "title";
      title_div.textContent = `${title_text}`
      // insert title div in card 
      playlist_card.appendChild(title_div);

      // insert card in card_container 
      container.appendChild(playlist_card);

      //on click call function to show songs inside it..
      playlist_card.addEventListener('click', ()=>{
      const playlistId = item.id;
      showSongsFromPlaylist(playlistId, title_text);
      });      
      

      console.log("title :", title_text);
      console.log("thumbnail :", thumbnail_image);
    })
    
    
  } else {
    console.error('Failed to load playlists');
  }
});

// hamburger functionality 

hamburger_icon.addEventListener("click", (e)=>{
  e.stopPropagation(); // Prevent event from bubbling to document
  leftSidebar.classList.toggle("show");

})

document.addEventListener("click", (e) => {
  const isClickInsideSidebar = leftSidebar.contains(e.target);
  const isClickOnHamburger = hamburger_icon.contains(e.target);

  if (!isClickInsideSidebar && !isClickOnHamburger) {
    leftSidebar.classList.remove("show");
  }
});


// coustom alert function implementation....

function showAlert(message, duration = 3000) {
  const alertBox = document.createElement('div');
  alertBox.className = 'custom-alert';
  alertBox.innerText = message;
  document.body.appendChild(alertBox);

  // Trigger show animation
  setTimeout(() => alertBox.classList.add('show'), 50);

  // Auto remove after duration
  setTimeout(() => {
    alertBox.classList.remove('show');
    // Remove from DOM after transition
    setTimeout(() => document.body.removeChild(alertBox), 500);
  }, duration);
}


// function to show songs inside an playlist...
async function showSongsFromPlaylist(playlistId, title) {
  const res = await fetch(`/playlistItems?playlistId=${playlistId}`);
  const data = await res.json();
  if (data.items) {
    const container = document.querySelector('.card-container');
    container.innerHTML = '';
    document.querySelector('.playlists').textContent = `Songs in ${title}`;
    playlistSongs = [];
    currentSongIndex = -1;

    data.items.forEach((item, index) => {
      const title = item.snippet.title;
      const thumbnail = item.snippet.thumbnails?.default?.url;
      const videoId = item.snippet.resourceId.videoId;
      playlistSongs.push({ videoId, title });

      const songCard = document.createElement('div');
      songCard.className = 'card';
      const thumb = document.createElement('div');
      thumb.className = 'thumbnail';
      thumb.innerHTML = `<img src="${thumbnail}" alt="${title}">`;
      const titleDiv = document.createElement('div');
      titleDiv.className = 'title';
      titleDiv.textContent = title;
      songCard.appendChild(thumb);
      songCard.appendChild(titleDiv);
      container.appendChild(songCard);

      songCard.addEventListener('click', () => {
        currentSongIndex = index;
        playSongFromPlaylist(index);
      });
    });
  } else {
    console.error('Failed to load songs');
  }
}
