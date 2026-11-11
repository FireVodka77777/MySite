/* ================== ИГРА «ГИПЕРТУННЕЛЬ» ================== */
const viewport = document.getElementById('viewport');
const world    = document.getElementById('world');
const playerEl = document.getElementById('player');
const overlay  = document.getElementById('overlay');
const scoreEl  = document.getElementById('score');
const coinsEl  = document.getElementById('coins');
const bestEl   = document.getElementById('best');
const startBtn = document.getElementById('startBtn');

const PERSPECTIVE   = 900;
const PLAYER_Z      = 200;
const PLAYER_X_MAX  = 220;
const SPAWN_Z       = -2200;
const DESPAWN_Z     = 700;
const HIT_PAD       = 60;  // запас на столкновение

let best = Number(localStorage.getItem('tunnelBest') || 0);
bestEl.textContent = best;

const state = {
  running: false,
  elapsed: 0,
  distance: 0,
  score: 0,
  coins: 0,
  speed: 800,
  playerX: 0,
  keys: { left: false, right: false },
  entities: [],
  nextObstacle: 0,
  nextCoin: 0,
  nextRing: 0,
  lastTime: 0,
  rafId: 0,
};

function makeEntity(type, x = 0, z = SPAWN_Z) {
  const el = document.createElement('div');
  el.className = 'entity ' + type;
  world.appendChild(el);
  const o = { type, el, x, z };
  applyTransform(o);
  state.entities.push(o);
  return o;
}

function applyTransform(o) {
  o.el.style.transform = `translate3d(${o.x}px, 0, ${o.z}px)`;
  // плавное «появление из тумана»
  const a = (o.z + 2200) / 1100;
  o.el.style.opacity = Math.max(0, Math.min(1, a));
}

function resetGame() {
  state.entities.forEach(e => e.el.remove());
  state.entities = [];
  Object.assign(state, {
    running: true,
    elapsed: 0,
    distance: 0,
    score: 0,
    coins: 0,
    speed: 800,
    playerX: 0,
    nextObstacle: 500,
    nextCoin: 1400,
    nextRing: 0,
    lastTime: performance.now(),
  });
  scoreEl.textContent = 0;
  coinsEl.textContent = 0;
  playerEl.style.transform = `translate3d(0, 0, ${PLAYER_Z}px)`;
  overlay.classList.add('hidden');
  startBtn.disabled = true;
  startBtn.textContent = 'Игра идёт…';
  state.rafId = requestAnimationFrame(loop);
}

function loop(t) {
  if (!state.running) return;

  const dt = Math.min((t - state.lastTime) / 1000, 0.05);
  state.lastTime = t;
  state.elapsed += dt;
  state.speed = Math.min(2400, 800 + state.elapsed * 45);

  const dist = state.speed * dt;
  state.distance += dist;

  /* движение игрока (клавиши) */
  let pv = 0;
  if (state.keys.left)  pv -= 1;
  if (state.keys.right) pv += 1;
  state.playerX += pv * 650 * dt;
  state.playerX = Math.max(-PLAYER_X_MAX, Math.min(PLAYER_X_MAX, state.playerX));
  playerEl.style.transform = `translate3d(${state.playerX}px, 0, ${PLAYER_Z}px)`;

  /* обновляем все сущности */
  for (let i = state.entities.length - 1; i >= 0; i--) {
    const o = state.entities[i];
    o.z += dist;

    if (o.z > DESPAWN_Z) {
      o.el.remove();
      state.entities.splice(i, 1);
      continue;
    }
    applyTransform(o);

    /* проверка столкновений/сбора только рядом с игроком */
    if (Math.abs(o.z - PLAYER_Z) < 130) {
      const dx = Math.abs(o.x - state.playerX);

      if (o.type === 'coin' && dx < HIT_PAD - 10) {
        state.coins++;
        coinsEl.textContent = state.coins;
        burstAt(o);
        o.el.remove();
        state.entities.splice(i, 1);
        continue;
      }
      if (o.type === 'obstacle' && dx < HIT_PAD) {
        gameOver();
        return;
      }
    }
  }

  /* спавн по дистанции */
  state.nextObstacle -= dist;
  if (state.nextObstacle <= 0) {
    spawnObstacle();
    state.nextObstacle = Math.max(320, 850 - state.elapsed * 8) + Math.random() * 250;
  }
  state.nextCoin -= dist;
  if (state.nextCoin <= 0) {
    spawnCoin();
    state.nextCoin = 1200 + Math.random() * 900;
  }
  state.nextRing -= dist;
  if (state.nextRing <= 0) {
    makeEntity('ring', 0, SPAWN_Z);
    state.nextRing = 250;
  }

  /* счёт = дистанция + бонус за звёзды */
  const s = Math.floor(state.distance / 40) + state.coins * 25;
  if (s !== state.score) {
    state.score = s;
    scoreEl.textContent = s;
  }

  state.rafId = requestAnimationFrame(loop);
}

function spawnObstacle() {
  const x = (Math.random() * 2 - 1) * (PLAYER_X_MAX - 30);
  makeEntity('obstacle', x, SPAWN_Z);
}
function spawnCoin() {
  const x = (Math.random() * 2 - 1) * (PLAYER_X_MAX - 30);
  makeEntity('coin', x, SPAWN_Z);
}

function gameOver() {
  state.running = false;
  cancelAnimationFrame(state.rafId);
  state.entities.forEach(e => e.el.remove());
  state.entities = [];

  if (state.score > best) {
    best = state.score;
    localStorage.setItem('tunnelBest', best);
    bestEl.textContent = best;
    overlay.innerHTML =
      `🏆 Новый рекорд: <b>${state.score}</b>!<br><small>Звёзд: ${state.coins}</small>`;
  } else {
    overlay.innerHTML =
      `💥 Игра окончена!<br>Очки: <b>${state.score}</b> · Звёзд: ${state.coins}`;
  }
  overlay.classList.remove('hidden');
  startBtn.disabled = false;
  startBtn.textContent = 'Играть снова';
}

/* вспышка частиц при сборе звезды */
function burstAt(o) {
  const rect = viewport.getBoundingClientRect();
  const scale = PERSPECTIVE / (PERSPECTIVE - o.z);
  const cx = rect.left + rect.width / 2 + o.x * scale;
  const cy = rect.top  + rect.height / 2;
  for (let i = 0; i < 7; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = cx + 'px';
    p.style.top  = cy + 'px';
    const angle = Math.random() * Math.PI * 2;
    const d = 30 + Math.random() * 55;
    p.style.setProperty('--tx', Math.cos(angle) * d + 'px');
    p.style.setProperty('--ty', Math.sin(angle) * d + 'px');
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 620);
  }
}

/* ---- управление ---- */
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft'  || k === 'a') state.keys.left  = true;
  if (k === 'arrowright' || k === 'd') state.keys.right = true;
});
document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft'  || k === 'a') state.keys.left  = false;
  if (k === 'arrowright' || k === 'd') state.keys.right = false;
});

viewport.addEventListener('pointermove', e => {
  if (!state.running) return;
  const rect = viewport.getBoundingClientRect();
  const rel = (e.clientX - rect.left) / rect.width;      // 0..1
  state.playerX = (rel * 2 - 1) * PLAYER_X_MAX;          // -max..+max
});

startBtn.addEventListener('click', () => {
  if (!state.running) resetGame();
});