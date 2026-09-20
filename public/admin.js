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

const STATUS = {
  new: ['Новая', 'st-new'],
  approved: ['Выдана', 'st-approved'],
  rejected: ['Отклонена', 'st-rejected']
};

const RANKS = {
  owner: ['Владелец', 'st-owner'],
  admin: ['Гл. админ', 'st-admin'],
  moderator: ['Модератор', 'st-mod'],
  helper: ['Хелпер', 'st-help'],
  vip: ['VIP', 'st-vip'],
  player: ['Игрок', 'st-common']
};

const RAR = {
  common: ['Обычный', 'st-common'],
  rare: ['Редкий', 'st-rare'],
  epic: ['Эпический', 'st-epic'],
  legend: ['Легендарный', 'st-legend']
};

function bindUpload(fileId, inputId, previewId) {
  const fileInput = document.getElementById(fileId);
  const imgInput = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!fileInput) return;
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Файл больше 2 МБ'); fileInput.value = ''; return; }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const d = await api('/api/admin/upload', { name: file.name, data: String(reader.result).split(',')[1] || '' });
        imgInput.value = d.img;
        preview.src = 'img/' + d.img;
        preview.hidden = false;
        showToast('Картинка загружена: ' + d.img);
      } catch (ex) { showToast(ex.message); }
    };
    reader.readAsDataURL(file);
  });
  imgInput.addEventListener('input', () => {
    if (imgInput.value) { preview.src = 'img/' + imgInput.value; preview.hidden = false; }
    else preview.hidden = true;
  });
}

function setImgPreview(inputId, previewId, value) {
  const imgInput = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (imgInput && preview) {
    imgInput.value = value || '';
    if (value) { preview.src = 'img/' + value; preview.hidden = false; }
    else preview.hidden = true;
  }
}

async function loadImgList() {
  try {
    const d = await api('/api/admin/imgs');
    document.getElementById('img-list').innerHTML = d.files.map(f => '<option value="' + esc(f) + '">').join('');
  } catch (e) {}
}

const toast = document.getElementById('toast');
let toastTimer;
function showToast(text) {
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

document.getElementById('burger').addEventListener('click', () => document.getElementById('nav').classList.toggle('open'));

let siteData = null;

async function guard() {
  try {
    const me = await api('/api/me');
    if (me.user && me.user.role === 'admin') {
      document.getElementById('auth-area').innerHTML =
        '<span class="user-chip">👤 ' + esc(me.user.nick || me.user.login) + '</span>' +
        '<button class="btn btn-ghost btn-sm" id="logout-btn">Выйти</button>';
      document.getElementById('logout-btn').addEventListener('click', async () => {
        try { await api('/api/logout', {}); } catch (e) {}
        location.href = 'index.html';
      });
      return true;
    }
  } catch (e) {}
  location.href = 'index.html';
  return false;
}

document.querySelectorAll('#admin-side button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#admin-side button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById('sec-' + btn.dataset.sec).classList.add('active');
  });
});

async function loadDashboard() {
  const s = await api('/api/admin/stats');
  document.getElementById('stat-cards').innerHTML =
    '<div class="stat-card"><b>' + s.users + '</b><span>аккаунтов</span></div>' +
    '<div class="stat-card"><b>' + s.online + '/' + s.max + '</b><span>онлайн</span></div>' +
    '<div class="stat-card"><b>' + s.ordersNew + '</b><span>новых заявок</span></div>' +
    '<div class="stat-card"><b>' + s.ordersAll + '</b><span>заявок всего</span></div>' +
    '<div class="stat-card"><b>' + s.revenue.toLocaleString('ru-RU') + ' ₽</b><span>выручка</span></div>' +
    '<div class="stat-card"><b>' + s.banned + '</b><span>забанено</span></div>';
  const orders = (await api('/api/admin/orders')).orders.slice(0, 5);
  document.getElementById('dash-orders').innerHTML = orders.length
    ? ordersTable(orders, false)
    : '<p class="empty">Заявок пока нет</p>';
}

function ordersTable(orders, withActions) {
  return '<table class="tbl"><thead><tr><th>#</th><th>Игрок</th><th>Тариф</th><th>Цена</th><th>Дата</th><th>Статус</th>' + (withActions ? '<th></th>' : '') + '</tr></thead><tbody>' +
    orders.map(o =>
      '<tr><td>' + o.id + '</td>' +
      '<td><b>' + esc(o.login) + '</b><br><span style="color:var(--muted);font-size:12px">' + esc(o.nick) + '</span></td>' +
      '<td>' + esc(o.planTitle) + ' (' + o.days + ' дн.)</td>' +
      '<td>' + Number(o.price) + ' ₽</td><td>' + fmtDate(o.created) + '</td>' +
      '<td><span class="st ' + STATUS[o.status][1] + '">' + STATUS[o.status][0] + '</span></td>' +
      (withActions ? '<td><div class="row-actions">' +
        (o.status === 'new' ? '<button class="btn btn-ok btn-mini" data-order="' + o.id + '" data-act="approve">Выдать</button><button class="btn btn-danger btn-mini" data-order="' + o.id + '" data-act="reject">Отклонить</button>' : '') +
      '</div></td>' : '') + '</tr>'
    ).join('') + '</tbody></table>';
}

async function loadOrders() {
  const orders = (await api('/api/admin/orders')).orders;
  const box = document.getElementById('orders-table');
  box.innerHTML = orders.length ? ordersTable(orders, true) : '<p class="empty">Заявок пока нет</p>';
  box.querySelectorAll('[data-order]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api('/api/admin/order', { id: Number(btn.dataset.order), action: btn.dataset.act });
        showToast(btn.dataset.act === 'approve' ? 'Привилегия выдана' : 'Заявка отклонена');
        loadOrders();
        loadDashboard();
      } catch (ex) { showToast(ex.message); }
    });
  });
}

async function loadNews() {
  const news = siteData.news;
  document.getElementById('news-list').innerHTML = news.length ? news.map(n =>
    '<div class="edit-item"><div><h4>' + esc(n.title) + (n.pinned ? ' 📌' : '') + '</h4><p>' + esc(n.text) + '</p><p style="margin-top:6px">' + esc(n.date) + '</p></div>' +
    '<div class="edit-actions">' +
      '<button class="btn btn-ghost btn-sm btn-mini" data-editnews="' + n.id + '">Изменить</button>' +
      '<button class="btn btn-danger btn-sm btn-mini" data-delnews="' + n.id + '">Удалить</button>' +
    '</div></div>'
  ).join('') : '<p class="empty">Новостей нет</p>';
  document.querySelectorAll('[data-editnews]').forEach(b => b.addEventListener('click', () => {
    const n = siteData.news.find(x => x.id === Number(b.dataset.editnews));
    const f = document.getElementById('news-form');
    f.id.value = n.id;
    f.title.value = n.title;
    f.text.value = n.text;
    f.pinned.checked = !!n.pinned;
    document.getElementById('news-form-title').textContent = 'Изменение новости';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  document.querySelectorAll('[data-delnews]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Удалить новость?')) return;
    try { await api('/api/admin/news/delete', { id: Number(b.dataset.delnews) }); await refreshSite(); loadNews(); showToast('Новость удалена'); } catch (ex) { showToast(ex.message); }
  }));
}

document.getElementById('news-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  try {
    await api('/api/admin/news', { id: f.id.value ? Number(f.id.value) : undefined, title: f.title.value, text: f.text.value, pinned: f.pinned.checked });
    f.reset();
    f.id.value = '';
    document.getElementById('news-form-title').textContent = 'Новая новость';
    await refreshSite();
    loadNews();
    showToast('Новость сохранена');
  } catch (ex) { showToast(ex.message); }
});

async function loadPlans() {
  const plans = siteData.plans;
  document.getElementById('plan-list').innerHTML = plans.length ? plans.map(p =>
    '<div class="edit-item"><div><h4>' + esc(p.title) + (p.popular ? ' 🔥' : '') + '</h4><p>' + Number(p.price) + ' ₽ • ' + p.days + ' дн.</p><p>' + p.perks.map(esc).join(' • ') + '</p></div>' +
    '<div class="edit-actions">' +
      '<button class="btn btn-ghost btn-sm btn-mini" data-editplan="' + p.id + '">Изменить</button>' +
      '<button class="btn btn-danger btn-sm btn-mini" data-delplan="' + p.id + '">Удалить</button>' +
    '</div></div>'
  ).join('') : '<p class="empty">Тарифов нет</p>';
  document.querySelectorAll('[data-editplan]').forEach(b => b.addEventListener('click', () => {
    const p = siteData.plans.find(x => x.id === Number(b.dataset.editplan));
    const f = document.getElementById('plan-form');
    f.id.value = p.id;
    f.title.value = p.title;
    f.price.value = p.price;
    f.days.value = p.days;
    f.perks.value = p.perks.join('\n');
    f.popular.checked = !!p.popular;
    document.getElementById('plan-form-title').textContent = 'Изменение тарифа';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  document.querySelectorAll('[data-delplan]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Удалить тариф?')) return;
    try { await api('/api/admin/plan/delete', { id: Number(b.dataset.delplan) }); await refreshSite(); loadPlans(); showToast('Тариф удалён'); } catch (ex) { showToast(ex.message); }
  }));
}

document.getElementById('plan-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  try {
    await api('/api/admin/plan', {
      id: f.id.value ? Number(f.id.value) : undefined,
      title: f.title.value,
      price: Number(f.price.value),
      days: Number(f.days.value),
      perks: f.perks.value,
      popular: f.popular.checked
    });
    f.reset();
    f.id.value = '';
    document.getElementById('plan-form-title').textContent = 'Новый тариф';
    await refreshSite();
    loadPlans();
    showToast('Тариф сохранён');
  } catch (ex) { showToast(ex.message); }
});

async function loadUsers() {
  const users = (await api('/api/admin/users')).users;
  const box = document.getElementById('users-table');
  box.innerHTML =
    '<table class="tbl"><thead><tr><th>Игрок</th><th>Должность</th><th>Баланс</th><th>Привилегии</th><th>Стрик</th><th>Регистрация</th><th></th></tr></thead><tbody>' +
    users.map(u => {
      const rk = u.rank || (u.role === 'admin' ? 'owner' : 'player');
      return '<tr>' +
        '<td><b>' + esc(u.nick || u.login) + '</b><br><span style="color:var(--muted);font-size:12px">@' + esc(u.login) + (u.banned ? ' • <span class="st st-banned">БАН</span>' : '') + '</span></td>' +
        '<td><span class="st ' + RANKS[rk][1] + '">' + RANKS[rk][0] + '</span>' +
          (u.id === 1 || rk === 'owner' ? '' : '<select class="f-tb-sel rank-sel" data-rank="' + u.id + '" style="margin-top:6px">' +
            Object.keys(RANKS).map(k => '<option value="' + k + '"' + (k === rk ? ' selected' : '') + '>' + RANKS[k][0] + '</option>').join('') +
          '</select>') + '</td>' +
        '<td>' + Number(u.balance || 0) + ' ₽</td>' +
        '<td>' + (u.priv && u.priv.length ? u.priv.length + ' шт.' : '—') + '</td>' +
        '<td>' + (u.spinStreak ? '🔥 ' + u.spinStreak : '—') + '</td>' +
        '<td>' + fmtDate(u.created) + '</td>' +
        '<td><div class="row-actions">' +
          '<button class="btn btn-ghost btn-sm btn-mini" data-bal="' + u.id + '" data-cur="' + u.balance + '">Баланс</button>' +
          '<button class="btn btn-ghost btn-sm btn-mini" data-priv="' + u.id + '" data-cur="' + esc((u.priv || []).join('\n')) + '">Привилегии</button>' +
          (u.banned
            ? '<button class="btn btn-ok btn-sm btn-mini" data-ban="' + u.id + '" data-act="unban">Разбанить</button>'
            : '<button class="btn btn-danger btn-sm btn-mini" data-ban="' + u.id + '" data-act="ban">Забанить</button>') +
        '</div></td>' +
      '</tr>';
    }).join('') + '</tbody></table>';
  box.querySelectorAll('[data-ban]').forEach(b => b.addEventListener('click', async () => {
    try { await api('/api/admin/user', { id: Number(b.dataset.ban), action: b.dataset.act }); loadUsers(); showToast(b.dataset.act === 'ban' ? 'Игрок заблокирован' : 'Игрок разблокирован'); } catch (ex) { showToast(ex.message); }
  }));
  box.querySelectorAll('.rank-sel').forEach(s => s.addEventListener('change', async () => {
    try {
      await api('/api/admin/user', { id: Number(s.dataset.rank), action: 'rank', value: s.value });
      loadUsers();
      showToast('Должность изменена: ' + RANKS[s.value][0]);
    } catch (ex) { showToast(ex.message); loadUsers(); }
  }));
  box.querySelectorAll('[data-bal]').forEach(b => b.addEventListener('click', async () => {
    const v = prompt('Новый баланс, ₽:', b.dataset.cur);
    if (v === null) return;
    try { await api('/api/admin/user', { id: Number(b.dataset.bal), action: 'balance', value: Number(v) }); loadUsers(); showToast('Баланс обновлён'); } catch (ex) { showToast(ex.message); }
  }));
  box.querySelectorAll('[data-priv]').forEach(b => b.addEventListener('click', async () => {
    const v = prompt('Привилегии (по одной на строку):', b.dataset.cur);
    if (v === null) return;
    try { await api('/api/admin/user', { id: Number(b.dataset.priv), action: 'priv', value: v }); loadUsers(); showToast('Привилегии обновлены'); } catch (ex) { showToast(ex.message); }
  }));
}

function ruleRow(title, text) {
  return '<div class="edit-item rule-row" style="display:grid;grid-template-columns:200px 1fr auto;gap:12px;align-items:start">' +
    '<input class="f-input rule-title" placeholder="Название" value="' + esc(title) + '">' +
    '<input class="f-input rule-text" placeholder="Описание" value="' + esc(text) + '">' +
    '<button class="btn btn-danger btn-sm btn-mini rule-del" type="button">×</button>' +
    '</div>';
}

async function loadRules() {
  document.getElementById('rules-editor').innerHTML = siteData.rules.map(r => ruleRow(r.title, r.text)).join('');
  bindRuleRows();
}

function bindRuleRows() {
  document.querySelectorAll('.rule-del').forEach(b => b.addEventListener('click', () => b.closest('.rule-row').remove()));
}

document.getElementById('rule-add').addEventListener('click', () => {
  document.getElementById('rules-editor').insertAdjacentHTML('beforeend', ruleRow('', ''));
  bindRuleRows();
});

document.getElementById('rules-save').addEventListener('click', async () => {
  const rules = [...document.querySelectorAll('.rule-row')].map(r => ({
    title: r.querySelector('.rule-title').value.trim(),
    text: r.querySelector('.rule-text').value.trim()
  })).filter(r => r.title);
  try {
    await api('/api/admin/rules', { rules });
    await refreshSite();
    loadRules();
    showToast('Правила сохранены');
  } catch (ex) { showToast(ex.message); }
});

async function loadSettings() {
  const s = siteData.settings;
  const f = document.getElementById('settings-form');
  f.serverName.value = s.serverName || '';
  f.serverIp.value = s.serverIp || '';
  f.discord.value = s.discord || '';
  f.vk.value = s.vk || '';
  f.promoCode.value = (s.promo && s.promo.code) || '';
  f.promoPercent.value = (s.promo && s.promo.percent) || 0;
  f.roulCost.value = (s.roulette && s.roulette.cost) || 0;
  const m = s.monitor || {};
  f.monName.value = m.name || '';
  f.monMode.value = m.mode || '';
  f.monMap.value = m.map || '';
  f.monVersion.value = m.version || '';
  f.monPlayers.value = m.players || 0;
  f.monMax.value = m.max || 500;
}

document.getElementById('settings-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  try {
    await api('/api/admin/settings', {
      serverName: f.serverName.value,
      serverIp: f.serverIp.value,
      discord: f.discord.value,
      vk: f.vk.value,
      promo: { code: f.promoCode.value, percent: Number(f.promoPercent.value) || 0 },
      roulette: { cost: Number(f.roulCost.value) || 0 },
      monitor: {
        name: f.monName.value,
        mode: f.monMode.value,
        map: f.monMap.value,
        version: f.monVersion.value,
        players: Number(f.monPlayers.value) || 0,
        max: Number(f.monMax.value) || 500
      }
    });
    await refreshSite();
    showToast('Настройки сохранены');
  } catch (ex) { showToast(ex.message); }
});

async function loadRoulette() {
  const cases = (await api('/api/admin/cases')).cases;
  const caseSel = document.getElementById('prize-case-sel');
  caseSel.innerHTML = cases.map(c => '<option value="' + c.id + '">' + esc(c.icon + ' ' + c.title) + '</option>').join('');
  document.getElementById('case-list').innerHTML = cases.length ? cases.map(c =>
    '<div class="edit-item"><div>' + (c.img ? '<img class="prize-thumb" style="width:40px;height:40px" src="img/' + esc(c.img) + '" alt="">' : '') + '<h4>' + esc(c.title) + (c.freeDaily ? ' <span class="st st-approved">бесплатный/день</span>' : '') + (c.enabled ? '' : ' <span class="st st-rejected">выключен</span>') + '</h4>' +
    '<p>' + c.cost + ' ₽ за прокрут • цвет ' + esc(c.accent || '—') + ' • призов: ' + 0 + '</p></div>' +
    '<div class="edit-actions">' +
      '<button class="btn btn-ghost btn-sm btn-mini" data-editcase="' + c.id + '">Изменить</button>' +
      '<button class="btn btn-danger btn-sm btn-mini" data-delcase="' + c.id + '">Удалить</button>' +
    '</div></div>'
  ).join('') : '<p class="empty">Кейсов нет</p>';
  document.querySelectorAll('[data-editcase]').forEach(b => b.addEventListener('click', () => {
    const c = cases.find(x => x.id === Number(b.dataset.editcase));
    const f = document.getElementById('case-form');
    f.id.value = c.id;
    f.title.value = c.title;
    f.icon.value = c.icon || '';
    setImgPreview('case-img-input', 'case-img-preview', c.img);
    f.accent.value = c.accent || '#35a2ff';
    f.cost.value = c.cost;
    f.order.value = c.order || 99;
    f.freeDaily.checked = !!c.freeDaily;
    f.enabled.checked = !!c.enabled;
    document.getElementById('case-form-title').textContent = 'Изменение кейса';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  document.querySelectorAll('[data-delcase]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Удалить кейс вместе со всеми его призами?')) return;
    try { await api('/api/admin/case/delete', { id: Number(b.dataset.delcase) }); loadRoulette(); showToast('Кейс удалён'); } catch (ex) { showToast(ex.message); }
  }));

  const prizes = (await api('/api/admin/prizes')).prizes;
  const caseById = {};
  cases.forEach(c => { caseById[c.id] = c; });
  const list = document.getElementById('prize-list');
  const byCase = {};
  prizes.forEach(p => { const k = p.caseId || 1; (byCase[k] = byCase[k] || []).push(p); });
  let sumAll = {};
  prizes.forEach(p => { sumAll[p.caseId || 1] = (sumAll[p.caseId || 1] || 0) + (Number(p.chance) || 0); });
  document.getElementById('prize-sum').textContent = Object.keys(byCase).map(k => {
    const c = caseById[k];
    return (c ? c.title : 'Кейс ' + k) + ': ' + Math.round(sumAll[k] * 10) / 10 + '%' + (Math.abs(sumAll[k] - 100) < 0.05 ? ' ✔' : ' ⚠100%');
  }).join(' • ') || 'Призов нет';
  list.innerHTML = prizes.length ? prizes.map(p =>
    '<div class="edit-item"><div>' + (p.img ? '<img class="prize-thumb" src="img/' + esc(p.img) + '" alt="">' : esc(p.icon || '🎁') + ' ') + '<h4>' + esc(p.title) + (p.enabled ? '' : ' <span class="st st-rejected">выключен</span>') + '</h4>' +
    '<p>' + (caseById[p.caseId || 1] ? esc(caseById[p.caseId || 1].title) : 'Без кейса') + ' • <span class="st ' + RAR[p.rarity][1] + '">' + RAR[p.rarity][0] + '</span> • шанс ' + p.chance + '% • ' + (p.type === 'balance' ? 'баланс +' + Number(p.value) + ' ₽' : p.type === 'spins' ? '+' + Number(p.value) + ' прокрут(ов)' : esc(p.value)) + '</p></div>' +
    '<div class="edit-actions">' +
      '<button class="btn btn-ghost btn-sm btn-mini" data-editprize="' + p.id + '">Изменить</button>' +
      '<button class="btn btn-danger btn-sm btn-mini" data-delprize="' + p.id + '">Удалить</button>' +
    '</div></div>'
  ).join('') : '<p class="empty">Призов нет</p>';
  document.querySelectorAll('[data-editprize]').forEach(b => b.addEventListener('click', () => {
    const p = prizes.find(x => x.id === Number(b.dataset.editprize));
    const f = document.getElementById('prize-form');
    f.id.value = p.id;
    f.title.value = p.title;
    f.icon.value = p.icon || '';
    setImgPreview('prize-img-input', 'prize-img-preview', p.img);
    f.rarity.value = p.rarity;
    f.category.value = p.category || 'items';
    f.caseId.value = p.caseId || 1;
    f.chance.value = p.chance;
    f.type.value = p.type;
    f.value.value = p.value;
    f.enabled.checked = !!p.enabled;
    document.getElementById('prize-form-title').textContent = 'Изменение приза';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  document.querySelectorAll('[data-delprize]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Удалить приз?')) return;
    try { await api('/api/admin/prize/delete', { id: Number(b.dataset.delprize) }); loadRoulette(); showToast('Приз удалён'); } catch (ex) { showToast(ex.message); }
  }));

  const spins = (await api('/api/admin/spins')).spins;
  document.getElementById('spins-table').innerHTML = spins.length
    ? '<table class="tbl"><thead><tr><th>Дата</th><th>Игрок</th><th>Кейс</th><th>Приз</th><th>Редкость</th><th>Цена</th></tr></thead><tbody>' +
      spins.map(s =>
        '<tr><td>' + fmtDate(s.date) + '</td><td><b>' + esc(s.login) + '</b></td>' +
        '<td>' + esc(s.caseTitle || '—') + '</td>' +
        '<td>' + esc(s.prize) + '</td>' +
        '<td><span class="st ' + RAR[s.rarity][1] + '">' + RAR[s.rarity][0] + '</span></td>' +
        '<td>' + (s.free ? '<span class="st st-approved">бесплатно</span>' : Number(s.cost) + ' ₽') + '</td></tr>'
      ).join('') + '</tbody></table>'
    : '<p class="empty">Прокрутов пока нет</p>';
}

document.getElementById('case-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  try {
    await api('/api/admin/case', {
      id: f.id.value ? Number(f.id.value) : undefined,
      title: f.title.value,
      icon: f.icon.value,
      img: f.img.value.trim(),
      accent: f.accent.value.trim(),
      cost: Number(f.cost.value),
      order: Number(f.order.value) || 99,
      freeDaily: f.freeDaily.checked,
      enabled: f.enabled.checked
    });
    f.reset();
    f.id.value = '';
    f.cost.value = 99;
    f.order.value = 99;
    f.accent.value = '#35a2ff';
    f.enabled.checked = true;
    setImgPreview('case-img-input', 'case-img-preview', '');
    document.getElementById('case-form-title').textContent = 'Новый кейс';
    loadRoulette();
    showToast('Кейс сохранён');
  } catch (ex) { showToast(ex.message); }
});

document.getElementById('prize-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  try {
    await api('/api/admin/prize', {
      id: f.id.value ? Number(f.id.value) : undefined,
      title: f.title.value,
      icon: f.icon.value,
      img: f.img.value.trim(),
      rarity: f.rarity.value,
      category: f.category.value,
      caseId: Number(f.caseId.value) || 1,
      chance: Number(f.chance.value),
      type: f.type.value,
      value: f.value.value,
      enabled: f.enabled.checked
    });
    f.reset();
    f.id.value = '';
    f.enabled.checked = true;
    setImgPreview('prize-img-input', 'prize-img-preview', '');
    document.getElementById('prize-form-title').textContent = 'Новый приз';
    loadRoulette();
    showToast('Приз сохранён');
  } catch (ex) { showToast(ex.message); }
});

async function loadForum() {
  const sections = (await api('/api/admin/sections')).sections;
  document.getElementById('fsection-list').innerHTML = sections.length ? sections.map(s =>
    '<div class="edit-item"><div><h4>' + esc(s.icon || '📁') + ' ' + esc(s.title) + (s.adminOnly ? ' <span class="st st-admin">только админ</span>' : '') + '</h4>' +
    '<p>' + esc(s.desc || '') + ' • порядок: ' + (s.order || 0) + '</p></div>' +
    '<div class="edit-actions">' +
      '<button class="btn btn-ghost btn-sm btn-mini" data-editfsec="' + s.id + '">Изменить</button>' +
      '<button class="btn btn-danger btn-sm btn-mini" data-delfsec="' + s.id + '">Удалить</button>' +
    '</div></div>'
  ).join('') : '<p class="empty">Разделов нет</p>';
  document.querySelectorAll('[data-editfsec]').forEach(b => b.addEventListener('click', () => {
    const s = sections.find(x => x.id === Number(b.dataset.editfsec));
    const f = document.getElementById('fsection-form');
    f.id.value = s.id;
    f.title.value = s.title;
    f.icon.value = s.icon || '';
    f.desc.value = s.desc || '';
    f.order.value = s.order || 99;
    f.adminOnly.checked = !!s.adminOnly;
    document.getElementById('fsec-form-title').textContent = 'Изменение раздела';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  document.querySelectorAll('[data-delfsec]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Удалить раздел вместе со всеми темами и сообщениями?')) return;
    try { await api('/api/admin/section/delete', { id: Number(b.dataset.delfsec) }); loadForum(); showToast('Раздел удалён'); } catch (ex) { showToast(ex.message); }
  }));

  const threads = (await api('/api/admin/threads')).threads;
  document.getElementById('fthreads-table').innerHTML = threads.length
    ? '<table class="tbl"><thead><tr><th>Тема</th><th>Раздел</th><th>Автор</th><th>Ответов</th><th>Активность</th><th></th></tr></thead><tbody>' +
      threads.map(t =>
        '<tr><td><b>' + (t.pinned ? '📌 ' : '') + (t.locked ? '🔒 ' : '') + esc(t.title) + '</b><br><a class="back-link" href="forum.html#/t/' + t.id + '" target="_blank">открыть ↗</a></td>' +
        '<td>' + esc(t.sectionTitle) + '</td><td>' + esc(t.nick || t.login) + '</td><td>' + t.replies + '</td><td>' + fmtDate(t.lastAt) + '</td>' +
        '<td><div class="row-actions">' +
          '<button class="btn btn-ghost btn-sm btn-mini" data-fpin="' + t.id + '" data-v="' + (t.pinned ? 0 : 1) + '">' + (t.pinned ? 'Открепить' : 'Закрепить') + '</button>' +
          '<button class="btn btn-ghost btn-sm btn-mini" data-flock="' + t.id + '" data-v="' + (t.locked ? 0 : 1) + '">' + (t.locked ? 'Открыть' : 'Закрыть') + '</button>' +
          '<button class="btn btn-danger btn-sm btn-mini" data-fdel="' + t.id + '">Удалить</button>' +
        '</div></td></tr>'
      ).join('') + '</tbody></table>'
    : '<p class="empty">Тем пока нет</p>';
  document.querySelectorAll('[data-fpin]').forEach(b => b.addEventListener('click', async () => {
    try { await api('/api/forum/thread/pin', { id: Number(b.dataset.fpin), value: b.dataset.v === '1' }); loadForum(); } catch (ex) { showToast(ex.message); }
  }));
  document.querySelectorAll('[data-flock]').forEach(b => b.addEventListener('click', async () => {
    try { await api('/api/forum/thread/lock', { id: Number(b.dataset.flock), value: b.dataset.v === '1' }); loadForum(); } catch (ex) { showToast(ex.message); }
  }));
  document.querySelectorAll('[data-fdel]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Удалить тему со всеми сообщениями?')) return;
    try { await api('/api/forum/thread/delete', { id: Number(b.dataset.fdel) }); loadForum(); showToast('Тема удалена'); } catch (ex) { showToast(ex.message); }
  }));
}

document.getElementById('fsection-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  try {
    await api('/api/admin/section', {
      id: f.id.value ? Number(f.id.value) : undefined,
      title: f.title.value,
      icon: f.icon.value,
      desc: f.desc.value,
      order: Number(f.order.value) || 99,
      adminOnly: f.adminOnly.checked
    });
    f.reset();
    f.id.value = '';
    f.order.value = 99;
    document.getElementById('fsec-form-title').textContent = 'Новый раздел форума';
    loadForum();
    showToast('Раздел сохранён');
  } catch (ex) { showToast(ex.message); }
});

async function loadPromocodes() {
  const codes = (await api('/api/admin/promocodes')).codes;
  const list = document.getElementById('promo-list');
  list.innerHTML = codes.length ? codes.map(c =>
    '<div class="edit-item"><div><h4>' + esc(c.code) + ' ' + (c.active ? '<span class="st st-approved">активен</span>' : '<span class="st st-rejected">выключен</span>') + '</h4>' +
    '<p>' + (c.type === 'balance' ? 'Баланс +' + Number(c.value) + ' ₽' : c.type === 'spins' ? '+' + Number(c.value) + ' прокрут(ов)' : esc(c.value)) +
    ' • активаций: ' + c.uses + (c.maxUses > 0 ? '/' + c.maxUses : ' (без лимита)') + '</p></div>' +
    '<div class="edit-actions">' +
      '<button class="btn btn-ghost btn-sm btn-mini" data-editpromo="' + c.id + '">Изменить</button>' +
      '<button class="btn btn-danger btn-sm btn-mini" data-delpromo="' + c.id + '">Удалить</button>' +
    '</div></div>'
  ).join('') : '<p class="empty">Промокодов нет</p>';
  document.querySelectorAll('[data-editpromo]').forEach(b => b.addEventListener('click', () => {
    const c = codes.find(x => x.id === Number(b.dataset.editpromo));
    const f = document.getElementById('promo-form');
    f.id.value = c.id;
    f.code.value = c.code;
    f.type.value = c.type;
    f.value.value = c.value;
    f.maxUses.value = c.maxUses || 0;
    f.active.checked = !!c.active;
    document.getElementById('promo-form-title').textContent = 'Изменение промокода';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  document.querySelectorAll('[data-delpromo]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Удалить промокод?')) return;
    try { await api('/api/admin/promocode/delete', { id: Number(b.dataset.delpromo) }); loadPromocodes(); showToast('Промокод удалён'); } catch (ex) { showToast(ex.message); }
  }));
}

document.getElementById('promo-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  try {
    await api('/api/admin/promocode', {
      id: f.id.value ? Number(f.id.value) : undefined,
      code: f.code.value,
      type: f.type.value,
      value: f.value.value,
      maxUses: Number(f.maxUses.value) || 0,
      active: f.active.checked
    });
    f.reset();
    f.id.value = '';
    f.maxUses.value = 0;
    f.active.checked = true;
    document.getElementById('promo-form-title').textContent = 'Новый промокод';
    loadPromocodes();
    showToast('Промокод сохранён');
  } catch (ex) { showToast(ex.message); }
});

async function refreshSite() {
  siteData = await api('/api/site');
}

(async () => {
  if (!await guard()) return;
  bindUpload('prize-file', 'prize-img-input', 'prize-img-preview');
  bindUpload('case-file', 'case-img-input', 'case-img-preview');
  loadImgList();
  await refreshSite();
  await Promise.all([loadDashboard(), loadNews(), loadPlans(), loadUsers(), loadOrders(), loadRoulette(), loadForum(), loadPromocodes(), loadRules(), loadSettings()]);
})().catch(() => showToast('Ошибка загрузки данных'));
