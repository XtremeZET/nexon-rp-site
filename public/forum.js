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
  return isNaN(d) ? '' : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const RANKS = {
  owner: ['Владелец', 'st-owner'],
  admin: ['Гл. админ', 'st-admin'],
  moderator: ['Модератор', 'st-mod'],
  helper: ['Хелпер', 'st-help'],
  vip: ['VIP', 'st-vip'],
  player: ['Игрок', 'st-common']
};

function rankOf(u) {
  const r = u && (u.rank || u.role);
  return RANKS[r] ? r : (u && u.role === 'admin' ? 'owner' : 'player');
}
function isMod() { return user && ['owner', 'admin', 'moderator'].includes(rankOf(user)); }
function canDelAny() { return user && ['owner', 'admin', 'moderator', 'helper'].includes(rankOf(user)); }
function canAdminPost() { return user && ['owner', 'admin'].includes(rankOf(user)); }

const AV_COLORS = ['#35a2ff', '#b366ff', '#46d17a', '#ffb03a', '#ff7a7a', '#5cc8ff'];

function avatarHTML(name, rank) {
  const n = String(name || '?');
  let sum = 0;
  for (let i = 0; i < n.length; i++) sum += n.charCodeAt(i);
  const c = AV_COLORS[sum % AV_COLORS.length];
  const staff = ['owner', 'admin', 'moderator', 'helper'].includes(rank);
  return '<div class="f-avatar" style="background:' + c + '">' + esc(n.charAt(0).toUpperCase()) + (staff ? '<i class="f-admin-dot"></i>' : '') + '</div>';
}

function renderBB(src) {
  let s = esc(src);
  const codes = [];
  s = s.replace(/\[code\]([\s\S]*?)\[\/code\]/g, (m, body) => {
    codes.push(body);
    return '\x00' + (codes.length - 1) + '\x00';
  });
  s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/g, '<b>$1</b>');
  s = s.replace(/\[i\]([\s\S]*?)\[\/i\]/g, '<i>$1</i>');
  s = s.replace(/\[u\]([\s\S]*?)\[\/u\]/g, '<u>$1</u>');
  s = s.replace(/\[s\]([\s\S]*?)\[\/s\]/g, '<s>$1</s>');
  s = s.replace(/\[size=(1[0-9]|2[0-4])\]([\s\S]*?)\[\/size\]/g, '<span style="font-size:$1px">$2</span>');
  s = s.replace(/\[color=(#[0-9a-fA-F]{3,6}|red|blue|green|yellow|orange|purple|white|gray|gold|cyan|pink|lime)\]([\s\S]*?)\[\/color\]/g, '<span style="color:$1">$2</span>');
  s = s.replace(/\[quote(?:=([^\]\n]{1,40}))?\]([\s\S]*?)\[\/quote\]/g, (m, n, body) =>
    '<blockquote class="bb-quote"><b>' + (n ? esc(n) : 'Цитата') + (n ? ' писал:' : ':') + '</b><span>' + body + '</span></blockquote>');
  s = s.replace(/\[list\]([\s\S]*?)\[\/list\]/g, (m, inner) =>
    '<ul class="bb-list">' + inner.replace(/\[\*\]([^\[]*)/g, '<li>$1</li>') + '</ul>');
  s = s.replace(/\[url=(https?:\/\/[^\s\]]+)\]([\s\S]*?)\[\/url\]/g, '<a href="$1" target="_blank" rel="noopener">$2</a>');
  s = s.replace(/\[url\](https?:\/\/[^\s\]]+)\[\/url\]/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\[spoiler(?:=([^\]\n]{1,50}))?\]([\s\S]*?)\[\/spoiler\]/g, (m, t, body) =>
    '<details class="bb-spoiler"><summary>' + (t ? esc(t) : 'Спойлер (нажми)') + '</summary><div>' + body + '</div></details>');
  s = s.replace(/(^|\s)@([A-Za-z0-9_]{2,20})/g, '$1<span class="bb-mention">@$2</span>');
  s = s.replace(/\n/g, '<br>');
  s = s.replace(/\x00(\d+)\x00/g, (m, i) => '<pre class="bb-code">' + codes[Number(i)] + '</pre>');
  return s;
}

function wrapSel(ta, open, close) {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const sel = ta.value.slice(start, end);
  ta.value = ta.value.slice(0, start) + open + sel + close + ta.value.slice(end);
  ta.focus();
  if (sel) {
    ta.selectionStart = start + open.length;
    ta.selectionEnd = start + open.length + sel.length;
  } else {
    ta.selectionStart = ta.selectionEnd = start + open.length;
  }
}

const SMILES = ['😀', '😂', '😍', '😎', '🤝', '🔥', '💀', '👍', '👎', '❌', '✅', '💰', '🚗', '🚓', '🎉'];

function attachToolbar(ta) {
  if (!ta || ta.dataset.toolbar) return;
  const bar = document.createElement('div');
  bar.className = 'f-toolbar';
  const btn = (label, title, open, close) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'f-tb-btn';
    b.innerHTML = label;
    b.title = title;
    b.addEventListener('click', () => wrapSel(ta, open, close));
    bar.appendChild(b);
  };
  bar.appendChild(document.createElement('span')).className = 'f-tb-sep';
  btn('<b>B</b>', 'Жирный', '[b]', '[/b]');
  btn('<i>I</i>', 'Курсив', '[i]', '[/i]');
  btn('<u>U</u>', 'Подчёркнутый', '[u]', '[/u]');
  btn('<s>S</s>', 'Зачёркнутый', '[s]', '[/s]');
  const sep1 = document.createElement('span'); sep1.className = 'f-tb-sep'; bar.appendChild(sep1);
  const sizeSel = document.createElement('select');
  sizeSel.className = 'f-tb-sel';
  sizeSel.innerHTML = '<option value="">Размер</option><option value="12">Мелкий</option><option value="16">Обычный</option><option value="20">Крупный</option><option value="24">Огромный</option>';
  sizeSel.addEventListener('change', () => { if (sizeSel.value) { wrapSel(ta, '[size=' + sizeSel.value + ']', '[/size]'); sizeSel.value = ''; } });
  bar.appendChild(sizeSel);
  const colSel = document.createElement('select');
  colSel.className = 'f-tb-sel';
  colSel.innerHTML = '<option value="">Цвет</option>' +
    '<option value="red">Красный</option><option value="blue">Синий</option><option value="green">Зелёный</option>' +
    '<option value="orange">Оранжевый</option><option value="purple">Фиолетовый</option><option value="gold">Золотой</option>' +
    '<option value="cyan">Голубой</option><option value="white">Белый</option><option value="gray">Серый</option>';
  colSel.addEventListener('change', () => { if (colSel.value) { wrapSel(ta, '[color=' + colSel.value + ']', '[/color]'); colSel.value = ''; } });
  bar.appendChild(colSel);
  const sep2 = document.createElement('span'); sep2.className = 'f-tb-sep'; bar.appendChild(sep2);
  btn('« »', 'Цитата', '[quote]', '[/quote]');
  btn('&lt;/&gt;', 'Код', '[code]', '[/code]');
  btn('• Список', 'Список', '[list]\n[*]', '\n[/list]');
  btn('🔗', 'Ссылка', '[url=https://]', '[/url]');
  btn('👁', 'Спойлер', '[spoiler]', '[/spoiler]');
  const sep3 = document.createElement('span'); sep3.className = 'f-tb-sep'; bar.appendChild(sep3);
  for (const sm of SMILES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'f-tb-smile';
    b.textContent = sm;
    b.addEventListener('click', () => {
      const p = ta.selectionStart;
      ta.value = ta.value.slice(0, p) + sm + ta.value.slice(ta.selectionEnd);
      ta.focus();
      ta.selectionStart = ta.selectionEnd = p + sm.length;
    });
    bar.appendChild(b);
  }
  ta.parentNode.insertBefore(bar, ta);
  ta.dataset.toolbar = '1';
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

const root = document.getElementById('forum-root');
const crumb = document.getElementById('f-crumb');

let user = null;
let newThreadSectionId = null;

async function renderAuth() {
  const area = document.getElementById('auth-area');
  if (user) {
    area.innerHTML =
      '<span class="user-chip">' + esc(user.nick || user.login) + ' <span class="st ' + RANKS[rankOf(user)][1] + '" style="margin-left:4px">' + RANKS[rankOf(user)][0] + '</span></span>' +
      (user.role === 'admin' ? '<a class="user-chip admin-chip" href="admin.html">Админка</a>' : '') +
      '<button class="btn btn-ghost btn-sm" id="logout-btn">Выйти</button>';
    document.getElementById('logout-btn').addEventListener('click', async () => {
      try { await api('/api/logout', {}); } catch (e) {}
      location.reload();
    });
  } else {
    area.innerHTML = '<a class="btn btn-red btn-sm" href="index.html">Войти</a>';
  }
}

function canPost() {
  return user && !user.banned;
}

function crumbHTML(parts) {
  crumb.innerHTML = parts.map((p, i) => {
    const last = i === parts.length - 1;
    return last ? '<b>' + esc(p.label) + '</b>' : '<a href="' + p.href + '">' + esc(p.label) + '</a>';
  }).join(' <span class="c-sep">›</span> ');
}

async function showSections() {
  document.getElementById('f-new-thread').hidden = true;
  crumbHTML([]);
  const d = await api('/api/forum');
  root.innerHTML =
    '<div class="f-search"><input id="f-search-input" placeholder="🔍 Поиск по форуму (темы и сообщения)…"><button class="btn btn-ghost btn-sm" id="f-search-btn">Найти</button></div>' +
    '<div id="f-search-results"></div>' +
    '<div class="f-list">' + d.sections.map(s =>
      '<a class="f-section card" href="#/s/' + s.id + '">' +
        '<div class="f-sec-ico">' + esc(s.icon || '📁') + '</div>' +
        '<div class="f-sec-main"><h3>' + esc(s.title) + (s.adminOnly ? ' <span class="st st-admin">только админ</span>' : '') + '</h3>' +
        '<p>' + esc(s.desc || '') + '</p></div>' +
        '<div class="f-sec-stats"><span><b>' + s.threads + '</b> тем</span><span><b>' + s.posts + '</b> сообщений</span></div>' +
        '<div class="f-sec-last">' + (s.last ? '💬 <a href="#/t/' + s.last.threadId + '">' + esc(s.last.title) + '</a><time>' + esc(s.last.login) + ' • ' + fmtDate(s.last.at) + '</time>' : '<span class="empty" style="padding:0">Тем пока нет</span>') + '</div>' +
      '</a>'
    ).join('') + '</div>';
  const input = document.getElementById('f-search-input');
  const doSearch = async () => {
    const q = input.value.trim();
    const box = document.getElementById('f-search-results');
    if (q.length < 2) { box.innerHTML = ''; return; }
    const r = await api('/api/forum/search?q=' + encodeURIComponent(q));
    box.innerHTML = r.threads.length
      ? '<div class="panel"><h3>Результаты: ' + r.threads.length + '</h3>' + r.threads.map(t =>
        '<div class="edit-item"><div><a href="#/t/' + t.id + '"><b>' + esc(t.title) + '</b></a><p>' + esc(t.snippet) + '</p><p style="margin-top:4px;color:var(--muted);font-size:12px">Раздел: ' + esc(t.sectionTitle) + ' • ' + fmtDate(t.lastAt) + '</p></div></div>'
      ).join('') + '</div>'
      : '<div class="panel"><p class="empty">Ничего не найдено</p></div>';
    box.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { box.innerHTML = ''; input.value = ''; }));
  };
  document.getElementById('f-search-btn').addEventListener('click', doSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
}

async function showSection(id) {
  const d = await api('/api/forum/threads?section=' + id);
  const canCreate = canPost() && (!d.section.adminOnly || canAdminPost());
  const btn = document.getElementById('f-new-thread');
  btn.hidden = !canCreate;
  btn.textContent = '+ Создать тему';
  newThreadSectionId = d.section.id;
  crumbHTML([{ label: 'Форум', href: '#/' }, { label: d.section.title }]);
  root.innerHTML =
    '<div class="panel f-sec-head"><span class="f-sec-ico">' + esc(d.section.icon || '📁') + '</span><div><h3>' + esc(d.section.title) + (d.section.adminOnly ? ' <span class="st st-admin">темы создаёт администрация</span>' : '') + '</h3><p>' + esc(d.section.desc || '') + '</p></div></div>' +
    (d.threads.length
      ? '<div class="f-threads">' + d.threads.map(t =>
        '<a class="f-thread" href="#/t/' + t.id + '">' +
          '<div class="f-th-main">' + (t.pinned ? '📌 ' : '') + (t.locked ? '🔒 ' : '') + '<b>' + esc(t.title) + '</b>' +
          '<time>Автор: ' + esc(t.nick || t.login) + ' • ' + fmtDate(t.created) + '</time></div>' +
          '<div class="f-th-stats"><span><b>' + t.replies + '</b> ответов</span><span><b>' + (t.views || 0) + '</b> просмотров</span></div>' +
          '<div class="f-th-last">💬 ' + fmtDate(t.lastAt) + '</div>' +
        '</a>'
      ).join('') + '</div>'
      : '<div class="panel"><p class="empty">В разделе пока нет тем' + (canCreate ? ' — создай первую!' : '') + '</p></div>');
}

function postHTML(p, thread) {
  const r = p.rank || (p.role === 'admin' ? 'owner' : 'player');
  const staff = ['owner', 'admin', 'moderator', 'helper'].includes(r);
  const canEdit = canPost() && (isMod() || p.userId === user.id);
  const canDelete = staff ? true : (canPost() && p.userId === user.id);
  return '<div class="f-post card" data-post="' + p.id + '">' +
    '<div class="f-post-side">' + avatarHTML(p.nick || p.login, r) +
    '<div class="f-post-author">' + esc(p.nick || p.login) + '</div>' +
    '<span class="st ' + RANKS[r][1] + '">' + RANKS[r][0] + '</span>' +
    '<div class="f-post-count">' + fmtDate(p.created) + '</div></div>' +
    '<div class="f-post-body">' +
      '<div class="f-post-text">' + renderBB(p.text) + '</div>' +
      (p.editedAt ? '<div class="f-edited">изменено ' + fmtDate(p.editedAt) + '</div>' : '') +
      (canPost() ? '<div class="row-actions f-post-actions">' +
        '<button class="btn btn-ghost btn-sm btn-mini" data-quote="' + p.id + '">Цитировать</button>' +
        (canEdit ? '<button class="btn btn-ghost btn-sm btn-mini" data-edit="' + p.id + '">Изменить</button>' : '') +
        (canDelete ? '<button class="btn btn-danger btn-sm btn-mini" data-delpost="' + p.id + '">Удалить</button>' : '') +
      '</div>' : '') +
    '</div></div>';
}

async function showThread(id, page) {
  const d = await api('/api/forum/thread?id=' + id + '&page=' + (page || 1));
  const t = d.thread;
  const canReply = canPost() && (!t.locked || isMod());
  const mod = isMod();
  crumbHTML([
    { label: 'Форум', href: '#/' },
    { label: d.section.title, href: '#/s/' + d.section.id },
    { label: t.title }
  ]);
  document.getElementById('f-new-thread').hidden = true;
  let pager = '';
  if (d.pages > 1) {
    pager = '<div class="f-pager">';
    for (let i = 1; i <= d.pages; i++) {
      pager += '<button class="btn btn-sm ' + (i === d.page ? 'btn-red' : 'btn-ghost') + ' f-page" data-page="' + i + '">' + i + '</button>';
    }
    pager += '</div>';
  }
  root.innerHTML =
    '<div class="panel f-thread-head"><h3>' + (t.pinned ? '📌 ' : '') + esc(t.title) + (t.locked ? ' <span class="st st-rejected">🔒 закрыта</span>' : '') + '</h3>' +
    '<p class="page-sub" style="margin:6px 0 0">' + (t.views || 0) + ' просмотров • ' + d.total + ' сообщений</p>' +
    (mod ? '<div class="row-actions" style="margin-top:12px">' +
      '<button class="btn btn-ghost btn-sm btn-mini" id="t-pin">' + (t.pinned ? 'Открепить' : 'Закрепить') + '</button>' +
      '<button class="btn btn-ghost btn-sm btn-mini" id="t-lock">' + (t.locked ? 'Открыть ответы' : 'Закрыть ответы') + '</button>' +
      '<button class="btn btn-danger btn-sm btn-mini" id="t-del">Удалить тему</button></div>' : '') +
    '</div>' +
    d.posts.map(p => postHTML(p, t)).join('') +
    pager +
    (canReply
      ? '<div class="panel f-reply"><h3>Быстрый ответ</h3>' +
        '<textarea class="f-area" id="reply-text" maxlength="5000" placeholder="Напиши сообщение… Поддерживается BB-коды: [b] [i] [u] [color] [size] [quote] [code] [spoiler]"></textarea>' +
        '<div class="form-error" id="reply-error"></div>' +
        '<button class="btn btn-red" id="reply-send">Ответить</button></div>'
      : '<div class="panel"><p class="empty">' + (t.locked ? '🔒 Тема закрыта для ответов' : user ? '' : '<a href="index.html" style="color:var(--red)">Войди</a>, чтобы отвечать') + '</p></div>');

  attachToolbar(document.getElementById('reply-text'));

  if (mod) {
    document.getElementById('t-pin').addEventListener('click', async () => {
      try { await api('/api/forum/thread/pin', { id: t.id, value: !t.pinned }); showThread(id, d.page); } catch (ex) { showToast(ex.message); }
    });
    document.getElementById('t-lock').addEventListener('click', async () => {
      try { await api('/api/forum/thread/lock', { id: t.id, value: !t.locked }); showThread(id, d.page); } catch (ex) { showToast(ex.message); }
    });
    document.getElementById('t-del').addEventListener('click', async () => {
      if (!confirm('Удалить тему со всеми сообщениями?')) return;
      try { await api('/api/forum/thread/delete', { id: t.id }); location.hash = '#/s/' + d.section.id; } catch (ex) { showToast(ex.message); }
    });
  }
  root.querySelectorAll('.f-page').forEach(b => b.addEventListener('click', () => showThread(id, Number(b.dataset.page))));

  const replyTa = document.getElementById('reply-text');
  root.querySelectorAll('[data-quote]').forEach(b => b.addEventListener('click', () => {
    const p = d.posts.find(x => x.id === Number(b.dataset.quote));
    if (!p) return;
    let sel = '';
    try { sel = String(window.getSelection() || ''); } catch (e) {}
    let text = sel && sel.length > 1 ? sel : p.text;
    if (text.length > 300) text = text.slice(0, 300) + '…';
    const r = p.rank || (p.role === 'admin' ? 'owner' : 'player');
    const tag = '[quote=' + (p.nick || p.login) + ' (' + RANKS[r][0] + ')]' + text.replace(/\[\/?quote[^\]]*\]/g, '') + '[/quote]';
    if (replyTa) {
      replyTa.value += (replyTa.value ? '\n' : '') + tag + '\n';
      replyTa.focus();
      replyTa.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      showToast('Тема закрыта — цитировать нельзя');
    }
  }));

  if (canReply) {
    document.getElementById('reply-send').addEventListener('click', async () => {
      const err = document.getElementById('reply-error');
      err.textContent = '';
      const text = replyTa.value.trim();
      if (!text) { err.textContent = 'Сообщение не может быть пустым'; return; }
      try {
        await api('/api/forum/post', { threadId: t.id, text });
        showToast('Ответ опубликован');
        showThread(id, d.pages);
      } catch (ex) { err.textContent = ex.message; }
    });
  }

  root.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    const postEl = b.closest('.f-post');
    const id2 = Number(b.dataset.edit);
    const p = d.posts.find(x => x.id === id2);
    if (!p) return;
    const textEl = postEl.querySelector('.f-post-text');
    textEl.innerHTML = '<textarea class="f-area f-edit-area" id="edit-ta-' + id2 + '" maxlength="5000">' + esc(p.text) + '</textarea>' +
      '<div class="row-actions" style="margin-top:10px"><button class="btn btn-red btn-sm btn-mini" data-save="' + id2 + '">Сохранить</button>' +
      '<button class="btn btn-ghost btn-sm btn-mini" data-cancel="1">Отмена</button></div>';
    attachToolbar(document.getElementById('edit-ta-' + id2));
    postEl.querySelector('[data-save]').addEventListener('click', async () => {
      const val = postEl.querySelector('.f-edit-area').value.trim();
      if (!val) { showToast('Сообщение не может быть пустым'); return; }
      try { await api('/api/forum/post/edit', { id: id2, text: val }); showThread(t.id, d.page); } catch (ex) { showToast(ex.message); }
    });
    postEl.querySelector('[data-cancel]').addEventListener('click', () => showThread(t.id, d.page));
  }));

  root.querySelectorAll('[data-delpost]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Удалить сообщение?')) return;
    try { await api('/api/forum/post/delete', { id: Number(b.dataset.delpost) }); showThread(t.id, d.page); } catch (ex) { showToast(ex.message); }
  }));
}

document.getElementById('f-new-thread').addEventListener('click', () => {
  if (!newThreadSectionId) return;
  if (!canPost()) { showToast('Войди в аккаунт, чтобы создавать темы'); return; }
  document.getElementById('nt-error').textContent = '';
  document.getElementById('newthread-form').reset();
  const m = document.getElementById('newthread-modal');
  m.hidden = false;
  requestAnimationFrame(() => m.classList.add('open'));
  attachToolbar(document.getElementById('nt-text'));
});

document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => {
  const m = document.getElementById(b.dataset.close);
  m.classList.remove('open');
  setTimeout(() => { m.hidden = true; }, 200);
}));
document.getElementById('newthread-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) {
    const m = e.currentTarget;
    m.classList.remove('open');
    setTimeout(() => { m.hidden = true; }, 200);
  }
});

document.getElementById('newthread-form').addEventListener('submit', async e => {
  e.preventDefault();
  const err = document.getElementById('nt-error');
  err.textContent = '';
  const f = e.target;
  try {
    const d = await api('/api/forum/thread', { sectionId: newThreadSectionId, title: f.title.value.trim(), text: f.text.value.trim() });
    const m = document.getElementById('newthread-modal');
    m.classList.remove('open');
    setTimeout(() => { m.hidden = true; }, 200);
    location.hash = '#/t/' + d.id;
  } catch (ex) { err.textContent = ex.message; }
});

function route() {
  const h = location.hash || '#/';
  const t = h.match(/^#\/t\/(\d+)$/);
  const s = h.match(/^#\/s\/(\d+)$/);
  root.innerHTML = '<p class="empty">Загрузка…</p>';
  if (t) showThread(Number(t[1]), 1);
  else if (s) showSection(Number(s[1]));
  else showSections();
}

window.addEventListener('hashchange', route);

(async () => {
  try {
    const me = await api('/api/me');
    user = me.user;
  } catch (e) {}
  renderAuth();
  route();
})();
