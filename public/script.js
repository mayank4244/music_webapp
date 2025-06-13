console.log("script is running");

const style = document.createElement('style');
style.innerHTML = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}`;
document.head.appendChild(style);

let play = document.getElementById("playbutton");
let currsong = document.getElementById("audioPlayer");
async function getStreamUrl(videoId) {
  console.log("Playing video:", videoId);

  const audio = document.getElementById("audioPlayer");
  const play = document.getElementById("playbutton");

  // Set spinner SVG and rotate it inline
  play.src = "spinner.svg";
  play.style.animation = "spin 1s linear infinite";
  play.style.transformOrigin = "center center";

  currsong.src = `/stream/${videoId}`;
  currsong.load();

  // When audio is ready
  currsong.addEventListener("canplay", () => {
    play.src = "pause.svg";
    play.style.animation = "";
  });

  currsong.addEventListener("waiting", () => {
    play.src = "spinner.svg";
    play.style.animation = "spin 1s linear infinite";
  });

  try {
    await currsong.play();
  } catch (err) {
    console.error("Error playing:", err);
    alert("⚠️ Unable to play audio. Try another video.");
    play.src = "play.svg";
    play.style.animation = "";
  }
}


play.addEventListener("click", () => {
  if (currsong.paused) {
    play.src = "spinner.svg";
    play.style.animation = "spin 1s linear infinite";
    currsong.play().then(() => {
      play.src = "pause.svg";
      play.style.animation = "";
    }).catch(err => {
      play.src = "play.svg";
      play.style.animation = "";
    });
  } else {
    currsong.pause();
    play.src = "play.svg";
    play.style.animation = "";
  }
});

// updating currenttime and moving seekbar according to song played 
document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("audioPlayer");
  if (audio) {
    audio.addEventListener("timeupdate", () => {
      const currentTimeElement = document.querySelector(".currenttime");
      if (currentTimeElement) {
        let minutes = Math.floor(audio.currentTime / 60);
        let seconds = Math.floor(audio.currentTime % 60);
        currentTimeElement.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.querySelector(".circle").style.left = (audio.currentTime/audio.duration)*100 + "%";
      }
    });
  } else {
    console.warn("No audio element found!");
  }
});

// adding event listener to seekbar to skip song forward and backward 
document.querySelector(".seekbar").addEventListener("click",e=>{
  const audio = document.getElementById("audioPlayer");
  console.log(e.offsetX,e.target.getBoundingClientRect(),e.offsetX);
  let percent = (e.offsetX/e.target.getBoundingClientRect().width)*100;
  document.querySelector(".circle").style.left = percent + "%";
  audio.currentTime = audio.duration*percent;
})



async function getdurationinfo(videoId){
  let duration_info = await fetch(`/duration?videoId=${videoId}`);
  let data = await duration_info.json();
  console.log("duration", data.duration);
  let divs = document.getElementsByClassName("duration");
  for (let div of divs) {
    div.innerHTML = data.duration;
  }
  
}

document.getElementById("search_form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const query = document.getElementById("search_input").value;
  console.log(query);

  try {
    const res = await fetch(`/search?song=${encodeURIComponent(query)}`);
    const data = await res.json();
    console.log("🔍 Search Results:", data);

    const resultList = document.getElementById("resultList");
    resultList.innerHTML = "";

    data.forEach((video) => {
      const li = document.createElement("li");

      li.addEventListener("click", () => {
        getStreamUrl(video.videoId);
        getdurationinfo(video.videoId);
      });

      const itemDiv = document.createElement("div");
      itemDiv.className = "item";

      const img = document.createElement("img");
      img.src = video.thumbnail;
      img.alt = video.title;
      itemDiv.appendChild(img);

      const titleDiv = document.createElement("div");
      titleDiv.className = "title";
      titleDiv.textContent = video.title;

      li.appendChild(itemDiv);
      li.appendChild(titleDiv);

      resultList.appendChild(li);
    });
  } catch (err) {
    console.error("❌ Fetch error:", err);
  }
});