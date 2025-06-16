const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const critterImg = new Image();
critterImg.src = "critter.png";
const meteorImg = new Image();
meteorImg.src = "meteor.png";
const starImg = new Image();
starImg.src = "star.png";

let critter = { x: 180, y: 540, width: 32, height: 32, speed: 6, dx: 0 };
let meteors = [],
  stars = [],
  shields = [];
let score = 0,
  bestScore = localStorage.getItem("bestScore") || 0;
let isGameOver = false;
let shieldLives = 0;
let currentZone = 1;
let mostLives = localStorage.getItem("mostLives") || 0;

document.getElementById("best").textContent = bestScore;
document.getElementById("mostLives").textContent = mostLives;

const bgm = document.getElementById("bgm");
const pickup = document.getElementById("pickup");
const hit = document.getElementById("hit");
const shieldSound = document.getElementById("shieldSound");
const gameOverSound = document.getElementById("gameOverSound");
const newHighScoreSound = document.getElementById("newHighScoreSound");
bgm.volume = 0.5;

window.addEventListener("load", () => {
  document.body.addEventListener("click", startMusicOnce, { once: true });
});

function startMusicOnce() {
  bgm
    .play()
    .then(() => {
      toggleBtn.textContent = "🔊 Music: On";
    })
    .catch(() => {
      toggleBtn.textContent = "🔇 Music: Off (Click)";
    });
}

function drawCritter() {
  ctx.drawImage(
    critterImg,
    critter.x,
    critter.y,
    critter.width,
    critter.height
  );
  if (shieldLives > 0) {
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(critter.x + 16, critter.y + 16, 20, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawMeteor(m) {
  ctx.drawImage(meteorImg, m.x, m.y, m.size, m.size);
}
function drawStar(s) {
  ctx.drawImage(starImg, s.x, s.y, s.size, s.size);
}
function drawShield(s) {
  ctx.fillStyle = "rgba(0,255,255,0.5)";
  ctx.beginPath();
  ctx.arc(s.x + 10, s.y + 10, 10, 0, Math.PI * 2);
  ctx.fill();
}

function isColliding(a, b) {
  return (
    a.x < b.x + b.size &&
    a.x + a.width > b.x &&
    a.y < b.y + b.size &&
    a.y + a.height > b.y
  );
}

function moveCritter() {
  critter.x += critter.dx;
  if (critter.x < 0) critter.x = 0;
  if (critter.x + critter.width > canvas.width)
    critter.x = canvas.width - critter.width;
}

function updateZone() {
  const body = document.body;
  if (score > 2000 && currentZone < 3) {
    body.style.background = "radial-gradient(circle, #1b0033, #440044)";
    currentZone = 3;
  } else if (score > 1000 && currentZone < 2) {
    body.style.background = "radial-gradient(circle, #003344, #002222)";
    currentZone = 2;
  }
}

function updateGame() {
  if (isGameOver) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  moveCritter();
  drawCritter();

  meteors.forEach((m, i) => {
    m.y += m.speed;
    drawMeteor(m);

    if (isColliding(critter, m)) {
      meteors.splice(i, 1);
      if (shieldLives > 0) {
        shieldLives--;
        document.getElementById("lives").textContent = shieldLives;
      } else {
        hit.play();
        endGame();
      }
    }
  });

  stars.forEach((s, i) => {
    s.y += s.speed;
    drawStar(s);
    if (isColliding(critter, s)) {
      score += 1;
      pickup.play();
      stars.splice(i, 1);
    }
  });

  shields.forEach((s, i) => {
    s.y += s.speed;
    drawShield(s);
    if (isColliding(critter, s)) {
      shieldSound.play();
      shields.splice(i, 1);
      shieldLives++;
      document.getElementById("lives").textContent = shieldLives;
      if (shieldLives > mostLives) {
        mostLives = shieldLives;
        localStorage.setItem("mostLives", mostLives);
        document.getElementById("mostLives").textContent = mostLives;
      }
    }
  });

  meteors = meteors.filter((m) => m.y < canvas.height);
  stars = stars.filter((s) => s.y < canvas.height);
  shields = shields.filter((s) => s.y < canvas.height);

  if (Math.random() < 0.035)
    meteors.push({
      x: Math.random() * 368,
      y: -20,
      size: 32,
      speed: 3 + score / 100,
    });

  if (Math.random() < 0.015)
    stars.push({ x: Math.random() * 368, y: -20, size: 20, speed: 2 });

  if (Math.random() < 0.004)
    shields.push({ x: Math.random() * 368, y: -20, size: 20, speed: 2 });

  updateZone();
  document.getElementById("score").textContent = score;
  requestAnimationFrame(updateGame);
}

function endGame() {
  isGameOver = true;

  const isNewHighScore = score > bestScore;

  if (isNewHighScore) {
    localStorage.setItem("bestScore", score);
    document.getElementById("best").textContent = score;
    newHighScoreSound.play();
    flashScreen("gold");
  } else {
    gameOverSound.play();
    flashScreen("red");
  }

  setTimeout(() => {
    alert(
      `💥 Game Over! Final score: ${score}${
        isNewHighScore ? " 🎉 NEW BEST!" : ""
      }`
    );
  }, 300);
}

function flashScreen(color) {
  const flash = document.createElement("div");
  flash.style.position = "fixed";
  flash.style.top = "0";
  flash.style.left = "0";
  flash.style.width = "100vw";
  flash.style.height = "100vh";
  flash.style.backgroundColor = color;
  flash.style.opacity = "0.7";
  flash.style.zIndex = "999";
  flash.style.pointerEvents = "none";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 300);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") critter.dx = -critter.speed;
  if (e.key === "ArrowRight") critter.dx = critter.speed;
});
document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") critter.dx = 0;
});

let touchStartX = null;
canvas.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0].clientX;
});
canvas.addEventListener("touchend", (e) => {
  const deltaX = e.changedTouches[0].clientX - touchStartX;
  if (deltaX > 30) critter.dx = critter.speed;
  else if (deltaX < -30) critter.dx = -critter.speed;
  setTimeout(() => (critter.dx = 0), 150);
});

document.getElementById("restartBtn").onclick = () => {
  score = 0;
  isGameOver = false;
  critter.x = 180;
  meteors = [];
  stars = [];
  shields = [];
  shieldLives = 0;

  document.getElementById("lives").textContent = shieldLives;
  document.getElementById("score").textContent = score;

  updateGame();
};

updateGame();

const toggleBtn = document.getElementById("toggleMusicBtn");
toggleBtn.addEventListener("click", () => {
  if (bgm.paused) {
    bgm.play();
    toggleBtn.textContent = "🔊 Music: On";
  } else {
    bgm.pause();
    toggleBtn.textContent = "🔇 Music: Off";
  }
});

// Sound Control Panel
const panel = document.getElementById("soundControlPanel");
document.getElementById("openControlPanel").onclick = () => {
  panel.style.display = "block";
};

function closeControlPanel() {
  panel.style.display = "none";
}

// volume Sliders
const musicSlider = document.getElementById("musicVolume");
const fxSlider = document.getElementById("fxVolume");

// defaults
musicSlider.value = bgm.volume;
fxSlider.value = pickup.volume;

// update volumes
musicSlider.addEventListener("input", () => {
  bgm.volume = parseFloat(musicSlider.value);
});

fxSlider.addEventListener("input", () => {
  const fxVolume = parseFloat(fxSlider.value);
  [pickup, hit, shieldSound, gameOverSound, newHighScoreSound].forEach(
    (sfx) => (sfx.volume = fxVolume)
  );
});

// Mute-All  (press 'M')
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "m") {
    const allSounds = [
      bgm,
      pickup,
      hit,
      shieldSound,
      gameOverSound,
      newHighScoreSound,
    ];
    const isMuted = allSounds.every((sound) => sound.muted);

    allSounds.forEach((sound) => {
      sound.muted = !isMuted;
    });

    const msg = isMuted ? "🔊 All sounds unmuted" : "🔇 All sounds muted";
    console.log(msg);

    // visual feedback on screen
    const flash = document.createElement("div");
    flash.textContent = msg;
    flash.style.position = "fixed";
    flash.style.bottom = "20px";
    flash.style.left = "50%";
    flash.style.transform = "translateX(-50%)";
    flash.style.padding = "8px 16px";
    flash.style.backgroundColor = "#000";
    flash.style.color = "#fff";
    flash.style.borderRadius = "6px";
    flash.style.zIndex = 2000;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 1500);
  }
});
