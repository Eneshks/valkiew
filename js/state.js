// Oyun durumu, kayıt ve tüm oyun aksiyonları.
'use strict';

const SAVE_KEY = 'valkiew-save-v1';
const ENERGY_EVERY = 12000; // 12 sn'de 1 enerji
const HEALTH_EVERY = 20000; // 20 sn'de 1 can
const INTEREST_RATE = 0.005; // saatlik banka faizi

let S = null; // aktif oyuncu durumu
let pendingLevel = null; // arayüze bildirilecek yeni rütbe

function newState(name) {
  const now = Date.now();
  return {
    v: 1, name,
    money: 500, bank: 0, gems: 10, xp: 0,
    energy: 100, health: 100, ammo: 0,
    str: 5, def: 5, agi: 5,
    weapons: [], weapon: -1, armors: [], armor: -1,
    cars: [], goods: {},
    city: 'istanbul',
    jailUntil: 0, hospUntil: 0,
    cd: {},
    stats: { crimes: 0, crimeFail: 0, carsStolen: 0, wins: 0, losses: 0, jailed: 0, earned: 0 },
    eTick: now, hTick: now, iTick: now, lastDaily: 0,
    log: [], created: now,
  };
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* depolama yok */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.v === 1 ? Object.assign(newState(d.name), d) : null;
  } catch (e) { return null; }
}
function resetSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* yok say */ }
}

// ---- yardımcılar ----
const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const chance = p => Math.random() < p;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const money = n => '$' + Math.floor(n).toLocaleString('tr-TR');
const num = n => Math.floor(n).toLocaleString('tr-TR');

function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}s ${String(m).padStart(2, '0')}dk`;
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s} sn`;
}

function rankIndex(xp = S.xp) {
  let r = 0;
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) r = i;
  return r;
}
const rank = () => rankIndex();
const maxEnergy = () => 100 + rank() * 10;
const maxHealth = () => 100 + rank() * 20;
const city = () => CITIES.find(c => c.id === S.city) || CITIES[0];
const garageCap = () => 6 + rank() * 2;
const goodsCap = () => 20 + rank() * 15;
const goodsCount = () => Object.values(S.goods).reduce((a, b) => a + b, 0);
const maxBet = () => 500 * Math.pow(rank() + 1, 2);

function power() {
  const w = WEAPONS[S.weapon], a = ARMORS[S.armor];
  let atk = w ? w.atk : 0;
  if (w && w.ammo && S.ammo <= 0) atk = Math.round(atk * 0.35); // mermisiz silah
  return S.str * 2 + S.def + S.agi + atk + (a ? a.def : 0) + rank() * 6;
}

const now = () => Date.now();
const jailLeft = () => Math.max(0, (S.jailUntil - now()) / 1000);
const hospLeft = () => Math.max(0, (S.hospUntil - now()) / 1000);
const cdLeft = key => Math.max(0, ((S.cd[key] || 0) - now()) / 1000);
const setCd = (key, sec) => { S.cd[key] = now() + sec * 1000; };

function log(text, type = '') {
  S.log.unshift({ t: now(), text, type });
  if (S.log.length > 60) S.log.length = 60;
}

// Zamanla dolan enerji/can ve banka faizi
function tick() {
  const t = now();
  const me = maxEnergy(), mh = maxHealth();
  if (S.energy < me) {
    const n = Math.floor((t - S.eTick) / ENERGY_EVERY);
    if (n > 0) { S.energy = Math.min(me, S.energy + n); S.eTick += n * ENERGY_EVERY; }
  } else S.eTick = t;
  if (S.health < mh && !hospLeft()) {
    const n = Math.floor((t - S.hTick) / HEALTH_EVERY);
    if (n > 0) { S.health = Math.min(mh, S.health + n); S.hTick += n * HEALTH_EVERY; }
  } else S.hTick = t;
  const hours = Math.floor((t - S.iTick) / 3600000);
  if (hours > 0) {
    const h = Math.min(hours, 48);
    if (S.bank > 0) {
      const gain = Math.floor(S.bank * (Math.pow(1 + INTEREST_RATE, h) - 1));
      if (gain > 0) { S.bank += gain; log(`Banka faizi: +${money(gain)}`, 'good'); }
    }
    S.iTick += hours * 3600000;
  }
  // Hastaneden çıkınca biraz can ver
  if (S.hospUntil && !hospLeft()) {
    S.hospUntil = 0;
    S.health = Math.max(S.health, Math.round(maxHealth() * 0.4));
    log('Hastaneden taburcu oldun.', 'good');
  }
  if (S.jailUntil && !jailLeft()) {
    S.jailUntil = 0;
    log('Cezanı çektin, serbestsin.', 'good');
  }
}

// ---- sonuç nesnesi: {ok, msg, type} ----
const R = (ok, msg, type) => ({ ok, msg, type: type || (ok ? 'good' : 'bad') });

function blocked() {
  if (jailLeft()) return R(false, `Hapistesin! ${fmtTime(jailLeft())} kaldı.`);
  if (hospLeft()) return R(false, `Hastanedesin! ${fmtTime(hospLeft())} kaldı.`);
  return null;
}

function gainXp(n) {
  const before = rank();
  S.xp += n;
  const after = rank();
  if (after > before) {
    S.gems += 5 * (after - before);
    S.energy = maxEnergy();
    S.health = maxHealth();
    log(`Rütbe atladın: ${RANKS[after].name}! +${5 * (after - before)} 💎`, 'level');
    pendingLevel = RANKS[after].name;
    return RANKS[after].name;
  }
  return null;
}

function earn(n) { S.money += n; S.stats.earned += n; }

function sendToJail(sec) {
  S.jailUntil = now() + sec * 1000;
  S.stats.jailed++;
}
function sendToHospital(sec) {
  S.health = 0;
  S.hospUntil = now() + sec * 1000;
}

// ---- Suçlar ----
function crimeChance(c) {
  return clamp(c.base + (rank() - c.minRank) * 0.025 + S.agi * 0.002, 0.05, 0.95);
}
function doCrime(id) {
  const c = CRIMES.find(x => x.id === id);
  const b = blocked(); if (b) return b;
  if (rank() < c.minRank) return R(false, `Bu iş için ${RANKS[c.minRank].name} olmalısın.`);
  if (cdLeft('crime_' + id)) return R(false, `Biraz bekle: ${fmtTime(cdLeft('crime_' + id))}`);
  if (S.energy < c.energy) return R(false, 'Yeterli enerjin yok.');
  S.energy -= c.energy;
  setCd('crime_' + id, c.cd);
  if (chance(crimeChance(c))) {
    const m = Math.round(rnd(c.money[0], c.money[1]) * city().mod);
    earn(m); S.stats.crimes++;
    gainXp(c.xp);
    log(`${c.name} başarılı: +${money(m)}, +${c.xp} XP`, 'good');
    return R(true, `${c.name} başarılı! +${money(m)}`);
  }
  S.stats.crimeFail++;
  if (chance(0.55)) {
    sendToJail(c.jail);
    log(`${c.name} sırasında yakalandın. ${fmtTime(c.jail)} hapis.`, 'bad');
    return R(false, `Polis seni yakaladı! ${fmtTime(c.jail)} hapis.`);
  }
  log(`${c.name} başarısız oldu, kaçmayı başardın.`, 'bad');
  return R(false, 'İş patladı ama polisten kaçtın.');
}

// ---- Araba hırsızlığı ----
function stealCar() {
  const b = blocked(); if (b) return b;
  if (cdLeft('car')) return R(false, `Ortalık sakinleşsin: ${fmtTime(cdLeft('car'))}`);
  if (S.energy < 10) return R(false, 'Yeterli enerjin yok.');
  if (S.cars.length >= garageCap()) return R(false, 'Garaj dolu. Önce birkaçını sat.');
  S.energy -= 10;
  setCd('car', 40);
  const pool = CARS.filter(c => c.minRank <= rank());
  // Pahalı arabaları bulmak daha zor
  const weights = pool.map((c, i) => Math.pow(0.6, i));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0), car = pool[0];
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { car = pool[i]; break; } }
  const p = clamp(car.chance + S.agi * 0.003, 0.05, 0.95);
  if (chance(p)) {
    const dmg = rnd(0, 45);
    S.cars.push({ i: CARS.indexOf(car), dmg });
    S.stats.carsStolen++;
    gainXp(6 + CARS.indexOf(car) * 4);
    log(`${car.name} çaldın (%${dmg} hasarlı).`, 'good');
    return R(true, `${car.name} senin! (%${dmg} hasar)`);
  }
  if (chance(0.45)) {
    sendToJail(45);
    log(`${car.name} çalarken yakalandın.`, 'bad');
    return R(false, `${car.name} çalarken yakalandın! 45 sn hapis.`);
  }
  log(`${car.name} çalınamadı, alarm çaldı.`, 'bad');
  return R(false, 'Alarm çaldı, elin boş kaçtın.');
}
function carValue(c) { return Math.round(CARS[c.i].value * (1 - c.dmg / 100) * city().mod); }
function sellCar(idx) {
  const c = S.cars[idx]; if (!c) return R(false, 'Araba bulunamadı.');
  const b = blocked(); if (b) return b;
  const v = carValue(c);
  S.cars.splice(idx, 1);
  earn(v);
  log(`${CARS[c.i].name} sattın: +${money(v)}`, 'good');
  return R(true, `${CARS[c.i].name} satıldı: +${money(v)}`);
}

// ---- Silahçı ----
function buyWeapon(i) {
  const w = WEAPONS[i];
  if (S.weapons.includes(i)) { S.weapon = i; return R(true, `${w.name} kuşandın.`); }
  if (rank() < w.minRank) return R(false, `${RANKS[w.minRank].name} olmalısın.`);
  const price = Math.round(w.price * city().mod);
  if (S.money < price) return R(false, 'Paran yetmiyor.');
  S.money -= price; S.weapons.push(i); S.weapon = i;
  log(`${w.name} satın aldın.`, 'good');
  return R(true, `${w.name} satın alındı ve kuşanıldı.`);
}
function buyArmor(i) {
  const a = ARMORS[i];
  if (S.armors.includes(i)) { S.armor = i; return R(true, `${a.name} giydin.`); }
  if (rank() < a.minRank) return R(false, `${RANKS[a.minRank].name} olmalısın.`);
  const price = Math.round(a.price * city().mod);
  if (S.money < price) return R(false, 'Paran yetmiyor.');
  S.money -= price; S.armors.push(i); S.armor = i;
  log(`${a.name} satın aldın.`, 'good');
  return R(true, `${a.name} satın alındı.`);
}
const bulletPrice = () => Math.round(4 * city().mod);
function buyAmmo(n) {
  const price = n * bulletPrice();
  if (S.money < price) return R(false, 'Paran yetmiyor.');
  S.money -= price; S.ammo += n;
  return R(true, `${n} mermi alındı.`);
}

// ---- Hastane ----
const healCost = () => Math.round((maxHealth() - S.health) * 6 * city().mod);
function heal() {
  if (hospLeft()) return R(false, 'Önce taburcu olmalısın.');
  if (S.health >= maxHealth()) return R(false, 'Zaten sapasağlamsın.');
  const c = healCost();
  if (S.money < c) return R(false, 'Tedaviye paran yetmiyor.');
  S.money -= c; S.health = maxHealth();
  return R(true, 'Yaraların sarıldı.');
}
function hospitalSkip() {
  if (!hospLeft()) return R(false, 'Hastanede değilsin.');
  if (S.gems < 3) return R(false, '3 💎 gerekiyor.');
  S.gems -= 3; S.hospUntil = 0; S.health = maxHealth();
  return R(true, 'Özel doktorun seni hemen ayağa kaldırdı.');
}

// ---- Hapishane ----
const bribeCost = () => Math.round(jailLeft() * 15 * (rank() + 1));
function bribe(useGems) {
  if (!jailLeft()) return R(false, 'Hapiste değilsin.');
  if (useGems) {
    if (S.gems < 3) return R(false, '3 💎 gerekiyor.');
    S.gems -= 3;
  } else {
    const c = bribeCost();
    if (S.money < c) return R(false, 'Rüşvete paran yetmiyor.');
    S.money -= c;
  }
  S.jailUntil = 0;
  log('Gardiyana rüşvet verip çıktın.', 'good');
  return R(true, 'Gardiyan gözlerini kapadı. Serbestsin!');
}
function escape() {
  if (!jailLeft()) return R(false, 'Hapiste değilsin.');
  if (cdLeft('escape')) return R(false, `Gardiyanlar tetikte: ${fmtTime(cdLeft('escape'))}`);
  setCd('escape', 20);
  if (chance(clamp(0.25 + S.agi * 0.004, 0.05, 0.7))) {
    S.jailUntil = 0; gainXp(10);
    log('Hapisten firar ettin!', 'good');
    return R(true, 'Duvarı aştın, firar başarılı!');
  }
  S.jailUntil += 30000;
  return R(false, 'Yakalandın! Cezana 30 sn eklendi.');
}

// ---- Banka ----
function deposit(n) {
  n = Math.floor(n);
  if (!(n > 0)) return R(false, 'Geçerli bir miktar gir.');
  if (n > S.money) return R(false, 'Üzerinde o kadar para yok.');
  S.money -= n; S.bank += n;
  return R(true, `${money(n)} yatırıldı.`);
}
function withdraw(n) {
  n = Math.floor(n);
  if (!(n > 0)) return R(false, 'Geçerli bir miktar gir.');
  if (n > S.bank) return R(false, 'Hesabında o kadar yok.');
  S.bank -= n; S.money += n;
  return R(true, `${money(n)} çekildi.`);
}

// ---- Kumarhane ----
function gamble(game, bet, pick) {
  const b = blocked(); if (b) return b;
  bet = Math.floor(bet);
  if (!(bet > 0)) return R(false, 'Bahis gir.');
  if (bet > maxBet()) return R(false, `Rütbene göre en fazla ${money(maxBet())} oynayabilirsin.`);
  if (bet > S.money) return R(false, 'Üzerinde o kadar para yok.');
  if (cdLeft('gamble')) return R(false, 'Krupiye kartları karıştırıyor…');
  setCd('gamble', 1.5);
  S.money -= bet;
  let win = 0, detail = '';
  if (game === 'yazitura') {
    const r = chance(0.5) ? 'yazi' : 'tura';
    detail = r === 'yazi' ? 'Yazı geldi' : 'Tura geldi';
    if (r === pick) win = bet * 2;
  } else if (game === 'zar') {
    const me = rnd(1, 6) + rnd(1, 6), house = rnd(1, 6) + rnd(1, 6);
    detail = `Sen ${me} – Kasa ${house}`;
    if (me > house) win = bet * 2; else if (me === house) win = bet;
  } else if (game === 'rulet') {
    const n = rnd(0, 36);
    const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n);
    const col = n === 0 ? 'yesil' : red ? 'kirmizi' : 'siyah';
    detail = `Top ${n} (${col === 'yesil' ? 'yeşil' : col === 'kirmizi' ? 'kırmızı' : 'siyah'})`;
    if (pick === col) win = col === 'yesil' ? bet * 14 : bet * 2;
  }
  S.money += win;
  if (win > bet) { S.stats.earned += win - bet; return R(true, `${detail}. Kazandın: +${money(win - bet)}`); }
  if (win === bet) return R(true, `${detail}. Berabere, bahsin iade.`, 'info');
  return R(false, `${detail}. Kaybettin: -${money(bet)}`);
}

// ---- Spor salonu ----
const trainCost = stat => Math.round(15 * S[stat] * city().mod);
function train(stat) {
  const b = blocked(); if (b) return b;
  if (cdLeft('train')) return R(false, 'Biraz soluklan…');
  if (S.energy < 8) return R(false, 'Yeterli enerjin yok.');
  const c = trainCost(stat);
  if (S.money < c) return R(false, 'Hocanın ücretine paran yetmiyor.');
  S.energy -= 8; S.money -= c; S[stat] += 1;
  setCd('train', 2);
  gainXp(2);
  const names = { str: 'Güç', def: 'Savunma', agi: 'Çeviklik' };
  return R(true, `${names[stat]} +1 (${S[stat]})`);
}

// ---- Havalimanı ----
function travel(id) {
  const b = blocked(); if (b) return b;
  const c = CITIES.find(x => x.id === id);
  if (c.id === S.city) return R(false, 'Zaten buradasın.');
  if (rank() < c.minRank) return R(false, `${RANKS[c.minRank].name} olmalısın.`);
  if (cdLeft('travel')) return R(false, `Sonraki uçuş: ${fmtTime(cdLeft('travel'))}`);
  const price = Math.max(c.price, 300);
  if (S.money < price) return R(false, 'Bilet paran yetmiyor.');
  S.money -= price; S.city = c.id;
  setCd('travel', 60);
  log(`${c.name} şehrine uçtun.`, 'info');
  return R(true, `${c.name} şehrine hoş geldin!`, 'info');
}

// ---- Karaborsa ----
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}
function goodPrice(g) {
  const slot = Math.floor(now() / 600000); // 10 dakikada bir değişir
  const f = 0.6 + hash(`${S.city}|${g.id}|${slot}`) * 0.9;
  return Math.max(1, Math.round(g.base * f));
}
const goodSellPrice = g => Math.round(goodPrice(g) * 0.92);
const priceChangeIn = () => (600000 - (now() % 600000)) / 1000;
function buyGood(id, n) {
  const b = blocked(); if (b) return b;
  const g = GOODS.find(x => x.id === id);
  n = Math.floor(n);
  if (!(n > 0)) return R(false, 'Miktar gir.');
  if (goodsCount() + n > goodsCap()) return R(false, `Depon dolu (en fazla ${goodsCap()}).`);
  const c = goodPrice(g) * n;
  if (S.money < c) return R(false, 'Paran yetmiyor.');
  S.money -= c; S.goods[id] = (S.goods[id] || 0) + n;
  return R(true, `${n} × ${g.name} alındı.`);
}
function sellGood(id, n) {
  const b = blocked(); if (b) return b;
  const g = GOODS.find(x => x.id === id);
  n = Math.min(Math.floor(n), S.goods[id] || 0);
  if (!(n > 0)) return R(false, 'Satacak malın yok.');
  const v = goodSellPrice(g) * n;
  S.goods[id] -= n; if (!S.goods[id]) delete S.goods[id];
  earn(v); gainXp(Math.ceil(n * g.base / 500));
  return R(true, `${n} × ${g.name} satıldı: +${money(v)}`);
}

// ---- Arka sokak (dövüş) ----
function winChance(r) { return clamp(power() / (power() + r.power) * 1.1, 0.05, 0.95); }
function attack(i) {
  const r = RIVALS[i];
  const b = blocked(); if (b) return b;
  if (rank() < r.minRank) return R(false, `${RANKS[r.minRank].name} olmalısın.`);
  if (cdLeft('attack')) return R(false, `Soluklan: ${fmtTime(cdLeft('attack'))}`);
  if (S.energy < 10) return R(false, 'Yeterli enerjin yok.');
  if (S.health < 15) return R(false, 'Bu kadar yaralıyken kavgaya girme. Hastaneye git.');
  const p = winChance(r);
  S.energy -= 10;
  setCd('attack', 6);
  const w = WEAPONS[S.weapon];
  let used = 0;
  if (w && w.ammo && S.ammo > 0) { used = Math.min(S.ammo, rnd(3, 8)); S.ammo -= used; }
  const ammoNote = used ? ` (${used} mermi)` : '';
  if (chance(p)) {
    const m = Math.round(rnd(r.money[0], r.money[1]) * city().mod);
    earn(m); S.stats.wins++;
    S.health = Math.max(1, S.health - rnd(0, 10));
    gainXp(r.xp);
    let gem = '';
    if (chance(0.06)) { S.gems += 1; gem = ' +1 💎'; }
    log(`${r.name} alt edildi: +${money(m)}${gem}${ammoNote}`, 'good');
    return R(true, `${r.name} yere serildi! +${money(m)}${gem}`);
  }
  S.stats.losses++;
  const dmg = rnd(18, 38) + i * 4;
  S.health -= dmg;
  if (S.health <= 0) {
    sendToHospital(60 + i * 20);
    log(`${r.name} seni hastanelik etti.`, 'bad');
    return R(false, `${r.name} seni fena dövdü. Hastanelik oldun!`);
  }
  log(`${r.name} karşısında kaybettin: -${dmg} can${ammoNote}`, 'bad');
  return R(false, `Kaybettin! -${dmg} can`);
}

// ---- Malikane ----
const dailyLeft = () => Math.max(0, (S.lastDaily + 86400000 - now()) / 1000);
function claimDaily() {
  if (dailyLeft()) return R(false, `Sonraki ödül: ${fmtTime(dailyLeft())}`);
  const m = 300 * (rank() + 1);
  S.lastDaily = now(); S.gems += 3; earn(m);
  log(`Günlük haraç: +${money(m)}, +3 💎`, 'good');
  return R(true, `Günlük ödül: +${money(m)} ve +3 💎`);
}
function refillEnergy() {
  if (S.energy >= maxEnergy()) return R(false, 'Enerjin zaten dolu.');
  if (S.gems < 5) return R(false, '5 💎 gerekiyor.');
  S.gems -= 5; S.energy = maxEnergy();
  return R(true, 'Sert bir espresso… Enerjin doldu!');
}
