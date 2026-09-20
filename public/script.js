const SITE = {
  ip: 'nexon-rp.ru:7777',
  maxPlayers: 500,
  baseOnline: 247,
  plans: [],
  promo: null,
  promoCode: ''
};

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

const topbar = document.getElementById('topbar');
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
const toast = document.getElementById('toast');
let toastTimer;

burger.addEventListener('click', () => nav.classList.toggle('open'));
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

window.addEventListener('scroll', () => {
  topbar.classList.toggle('scrolled', window.scrollY > 10);
});

const heroBg = document.querySelector('.hero-bg');
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  if (y <= window.innerHeight) heroBg.style.transform = 'translate3d(0, ' + y * 0.25 + 'px, 0)';
}, { passive: true });

function showToast(text) {
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

function copyIp() {
  navigator.clipboard.writeText(SITE.ip).then(() => {
    showToast('IP скопирован: ' + SITE.ip);
  }).catch(() => {
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('server-ip'));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    showToast('Выдели IP и скопируй: ' + SITE.ip);
  });
}

document.getElementById('copy-ip').addEventListener('click', copyIp);
document.querySelectorAll('.copy-again').forEach(b => b.addEventListener('click', copyIp));

function setOnline(online, max) {
  document.getElementById('topbar-online').textContent = online;
  document.getElementById('monitor-online').textContent = online;
  document.getElementById('topbar-max').textContent = max;
  document.getElementById('monitor-max').textContent = max;
  const el = document.getElementById('stat-online');
  if (el) { el.dataset.count = online; el.textContent = online.toLocaleString('ru-RU'); }
  document.getElementById('progress-fill').style.width = Math.round(online / max * 100) + '%';
}

const counters = document.querySelectorAll('[data-count]');
const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = parseInt(el.dataset.count, 10);
    const duration = 1400;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.floor(eased * target).toLocaleString('ru-RU');
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    counterObserver.unobserve(el);
  });
}, { threshold: 0.4 });
counters.forEach(c => counterObserver.observe(c));

const progressFill = document.getElementById('progress-fill');
const progressObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    progressFill.style.width = Math.round(SITE.baseOnline / SITE.maxPlayers * 100) + '%';
    progressObserver.unobserve(entry.target);
  });
}, { threshold: 0.4 });
progressObserver.observe(progressFill);

const sections = [...document.querySelectorAll('section[id]')];
window.addEventListener('scroll', () => {
  const pos = window.scrollY + 120;
  let current = '';
  sections.forEach(s => { if (pos >= s.offsetTop) current = s.id; });
  nav.querySelectorAll('a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + current);
  });
}, { passive: true });

setInterval(() => {
  const delta = Math.floor(Math.random() * 7) - 3;
  const online = Math.max(10, Math.min(SITE.maxPlayers, SITE.baseOnline + delta));
  SITE.baseOnline = online;
  document.getElementById('topbar-online').textContent = online;
  document.getElementById('monitor-online').textContent = online;
  progressFill.style.width = Math.round(online / SITE.maxPlayers * 100) + '%';
}, 5000);

document.getElementById('year').textContent = new Date().getFullYear();

const roleEl = document.getElementById('role-word');
const roles = ['таксистом', 'дальнобойщиком', 'боссом мафии', 'офицером LSPD', 'уличным гонщиком', 'владельцем казино', 'легендой города'];
let roleIdx = 0;
setInterval(() => {
  roleEl.classList.add('out');
  setTimeout(() => {
    roleIdx = (roleIdx + 1) % roles.length;
    roleEl.textContent = roles[roleIdx];
    roleEl.classList.remove('out');
  }, 300);
}, 2400);

const revealEls = document.querySelectorAll('.section-head, .grid, .monitor, .rules-list');
revealEls.forEach(el => el.classList.add('reveal'));
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('on');
    revealObs.unobserve(en.target);
  });
}, { threshold: 0.12 });
revealEls.forEach(el => revealObs.observe(el));

document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
});

let currentUser = null;

function renderAuth() {
  const area = document.getElementById('auth-area');
  if (currentUser) {
    area.innerHTML =
      '<a class="user-chip" href="cabinet.html" title="Личный кабинет">👤 ' + esc(currentUser.nick || currentUser.login) + '</a>' +
      (currentUser.role === 'admin' ? '<a class="user-chip admin-chip" href="admin.html">Админка</a>' : '') +
      '<button class="btn btn-ghost btn-sm" id="logout-btn">Выйти</button>';
    document.getElementById('logout-btn').addEventListener('click', async () => {
      try { await api('/api/logout', {}); } catch (e) {}
      currentUser = null;
      renderAuth();
      showToast('Ты вышел из аккаунта');
    });
  } else {
    area.innerHTML =
      '<button class="btn btn-ghost btn-sm" id="login-btn">Вход</button>' +
      '<button class="btn btn-red btn-sm" id="register-btn">Регистрация</button>';
    document.getElementById('login-btn').addEventListener('click', () => openAuth('login'));
    document.getElementById('register-btn').addEventListener('click', () => openAuth('register'));
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
document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => {
  if (e.target === m) closeModal(m.id);
}));
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay:not([hidden])').forEach(m => closeModal(m.id));
});

function openAuth(mode) {
  document.getElementById('login-form').hidden = mode !== 'login';
  document.getElementById('register-form').hidden = mode !== 'register';
  document.getElementById('auth-title').textContent = mode === 'login' ? 'Вход' : 'Регистрация';
  document.getElementById('login-error').textContent = '';
  document.getElementById('register-error').textContent = '';
  openModal('auth-modal');
}

document.getElementById('to-register').addEventListener('click', e => { e.preventDefault(); openAuth('register'); });
document.getElementById('to-login').addEventListener('click', e => { e.preventDefault(); openAuth('login'); });

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const err = document.getElementById('login-error');
  err.textContent = '';
  const f = e.target;
  try {
    const data = await api('/api/login', { login: f.login.value, password: f.password.value });
    currentUser = data.user;
    renderAuth();
    closeModal('auth-modal');
    f.reset();
    showToast('С возвращением, ' + (currentUser.nick || currentUser.login) + '!');
  } catch (ex) {
    err.textContent = ex.message;
  }
});

document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const err = document.getElementById('register-error');
  err.textContent = '';
  const f = e.target;
  if (f.password.value !== f.password2.value) {
    err.textContent = 'Пароли не совпадают';
    return;
  }
  try {
    const data = await api('/api/register', { login: f.login.value, password: f.password.value, nick: f.nick.value });
    currentUser = data.user;
    renderAuth();
    closeModal('auth-modal');
    f.reset();
    showToast('Аккаунт создан! Добро пожаловать, ' + (currentUser.nick || currentUser.login) + '!');
  } catch (ex) {
    err.textContent = ex.message;
  }
});

let orderPlan = null;

document.getElementById('order-form').addEventListener('submit', async e => {
  e.preventDefault();
  const err = document.getElementById('order-error');
  err.textContent = '';
  const f = e.target;
  try {
    await api('/api/order', { planId: orderPlan.id, nick: f.nick.value, promo: f.promo.value });
    closeModal('order-modal');
    showToast('Заявка отправлена! Жди подтверждения в личном кабинете');
    f.reset();
  } catch (ex) {
    err.textContent = ex.message;
  }
});

function openOrder(plan) {
  orderPlan = plan;
  document.getElementById('order-plan-name').textContent = plan.title;
  document.getElementById('order-price').textContent = plan.price + ' ₽';
  document.getElementById('order-error').textContent = '';
  const nickInput = document.getElementById('order-nick');
  nickInput.value = currentUser ? (currentUser.nick || currentUser.login) : '';
  openModal('order-modal');
}

function renderPlans(plans) {
  const grid = document.getElementById('donate-grid');
  grid.innerHTML = plans.map(p =>
    '<div class="card donate-card' + (p.popular ? ' featured' : '') + '">' +
      (p.popular ? '<div class="badge">Хит</div>' : '') +
      '<h3>' + esc(p.title) + '</h3><div class="price">' + Number(p.price) + ' ₽</div>' +
      '<ul>' + p.perks.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
      '<span class="plan-days">' + Number(p.days) + ' дней</span>' +
      '<button class="btn ' + (p.popular ? 'btn-red' : 'btn-ghost') + ' donate-btn" data-id="' + p.id + '">Купить</button>' +
    '</div>'
  ).join('');
  grid.querySelectorAll('.donate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = SITE.plans.find(p => p.id === Number(btn.dataset.id));
      if (!plan) return;
      if (!currentUser) {
        showToast('Сначала войди в аккаунт');
        openAuth('login');
        return;
      }
      openOrder(plan);
    });
  });
}

function renderRules(rules) {
  document.getElementById('rules-list').innerHTML = rules.map(r =>
    '<div class="rule"><b>' + esc(r.title) + '</b><span>' + esc(r.text) + '</span></div>'
  ).join('');
}

function renderNews(news) {
  document.getElementById('news-grid').innerHTML = news.map(n =>
    '<article class="card news-card">' +
      '<time>' + esc(n.date.split('-').reverse().join('.')) + (n.pinned ? ' 📌' : '') + '</time>' +
      '<h3>' + esc(n.title) + '</h3><p>' + esc(n.text) + '</p>' +
    '</article>'
  ).join('');
}

function renderTop(d) {
  const medals = ['🥇', '🥈', '🥉'];
  const rich = document.getElementById('top-rich');
  const lucky = document.getElementById('top-lucky');
  if (rich) {
    rich.innerHTML = d.rich.length ? d.rich.map((u, i) =>
      '<li><span>' + (medals[i] || (i + 1) + '.') + ' ' + esc(u.nick) + '</span><b>' + Number(u.balance).toLocaleString('ru-RU') + ' ₽</b></li>'
    ).join('') : '<li class="empty">Пока пусто — стань первым!</li>';
  }
  if (lucky) {
    lucky.innerHTML = d.lucky.length ? d.lucky.map((u, i) =>
      '<li><span>' + (medals[i] || (i + 1) + '.') + ' ' + esc(u.nick) + '</span><b>' + u.rare + ' редких • ' + u.wins + ' спинов</b></li>'
    ).join('') : '<li class="empty">Пока никто не крутил рулетку</li>';
  }
}

async function boot() {
  try {
    const me = await api('/api/me');
    currentUser = me.user;
  } catch (e) {}
  renderAuth();
  try {
    const data = await api('/api/site');
    SITE.ip = data.settings.serverIp;
    SITE.maxPlayers = data.monitor.max;
    SITE.baseOnline = data.monitor.players;
    SITE.plans = data.plans;
    SITE.promo = data.settings.promo;
    document.getElementById('server-ip').textContent = SITE.ip;
    document.getElementById('step-ip').textContent = SITE.ip;
    document.getElementById('mon-name').textContent = data.monitor.name;
    document.getElementById('mon-mode').textContent = data.monitor.mode;
    document.getElementById('mon-map').textContent = data.monitor.map;
    document.getElementById('mon-version').textContent = data.monitor.version;
    const acc = document.getElementById('stat-accounts');
    if (acc) { acc.dataset.count = data.accounts; acc.textContent = data.accounts.toLocaleString('ru-RU'); }
    setOnline(data.monitor.players, data.monitor.max);
    if (data.settings.vk) document.getElementById('footer-vk').href = data.settings.vk;
    if (data.settings.discord) document.getElementById('footer-discord').href = 'https://' + data.settings.discord.replace(/^https?:\/\//, '');
    renderPlans(data.plans);
    renderRules(data.rules);
    renderNews(data.news);
  } catch (e) {
    showToast('Не удалось загрузить данные сервера');
  }
  try {
    renderTop(await api('/api/leaderboard'));
  } catch (e) {}
}

boot();

const motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (motionOK) {
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');
  let W, H;
  const dots = [];
  let meteors = [];
  let lastMeteor = 0;

  function fxResize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }
  window.addEventListener('resize', fxResize);
  fxResize();

  for (let i = 0; i < 70; i++) {
    dots.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.8 + 0.6,
      vy: -(Math.random() * 0.22 + 0.06),
      sway: Math.random() * Math.PI * 2,
      swaySpeed: Math.random() * 0.012 + 0.004,
      a: Math.random() * 0.5 + 0.25,
      tw: Math.random() * Math.PI * 2,
      hue: Math.random() > 0.5 ? '159,230,255' : '53,162,255'
    });
  }

  function fxFrame(t) {
    ctx.clearRect(0, 0, W, H);
    for (const d of dots) {
      d.y += d.vy;
      d.sway += d.swaySpeed;
      d.tw += 0.03;
      if (d.y < -10) { d.y = H + 10; d.x = Math.random() * W; }
      const x = d.x + Math.sin(d.sway) * 18;
      const alpha = d.a * (0.6 + 0.4 * Math.sin(d.tw));
      ctx.beginPath();
      ctx.arc(x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + d.hue + ',' + alpha.toFixed(3) + ')';
      ctx.shadowColor = 'rgba(' + d.hue + ',0.9)';
      ctx.shadowBlur = 8;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    if (t - lastMeteor > 4000 + Math.random() * 5000) {
      lastMeteor = t;
      meteors.push({
        x: Math.random() * W * 0.6 + W * 0.2,
        y: -20,
        vx: -(Math.random() * 3 + 3),
        vy: Math.random() * 2 + 2.5,
        life: 1
      });
    }
    meteors = meteors.filter(m => m.life > 0);
    for (const m of meteors) {
      m.x += m.vx;
      m.y += m.vy;
      m.life -= 0.012;
      const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 14, m.y - m.vy * 14);
      grad.addColorStop(0, 'rgba(223,243,255,' + Math.max(m.life, 0).toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(53,162,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * 14, m.y - m.vy * 14);
      ctx.stroke();
    }
    requestAnimationFrame(fxFrame);
  }
  requestAnimationFrame(fxFrame);
}
