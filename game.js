const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const IMGS = {
  critter: loadImg("critter.png", "#00e8ff"),
  meteor: loadImg("meteor.png", "#b33"),
  star: loadImg("star.png", "#ff0"),
  shield: loadImg("shield.png", "#0ff"),
  laser: loadImg("laser.png", "#f0f"),
};
function loadImg(src, fallback) {
  const img = new Image();
  img.src = src;
  img.onerror = () => {
    // draw a quick placeholder on first load failure
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const x = c.getContext("2d");
    x.fillStyle = fallback;
    x.fillRect(0, 0, 32, 32);
    img.src = c.toDataURL();
  };
  return img;
}

/* ==== GLOBAL STATE ==== */
let critter, meteors, stars, shields, lasers, particles;
let score, bestScore, shieldLives, energy, mult, multTimer, mostLives;
let isGameOver = false,
  zone = 1,
  achievements = {};

/* DOM REFS */
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

/* ==== INIT ==== */
function resetGame() {
  critter = { x: 184, y: 540, w: 32, h: 32, speed: 6, dx: 0 };
  meteors = [];
  stars = [];
  shields = [];
  lasers = [];
  particles = [];
  score = 0;
  shieldLives = 0;
  energy = 100;
  mult = 1;
  multTimer = 0;
  zone = 1;
  isGameOver = false;
  qs("score").textContent = score;
  qs("lives").textContent = shieldLives;
  qs("energy").textContent = Math.round(energy);
  qs("multiplier").textContent = `${mult}×`;
  document.body.style.background =
    "radial-gradient(circle at top,#020024,#090979 70%)";
}

/* ==== INPUT ==== */
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
});
window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

/* ==== GAME LOOP ==== */
function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

/* ==== UPDATE ==== */
function update() {
  if (isGameOver) return;

  /* -- Movement -- */
  critter.dx =
    keys["ArrowLeft"] || keys["a"]
      ? -critter.speed
      : keys["ArrowRight"] || keys["d"]
      ? critter.speed
      : 0;
  critter.x += critter.dx;
  critter.x = Math.max(0, Math.min(canvas.width - critter.w, critter.x));

  /* -- Hyper Dash (Shift) -- */
  if (keys["Shift"] && energy > 0) {
    critter.speed = 9;
    energy -= 0.6;
  } else {
    critter.speed = 6;
    if (energy < 100) energy += 0.2;
  }
  qs("energy").textContent = Math.round(energy);

  /* -- Firing (space) -- */
  if (keys[" "] && canFire()) {
    fireLaser();
  }

  /* -- Entities -- */
  spawnEntities();
  moveEntities();
  handleCollisions();
  updateParticles();

  /* -- Score/multiplier decay -- */
  multTimer--;
  if (multTimer <= 0 && mult > 1) {
    mult--;
    qs("multiplier").textContent = `${mult}×`;
    multTimer = 300;
  }

  /* -- Zone Change -- */
  if (score > 3000 && zone < 3) {
    zone = 3;
    switchZone("#2b0033", "#660044");
  } else if (score > 1500 && zone < 2) {
    zone = 2;
    switchZone("#002b33", "#004466");
  }
}
function canFire() {
  return lasers.length < 3 && keys["_cooldown"] !== true;
}
function fireLaser() {
  lasers.push({ x: critter.x + 14, y: critter.y - 10, dy: -10 });
  sfx.laser.play();
  keys["_cooldown"] = true;
  setTimeout(() => {
    keys["_cooldown"] = false;
  }, 200); //fire-rate
}

/* ==== SPAWN ==== */
function spawnEntities() {
  if (Math.random() < 0.04)
    meteors.push({ x: rand(0, 368), y: -30, s: 32, dy: 3 + score / 300 });
  if (Math.random() < 0.02)
    stars.push({ x: rand(0, 380), y: -20, s: 20, dy: 2 });
  if (Math.random() < 0.006)
    shields.push({ x: rand(0, 380), y: -20, s: 22, dy: 1.8 });
}
function rand(a, b) {
  return Math.random() * (b - a) + a;
}

/* ==== MOVE ==== */
function moveEntities() {
  meteors.forEach((m) => (m.y += m.dy));
  stars.forEach((s) => (s.y += s.dy));
  shields.forEach((s) => (s.y += s.dy));
  lasers.forEach((l) => (l.y += l.dy));
  // cleanup
  meteors = meteors.filter((m) => m.y < canvas.height + 40);
  stars = stars.filter((s) => s.y < canvas.height + 40);
  shields = shields.filter((s) => s.y < canvas.height + 40);
  lasers = lasers.filter((l) => l.y > -20);
}

/* ==== COLLISIONS ==== */
function hitRect(a, b) {
  return (
    a.x < b.x + b.s && a.x + a.w > b.x && a.y < b.y + b.s && a.y + a.h > b.y
  );
}
function handleCollisions() {
  //player & meteors
  meteors.forEach((m, i) => {
    if (hitRect(critter, m)) {
      meteors.splice(i, 1);
      if (shieldLives > 0) {
        shieldLives--;
        qs("lives").textContent = shieldLives;
        sfx.hit.play();
      } else {
        sfx.gameover.play();
        gameOver();
      }
    }
  });

  //player & stars
  stars.forEach((s, i) => {
    if (hitRect(critter, s)) {
      stars.splice(i, 1);
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

  //player & shields
  shields.forEach((s, i) => {
    if (hitRect(critter, s)) {
      shields.splice(i, 1);
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

  //laser & meteor
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

/* ==== PARTICLES ==== */
function addParticle(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      dx: rand(-2, 2),
      dy: rand(-2, 2),
      ttl: 30,
      c: color,
    });
  }
}
function updateParticles() {
  particles.forEach((p) => {
    p.x += p.dx;
    p.y += p.dy;
    p.ttl--;
  });
  particles = particles.filter((p) => p.ttl > 0);
}

/* ==== DRAW ==== */
function render() {
  //clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  //stars parallax
  ctx.save();
  ctx.globalAlpha = 0.2;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#000");
  gradient.addColorStop(1, "#111");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  //entities
  ctx.drawImage(IMGS.critter, critter.x, critter.y, critter.w, critter.h);
  if (shieldLives > 0) {
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(critter.x + 16, critter.y + 16, 20, 0, Math.PI * 2);
    ctx.stroke();
  }

  meteors.forEach((m) => ctx.drawImage(IMGS.meteor, m.x, m.y, m.s, m.s));
  stars.forEach((s) => ctx.drawImage(IMGS.star, s.x, s.y, s.s, s.s));
  shields.forEach((s) => ctx.drawImage(IMGS.shield, s.x, s.y, s.s, s.s));
  lasers.forEach((l) => ctx.drawImage(IMGS.laser, l.x, l.y, 4, 12));

  //particles
  particles.forEach((p) => {
    ctx.fillStyle = p.c;
    ctx.globalAlpha = p.ttl / 30;
    ctx.fillRect(p.x, p.y, 3, 3);
    ctx.globalAlpha = 1;
  });
}

/* ==== ZONE BG ==== */
function switchZone(c1, c2) {
  document.body.style.background = `radial-gradient(circle at top,${c1},${c2} 70%)`;
}

/* ==== GAME OVER ==== */
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

  setTimeout(() => {
    alert(`💥 Game Over! Score: ${score}${newBest ? " 🎉 NEW BEST" : ""}`);
  }, 200);
}

/* ==== ACHIEVEMENTS ==== */
function addAchievement(name) {
  if (achievements[name]) return;
  achievements[name] = true;
  const li = document.createElement("li");
  li.textContent = `🏆 ${name}`;
  qs("achievementList").prepend(li);
}
function checkAchievements() {
  if (score >= 50) addAchievement("50 Points!");
  if (score >= 200) addAchievement("200 Points!");
  if (mult >= 5) addAchievement("x5 Combo Master");
}

/* ==== UTILITY ==== */
function toggleMute() {
  const all = [bgm, ...Object.values(sfx)];
  const muted = all.every((a) => a.muted);
  all.forEach((a) => (a.muted = !muted));
}

/* ==== EVENTS & UI ==== */
qs("restartBtn").onclick = () => resetGame();
document.addEventListener("keydown", (e) => {
  if (e.key === "m") toggleMute();
  if (e.key === "r" && isGameOver) resetGame();
});
/* music button */ {
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
/* sound panel */ {
  const panel = qs("soundControlPanel");
  qs("openControlPanel").onclick = () => (panel.style.display = "block");
  window.closeControlPanel = () => (panel.style.display = "none");
  qs("musicVolume").oninput = (e) => (bgm.volume = parseFloat(e.target.value));
  qs("fxVolume").oninput = (e) => {
    const v = parseFloat(e.target.value);
    Object.values(sfx).forEach((a) => (a.volume = v));
  };
}

/* ==== BOOT ==== */
bestScore = Number(localStorage.getItem("bestScore") || 0);
mostLives = Number(localStorage.getItem("mostLives") || 0);
qs("best").textContent = bestScore;
qs("mostLives").textContent = mostLives;
resetGame();
loop();
