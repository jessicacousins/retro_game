const LOGICAL_W = 400,
  LOGICAL_H = 600;


const wrapper = document.getElementById("gameWrapper");
function resizeGame() {
  const panel = wrapper.parentElement; 
  const availW = panel.clientWidth;
  const availH = window.innerHeight - panel.getBoundingClientRect().top;
  const scale = Math.min(availW / LOGICAL_W, availH / LOGICAL_H);
  wrapper.style.transform = `scale(${scale})`;


  const extra = availH - LOGICAL_H * scale;
  panel.style.paddingTop = `${extra > 0 ? extra * 0.5 : 0}px`;
}
window.addEventListener("resize", resizeGame);
resizeGame(); 


function loadImg(src, color) {
  const img = new Image();
  img.src = src;
  img.onerror = () => {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const x = c.getContext("2d");
    x.fillStyle = color;
    x.fillRect(0, 0, 32, 32);
    img.src = c.toDataURL();
  };
  return img;
}

/* ---------- CANVAS & ASSETS ---------- */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const IMGS = {
  critter: loadImg("critter.png", "#00e8ff"),
  meteor: loadImg("meteor.png", "#b33"),
  star: loadImg("star.png", "#ff0"),
  shield: loadImg("shield.png", "#0ff"),
  laser: loadImg("laser.png", "#f0f"),
  token: loadImg("token.png", "#0f0"), // cube that unlocks side-kick
  sidekick: loadImg("sidekick.png", "#ff66ff"), // the drone itself
};

/* ---------- SOUND ---------- */
const qs = (id) => document.getElementById(id);
const bgm = qs("bgm");
const sfx = {
  pickup: qs("pickup"),
  hit: qs("hit"),
  shield: qs("shieldSound"),
  laser: qs("laserSound"),
  explode: qs("explodeSound"),
  gameover: qs("gameOverSound"),
  high: qs("newHighScoreSound"),
};

/* ---------- GAME STATE ---------- */
let critter, meteors, stars, shields, lasers, particles;
let tokenDrops, sidekick;
let score, bestScore, shieldLives, energy, mult, multTimer, mostLives;
let isGameOver = false,
  zone = 1,
  achievements = {};
let playTime = 0,
  lastFrame = performance.now();
const TOKEN_COOLDOWN = 180000; // 3 minutes
let lastTokenAttempt = 0;

/* ---------- INPUT ---------- */
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
});
window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

/* ---------- INITIALISATION ---------- */
function resetGame() {
  critter = { x: 184, y: 540, w: 32, h: 32, speed: 6, dx: 0 };
  meteors = [];
  stars = [];
  shields = [];
  lasers = [];
  particles = [];
  tokenDrops = [];
  sidekick = null;

  score = 0;
  shieldLives = 0;
  energy = 100;
  mult = 1;
  multTimer = 0;
  zone = 1;
  playTime = 0;
  lastTokenAttempt = 0;
  isGameOver = false;

  qs("score").textContent = score;
  qs("lives").textContent = shieldLives;
  qs("energy").textContent = Math.round(energy);
  qs("multiplier").textContent = `${mult}×`;
  document.body.style.background =
    "radial-gradient(circle at top,#020024,#090979 70%)";
}

/* ---------- GAME LOOP ---------- */
function loop(now) {
  const dt = now - lastFrame;
  lastFrame = now;
  if (!isGameOver) playTime += dt;

  update(now);
  render();
  requestAnimationFrame(loop);
}

/* ---------- UPDATE ---------- */
function update(now) {
  if (isGameOver) return;

  /* movement */
  critter.dx =
    keys["ArrowLeft"] || keys["a"]
      ? -critter.speed
      : keys["ArrowRight"] || keys["d"]
      ? critter.speed
      : 0;
  critter.x = Math.max(
    0,
    Math.min(canvas.width - critter.w, critter.x + critter.dx)
  );

  /* dash */
  if (keys["Shift"] && energy > 0) {
    critter.speed = 9;
    energy -= 0.5;
  } else {
    critter.speed = 6;
    if (energy < 100) energy += 0.2;
  }
  qs("energy").textContent = Math.round(energy);

  /* firing */
  if (keys[" "] && canFire())
    fireLaser(critter.x + 14, critter.y - 10, "player");

  /* side-kick behavior */
  if (sidekick) {
    sidekick.x += (critter.x - sidekick.x) * 0.1;
    sidekick.y = critter.y - 40;

    if (now - sidekick.lastShot > 600) {
      fireLaser(sidekick.x + 12, sidekick.y - 8, "side");
      sidekick.lastShot = now;
    }
  }

  spawnEntities();
  moveEntities();
  handleCollisions();
  updateParticles();

  /* combo decay */
  if (--multTimer <= 0 && mult > 1) {
    mult--;
    multTimer = 300;
    qs("multiplier").textContent = `${mult}×`;
  }

  /* zone tint */
  if (score > 3000 && zone < 3) {
    zone = 3;
    switchZone("#2b0033", "#660044");
  } else if (score > 1500 && zone < 2) {
    zone = 2;
    switchZone("#002b33", "#004466");
  }
}

/* ---------- SPAWN ---------- */
function rand(a, b) {
  return Math.random() * (b - a) + a;
}
function spawnEntities() {
  if (Math.random() < 0.04)
    meteors.push({ x: rand(0, 368), y: -30, s: 32, dy: 3 + score / 300 });
  if (Math.random() < 0.02)
    stars.push({ x: rand(0, 380), y: -20, s: 20, dy: 2 });
  if (Math.random() < 0.006)
    shields.push({ x: rand(0, 380), y: -20, s: 22, dy: 1.8 });

  /* token cube */
  if (
    !sidekick &&
    tokenDrops.length === 0 &&
    playTime - lastTokenAttempt >= TOKEN_COOLDOWN
  ) {
    if (Math.random() < 0.05) {
      // 5 % chance this frame
      tokenDrops.push({ x: rand(0, 380), y: -20, s: 24, dy: 2 });
      lastTokenAttempt = playTime;
    }
  }
}

/* ---------- MOVE ---------- */
function moveEntities() {
  meteors.forEach((m) => (m.y += m.dy));
  stars.forEach((s) => (s.y += s.dy));
  shields.forEach((s) => (s.y += s.dy));
  tokenDrops.forEach((t) => (t.y += t.dy));
  lasers.forEach((l) => (l.y += l.dy));

  meteors = meteors.filter((m) => m.y < canvas.height + 40);
  stars = stars.filter((s) => s.y < canvas.height + 40);
  shields = shields.filter((s) => s.y < canvas.height + 40);
  tokenDrops = tokenDrops.filter((t) => t.y < canvas.height + 40);
  lasers = lasers.filter((l) => l.y > -20);
}

/* ---------- FIRE ---------- */
function canFire() {
  return lasers.filter((l) => l.owner === "player").length < 3 && !keys._cool;
}
function fireLaser(x, y, owner) {
  lasers.push({ x, y, dy: -10, owner });
  sfx.laser.play();
  if (owner === "player") {
    keys._cool = true;
    setTimeout(() => (keys._cool = false), 200);
  }
}

/* ---------- COLLISIONS ---------- */
function hit(a, b) {
  return (
    a.x < b.x + b.s && a.x + a.w > b.x && a.y < b.y + b.s && a.y + a.h > b.y
  );
}

function handleCollisions() {
  /* meteors vs player / side-kick */
  meteors.forEach((m, mi) => {
    if (hit(critter, m)) {
      meteors.splice(mi, 1);
      if (shieldLives > 0) {
        shieldLives--;
        qs("lives").textContent = shieldLives;
        sfx.hit.play();
      } else {
        sfx.gameover.play();
        gameOver();
      }
    }
    if (
      sidekick &&
      sidekick.x < m.x + m.s &&
      sidekick.x + 24 > m.x &&
      sidekick.y < m.y + m.s &&
      sidekick.y + 24 > m.y
    ) {
      meteors.splice(mi, 1);
      addParticle(m.x + 16, m.y + 16, "#ff66ff", 18);
      sfx.explode.play();
    }
  });

  /* stars */
  stars.forEach((s, si) => {
    if (hit(critter, s)) {
      stars.splice(si, 1);
      score += 1 * mult;
      mult = Math.min(mult + 1, 5);
      multTimer = 300;
      qs("score").textContent = score;
      qs("multiplier").textContent = `${mult}×`;
      sfx.pickup.play();
      addParticle(s.x + 8, s.y + 8, "#ff0");
      checkAchievements();
    }
  });

  /* shields */
  shields.forEach((s, si) => {
    if (hit(critter, s)) {
      shields.splice(si, 1);
      shieldLives++;
      qs("lives").textContent = shieldLives;
      sfx.shield.play();
      addParticle(s.x + 10, s.y + 10, "#0ff");
      if (shieldLives > mostLives) {
        mostLives = shieldLives;
        localStorage.setItem("mostLives", mostLives);
        qs("mostLives").textContent = mostLives;
      }
    }
  });

  /* token cube */
  tokenDrops.forEach((t, ti) => {
    if (hit(critter, t)) {
      tokenDrops.splice(ti, 1);
      unlockSidekick();
    }
  });

  /* lasers vs meteors */
  lasers.forEach((l, li) => {
    meteors.forEach((m, mi) => {
      if (l.x > m.x && l.x < m.x + m.s && l.y > m.y && l.y < m.y + m.s) {
        meteors.splice(mi, 1);
        lasers.splice(li, 1);
        score += 5 * mult;
        qs("score").textContent = score;
        sfx.explode.play();
        addParticle(m.x + 16, m.y + 16, "#f33", 20);
      }
    });
  });
}

/* ---------- SIDE-KICK ---------- */
function unlockSidekick() {
  sidekick = { x: critter.x, y: critter.y - 40, lastShot: 0 };
  addAchievement("Side-kick Unlocked!");
  sfx.pickup.play();
}

/* ---------- PARTICLES ---------- */
function addParticle(x, y, c, count = 12) {
  for (let i = 0; i < count; i++)
    particles.push({ x, y, dx: rand(-2, 2), dy: rand(-2, 2), ttl: 30, c });
}
function updateParticles() {
  particles.forEach((p) => {
    p.x += p.dx;
    p.y += p.dy;
    p.ttl--;
  });
  particles = particles.filter((p) => p.ttl > 0);
}

/* ---------- RENDER ---------- */
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  /* subtle parallax tint */
  ctx.save();
  ctx.globalAlpha = 0.2;
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, "#000");
  g.addColorStop(1, "#111");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  /* draw entities */
  ctx.drawImage(IMGS.critter, critter.x, critter.y, critter.w, critter.h);
  if (shieldLives > 0) {
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(critter.x + 16, critter.y + 16, 20, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (sidekick) ctx.drawImage(IMGS.sidekick, sidekick.x, sidekick.y, 24, 24);

  meteors.forEach((m) => ctx.drawImage(IMGS.meteor, m.x, m.y, m.s, m.s));
  stars.forEach((s) => ctx.drawImage(IMGS.star, s.x, s.y, s.s, s.s));
  shields.forEach((s) => ctx.drawImage(IMGS.shield, s.x, s.y, s.s, s.s));
  tokenDrops.forEach((t) => ctx.drawImage(IMGS.token, t.x, t.y, t.s, t.s));
  lasers.forEach((l) => ctx.drawImage(IMGS.laser, l.x, l.y, 4, 12));

  /* particles */
  particles.forEach((p) => {
    ctx.globalAlpha = p.ttl / 30;
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x, p.y, 3, 3);
    ctx.globalAlpha = 1;
  });
}

/* ---------- ZONE BG ---------- */
function switchZone(c1, c2) {
  document.body.style.background = `radial-gradient(circle at top,${c1},${c2} 70%)`;
}

/* ---------- GAME OVER ---------- */
function gameOver() {
  isGameOver = true;
  addParticle(critter.x + 16, critter.y + 16, "#ff4444", 30);

  const best = Number(localStorage.getItem("bestScore") || 0);
  const newBest = score > best;
  if (newBest) {
    localStorage.setItem("bestScore", score);
    sfx.high.play();
  }
  qs("best").textContent = newBest ? score : best;

  setTimeout(
    () =>
      alert(`💥 Game Over! Score: ${score}${newBest ? " 🎉 NEW BEST" : ""}`),
    200
  );
}

/* ---------- ACHIEVEMENTS ---------- */
function addAchievement(name) {
  if (achievements[name]) return;
  achievements[name] = true;
  const li = document.createElement("li");
  li.textContent = `🏆 ${name}`;
  qs("achievementList").prepend(li);
}
function checkAchievements() {
  if (score >= 50) addAchievement("50 Points!");
  if (score >= 300) addAchievement("300 Points!");
  if (mult >= 5) addAchievement("×5 Combo Master");
}

/* ---------- UI EVENTS ---------- */
qs("restartBtn").onclick = () => resetGame();
document.addEventListener("keydown", (e) => {
  if (e.key === "m") toggleMute();
  if (e.key === "r" && isGameOver) resetGame();
});
function toggleMute() {
  const all = [bgm, ...Object.values(sfx)];
  const muted = all.every((a) => a.muted);
  all.forEach((a) => (a.muted = !muted));
}
/* music button */
{
  const btn = qs("toggleMusicBtn");
  btn.onclick = () => {
    if (bgm.paused) {
      bgm.play();
      btn.textContent = "🔊 Music: On";
    } else {
      bgm.pause();
      btn.textContent = "🔇 Music: Off";
    }
  };
  window.addEventListener("click", () => bgm.play().catch(() => {}), {
    once: true,
  });
}
/* sound panel */
{
  const panel = qs("soundControlPanel");
  qs("openControlPanel").onclick = () => (panel.style.display = "block");
  window.closeControlPanel = () => (panel.style.display = "none");
  qs("musicVolume").oninput = (e) => (bgm.volume = parseFloat(e.target.value));
  qs("fxVolume").oninput = (e) => {
    const v = parseFloat(e.target.value);
    Object.values(sfx).forEach((a) => (a.volume = v));
  };
}

/* ---------- BOOT ---------- */
bestScore = Number(localStorage.getItem("bestScore") || 0);
mostLives = Number(localStorage.getItem("mostLives") || 0);
qs("best").textContent = bestScore;
qs("mostLives").textContent = mostLives;

resetGame();
requestAnimationFrame(loop);
