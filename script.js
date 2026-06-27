/* ═══ AUDIO ═══ */
let audioCtx = null;
function ctx() {
  return (
    audioCtx ||
    (audioCtx = new (window.AudioContext || window.webkitAudioContext)())
  );
}
function noise(dur, freq, type, vol, t) {
  const b = ctx().createBuffer(1, ctx().sampleRate * dur, ctx().sampleRate),
    d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++)
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, type);
  const s = ctx().createBufferSource();
  s.buffer = b;
  const f = ctx().createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = freq;
  const g = ctx().createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(ctx().destination);
  s.start(t);
}
function tone(freq, dur, type, vol, t) {
  const o = ctx().createOscillator(),
    g = ctx().createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(ctx().destination);
  o.start(t);
  o.stop(t + dur);
}
function playKick() {
  const t = ctx().currentTime;
  noise(0.12, 280, 3, 1.4, t);
}
function playGoal() {
  const t = ctx().currentTime;
  noise(0.18, 1200, 1.5, 1.2, t);
  [0, 0.08, 0.16].forEach((d, i) =>
    tone([440, 550, 660][i], 0.22, "sine", 0.18, t + d),
  );
}
function playSave() {
  const t = ctx().currentTime;
  noise(0.1, 900, 2, 1.0, t);
  const o = ctx().createOscillator(),
    g = ctx().createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(300, t + 0.04);
  o.frequency.exponentialRampToValueAtTime(120, t + 0.28);
  g.gain.setValueAtTime(0.12, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g);
  g.connect(ctx().destination);
  o.start(t + 0.04);
  o.stop(t + 0.3);
}
function playClick() {
  const t = ctx().currentTime;
  tone(800, 0.06, "sine", 0.08, t);
}

/* ═══ STATE ═══ */
let state = {
  goals: 0,
  saves: 0,
  round: 1,
  selected: null,
  shooting: false,
  history: [],
};

/* ═══ GOAL TARGET COORDS (% of stadium size) ═══ */
function getTargets(W, H) {
  const gl = (W - W * 0.42) / 2 + W * 0.005,
    gr = gl + W * 0.42 - W * 0.005;
  const gt = H * 0.14 + H * 0.01,
    gb = H * 0.14 + H * 0.38 - H * 0.01;
  const mx = W * 0.05,
    my = H * 0.04;
  return {
    tl: { x: gl + mx, y: gt + my },
    tr: { x: gr - mx - W * 0.03, y: gt + my },
    c: { x: (gl + gr) / 2 - W * 0.016, y: (gt + gb) / 2 - H * 0.01 },
    bl: { x: gl + mx, y: gb - my - H * 0.03 },
    br: { x: gr - mx - W * 0.03, y: gb - my - H * 0.03 },
  };
}

/* ═══ GK DIVES ═══ */
const DIVES = {
  tl: { dx: -0.16, dy: -0.14, rot: -35 },
  tr: { dx: 0.16, dy: -0.14, rot: 35 },
  c: { dx: 0, dy: -0.04, rot: 0 },
  bl: { dx: -0.15, dy: 0.03, rot: -20 },
  br: { dx: 0.15, dy: 0.03, rot: 20 },
};

/* ═══ GK AI ═══ */
function gkAI() {
  const r = Math.random(),
    dirs = ["tl", "tr", "c", "bl", "br"];
  if (r < 0.42) return "c";
  if (r < 0.62 && state.history.length)
    return state.history[state.history.length - 1];
  return dirs[Math.floor(Math.random() * dirs.length)];
}

/* ═══ ANIMATE BALL ═══ */
function animateBall(dir, cb) {
  const st = document.getElementById("stadium");
  const W = st.offsetWidth,
    H = st.offsetHeight;
  const ball = document.getElementById("ball");
  const tgts = getTargets(W, H);
  const tgt = tgts[dir];
  const bw = ball.offsetWidth;
  const sx = W / 2 - bw / 2,
    sy = H * 0.78;
  const cpx =
    sx +
    (tgt.x - sx) * 0.3 +
    (dir.includes("l") ? -W * 0.07 : dir.includes("r") ? W * 0.07 : 0);
  const cpy = sy - H * 0.28;
  const dur = dir === "c" ? 400 : 480;
  let start = null;
  ball.style.cssText = `position:absolute;left:${sx}px;top:${sy}px;width:${bw}px;height:${bw}px;pointer-events:none;opacity:1;`;
  function ease(p) {
    return p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2;
  }
  function step(ts) {
    if (!start) start = ts;
    const raw = Math.min((ts - start) / dur, 1),
      p = ease(raw);
    const inv = 1 - p;
    const bx = inv * inv * sx + 2 * inv * p * cpx + p * p * tgt.x;
    const by = inv * inv * sy + 2 * inv * p * cpy + p * p * tgt.y;
    const sc = 1 - p * 0.55;
    const rot = (dir === "c" ? 0 : dir.includes("l") ? -1 : 1) * raw * 400;
    ball.style.left = bx + "px";
    ball.style.top = by + "px";
    ball.style.transform = `scale(${sc}) rotate(${rot}deg)`;
    if (raw < 1) requestAnimationFrame(step);
    else {
      ball.style.opacity = "0";
      cb();
    }
  }
  requestAnimationFrame(step);
}

/* ═══ ANIMATE GK ═══ */
function animateGK(dir) {
  const gk = document.getElementById("gk");
  const st = document.getElementById("stadium");
  const W = st.offsetWidth,
    H = st.offsetHeight;
  const d = DIVES[dir];
  const delay = dir === "c" ? 90 : 140 + Math.random() * 110;
  setTimeout(() => {
    gk.style.transition = "transform 0.2s cubic-bezier(0.25,0.46,0.45,0.94)";
    gk.style.transform = `translateX(calc(-50% + ${d.dx * W}px)) translateY(${d.dy * H}px) rotate(${d.rot}deg)`;
  }, delay);
}
function resetGK() {
  const gk = document.getElementById("gk");
  gk.style.transition = "transform 0.45s ease";
  gk.style.transform = "translateX(-50%)";
}

/* ═══ BALL RESET ═══ */
function resetBall() {
  const st = document.getElementById("stadium");
  const W = st.offsetWidth,
    H = st.offsetHeight;
  const ball = document.getElementById("ball");
  const bw = Math.max(12, W * 0.032);
  ball.style.cssText = `position:absolute;left:${W / 2 - bw / 2}px;top:${H * 0.78}px;width:${bw}px;height:${bw}px;pointer-events:none;opacity:1;transform:none;`;
}

/* ═══ RESULT ═══ */
function showResult(isGoal) {
  const el = document.getElementById("result-display");
  el.textContent = isGoal ? "⚽ GOAL!" : "🧤 SAVED!";
  el.style.color = isGoal ? "#39ff14" : "#e74c3c";
  el.style.transition = "none";
  el.style.transform = "translate(-50%,-50%) scale(0)";
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      el.style.transition = "transform 0.32s cubic-bezier(0.34,1.56,0.64,1)";
      el.style.transform = "translate(-50%,-50%) scale(1)";
    }),
  );
  setTimeout(() => {
    el.style.transition = "transform 0.2s ease-in";
    el.style.transform = "translate(-50%,-50%) scale(0)";
  }, 1500);
  if (isGoal) shake();
  else saveFlash();
}
function shake() {
  const s = document.getElementById("stadium");
  const f = [5, -5, 4, -4, 3, -3, 1, 0];
  let i = 0;
  (function r() {
    if (i >= f.length) {
      s.style.transform = "";
      return;
    }
    s.style.transform = `translateX(${f[i++]}px)`;
    setTimeout(r, 32);
  })();
}
function saveFlash() {
  const f = document.getElementById("goal-flash");
  f.style.transition = "none";
  f.style.background = "rgba(231,76,60,0.38)";
  setTimeout(() => {
    f.style.transition = "background 0.55s ease";
    f.style.background = "rgba(255,255,255,0)";
  }, 50);
}

/* ═══ CONTROLS ═══ */
function selectDir(btn) {
  if (state.shooting) return;
  playClick();
  document
    .querySelectorAll(".dir-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  state.selected = btn.dataset.dir;
  document.getElementById("shoot-btn").disabled = false;
}
function lockControls(lock) {
  state.shooting = lock;
  document.getElementById("shoot-btn").disabled = lock;
  document
    .querySelectorAll(".dir-btn")
    .forEach((b) => (b.style.pointerEvents = lock ? "none" : "auto"));
}
function updateHUD() {
  document.getElementById("goals-val").textContent = state.goals;
  document.getElementById("saves-val").textContent = state.saves;
  document.getElementById("round-val").textContent = state.round;
}
function shoot() {
  if (!state.selected || state.shooting) return;
  playKick();
  lockControls(true);
  const dir = state.selected,
    gkDir = gkAI();
  state.history.push(dir);
  animateGK(gkDir);
  animateBall(dir, () => {
    const goal = dir !== gkDir;
    if (goal) {
      state.goals++;
      playGoal();
    } else {
      state.saves++;
      playSave();
    }
    state.round++;
    updateHUD();
    showResult(goal);
    setTimeout(() => {
      resetBall();
      resetGK();
      state.selected = null;
      document
        .querySelectorAll(".dir-btn")
        .forEach((b) => b.classList.remove("active"));
      document.getElementById("shoot-btn").disabled = true;
      lockControls(false);
    }, 1900);
  });
}
function restartGame() {
  playClick();
  state = {
    goals: 0,
    saves: 0,
    round: 1,
    selected: null,
    shooting: false,
    history: [],
  };
  updateHUD();
  resetBall();
  resetGK();
  document
    .querySelectorAll(".dir-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("shoot-btn").disabled = true;
}
function startGame() {
  playClick();
  document.getElementById("overlay").style.display = "none";
  resetBall();
}
window.addEventListener("load", resetBall);
window.addEventListener("resize", () => {
  if (!state.shooting) resetBall();
});
