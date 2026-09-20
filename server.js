const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

const RANKS = {
  owner: { label: 'Владелец', panel: true, mod: true, delAny: true, adminPost: true },
  admin: { label: 'Гл. админ', panel: true, mod: true, delAny: true, adminPost: true },
  moderator: { label: 'Модератор', panel: false, mod: true, delAny: true, adminPost: false },
  helper: { label: 'Хелпер', panel: false, mod: false, delAny: true, adminPost: false },
  vip: { label: 'VIP игрок', panel: false, mod: false, delAny: false, adminPost: false },
  player: { label: 'Игрок', panel: false, mod: false, delAny: false, adminPost: false }
};

function rankOf(u) {
  if (u && RANKS[u.rank]) return u.rank;
  return u && u.role === 'admin' ? 'owner' : 'player';
}
function canPanel(u) { return !!u && RANKS[rankOf(u)].panel; }
function canMod(u) { return !!u && RANKS[rankOf(u)].mod; }
function canDelAny(u) { return !!u && RANKS[rankOf(u)].delAny; }
function canAdminPost(u) { return !!u && RANKS[rankOf(u)].adminPost; }

function seed() {
  return {
    seq: 100,
    users: [
      {
        id: 1,
        login: 'admin',
        loginLower: 'admin',
        pass: hashPassword('admin123'),
        nick: 'ГлавныйАдмин',
        role: 'admin',
        rank: 'owner',
        banned: false,
        balance: 0,
        priv: [],
        created: new Date().toISOString(),
        lastLogin: null,
        lastFreeSpin: null
      }
    ],
    sessions: {},
    news: [
      {
        id: 1,
        title: 'Открытие Nexon Role-Play!',
        text: 'Сервер официально открыт. Первые 100 игроков получают стартовый бонус 50.000$ на счёт и уникальный скин. Заходи скорее — город ждёт своих героев!',
        date: '2026-09-01',
        pinned: true
      },
      {
        id: 2,
        title: 'Обновление Criminal Russia 2.0',
        text: 'Новая карта, доработанные тачки, перерисованный юг города и куча фиксов. Полный ченджлог — в нашем Discord.',
        date: '2026-08-28',
        pinned: false
      },
      {
        id: 3,
        title: 'Ивент: Гонка на выживание',
        text: 'В субботу в 20:00 — уличные гонки по кольцу с призовым фондом 500.000$. Регистрация у механиков в Дистрикте.',
        date: '2026-08-25',
        pinned: false
      }
    ],
    plans: [
      {
        id: 1,
        title: 'Стартовый',
        price: 99,
        days: 7,
        perks: ['Статус START', 'Смена ника', 'Цветной ник в чате', 'Комната /start'],
        popular: false
      },
      {
        id: 2,
        title: 'Бонусный',
        price: 299,
        days: 30,
        perks: ['Статус BONUS', 'Всё из START', '+1 слот машины', 'Бонусный сундук раз в день'],
        popular: true
      },
      {
        id: 3,
        title: 'VIP',
        price: 499,
        days: 30,
        perks: ['Статус VIP', 'Всё из BONUS', '+3 слота машин', 'VIP-скины', 'Очередь на вход в приоритете'],
        popular: false
      },
      {
        id: 4,
        title: 'МЕГА',
        price: 999,
        days: 90,
        perks: ['Статус MEGA', 'Всё из VIP', '+10 слотов машин', 'Личный номер', 'Дом в элитном районе'],
        popular: false
      }
    ],
    orders: [],
    spins: [],
    cases: [
      { id: 1, title: 'Стандартный', icon: '📦', img: 'case-standard.svg', accent: '#35a2ff', cost: 99, freeDaily: true, order: 1, enabled: true },
      { id: 2, title: 'Автопарк', icon: '🚗', img: 'case-auto.svg', accent: '#ff5a4d', cost: 299, freeDaily: false, order: 2, enabled: true },
      { id: 3, title: 'Легенда', icon: '👑', img: 'case-legend.svg', accent: '#ffb03a', cost: 599, freeDaily: false, order: 3, enabled: true }
    ],
    prizes: [
      { id: 8, title: 'Джекпот: 1.000.000 вирт', icon: '💰', img: 'jackpot.svg', rarity: 'legend', chance: 0.5, type: 'virtual', value: 'Джекпот: 1.000.000 вирт на счёт', caseId: 1, category: 'money', enabled: true },
      { id: 1, title: 'MEGA — 90 дней', icon: '👑', img: 'mega.svg', rarity: 'legend', chance: 1, type: 'virtual', value: 'MEGA — 90 дней', caseId: 1, category: 'status', enabled: true },
      { id: 9, title: 'Дом у моря', icon: '🏝️', img: 'house.svg', rarity: 'epic', chance: 2, type: 'virtual', value: 'Дом у моря — бесплатно', caseId: 1, category: 'property', enabled: true },
      { id: 2, title: 'Спорткар Skyline', icon: '🏎️', img: 'skyline.svg', rarity: 'epic', chance: 2, type: 'virtual', value: 'Спорткар Nissan Skyline', caseId: 1, category: 'transport', enabled: true },
      { id: 10, title: 'Спортбайк Hayabusa', icon: '🏍️', img: 'bike.svg', rarity: 'epic', chance: 3, type: 'virtual', value: 'Спортбайк Suzuki Hayabusa', caseId: 1, category: 'transport', enabled: true },
      { id: 3, title: 'VIP — 30 дней', icon: '💎', img: 'vip.svg', rarity: 'epic', chance: 4, type: 'virtual', value: 'VIP — 30 дней', caseId: 1, category: 'status', enabled: true },
      { id: 11, title: '+2 прокрута рулетки', icon: '🎟️', img: 'ticket.svg', rarity: 'rare', chance: 4, type: 'spins', value: 2, caseId: 1, category: 'bonus', enabled: true },
      { id: 12, title: 'Красивый номер авто', icon: '🔖', img: 'plate.svg', rarity: 'rare', chance: 4, type: 'virtual', value: 'Красивый номер на авто (NEXON 777)', caseId: 1, category: 'items', enabled: true },
      { id: 13, title: 'Индивидуальный скин', icon: '👕', img: 'skin.svg', rarity: 'rare', chance: 5, type: 'virtual', value: 'Индивидуальный скин персонажа', caseId: 1, category: 'items', enabled: true },
      { id: 29, title: 'Квадроцикл', icon: '🛺', img: 'quad.svg', rarity: 'rare', chance: 6, type: 'virtual', value: 'Квадроцикл — бесплатно', caseId: 1, category: 'transport', enabled: true },
      { id: 30, title: 'Гараж на 5 машин', icon: '🏚️', img: 'garage.svg', rarity: 'rare', chance: 5, type: 'virtual', value: 'Гараж на 5 машин', caseId: 1, category: 'property', enabled: true },
      { id: 4, title: '+50 ₽ на баланс', icon: '💰', img: 'money.svg', rarity: 'rare', chance: 8, type: 'balance', value: 50, caseId: 1, category: 'money', enabled: true },
      { id: 5, title: 'Бонусный — 30 дней', icon: '🎁', img: 'bonus.svg', rarity: 'rare', chance: 12, type: 'virtual', value: 'Бонусный — 30 дней', caseId: 1, category: 'status', enabled: true },
      { id: 28, title: '+1 прокрут рулетки', icon: '🎟️', img: 'ticket.svg', rarity: 'common', chance: 8, type: 'spins', value: 1, caseId: 1, category: 'bonus', enabled: true },
      { id: 14, title: 'Ремкомплект + нитро', icon: '🔧', img: 'wrench.svg', rarity: 'common', chance: 10, type: 'virtual', value: 'Ремкомплект + баллон нитро', caseId: 1, category: 'items', enabled: true },
      { id: 6, title: 'Смена ника бесплатно', icon: '🪪', img: 'nick.svg', rarity: 'common', chance: 11.5, type: 'virtual', value: 'Смена ника — бесплатно', caseId: 1, category: 'items', enabled: true },
      { id: 7, title: '100.000 вирт', icon: '🪙', img: 'virt.svg', rarity: 'common', chance: 14, type: 'virtual', value: '100.000 вирт на счёт', caseId: 1, category: 'money', enabled: true },
      { id: 71, title: 'ZAZ 968', icon: '🚗', img: 'car-zaz.svg', rarity: 'common', chance: 5, type: 'virtual', value: 'ZAZ 968 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 72, title: 'Moskvich', icon: '🚗', img: 'car-moskvich.svg', rarity: 'common', chance: 5, type: 'virtual', value: 'Moskvich — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 73, title: 'Volga GAZ-24', icon: '🚗', img: 'car-volga.svg', rarity: 'common', chance: 5, type: 'virtual', value: 'Volga GAZ-24 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 74, title: 'VAZ-2101', icon: '🚗', img: 'car-2101.svg', rarity: 'common', chance: 5, type: 'virtual', value: 'VAZ-2101 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 75, title: 'VAZ-2107', icon: '🚗', img: 'car-2107.svg', rarity: 'common', chance: 5, type: 'virtual', value: 'VAZ-2107 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 76, title: 'UAZ-469', icon: '🚗', img: 'car-uaz.svg', rarity: 'common', chance: 5, type: 'virtual', value: 'UAZ-469 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 40, title: 'BMW 5 (E60)', icon: '🚗', img: 'car-bmw5.svg', rarity: 'common', chance: 3, type: 'virtual', value: 'BMW 5 (E60) — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 41, title: 'Mercedes-Benz E-Class (W211)', icon: '🚗', img: 'car-mbe.svg', rarity: 'common', chance: 3, type: 'virtual', value: 'Mercedes-Benz E-Class (W211) — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 42, title: 'Audi A6', icon: '🚗', img: 'car-a6.svg', rarity: 'common', chance: 3, type: 'virtual', value: 'Audi A6 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 43, title: 'Toyota Camry', icon: '🚗', img: 'car-camry.svg', rarity: 'common', chance: 3, type: 'virtual', value: 'Toyota Camry — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 44, title: 'Honda Accord', icon: '🚗', img: 'car-accord.svg', rarity: 'common', chance: 3, type: 'virtual', value: 'Honda Accord — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 45, title: 'Volvo S80', icon: '🚗', img: 'car-s80.svg', rarity: 'common', chance: 3, type: 'virtual', value: 'Volvo S80 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 46, title: 'Lexus GS', icon: '🚗', img: 'car-lexgs.svg', rarity: 'common', chance: 3, type: 'virtual', value: 'Lexus GS — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 47, title: 'Infiniti G35', icon: '🚗', img: 'car-g35.svg', rarity: 'common', chance: 3, type: 'virtual', value: 'Infiniti G35 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 48, title: 'BMW 7 (E65)', icon: '🚙', img: 'car-bmw7.svg', rarity: 'rare', chance: 2.5, type: 'virtual', value: 'BMW 7 (E65) — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 49, title: 'Mercedes-Benz S-Class (W221)', icon: '🚙', img: 'car-mbs.svg', rarity: 'rare', chance: 2.5, type: 'virtual', value: 'Mercedes-Benz S-Class (W221) — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 50, title: 'Audi A8', icon: '🚙', img: 'car-a8.svg', rarity: 'rare', chance: 2.5, type: 'virtual', value: 'Audi A8 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 51, title: 'Bentley Continental GT', icon: '🚙', img: 'car-bentley.svg', rarity: 'epic', chance: 2.5, type: 'virtual', value: 'Bentley Continental GT — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 58, title: 'Nissan GT-R', icon: '🏁', img: 'car-gtr.svg', rarity: 'epic', chance: 2.5, type: 'virtual', value: 'Nissan GT-R — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 59, title: 'Toyota Supra', icon: '🏁', img: 'car-supra.svg', rarity: 'epic', chance: 2.5, type: 'virtual', value: 'Toyota Supra — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 62, title: 'Mazda RX-7', icon: '🏁', img: 'car-rx7.svg', rarity: 'epic', chance: 2, type: 'virtual', value: 'Mazda RX-7 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 52, title: 'BMW M3', icon: '🏁', img: 'car-m3.svg', rarity: 'rare', chance: 1.5, type: 'virtual', value: 'BMW M3 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 53, title: 'BMW M5', icon: '🏁', img: 'car-m5.svg', rarity: 'rare', chance: 1.5, type: 'virtual', value: 'BMW M5 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 54, title: 'Mercedes AMG C63', icon: '🏁', img: 'car-c63.svg', rarity: 'rare', chance: 1.5, type: 'virtual', value: 'Mercedes AMG C63 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 55, title: 'Mercedes AMG E63', icon: '🏁', img: 'car-e63.svg', rarity: 'rare', chance: 1.5, type: 'virtual', value: 'Mercedes AMG E63 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 56, title: 'Audi RS6', icon: '🏁', img: 'car-rs6.svg', rarity: 'rare', chance: 1.5, type: 'virtual', value: 'Audi RS6 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 57, title: 'Audi RS7', icon: '🏁', img: 'car-rs7.svg', rarity: 'rare', chance: 1.5, type: 'virtual', value: 'Audi RS7 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 60, title: 'Mitsubishi Lancer Evo', icon: '🏁', img: 'car-evo.svg', rarity: 'rare', chance: 1, type: 'virtual', value: 'Mitsubishi Lancer Evo — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 61, title: 'Subaru Impreza WRX', icon: '🏁', img: 'car-wrx.svg', rarity: 'rare', chance: 1, type: 'virtual', value: 'Subaru Impreza WRX — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 63, title: 'Ferrari 488', icon: '🏎️', img: 'car-f488.svg', rarity: 'epic', chance: 0.8, type: 'virtual', value: 'Ferrari 488 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 64, title: 'Ferrari F12', icon: '🏎️', img: 'car-f12.svg', rarity: 'epic', chance: 0.6, type: 'virtual', value: 'Ferrari F12 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 65, title: 'Lamborghini Huracan', icon: '🏎️', img: 'car-huracan.svg', rarity: 'epic', chance: 0.8, type: 'virtual', value: 'Lamborghini Huracan — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 66, title: 'Lamborghini Aventador', icon: '🏎️', img: 'car-aventador.svg', rarity: 'epic', chance: 0.5, type: 'virtual', value: 'Lamborghini Aventador — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 67, title: 'McLaren 720S', icon: '🏎️', img: 'car-720s.svg', rarity: 'epic', chance: 0.7, type: 'virtual', value: 'McLaren 720S — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 68, title: 'McLaren P1', icon: '🏎️', img: 'car-p1.svg', rarity: 'epic', chance: 0.5, type: 'virtual', value: 'McLaren P1 — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 69, title: 'Porsche 911 Turbo', icon: '🏎️', img: 'car-911.svg', rarity: 'epic', chance: 0.9, type: 'virtual', value: 'Porsche 911 Turbo — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 70, title: 'Bugatti Veyron', icon: '👑', img: 'car-bugatti.svg', rarity: 'legend', chance: 0.2, type: 'virtual', value: 'Bugatti Veyron — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 31, title: 'Личный вертолёт', icon: '🚁', img: 'heli.svg', rarity: 'legend', chance: 1.5, type: 'virtual', value: 'Личный вертолёт', caseId: 2, category: 'transport', enabled: true },
      { id: 15, title: 'Спорткар Skyline', icon: '🏎️', img: 'skyline.svg', rarity: 'epic', chance: 1, type: 'virtual', value: 'Спорткар Nissan Skyline', caseId: 2, category: 'transport', enabled: true },
      { id: 16, title: 'Спортбайк Hayabusa', icon: '🏍️', img: 'bike.svg', rarity: 'epic', chance: 1, type: 'virtual', value: 'Спортбайк Suzuki Hayabusa', caseId: 2, category: 'transport', enabled: true },
      { id: 32, title: 'Гараж на 10 машин', icon: '🏚️', img: 'garage.svg', rarity: 'epic', chance: 1.5, type: 'virtual', value: 'Гараж на 10 машин', caseId: 2, category: 'property', enabled: true },
      { id: 17, title: 'Красивый номер авто', icon: '🔖', img: 'plate.svg', rarity: 'rare', chance: 1.5, type: 'virtual', value: 'Красивый номер на авто (NEXON 777)', caseId: 2, category: 'items', enabled: true },
      { id: 33, title: 'Квадроцикл', icon: '🛺', img: 'quad.svg', rarity: 'rare', chance: 1.5, type: 'virtual', value: 'Квадроцикл — бесплатно', caseId: 2, category: 'transport', enabled: true },
      { id: 18, title: 'Ремкомплект + нитро ×3', icon: '🔧', img: 'wrench.svg', rarity: 'common', chance: 1.5, type: 'virtual', value: 'Ремкомплект + 3 баллона нитро', caseId: 2, category: 'items', enabled: true },
      { id: 19, title: '250.000 вирт', icon: '🪙', img: 'virt.svg', rarity: 'rare', chance: 1.5, type: 'virtual', value: '250.000 вирт на счёт', caseId: 2, category: 'money', enabled: true },
      { id: 20, title: '+20 ₽ на баланс', icon: '💰', img: 'money.svg', rarity: 'common', chance: 2, type: 'balance', value: 20, caseId: 2, category: 'money', enabled: true },
      { id: 21, title: 'Джекпот: 1.000.000 вирт', icon: '💰', img: 'jackpot.svg', rarity: 'legend', chance: 1.5, type: 'virtual', value: 'Джекпот: 1.000.000 вирт на счёт', caseId: 3, category: 'money', enabled: true },
      { id: 22, title: 'MEGA — 90 дней', icon: '👑', img: 'mega.svg', rarity: 'legend', chance: 4, type: 'virtual', value: 'MEGA — 90 дней', caseId: 3, category: 'status', enabled: true },
      { id: 34, title: 'Личный вертолёт', icon: '🚁', img: 'heli.svg', rarity: 'legend', chance: 4, type: 'virtual', value: 'Личный вертолёт', caseId: 3, category: 'transport', enabled: true },
      { id: 23, title: 'Дом у моря', icon: '🏝️', img: 'house.svg', rarity: 'epic', chance: 6, type: 'virtual', value: 'Дом у моря — бесплатно', caseId: 3, category: 'property', enabled: true },
      { id: 35, title: 'Личная яхта', icon: '🛥️', img: 'yacht.svg', rarity: 'epic', chance: 6, type: 'virtual', value: 'Личная яхта в порту', caseId: 3, category: 'property', enabled: true },
      { id: 24, title: 'VIP — 90 дней', icon: '💎', img: 'vip.svg', rarity: 'epic', chance: 8, type: 'virtual', value: 'VIP — 90 дней', caseId: 3, category: 'status', enabled: true },
      { id: 36, title: '+5 прокрутов', icon: '🎟️', img: 'ticket.svg', rarity: 'rare', chance: 8, type: 'spins', value: 5, caseId: 3, category: 'bonus', enabled: true },
      { id: 25, title: '+200 ₽ на баланс', icon: '💰', img: 'money.svg', rarity: 'rare', chance: 20, type: 'balance', value: 200, caseId: 3, category: 'money', enabled: true },
      { id: 26, title: '500.000 вирт', icon: '🪙', img: 'virt.svg', rarity: 'rare', chance: 21, type: 'virtual', value: '500.000 вирт на счёт', caseId: 3, category: 'money', enabled: true },
      { id: 27, title: 'Индивидуальный скин', icon: '👕', img: 'skin.svg', rarity: 'rare', chance: 21.5, type: 'virtual', value: 'Индивидуальный скин персонажа', caseId: 3, category: 'items', enabled: true }
    ],
    sections: [
      { id: 1, title: 'Новости и анонсы', icon: '📢', desc: 'Официальные новости сервера от администрации', order: 1, adminOnly: true },
      { id: 2, title: 'Общий раздел', icon: '💬', desc: 'Свободное общение обо всём: игра, жизнь, оффтоп', order: 2, adminOnly: false },
      { id: 3, title: 'Автопарк и тюнинг', icon: '🚗', desc: 'Тачки, прокачка, покраска, продажа', order: 3, adminOnly: false },
      { id: 4, title: 'Жалобы и апелляции', icon: '🛡️', desc: 'Жалобы на игроков, заявки на разбан', order: 4, adminOnly: false },
      { id: 5, title: 'Идеи и предложения', icon: '💡', desc: 'Как сделать сервер ещё лучше', order: 5, adminOnly: false }
    ],
    threads: [
      { id: 1, sectionId: 1, userId: 1, login: 'admin', nick: 'ГлавныйАдмин', title: 'Добро пожаловать на форум Nexon Role-Play!', pinned: true, locked: false, views: 137, created: new Date().toISOString(), lastAt: new Date().toISOString() }
    ],
    posts: [
      { id: 2, threadId: 1, userId: 1, login: 'admin', nick: 'ГлавныйАдмин', role: 'admin', text: 'Привет, город! 👋\n\nФорум открыт — здесь мы публикуем новости, принимаем жалобы и идеи, обсуждаем тачки и бизнесы.\n\nПравила простые:\n— уважай других игроков;\n— никакого флуда и капса;\n— жалобы — с доказательствами (скрины/видео);\n— реклама сторонних проектов = бан.\n\nПолные правила — на главной сайта. Хорошей игры!', created: new Date().toISOString(), editedAt: null }
    ],
    rules: [
      { id: 1, title: 'Уважение', text: 'Запрещены оскорбления, токсичность и провокации в адрес игроков и администрации.' },
      { id: 2, title: 'Читы и баги', text: 'Использование читов, багов и стороннего ПО — бан навсегда без предупреждения.' },
      { id: 3, title: 'DM / DB', text: 'Запрещён Deathmatch (убийство без причины) и Driveby (стрельба из транспорта без причины).' },
      { id: 4, title: 'MG', text: 'Метагейминг запрещён: нельзя использовать информацию из реальной жизни в игре (Discord, стримы).' },
      { id: 5, title: 'PG', text: 'Павергейминг запрещён: нельзя навязывать свои действия другим игрокам и играть за них.' },
      { id: 6, title: 'DM в чате', text: 'Запрещён флуд, капс, реклама сторонних проектов и спам в любые чаты.' },
      { id: 7, title: 'Обман', text: 'Скрин сделки обязателен. Обман игроков и мошенничество — бан аккаунта и обнуление имущества.' },
      { id: 8, title: 'Никнейм', text: 'Ник должен быть адекватным: имя_фамилия на английском. Никонейм и рп-отыгрыш обязательны.' }
    ],
    settings: {
      serverName: 'Nexon Role-Play',
      serverIp: 'nexon-rp.ru:7777',
      discord: 'discord.gg/nexonrp',
      vk: 'vk.com/nexonrp',
      promo: { code: 'NEXON', percent: 10 },
      roulette: { cost: 99 },
      monitor: { name: 'Nexon Role-Play', mode: 'Role-Play', map: 'Criminal Russia', version: 'CRMP 0.3.7', players: 328, max: 500 }
    }
  };
}

let db;
function loadDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      migrateDb();
      return;
    } catch (e) {}
  }
  db = seed();
  saveDb();
}

function saveDb() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

function migrateDb() {
  const s = seed();
  let dirty = false;
  if (!Array.isArray(db.prizes)) { db.prizes = s.prizes; dirty = true; }
  if (!Array.isArray(db.spins)) { db.spins = []; dirty = true; }
  if (!Array.isArray(db.sections)) { db.sections = s.sections; db.threads = s.threads; db.posts = s.posts; dirty = true; }
  else {
    if (!Array.isArray(db.threads)) { db.threads = []; dirty = true; }
    if (!Array.isArray(db.posts)) { db.posts = []; dirty = true; }
  }
  if (!Array.isArray(db.promocodes)) { db.promocodes = []; dirty = true; }
  if (!db.settings.roulette) { db.settings.roulette = s.settings.roulette; dirty = true; }
  db.users.forEach(u => { if (u.lastFreeSpin === undefined) { u.lastFreeSpin = null; dirty = true; } });
  db.users.forEach(u => { if (u.spinStreak === undefined) { u.spinStreak = 0; dirty = true; } });
  db.users.forEach(u => { if (u.bonusSpins === undefined) { u.bonusSpins = 0; dirty = true; } });
  db.users.forEach(u => { if (!u.rank) { u.rank = u.role === 'admin' ? 'owner' : 'player'; dirty = true; } });
  if (!Array.isArray(db.prizesSynced2Done)) db.prizesSynced2Done = false;
  if (!db.prizesSynced4) {
    for (const sp of s.prizes) {
      const ex = db.prizes.find(p => p.id === sp.id);
      if (ex) { ex.chance = sp.chance; ex.category = sp.category; if (!ex.img) ex.img = sp.img; }
      else db.prizes.push(sp);
    }
    db.prizesSynced4 = true;
    dirty = true;
  }
  if (!db.prizesSynced3) {
    for (const sp of s.prizes) {
      const ex = db.prizes.find(p => p.id === sp.id);
      if (ex) { ex.chance = sp.chance; ex.category = sp.category; if (!ex.img) ex.img = sp.img; }
      else db.prizes.push(sp);
    }
    db.prizesSynced3 = true;
    dirty = true;
  }
  if (!db.prizesSynced2Done) {
    if (!Array.isArray(db.cases)) {
      db.cases = s.cases;
      db.prizes.forEach(p => { if (!p.caseId) p.caseId = 1; });
    }
    for (const sp of s.prizes) {
      if (!db.prizes.some(p => p.id === sp.id)) db.prizes.push(sp);
    }
    db.prizesSynced2Done = true;
    dirty = true;
  }
  db.prizes.forEach(p => {
    if (!p.img) {
      const sp = s.prizes.find(x => x.id === p.id) || s.prizes.find(x => x.title === p.title);
      if (sp) { p.img = sp.img; dirty = true; }
    }
  });
  if (dirty) saveDb();
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    login: u.login,
    nick: u.nick,
    role: u.role,
    rank: rankOf(u),
    banned: u.banned,
    balance: u.balance,
    priv: u.priv || [],
    spinStreak: u.spinStreak || 0,
    created: u.created,
    lastLogin: u.lastLogin
  };
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  raw.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function sessionUser(req) {
  const sid = parseCookies(req).sid;
  if (!sid) return null;
  const s = db.sessions[sid];
  if (!s || s.exp < Date.now()) {
    if (s) { delete db.sessions[sid]; saveDb(); }
    return null;
  }
  return db.users.find(u => u.id === s.uid) || null;
}

function startSession(res, uid) {
  const sid = crypto.randomBytes(24).toString('hex');
  db.sessions[sid] = { uid, exp: Date.now() + 7 * 24 * 3600 * 1000 };
  saveDb();
  res.setHeader('Set-Cookie', 'sid=' + sid + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800');
}

function endSession(req, res) {
  const sid = parseCookies(req).sid;
  if (sid && db.sessions[sid]) { delete db.sessions[sid]; saveDb(); }
  res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req, limit) {
  const max = limit || 100000;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => {
      data += c;
      if (data.length > max) { reject(new Error('too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve(null); }
    });
    req.on('error', reject);
  });
}

function monitorNow() {
  const m = Object.assign({}, db.settings.monitor);
  const base = Number(m.players) || 0;
  let p = base + Math.floor(Math.random() * 21) - 10;
  p = Math.max(0, Math.min(Number(m.max) || 500, p));
  m.players = p;
  return m;
}

async function api(req, res, pathname, query) {
  const user = sessionUser(req);
  const method = req.method;

  if (method === 'GET' && pathname === '/api/site') {
    const news = db.news.slice().sort((a, b) => (b.pinned - a.pinned) || (b.date > a.date ? 1 : -1));
    return sendJSON(res, 200, { news, plans: db.plans, rules: db.rules, settings: db.settings, monitor: monitorNow(), accounts: db.users.length });
  }

  if (method === 'POST' && pathname === '/api/register') {
    const b = await readBody(req);
    if (!b) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    const login = String(b.login || '').trim();
    const password = String(b.password || '');
    const nick = String(b.nick || '').trim() || login;
    if (!/^[A-Za-z0-9_]{3,20}$/.test(login)) return sendJSON(res, 400, { error: 'Логин: 3-20 символов, латиница, цифры, _' });
    if (password.length < 4) return sendJSON(res, 400, { error: 'Пароль минимум 4 символа' });
    if (db.users.some(u => u.loginLower === login.toLowerCase())) return sendJSON(res, 409, { error: 'Такой логин уже занят' });
    const u = {
      id: ++db.seq,
      login,
      loginLower: login.toLowerCase(),
      pass: hashPassword(password),
      nick,
      role: 'user',
      banned: false,
      balance: 0,
      priv: [],
      created: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    db.users.push(u);
    startSession(res, u.id);
    saveDb();
    return sendJSON(res, 200, { user: publicUser(u) });
  }

  if (method === 'POST' && pathname === '/api/login') {
    const b = await readBody(req);
    if (!b) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    const u = db.users.find(x => x.loginLower === String(b.login || '').trim().toLowerCase());
    if (!u || !verifyPassword(String(b.password || ''), u.pass)) return sendJSON(res, 401, { error: 'Неверный логин или пароль' });
    if (u.banned) return sendJSON(res, 403, { error: 'Аккаунт заблокирован' });
    u.lastLogin = new Date().toISOString();
    startSession(res, u.id);
    saveDb();
    return sendJSON(res, 200, { user: publicUser(u) });
  }

  if (method === 'POST' && pathname === '/api/logout') {
    endSession(req, res);
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/me') {
    return sendJSON(res, 200, { user: publicUser(user) });
  }

  if (method === 'POST' && pathname === '/api/password') {
    if (!user) return sendJSON(res, 401, { error: 'Требуется вход' });
    const b = await readBody(req);
    if (!b) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    if (!verifyPassword(String(b.current || ''), user.pass)) return sendJSON(res, 400, { error: 'Текущий пароль неверный' });
    if (String(b.next || '').length < 4) return sendJSON(res, 400, { error: 'Новый пароль минимум 4 символа' });
    user.pass = hashPassword(String(b.next));
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/cabinet') {
    if (!user) return sendJSON(res, 401, { error: 'Требуется вход' });
    const orders = db.orders.filter(o => o.userId === user.id).sort((a, b) => b.created > a.created ? 1 : -1);
    return sendJSON(res, 200, { user: publicUser(user), orders });
  }

  if (method === 'POST' && pathname === '/api/order') {
    if (!user) return sendJSON(res, 401, { error: 'Требуется вход' });
    const b = await readBody(req);
    if (!b) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    const plan = db.plans.find(p => p.id === Number(b.planId));
    if (!plan) return sendJSON(res, 404, { error: 'Тариф не найден' });
    const nick = String(b.nick || '').trim() || user.nick;
    let price = Number(plan.price);
    const promo = db.settings.promo || {};
    if (promo.code && String(b.promo || '').trim().toUpperCase() === String(promo.code).toUpperCase()) {
      price = Math.max(0, Math.round(price * (100 - Number(promo.percent) || 0)) / 100);
    }
    const order = {
      id: ++db.seq,
      userId: user.id,
      login: user.login,
      planId: plan.id,
      planTitle: plan.title,
      days: plan.days,
      price,
      nick,
      status: 'new',
      created: new Date().toISOString()
    };
    db.orders.push(order);
    saveDb();
    return sendJSON(res, 200, { order });
  }

  const maskLogin = l => String(l).length <= 2 ? String(l) + '***' : String(l).slice(0, 2) + '***';

  if (method === 'GET' && pathname === '/api/roulette/info') {
    const FREE_CD = 24 * 3600 * 1000;
    const last = user && user.lastFreeSpin ? new Date(user.lastFreeSpin).getTime() : 0;
    const dailyFree = !last || Date.now() - last >= FREE_CD;
    const bonusFree = user && (user.bonusSpins || 0) > 0;
    const cases = db.cases
      .filter(c => c.enabled !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(c => Object.assign({}, c, { prizes: db.prizes.filter(p => p.caseId === c.id && p.enabled !== false) }));
    return sendJSON(res, 200, {
      cases,
      free: dailyFree || bonusFree,
      dailyFree,
      bonusSpins: user ? user.bonusSpins || 0 : 0,
      nextFreeAt: user && !dailyFree && !bonusFree ? new Date(last + FREE_CD).toISOString() : null,
      streak: user ? user.spinStreak || 0 : 0,
      balance: user ? user.balance : 0,
      user: user ? publicUser(user) : null,
      history: db.spins.slice(-15).reverse().map(s => ({ login: maskLogin(s.login), prize: s.prize, rarity: s.rarity, date: s.date }))
    });
  }

  if (method === 'POST' && pathname === '/api/roulette/spin') {
    if (!user) return sendJSON(res, 401, { error: 'Требуется вход' });
    const b = await readBody(req);
    const cs = db.cases.find(c => c.id === Number(b && b.caseId) && c.enabled !== false);
    if (!cs) return sendJSON(res, 404, { error: 'Кейс не найден' });
    const FREE_CD = 24 * 3600 * 1000;
    const last = user.lastFreeSpin ? new Date(user.lastFreeSpin).getTime() : 0;
    const dailyFree = cs.freeDaily && (!last || Date.now() - last >= FREE_CD);
    const bonusFree = (user.bonusSpins || 0) > 0;
    const free = dailyFree || bonusFree;
    let cost = 0;
    let lucky = false;
    let usedBonus = false;
    if (free) {
      if (dailyFree) {
        user.lastFreeSpin = new Date().toISOString();
        user.spinStreak = last && Date.now() - last <= 48 * 3600 * 1000 ? (user.spinStreak || 0) + 1 : 1;
        lucky = user.spinStreak > 0 && user.spinStreak % 5 === 0;
      } else {
        user.bonusSpins -= 1;
        usedBonus = true;
      }
    } else {
      cost = Number(cs.cost) || 0;
      if (user.balance < cost) return sendJSON(res, 400, { error: 'Недостаточно средств на балансе. Попроси админа пополнить' });
      user.balance -= cost;
    }
    let pool = db.prizes.filter(p => p.caseId === cs.id && p.enabled !== false);
    if (lucky) {
      const rarePool = pool.filter(p => p.rarity !== 'common');
      if (rarePool.length) pool = rarePool;
    }
    if (!pool.length) return sendJSON(res, 500, { error: 'Призы не настроены' });
    const total = pool.reduce((s, p) => s + (Number(p.chance) || 0), 0);
    if (total <= 0) return sendJSON(res, 500, { error: 'Шансы не настроены' });
    let roll = Math.random() * total;
    let prize = pool[0];
    for (const p of pool) { roll -= Number(p.chance) || 0; if (roll <= 0) { prize = p; break; } }
    if (prize.type === 'balance') {
      user.balance += Number(prize.value) || 0;
    } else if (prize.type === 'spins') {
      user.bonusSpins = (user.bonusSpins || 0) + (Number(prize.value) || 0);
    } else {
      user.priv = user.priv || [];
      user.priv.push(String(prize.value || prize.title));
    }
    const spin = { id: ++db.seq, userId: user.id, login: user.login, prize: prize.title, rarity: prize.rarity, caseTitle: cs.title, cost, free, lucky, date: new Date().toISOString() };
    db.spins.push(spin);
    if (db.spins.length > 200) db.spins = db.spins.slice(-200);
    saveDb();
    return sendJSON(res, 200, { prize, free, cost, balance: user.balance, streak: user.spinStreak || 0, lucky, usedBonus, bonusSpins: user.bonusSpins || 0, nextFreeAt: new Date(Date.now() + FREE_CD).toISOString() });
  }

  if (method === 'GET' && pathname === '/api/forum') {
    const sections = db.sections.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(sec => {
      const th = db.threads.filter(t => t.sectionId === sec.id);
      let postCount = 0;
      for (const t of th) postCount += db.posts.filter(p => p.threadId === t.id).length;
      let best = null;
      for (const t of th) if (!best || t.lastAt > best.lastAt) best = t;
      return {
        id: sec.id,
        title: sec.title,
        icon: sec.icon,
        desc: sec.desc,
        adminOnly: !!sec.adminOnly,
        threads: th.length,
        posts: postCount,
        last: best ? { threadId: best.id, title: best.title, at: best.lastAt, login: best.login } : null
      };
    });
    return sendJSON(res, 200, { sections });
  }

  if (method === 'GET' && pathname === '/api/forum/search') {
    const q = String(query.get('q') || '').trim().toLowerCase();
    if (q.length < 2) return sendJSON(res, 200, { threads: [] });
    const results = [];
    for (const t of db.threads) {
      const titleHit = t.title.toLowerCase().includes(q);
      let hitPost = null;
      if (!titleHit) {
        hitPost = db.posts.find(p => p.threadId === t.id && p.text.toLowerCase().includes(q));
        if (!hitPost) continue;
      } else {
        hitPost = db.posts.find(p => p.threadId === t.id && p.text.toLowerCase().includes(q)) || null;
      }
      const sec = db.sections.find(s => s.id === t.sectionId);
      let snippet = '';
      const src = hitPost ? hitPost.text : t.title;
      const i = src.toLowerCase().indexOf(q);
      const start = Math.max(0, i - 40);
      snippet = (start > 0 ? '…' : '') + src.slice(start, start + 130).replace(/\[[^\]]*\]/g, '').replace(/\n/g, ' ') + '…';
      results.push({ id: t.id, title: t.title, sectionTitle: sec ? sec.title : '—', lastAt: t.lastAt, snippet });
    }
    results.sort((a, b) => (b.lastAt > a.lastAt ? 1 : -1));
    return sendJSON(res, 200, { threads: results.slice(0, 20) });
  }

  if (method === 'GET' && pathname === '/api/forum/threads') {
    const sec = db.sections.find(s => s.id === Number(query.get('section')));
    if (!sec) return sendJSON(res, 404, { error: 'Раздел не найден' });
    const threads = db.threads
      .filter(t => t.sectionId === sec.id)
      .map(t => Object.assign({}, t, { replies: Math.max(0, db.posts.filter(p => p.threadId === t.id).length - 1) }))
      .sort((a, b) => (b.pinned - a.pinned) || (b.lastAt > a.lastAt ? 1 : -1));
    return sendJSON(res, 200, { section: sec, threads });
  }

  if (method === 'GET' && pathname === '/api/forum/thread') {
    const th = db.threads.find(t => t.id === Number(query.get('id')));
    if (!th) return sendJSON(res, 404, { error: 'Тема не найдена' });
    const page = Math.max(1, Number(query.get('page')) || 1);
    const PER = 15;
    const all = db.posts.filter(p => p.threadId === th.id).sort((a, b) => (a.created > b.created ? 1 : -1));
    th.views = (th.views || 0) + 1;
    saveDb();
    const pages = Math.max(1, Math.ceil(all.length / PER));
    const posts = all.slice((page - 1) * PER, page * PER);
    return sendJSON(res, 200, { thread: th, posts, page, pages, total: all.length, section: db.sections.find(s => s.id === th.sectionId) });
  }

  if (method === 'POST' && pathname === '/api/forum/thread') {
    if (!user) return sendJSON(res, 401, { error: 'Требуется вход' });
    if (user.banned) return sendJSON(res, 403, { error: 'Аккаунт заблокирован' });
    const b = await readBody(req);
    if (!b) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    const sec = db.sections.find(s => s.id === Number(b.sectionId));
    if (!sec) return sendJSON(res, 404, { error: 'Раздел не найден' });
    if (sec.adminOnly && !canAdminPost(user)) return sendJSON(res, 403, { error: 'Темы в этом разделе создают только администраторы' });
    const title = String(b.title || '').trim();
    const text = String(b.text || '').trim();
    if (title.length < 3 || title.length > 120) return sendJSON(res, 400, { error: 'Заголовок: 3-120 символов' });
    if (!text || text.length > 5000) return sendJSON(res, 400, { error: 'Сообщение: 1-5000 символов' });
    const now = new Date().toISOString();
    const tid = ++db.seq;
    db.threads.push({ id: tid, sectionId: sec.id, userId: user.id, login: user.login, nick: user.nick || user.login, title, pinned: false, locked: false, views: 0, created: now, lastAt: now });
    db.posts.push({ id: ++db.seq, threadId: tid, userId: user.id, login: user.login, nick: user.nick || user.login, rank: rankOf(user), text, created: now, editedAt: null });
    saveDb();
    return sendJSON(res, 200, { id: tid });
  }

  if (method === 'POST' && pathname === '/api/forum/post') {
    if (!user) return sendJSON(res, 401, { error: 'Требуется вход' });
    if (user.banned) return sendJSON(res, 403, { error: 'Аккаунт заблокирован' });
    const b = await readBody(req);
    if (!b) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    const th = db.threads.find(t => t.id === Number(b.threadId));
    if (!th) return sendJSON(res, 404, { error: 'Тема не найдена' });
    if (th.locked && !canMod(user)) return sendJSON(res, 403, { error: 'Тема закрыта для ответов' });
    const text = String(b.text || '').trim();
    if (!text || text.length > 5000) return sendJSON(res, 400, { error: 'Сообщение: 1-5000 символов' });
    const now = new Date().toISOString();
    db.posts.push({ id: ++db.seq, threadId: th.id, userId: user.id, login: user.login, nick: user.nick || user.login, rank: rankOf(user), text, created: now, editedAt: null });
    th.lastAt = now;
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/forum/post/edit') {
    if (!user) return sendJSON(res, 401, { error: 'Требуется вход' });
    const b = await readBody(req);
    const p = db.posts.find(x => x.id === Number(b && b.id));
    if (!p) return sendJSON(res, 404, { error: 'Сообщение не найдено' });
    if (p.userId !== user.id && !canMod(user)) return sendJSON(res, 403, { error: 'Нет доступа' });
    const text = String((b && b.text) || '').trim();
    if (!text || text.length > 5000) return sendJSON(res, 400, { error: 'Сообщение: 1-5000 символов' });
    p.text = text;
    p.editedAt = new Date().toISOString();
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/forum/post/delete') {
    if (!user) return sendJSON(res, 401, { error: 'Требуется вход' });
    const b = await readBody(req);
    const p = db.posts.find(x => x.id === Number(b && b.id));
    if (!p) return sendJSON(res, 404, { error: 'Сообщение не найдено' });
    const th = db.threads.find(t => t.id === p.threadId);
    const siblings = db.posts.filter(x => x.threadId === p.threadId).sort((a, b2) => (a.created > b2.created ? 1 : -1));
    const isFirst = siblings.length && siblings[0].id === p.id;
    if (p.userId !== user.id && !canDelAny(user)) return sendJSON(res, 403, { error: 'Нет доступа' });
    if (isFirst && !canMod(user)) return sendJSON(res, 403, { error: 'Первое сообщение удаляется вместе с темой' });
    db.posts = db.posts.filter(x => x.id !== p.id);
    if (th) {
      const rest = db.posts.filter(x => x.threadId === th.id).sort((a, b2) => (a.created > b2.created ? 1 : -1));
      th.lastAt = rest.length ? rest[rest.length - 1].created : th.created;
    }
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/forum/thread/pin') {
    if (!user || !canMod(user)) return sendJSON(res, 403, { error: 'Нет доступа' });
    const b = await readBody(req);
    const th = db.threads.find(t => t.id === Number(b && b.id));
    if (!th) return sendJSON(res, 404, { error: 'Тема не найдена' });
    th.pinned = !!b.value;
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/forum/thread/lock') {
    if (!user || !canMod(user)) return sendJSON(res, 403, { error: 'Нет доступа' });
    const b = await readBody(req);
    const th = db.threads.find(t => t.id === Number(b && b.id));
    if (!th) return sendJSON(res, 404, { error: 'Тема не найдена' });
    th.locked = !!b.value;
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/forum/thread/delete') {
    if (!user || !canMod(user)) return sendJSON(res, 403, { error: 'Нет доступа' });
    const b = await readBody(req);
    const id = Number(b && b.id);
    if (!db.threads.some(t => t.id === id)) return sendJSON(res, 404, { error: 'Тема не найдена' });
    db.threads = db.threads.filter(t => t.id !== id);
    db.posts = db.posts.filter(p => p.threadId !== id);
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/promo/redeem') {
    if (!user) return sendJSON(res, 401, { error: 'Требуется вход' });
    if (user.banned) return sendJSON(res, 403, { error: 'Аккаунт заблокирован' });
    const b = await readBody(req);
    const code = String((b && b.code) || '').trim().toUpperCase();
    if (!code) return sendJSON(res, 400, { error: 'Введи промокод' });
    const pc = db.promocodes.find(c => String(c.code).toUpperCase() === code);
    if (!pc || !pc.active) return sendJSON(res, 404, { error: 'Промокод не найден или отключён' });
    if (pc.maxUses > 0 && pc.uses >= pc.maxUses) return sendJSON(res, 400, { error: 'Лимит активаций исчерпан' });
    pc.uses += 1;
    let reward = '';
    if (pc.type === 'balance') {
      user.balance += Number(pc.value) || 0;
      reward = '+' + Number(pc.value) + ' ₽ на баланс';
    } else if (pc.type === 'spins') {
      user.bonusSpins = (user.bonusSpins || 0) + (Number(pc.value) || 0);
      reward = '+' + Number(pc.value) + ' бонусных прокрут(ов) рулетки';
    } else {
      user.priv = user.priv || [];
      user.priv.push(String(pc.value));
      reward = String(pc.value);
    }
    saveDb();
    return sendJSON(res, 200, { ok: true, reward });
  }

  if (method === 'GET' && pathname === '/api/leaderboard') {
    const byLogin = {};
    for (const s of db.spins) {
      if (!byLogin[s.login]) byLogin[s.login] = { login: s.login, nick: s.login, wins: 0, rare: 0, last: s.date };
      const b = byLogin[s.login];
      b.wins++;
      if (s.rarity === 'legend' || s.rarity === 'epic') b.rare++;
      if (s.date > b.last) b.last = s.date;
    }
    db.users.forEach(u => { if (byLogin[u.login]) byLogin[u.login].nick = u.nick || u.login; });
    const lucky = Object.values(byLogin).sort((a, b) => b.rare - a.rare || b.wins - a.wins).slice(0, 10);
    const rich = db.users.slice()
      .sort((a, b) => (b.balance || 0) - (a.balance || 0))
      .slice(0, 10)
      .map(u => ({ login: u.login, nick: u.nick || u.login, balance: u.balance || 0, rank: rankOf(u) }));
    return sendJSON(res, 200, { lucky, rich });
  }

  if (!pathname.startsWith('/api/admin/')) return sendJSON(res, 404, { error: 'Not found' });
  if (!user) return sendJSON(res, 401, { error: 'Требуется вход' });
  if (!canPanel(user)) return sendJSON(res, 403, { error: 'Нет доступа' });

  if (method === 'GET' && pathname === '/api/admin/stats') {
    const approved = db.orders.filter(o => o.status === 'approved');
    return sendJSON(res, 200, {
      users: db.users.length,
      admins: db.users.filter(u => u.role === 'admin').length,
      banned: db.users.filter(u => u.banned).length,
      ordersNew: db.orders.filter(o => o.status === 'new').length,
      ordersAll: db.orders.length,
      revenue: approved.reduce((s, o) => s + Number(o.price || 0), 0),
      online: monitorNow().players,
      max: Number(db.settings.monitor.max) || 500
    });
  }

  if (method === 'GET' && pathname === '/api/admin/users') {
    return sendJSON(res, 200, { users: db.users.map(publicUser) });
  }

  if (method === 'POST' && pathname === '/api/admin/user') {
    const b = await readBody(req);
    if (!b) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    const u = db.users.find(x => x.id === Number(b.id));
    if (!u) return sendJSON(res, 404, { error: 'Игрок не найден' });
    switch (b.action) {
      case 'ban':
        if (u.id === user.id) return sendJSON(res, 400, { error: 'Нельзя забанить себя' });
        u.banned = true;
        break;
      case 'unban': u.banned = false; break;
      case 'makeadmin': u.role = 'admin'; u.rank = 'admin'; break;
      case 'removeadmin':
        if (u.id === user.id) return sendJSON(res, 400, { error: 'Нельзя снять права с себя' });
        u.role = 'user'; u.rank = 'player';
        break;
      case 'rank': {
        const v = String(b.value || '');
        if (!RANKS[v]) return sendJSON(res, 400, { error: 'Неизвестная должность' });
        if (u.id === user.id) return sendJSON(res, 400, { error: 'Нельзя менять свою должность' });
        u.rank = v;
        u.role = (v === 'owner' || v === 'admin') ? 'admin' : 'user';
        break;
      }
      case 'balance':
        const bal = Number(b.value);
        if (isNaN(bal) || bal < 0) return sendJSON(res, 400, { error: 'Некорректный баланс' });
        u.balance = bal;
        break;
      case 'priv':
        u.priv = Array.isArray(b.value) ? b.value.map(String) : String(b.value || '').split('\n').map(s => s.trim()).filter(Boolean);
        break;
      default: return sendJSON(res, 400, { error: 'Неизвестное действие' });
    }
    saveDb();
    return sendJSON(res, 200, { user: publicUser(u) });
  }

  if (method === 'GET' && pathname === '/api/admin/orders') {
    return sendJSON(res, 200, { orders: db.orders.slice().sort((a, b) => b.created > a.created ? 1 : -1) });
  }

  if (method === 'POST' && pathname === '/api/admin/order') {
    const b = await readBody(req);
    if (!b) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    const o = db.orders.find(x => x.id === Number(b.id));
    if (!o) return sendJSON(res, 404, { error: 'Заявка не найдена' });
    if (b.action === 'approve') {
      o.status = 'approved';
      const u = db.users.find(x => x.id === o.userId);
      if (u) {
        u.priv = u.priv || [];
        u.priv.push(o.planTitle + ' — ' + o.days + ' дн.');
      }
    } else if (b.action === 'reject') {
      o.status = 'rejected';
    } else {
      return sendJSON(res, 400, { error: 'Неизвестное действие' });
    }
    saveDb();
    return sendJSON(res, 200, { order: o });
  }

  if (method === 'POST' && pathname === '/api/admin/news') {
    const b = await readBody(req);
    if (!b) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    const title = String(b.title || '').trim();
    if (!title) return sendJSON(res, 400, { error: 'Заголовок обязателен' });
    if (b.id) {
      const n = db.news.find(x => x.id === Number(b.id));
      if (!n) return sendJSON(res, 404, { error: 'Новость не найдена' });
      n.title = title;
      n.text = String(b.text || '').trim();
      n.pinned = !!b.pinned;
    } else {
      db.news.push({ id: ++db.seq, title, text: String(b.text || '').trim(), date: new Date().toISOString().slice(0, 10), pinned: !!b.pinned });
    }
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/admin/news/delete') {
    const b = await readBody(req);
    const i = db.news.findIndex(x => x.id === Number(b && b.id));
    if (i < 0) return sendJSON(res, 404, { error: 'Новость не найдена' });
    db.news.splice(i, 1);
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/admin/plan') {
    const b = await readBody(req);
    if (!b) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    const title = String(b.title || '').trim();
    const price = Number(b.price);
    const days = Number(b.days);
    if (!title) return sendJSON(res, 400, { error: 'Название обязательно' });
    if (isNaN(price) || price < 0) return sendJSON(res, 400, { error: 'Некорректная цена' });
    if (isNaN(days) || days < 1) return sendJSON(res, 400, { error: 'Некорректное число дней' });
    const perks = Array.isArray(b.perks) ? b.perks.map(String) : String(b.perks || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (b.id) {
      const p = db.plans.find(x => x.id === Number(b.id));
      if (!p) return sendJSON(res, 404, { error: 'Тариф не найден' });
      Object.assign(p, { title, price, days, perks, popular: !!b.popular });
    } else {
      db.plans.push({ id: ++db.seq, title, price, days, perks, popular: !!b.popular });
    }
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/admin/plan/delete') {
    const b = await readBody(req);
    const i = db.plans.findIndex(x => x.id === Number(b && b.id));
    if (i < 0) return sendJSON(res, 404, { error: 'Тариф не найден' });
    db.plans.splice(i, 1);
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/admin/rules') {
    const b = await readBody(req);
    if (!b || !Array.isArray(b.rules)) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    db.rules = b.rules
      .map(r => ({ title: String(r.title || '').trim(), text: String(r.text || '').trim() }))
      .filter(r => r.title)
      .map((r, i) => ({ id: i + 1, title: r.title, text: r.text }));
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/admin/settings') {
    const b = await readBody(req);
    if (!b) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    const s = db.settings;
    if (b.serverName !== undefined) s.serverName = String(b.serverName).trim() || s.serverName;
    if (b.serverIp !== undefined) s.serverIp = String(b.serverIp).trim() || s.serverIp;
    if (b.discord !== undefined) s.discord = String(b.discord).trim();
    if (b.vk !== undefined) s.vk = String(b.vk).trim();
    if (b.promo && typeof b.promo === 'object') {
      s.promo = {
        code: String(b.promo.code || '').trim().toUpperCase(),
        percent: Math.max(0, Math.min(90, Number(b.promo.percent) || 0))
      };
    }
    if (b.roulette && typeof b.roulette === 'object') {
      s.roulette = { cost: Math.max(0, Number(b.roulette.cost) || 0) };
    }
    if (b.monitor && typeof b.monitor === 'object') {
      s.monitor = Object.assign({}, s.monitor, b.monitor, {
        players: Math.max(0, Number(b.monitor.players) || 0),
        max: Math.max(1, Number(b.monitor.max) || 500)
      });
    }
    saveDb();
    return sendJSON(res, 200, { settings: s });
  }

  if (method === 'POST' && pathname === '/api/admin/upload') {
    const b = await readBody(req, 3 * 1024 * 1024);
    if (!b || !b.data) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    const name = String(b.name || '').trim();
    const extMatch = name.match(/\.(png|jpe?g|gif|webp|svg)$/i);
    if (!extMatch) return sendJSON(res, 400, { error: 'Разрешены: PNG, JPG, GIF, WEBP, SVG' });
    let data;
    try { data = Buffer.from(String(b.data), 'base64'); } catch (e) { data = null; }
    if (!data || !data.length) return sendJSON(res, 400, { error: 'Пустой файл' });
    if (data.length > 2 * 1024 * 1024) return sendJSON(res, 400, { error: 'Файл больше 2 МБ' });
    const ext = extMatch[1].toLowerCase() === 'jpeg' ? 'jpg' : extMatch[1].toLowerCase();
    const safe = 'up-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    fs.writeFileSync(path.join(PUBLIC, 'img', 'upload', safe), data);
    return sendJSON(res, 200, { img: 'upload/' + safe });
  }

  if (method === 'GET' && pathname === '/api/admin/imgs') {
    const dir = path.join(PUBLIC, 'img');
    let files = [];
    try { files = fs.readdirSync(dir).filter(f => /\.(png|jpe?g|gif|webp|svg)$/i.test(f)).sort(); } catch (e) {}
    let ups = [];
    try { ups = fs.readdirSync(path.join(dir, 'upload')).filter(f => /\.(png|jpe?g|gif|webp|svg)$/i.test(f)).map(f => 'upload/' + f).sort(); } catch (e) {}
    return sendJSON(res, 200, { files: files.concat(ups) });
  }

  if (method === 'GET' && pathname === '/api/admin/cases') {
    return sendJSON(res, 200, { cases: db.cases.slice().sort((a, b) => (a.order || 0) - (b.order || 0)) });
  }

  if (method === 'POST' && pathname === '/api/admin/case') {
    const b = await readBody(req);
    if (!b) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    const title = String(b.title || '').trim();
    const cost = Number(b.cost);
    if (!title) return sendJSON(res, 400, { error: 'Название обязательно' });
    if (isNaN(cost) || cost < 0) return sendJSON(res, 400, { error: 'Некорректная цена' });
    const item = {
      title,
      icon: String(b.icon || '📦'),
      img: String(b.img || 'case-standard.svg').trim(),
      accent: /^#[0-9a-fA-F]{3,8}$/.test(String(b.accent || '')) ? String(b.accent) : '#35a2ff',
      cost,
      freeDaily: !!b.freeDaily,
      order: Number(b.order) || 99,
      enabled: !!b.enabled
    };
    if (b.id) {
      const c = db.cases.find(x => x.id === Number(b.id));
      if (!c) return sendJSON(res, 404, { error: 'Кейс не найден' });
      Object.assign(c, item);
    } else {
      db.cases.push(Object.assign({ id: ++db.seq }, item));
    }
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/admin/case/delete') {
    const b = await readBody(req);
    const id = Number(b && b.id);
    if (!db.cases.some(c => c.id === id)) return sendJSON(res, 404, { error: 'Кейс не найден' });
    db.cases = db.cases.filter(c => c.id !== id);
    db.prizes = db.prizes.filter(p => p.caseId !== id);
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/admin/prizes') {
    return sendJSON(res, 200, { prizes: db.prizes });
  }

  if (method === 'POST' && pathname === '/api/admin/prize') {
    const b = await readBody(req);
    if (!b) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    const title = String(b.title || '').trim();
    const chance = Number(b.chance);
    const rarity = ['common', 'rare', 'epic', 'legend'].includes(b.rarity) ? b.rarity : 'common';
    const type = ['balance', 'spins'].includes(b.type) ? b.type : 'virtual';
    const category = ['status', 'transport', 'property', 'money', 'items', 'bonus'].includes(b.category) ? b.category : 'items';
    if (!title) return sendJSON(res, 400, { error: 'Название обязательно' });
    if (isNaN(chance) || chance <= 0) return sendJSON(res, 400, { error: 'Некорректный шанс' });
    const item = {
      title,
      icon: String(b.icon || '🎁'),
      img: String(b.img || '').trim(),
      rarity,
      chance,
      type,
      category,
      value: type === 'virtual' ? String(b.value || title) : Number(b.value) || 0,
      caseId: Number(b.caseId) || 1,
      enabled: !!b.enabled
    };
    if (b.id) {
      const p = db.prizes.find(x => x.id === Number(b.id));
      if (!p) return sendJSON(res, 404, { error: 'Приз не найден' });
      Object.assign(p, item);
    } else {
      db.prizes.push(Object.assign({ id: ++db.seq }, item));
    }
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/admin/prize/delete') {
    const b = await readBody(req);
    const i = db.prizes.findIndex(x => x.id === Number(b && b.id));
    if (i < 0) return sendJSON(res, 404, { error: 'Приз не найден' });
    db.prizes.splice(i, 1);
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/admin/spins') {
    return sendJSON(res, 200, { spins: db.spins.slice(-100).reverse() });
  }

  if (method === 'GET' && pathname === '/api/admin/sections') {
    return sendJSON(res, 200, { sections: db.sections.slice().sort((a, b) => (a.order || 0) - (b.order || 0)) });
  }

  if (method === 'POST' && pathname === '/api/admin/section') {
    const b = await readBody(req);
    if (!b) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    const title = String(b.title || '').trim();
    if (!title) return sendJSON(res, 400, { error: 'Название обязательно' });
    const item = { title, icon: String(b.icon || '📁'), desc: String(b.desc || '').trim(), order: Number(b.order) || 99, adminOnly: !!b.adminOnly };
    if (b.id) {
      const sec = db.sections.find(s => s.id === Number(b.id));
      if (!sec) return sendJSON(res, 404, { error: 'Раздел не найден' });
      Object.assign(sec, item);
    } else {
      db.sections.push(Object.assign({ id: ++db.seq }, item));
    }
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/admin/section/delete') {
    const b = await readBody(req);
    const id = Number(b && b.id);
    if (!db.sections.some(s => s.id === id)) return sendJSON(res, 404, { error: 'Раздел не найден' });
    const tids = db.threads.filter(t => t.sectionId === id).map(t => t.id);
    db.threads = db.threads.filter(t => t.sectionId !== id);
    db.posts = db.posts.filter(p => !tids.includes(p.threadId));
    db.sections = db.sections.filter(s => s.id !== id);
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/admin/threads') {
    const threads = db.threads.slice().sort((a, b) => (b.lastAt > a.lastAt ? 1 : -1)).slice(0, 200).map(t => {
      const sec = db.sections.find(s => s.id === t.sectionId);
      return Object.assign({}, t, { sectionTitle: sec ? sec.title : '—', replies: Math.max(0, db.posts.filter(p => p.threadId === t.id).length - 1) });
    });
    return sendJSON(res, 200, { threads });
  }

  if (method === 'GET' && pathname === '/api/admin/promocodes') {
    return sendJSON(res, 200, { codes: db.promocodes.slice().sort((a, b) => b.id - a.id) });
  }

  if (method === 'POST' && pathname === '/api/admin/promocode') {
    const b = await readBody(req);
    if (!b) return sendJSON(res, 400, { error: 'Некорректный запрос' });
    const code = String(b.code || '').trim().toUpperCase();
    const value = Number(b.value);
    const type = ['balance', 'spins', 'virtual'].includes(b.type) ? b.type : 'virtual';
    if (!/^[A-Z0-9-]{3,24}$/.test(code)) return sendJSON(res, 400, { error: 'Код: 3-24 символа (латиница, цифры, дефис)' });
    if (isNaN(value) || value <= 0) return sendJSON(res, 400, { error: 'Некорректное значение' });
    const dup = db.promocodes.find(c => c.id !== Number(b.id) && String(c.code).toUpperCase() === code);
    if (dup) return sendJSON(res, 409, { error: 'Такой код уже существует' });
    const item = { code, type, value: type === 'virtual' ? String(b.value).trim() : value, maxUses: Math.max(0, Number(b.maxUses) || 0), active: !!b.active };
    if (b.id) {
      const pc = db.promocodes.find(c => c.id === Number(b.id));
      if (!pc) return sendJSON(res, 404, { error: 'Промокод не найден' });
      Object.assign(pc, item);
    } else {
      db.promocodes.push(Object.assign({ id: ++db.seq, uses: 0, created: new Date().toISOString() }, item));
    }
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/admin/promocode/delete') {
    const b = await readBody(req);
    const i = db.promocodes.findIndex(c => c.id === Number(b && b.id));
    if (i < 0) return sendJSON(res, 404, { error: 'Промокод не найден' });
    db.promocodes.splice(i, 1);
    saveDb();
    return sendJSON(res, 200, { ok: true });
  }

  return sendJSON(res, 404, { error: 'Not found' });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  let file = path.normalize(path.join(PUBLIC, pathname));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 Not Found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    const stream = fs.createReadStream(file);
    stream.on('error', () => { try { res.end(); } catch (e) {} });
    stream.pipe(res);
  });
}

loadDb();

const UPLOAD_DIR = path.join(PUBLIC, 'img', 'upload');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

process.on('uncaughtException', err => { console.error('uncaught:', err && err.message); });
process.on('unhandledRejection', err => { console.error('unhandled:', err && err.message); });

http.createServer((req, res) => {
  let u;
  try { u = new URL(req.url, 'http://x'); } catch (e) { u = new URL('/', 'http://x'); }
  const pathname = decodeURIComponent(u.pathname);
  if (pathname.startsWith('/api/')) {
    api(req, res, pathname, u.searchParams).catch(() => sendJSON(res, 500, { error: 'Ошибка сервера' }));
  } else {
    serveStatic(req, res, pathname);
  }
}).listen(PORT, () => {
  console.log('Nexon Role-Play сайт запущен: http://localhost:' + PORT);
  console.log('Админка: login admin / пароль admin123');
});
