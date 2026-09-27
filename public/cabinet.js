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
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const RANKS = {
  owner: ['Владелец', 'st-owner'],
  admin: ['Гл. админ', 'st-admin'],
  moderator: ['Модератор', 'st-mod'],
  helper: ['Хелпер', 'st-help'],
  vip: ['VIP игрок', 'st-vip'],
  player: ['Игрок', 'st-common']
};
function rankOf(u) {
  const r = u && (u.rank || u.role);
  return RANKS[r] ? r : (u && u.role === 'admin' ? 'owner' : 'player');
}

const STATUS = {
  new: ['Новая', 'st-new'],
  approved: ['Выдана', 'st-approved'],
  rejected: ['Отклонена', 'st-rejected']
};

const RARITY = {
  common: ['Обычный', 'hl-common'],
  rare: ['Редкий', 'hl-rare'],
  epic: ['Эпический', 'hl-epic'],
  legend: ['Легендарный', 'hl-legend']
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

async function renderAuth() {
  const area = document.getElementById('auth-area');
  try {
    const me = await api('/api/me');
    if (me.user) {
      area.innerHTML =
        '<span class="user-chip">👤 ' + esc(me.user.nick || me.user.login) + '</span>' +
        (me.user.role === 'admin' ? '<a class="user-chip admin-chip" href="admin.html">Админка</a>' : '') +
        '<button class="btn btn-ghost btn-sm" id="logout-btn">Выйти</button>';
      document.getElementById('logout-btn').addEventListener('click', async () => {
        try { await api('/api/logout', {}); } catch (e) {}
        location.href = 'index.html';
      });
      return me.user;
    }
  } catch (e) {}
  location.href = 'index.html';
  return null;
}

async function loadCabinet() {
  const user = await renderAuth();
  if (!user) return;
  const avatar = document.getElementById('profile-avatar');
  avatar.textContent = (user.nick || user.login || '?').charAt(0).toUpperCase();
  document.getElementById('profile-name').textContent = user.nick || user.login;
  document.getElementById('profile-login').textContent = '@' + user.login;
  const rk = rankOf(user);
  document.getElementById('profile-role').innerHTML = user.banned
    ? '<span class="st st-banned">Заблокирован</span>'
    : '<span class="st ' + RANKS[rk][1] + '">' + RANKS[rk][0] + '</span>';
  document.getElementById('profile-balance').textContent = Number(user.balance || 0) + ' ₽';
  document.getElementById('profile-created').textContent = fmtDate(user.created);
  document.getElementById('profile-last').textContent = fmtDate(user.lastLogin);
  const priv = document.getElementById('profile-priv');
  priv.innerHTML = user.priv && user.priv.length
    ? user.priv.map(p => '<li>' + esc(p) + '</li>').join('')
    : '<li style="color:var(--muted)">Пока нет — загляни в <a href="index.html#donate" style="color:var(--red)">донат</a></li>';

  const data = await api('/api/cabinet');
  document.getElementById('rs-total').textContent = data.stats.total;
  document.getElementById('rs-rare').textContent = data.stats.rare;
  document.getElementById('rs-free').textContent = data.stats.free;
  document.getElementById('rs-spent').textContent = data.stats.spent + ' ₽';
  const wins = document.getElementById('rs-wins');
  if (data.lastWins.length) {
    wins.innerHTML = data.lastWins.map(w => {
      const r = RARITY[w.rarity] || RARITY.common;
      return '<li><span><b class="' + r[1] + '">' + esc(w.prize) + '</b><br><span class="l">' + esc(w.caseTitle || '') + '</span></span><span class="l">' + fmtDate(w.date) + '</span></li>';
    }).join('');
  }
  const box = document.getElementById('orders-box');
  if (!data.orders.length) {
    box.innerHTML = '<p class="empty">Заявок пока нет. Тарифы — на <a href="index.html#donate" style="color:var(--red)">главной странице</a></p>';
    return;
  }
  box.innerHTML =
    '<table class="tbl"><thead><tr><th>Тариф</th><th>Ник</th><th>Цена</th><th>Дата</th><th>Статус</th></tr></thead><tbody>' +
    data.orders.map(o =>
      '<tr><td><b>' + esc(o.planTitle) + '</b><br><span style="color:var(--muted);font-size:12px">' + Number(o.days) + ' дней</span></td>' +
      '<td>' + esc(o.nick) + '</td><td>' + Number(o.price) + ' ₽</td><td>' + fmtDate(o.created) + '</td>' +
      '<td><span class="st ' + STATUS[o.status][1] + '">' + STATUS[o.status][0] + '</span></td></tr>'
    ).join('') +
    '</tbody></table>';
}

async function loadCheckin() {
  try {
    const d = await api('/api/checkin');
    const btn = document.getElementById('checkin-btn');
    document.getElementById('checkin-streak').textContent = d.streak + ' 🔥';
    document.getElementById('checkin-next').textContent = '+' + d.next.balance + ' ₽' + (d.next.spins ? ' + ' + d.next.spins + ' прокрут' : '');
    const note = document.getElementById('checkin-note');
    if (d.available) {
      btn.disabled = false;
      btn.textContent = 'Забрать награду';
      note.textContent = 'Каждый 7-й день подряд — бонусный прокрут рулетки!';
    } else {
      btn.disabled = true;
      btn.textContent = 'Награда получена';
      const left = new Date(d.nextAt).getTime() - Date.now();
      note.textContent = 'Следующая через ~' + (left > 3600000 ? Math.ceil(left / 3600000) + ' ч' : Math.ceil(left / 60000) + ' мин');
    }
  } catch (e) {}
}

document.getElementById('checkin-btn').addEventListener('click', async () => {
  const btn = document.getElementById('checkin-btn');
  btn.disabled = true;
  btn.textContent = 'Забираем…';
  try {
    const d = await api('/api/checkin', {});
    showToast('Получено: ' + d.reward);
    await loadCheckin();
    await loadCabinet();
  } catch (ex) {
    showToast(ex.message);
    loadCheckin();
  }
});

document.getElementById('promo-form').addEventListener('submit', async e => {
  e.preventDefault();
  const err = document.getElementById('promo-error');
  err.textContent = '';
  const f = e.target;
  try {
    const d = await api('/api/promo/redeem', { code: f.code.value });
    f.reset();
    showToast('Промокод активирован: ' + d.reward);
    loadCabinet();
  } catch (ex) {
    err.textContent = ex.message;
  }
});

document.getElementById('pass-form').addEventListener('submit', async e => {
  e.preventDefault();
  const err = document.getElementById('pass-error');
  err.textContent = '';
  const f = e.target;
  try {
    await api('/api/password', { current: f.current.value, next: f.next.value });
    f.reset();
    showToast('Пароль изменён');
  } catch (ex) {
    err.textContent = ex.message;
  }
});

loadCheckin();
loadCabinet().catch(() => {
  document.getElementById('orders-box').innerHTML = '<p class="empty">Ошибка загрузки данных</p>';
});
