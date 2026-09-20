async function api(path, body) {
  const opts = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { headers: { 'Content-Type': 'application/json' } };
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const RAR = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legend: 'Легендарный'
};

const CATS = {
  status: ['Статусы', '🎖'],
  transport: ['Транспорт', '🚗'],
  property: ['Недвижимость', '🏠'],
  money: ['Валюта', '💰'],
  items: ['Предметы', '🎒'],
  bonus: ['Бонусы', '🎟']
};

const toast = document.getElementById('toast');
let toastTimer;
function showToast(text) {
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

document.getElementById('burger').addEventListener('click', () => document.getElementById('nav').classList.toggle('open'));

const strip = document.getElementById('roul-strip');
const win_ = document.getElementById('roul-window');
const spinBtn = document.getElementById('spin-btn');
const demoBtn = document.getElementById('demo-btn');
const fastTgl = document.getElementById('fast-tgl');
const soundTgl = document.getElementById('sound-tgl');
const caseSelect = document.getElementById('case-select');

const STRIP_COUNT = 58;
const WIN_INDEX = 44;

let cases = [];
let activeCase = null;
let dailyFree = false;
let nextFreeAt = null;
let streak = 0;
let bonusSpins = 0;
let user = null;
let balance = 0;
let spinning = false;
let fastOn = localStorage.getItem('nexonFast') === '1';
let soundOn = localStorage.getItem('nexonSound') !== '0';

fastTgl.checked = fastOn;
soundTgl.checked = soundOn;
fastTgl.addEventListener('change', () => { fastOn = fastTgl.checked; localStorage.setItem('nexonFast', fastOn ? '1' : '0'); });
soundTgl.addEventListener('change', () => { soundOn = soundTgl.checked; localStorage.setItem('nexonSound', soundOn ? '1' : '0'); });

let audioCtx;
function ac() {
  if (!soundOn) return null;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { return null; }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq, dur, type, vol, delay, slideTo) {
  const ctx = ac();
  if (!ctx) return;
  const t = ctx.currentTime + (delay || 0);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol || 0.06, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function noise(dur, vol, bandFreq, q, delay) {
  const ctx = ac();
  if (!ctx) return;
  const t = ctx.currentTime + (delay || 0);
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = bandFreq || 3000;
  f.Q.value = q || 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function tickSound() {
  const f = 1250 + Math.random() * 180;
  tone(f, 0.035, 'sine', 0.09);
  tone(f * 0.72, 0.03, 'sine', 0.03);
  tone(150, 0.05, 'sine', 0.055);
}

function startSound() {
  tone(180, 0.5, 'sawtooth', 0.028, 0, 720);
  tone(90, 0.5, 'sine', 0.05, 0, 360);
  noise(0.3, 0.025, 1400, 0.8);
}

function stopSound() {
  tone(220, 0.12, 'sine', 0.09);
  tone(110, 0.16, 'sine', 0.07, 0.02);
  tone(880, 0.05, 'sine', 0.04);
}

function coinShower(count, start, gap, vol) {
  for (let i = 0; i < count; i++) {
    tone(1500 + Math.random() * 1200, 0.08, 'triangle', vol, start + i * gap + Math.random() * 0.03);
  }
}

function winSound(rarity) {
  if (rarity === 'legend') {
    tone(523, 0.2, 'square', 0.03, 0);
    tone(659, 0.2, 'square', 0.03, 0.02);
    tone(784, 0.2, 'square', 0.03, 0.04);
    tone(1047, 0.2, 'square', 0.03, 0.24);
    tone(784, 0.18, 'square', 0.03, 0.44);
    tone(1047, 0.18, 'square', 0.03, 0.58);
    tone(1319, 0.7, 'square', 0.032, 0.72);
    tone(2093, 0.6, 'sine', 0.028, 0.74);
    tone(65, 0.8, 'sine', 0.11, 0.24);
    coinShower(12, 0.9, 0.06, 0.03);
  } else if (rarity === 'epic') {
    tone(659, 0.12, 'square', 0.026, 0);
    tone(831, 0.12, 'square', 0.026, 0.1);
    tone(988, 0.16, 'square', 0.03, 0.2);
    tone(1319, 0.5, 'square', 0.032, 0.3);
    tone(2637, 0.4, 'sine', 0.02, 0.32);
    tone(165, 0.45, 'sine', 0.07, 0.3);
    coinShower(6, 0.55, 0.06, 0.026);
  } else if (rarity === 'rare') {
    coinShower(7, 0, 0.055, 0.03);
    tone(523, 0.14, 'triangle', 0.05, 0);
    tone(784, 0.35, 'triangle', 0.06, 0.12);
    tone(1568, 0.3, 'sine', 0.022, 0.14);
  } else {
    tone(880, 0.12, 'sine', 0.05, 0);
    tone(1174, 0.22, 'sine', 0.045, 0.09);
  }
}

function scheduleTicks(duration) {
  let elapsed = 0;
  let stopped = false;
  function next() {
    if (stopped || elapsed >= duration - 80) return;
    tickSound();
    const p = elapsed / duration;
    const delay = 42 + Math.pow(p, 2.2) * 400;
    elapsed += delay;
    setTimeout(next, delay);
  }
  setTimeout(next, 60);
  return () => { stopped = true; };
}

function pluralDays(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня';
  return 'дней';
}

function fmtHMS(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor(s % 3600 / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h + ':' + m + ':' + ss;
}

function renderCases() {
  caseSelect.innerHTML = cases.map(c =>
    '<button class="case-card' + (activeCase && activeCase.id === c.id ? ' selected' : '') + '" data-case="' + c.id + '" style="--acc:' + (c.accent || '#35a2ff') + '">' +
      (c.freeDaily ? '<span class="case-free">бесплатно / день</span>' : '') +
      '<img src="img/' + esc(c.img || 'case-standard.svg') + '" alt="">' +
      '<h4>' + esc(c.icon || '') + ' ' + esc(c.title) + '</h4>' +
      '<span class="case-cost">' + (c.cost > 0 ? c.cost + ' ₽' : 'бесплатно') + '</span>' +
    '</button>'
  ).join('');
  caseSelect.querySelectorAll('[data-case]').forEach(b => b.addEventListener('click', () => {
    if (spinning) return;
    activeCase = cases.find(c => c.id === Number(b.dataset.case));
    renderCases();
    renderStrip(null);
    renderChances();
    updateUI();
  }));
}

function updateUI() {
  document.getElementById('roul-balance').textContent = balance + ' ₽';
  const fb = document.getElementById('roul-free');
  const cd = document.getElementById('roul-cd');
  const bn = document.getElementById('roul-bonus');
  const stEl = document.getElementById('roul-streak');
  const isDaily = activeCase && activeCase.freeDaily;
  fb.hidden = !user || !isDaily || !dailyFree;
  cd.hidden = !user || !isDaily || dailyFree || !nextFreeAt;
  bn.hidden = !user || !bonusSpins;
  if (bonusSpins) bn.textContent = '🎟 Бонусных прокрутов: ' + bonusSpins;
  stEl.hidden = !user || !streak;
  if (streak) stEl.textContent = '🔥 ' + streak + ' ' + pluralDays(streak) + ' подряд';
  if (!user) spinBtn.textContent = 'Войти и крутить';
  else if (isDaily && dailyFree) spinBtn.textContent = '🎁 Бесплатный прокрут';
  else if (bonusSpins > 0) spinBtn.textContent = '🎟 Бонусный прокрут (' + bonusSpins + ')';
  else spinBtn.textContent = 'Крутить за ' + (activeCase ? activeCase.cost : 99) + ' ₽';
  win_.style.setProperty('--acc', activeCase ? (activeCase.accent || '#35a2ff') : '#35a2ff');
}

setInterval(() => {
  if (dailyFree || !nextFreeAt) return;
  const rem = new Date(nextFreeAt).getTime() - Date.now();
  if (rem <= 0) {
    dailyFree = true;
    nextFreeAt = null;
    updateUI();
    showToast('🎁 Бесплатный прокрут снова доступен!');
    return;
  }
  document.getElementById('roul-cd').textContent = '⏳ Бесплатный через ' + fmtHMS(rem);
}, 1000);

function itemHTML(p) {
  const visual = p.img
    ? '<img class="rimg" src="img/' + esc(p.img) + '" alt="" loading="lazy">'
    : '<div class="ric">' + esc(p.icon || '🎁') + '</div>';
  return '<div class="roul-item r-' + p.rarity + '" data-prize="' + p.id + '">' +
    visual +
    '<div class="rt">' + esc(p.title) + '</div>' +
    '<div class="rc">' + RAR[p.rarity] + '</div>' +
    '</div>';
}

function weightedPick() {
  const pool = activeCase ? activeCase.prizes : [];
  const total = pool.reduce((s, p) => s + (Number(p.chance) || 0), 0);
  let roll = Math.random() * total;
  for (const p of pool) { roll -= Number(p.chance) || 0; if (roll <= 0) return p; }
  return pool[0];
}

function renderStrip(winnerId) {
  const pool = activeCase ? activeCase.prizes : [];
  let html = '';
  for (let i = 0; i < STRIP_COUNT; i++) {
    let p = weightedPick();
    if (i === WIN_INDEX && winnerId != null) {
      p = pool.find(x => x.id === winnerId) || p;
    }
    html += itemHTML(p);
  }
  strip.innerHTML = html;
}

function stepWidth() {
  const items = strip.children;
  if (items.length < 2) return 134;
  return items[1].offsetLeft - items[0].offsetLeft;
}

function renderChances() {
  const prizes = activeCase ? activeCase.prizes : [];
  const groups = {};
  for (const p of prizes) {
    const k = p.category && CATS[p.category] ? p.category : 'items';
    (groups[k] = groups[k] || []).push(p);
  }
  const order = Object.keys(CATS).filter(k => groups[k] && groups[k].length);
  document.getElementById('chances').innerHTML = order.map(k =>
    '<div class="chance-cat full-span">' + CATS[k][1] + ' ' + CATS[k][0] + '</div>' +
    groups[k].map(p =>
      '<div class="chance"><span class="ch-l">' + (p.img ? '<img src="img/' + esc(p.img) + '" alt="">' : esc(p.icon || '🎁')) + ' ' + esc(p.title) + '</span>' +
      '<span class="rare-line r-' + p.rarity + '"><i class="dot-' + p.rarity + '"></i>' + RAR[p.rarity] + ' • <b>' + p.chance + '%</b></span></div>'
    ).join('')
  ).join('');
}

function renderHistory(h) {
  const el = document.getElementById('hist');
  if (!h || !h.length) { el.innerHTML = '<li class="empty">Пока никто не крутил — будь первым!</li>'; return; }
  el.innerHTML = h.map(s =>
    '<li><span class="l">' + esc(s.login) + ' → <b class="hl-' + s.rarity + '">' + esc(s.prize) + '</b></span><span class="l">' + fmtDate(s.date) + '</span></li>'
  ).join('');
}

async function loadInfo(skipStrip) {
  const d = await api('/api/roulette/info');
  cases = d.cases;
  if (!activeCase || !cases.some(c => c.id === activeCase.id)) activeCase = cases[0] || null;
  dailyFree = d.dailyFree;
  nextFreeAt = d.nextFreeAt;
  streak = d.streak;
  bonusSpins = d.bonusSpins || 0;
  user = d.user;
  balance = d.balance;
  renderCases();
  if (!skipStrip) renderStrip(null);
  renderChances();
  renderHistory(d.history);
  updateUI();
}

async function renderAuth() {
  const area = document.getElementById('auth-area');
  if (user) {
    area.innerHTML =
      '<span class="user-chip">👤 ' + esc(user.nick || user.login) + '</span>' +
      (user.role === 'admin' ? '<a class="user-chip admin-chip" href="admin.html">Админка</a>' : '') +
      '<button class="btn btn-ghost btn-sm" id="logout-btn">Выйти</button>';
    document.getElementById('logout-btn').addEventListener('click', async () => {
      try { await api('/api/logout', {}); } catch (e) {}
      location.href = 'index.html';
    });
  } else {
    area.innerHTML = '<a class="btn btn-red btn-sm" href="index.html">Войти</a>';
  }
}

function openModal(id) {
  const m = document.getElementById(id);
  m.hidden = false;
  requestAnimationFrame(() => m.classList.add('open'));
}

function closeModal(id) {
  const m = document.getElementById(id);
  m.classList.remove('open');
  setTimeout(() => { m.hidden = true; }, 200);
}

document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
document.getElementById('win-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal('win-modal');
});

function confetti(rarity) {
  const cv = document.getElementById('confetti');
  const rect = cv.parentElement.getBoundingClientRect();
  cv.width = rect.width;
  cv.height = rect.height;
  const ctx = cv.getContext('2d');
  const colors = {
    rare: ['53,162,255', '159,230,255'],
    epic: ['179,102,255', '220,180,255', '53,162,255'],
    legend: ['255,176,58', '255,230,160', '255,120,60']
  }[rarity] || ['53,162,255'];
  const parts = [];
  for (let i = 0; i < 90; i++) {
    parts.push({
      x: rect.width / 2 + (Math.random() - 0.5) * 140,
      y: rect.height * 0.32,
      vx: (Math.random() - 0.5) * 10,
      vy: -Math.random() * 8 - 3,
      w: 4 + Math.random() * 5,
      h: 6 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      c: colors[Math.random() * colors.length | 0],
      life: 1
    });
  }
  let t0 = performance.now();
  (function frame(t) {
    const dt = Math.min((t - t0) / 1000, 0.05);
    t0 = t;
    ctx.clearRect(0, 0, cv.width, cv.height);
    let alive = false;
    for (const p of parts) {
      p.life -= dt * 0.45;
      if (p.life <= 0) continue;
      alive = true;
      p.vy += 26 * dt;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = 'rgba(' + p.c + ',' + Math.min(p.life, 1).toFixed(2) + ')';
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (alive) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, cv.width, cv.height);
  })(performance.now());
}

function showWin(prize, opts) {
  opts = opts || {};
  const visual = prize.img
    ? '<img class="win-img r-' + prize.rarity + '" src="img/' + esc(prize.img) + '" alt="">'
    : '<div class="win-big r-' + prize.rarity + '">' + esc(prize.icon || '🎁') + '</div>';
  let note;
  if (opts.demo) {
    note = 'Демо-режим: приз не начислен. ' + (user ? 'Крути по-настоящему!' : 'Войди в аккаунт и крути по-настоящему!');
  } else if (opts.usedBonus) {
    note = '🎟 Бонусный прокрут • приз уже на твоём аккаунте';
  } else if (opts.lucky) {
    note = '🎉 Счастливый прокрут за стрик ' + streak + ' ' + pluralDays(streak) + ' — только редкие призы!';
  } else if (opts.wasFree) {
    note = 'Бесплатный прокрут • приз уже на твоём аккаунте';
  } else {
    note = 'Прокрут за ' + opts.paid + ' ₽ • приз уже на твоём аккаунте';
  }
  document.getElementById('win-content').innerHTML =
    visual +
    '<div class="win-label">' + (opts.demo ? 'ДЕМО-ПРОКРУТ' : 'ТЫ ВЫИГРАЛ') + '</div>' +
    '<div class="win-title">' + esc(prize.title) + '</div>' +
    '<div class="win-rar r-' + prize.rarity + '">' + RAR[prize.rarity] + (opts.lucky ? ' • LUCKY' : '') + '</div>' +
    '<p class="form-note">' + note + '</p>' +
    '<button class="btn btn-red btn-block" id="win-ok">' + (opts.demo ? 'Понятно' : 'Забрать') + '</button>';
  document.getElementById('win-ok').addEventListener('click', () => closeModal('win-modal'));
  openModal('win-modal');
  winSound(prize.rarity);
  if (prize.rarity !== 'common') confetti(prize.rarity);
}

async function doSpin(demo) {
  if (spinning || !activeCase) return;
  if (!demo && !user) {
    showToast('Сначала войди в аккаунт');
    setTimeout(() => location.href = 'index.html', 900);
    return;
  }
  spinning = true;
  spinBtn.disabled = true;
  demoBtn.disabled = true;
  spinBtn.textContent = 'Крутим…';

  const duration = fastOn ? 1700 : 6500;
  const curve = fastOn ? 'cubic-bezier(.15, .7, .2, 1)' : 'cubic-bezier(.08, .72, .12, 1)';

  let data = null;
  let prize;
  if (demo) {
    prize = weightedPick();
  } else {
    try {
      data = await api('/api/roulette/spin', { caseId: activeCase.id });
      prize = data.prize;
    } catch (ex) {
      showToast(ex.message);
      spinning = false;
      spinBtn.disabled = false;
      demoBtn.disabled = false;
      updateUI();
      return;
    }
  }

  renderStrip(prize.id);
  const step = stepWidth();
  const jitter = (Math.random() * 0.5 - 0.25) * step;
  const offset = WIN_INDEX * step + step / 2 - win_.clientWidth / 2 + jitter;
  strip.style.transition = 'none';
  strip.style.transform = 'translateX(0)';
  strip.style.filter = 'blur(0px)';
  void strip.offsetWidth;
  strip.style.transition = 'filter 0.4s, transform ' + duration + 'ms ' + curve;
  strip.style.filter = 'blur(3px)';
  strip.style.transform = 'translateX(' + (-offset) + 'px)';
  setTimeout(() => { strip.style.transition = 'filter 0.7s'; strip.style.filter = 'blur(0px)'; }, duration * 0.62);
  const stopTicks = scheduleTicks(duration);
  startSound();

  setTimeout(() => {
    stopTicks();
    stopSound();
    const winItem = strip.children[WIN_INDEX];
    if (winItem) winItem.classList.add('win');
    if (!demo && data) {
      balance = data.balance;
      dailyFree = false;
      nextFreeAt = data.nextFreeAt;
      streak = data.streak;
      bonusSpins = data.bonusSpins || 0;
    }
    if (prize.rarity === 'legend' || prize.rarity === 'epic') {
      win_.classList.add('shake');
      setTimeout(() => win_.classList.remove('shake'), 600);
    }
    updateUI();
    showWin(prize, { demo, lucky: data && data.lucky, wasFree: data && data.free && !data.usedBonus, usedBonus: data && data.usedBonus, paid: data && data.cost });
    spinning = false;
    spinBtn.disabled = false;
    demoBtn.disabled = false;
    if (!demo) loadInfo(true).catch(() => {});
  }, duration + 100);
}

spinBtn.addEventListener('click', () => doSpin(false));
demoBtn.addEventListener('click', () => doSpin(true));

(async () => {
  try {
    await loadInfo();
    await renderAuth();
  } catch (e) {
    showToast('Ошибка загрузки рулетки');
  }
})();
