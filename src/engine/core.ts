import { CONFIG } from '@/config/game';
import type { Ctx, Player, Result, Tone } from './types';

export const C = CONFIG;

// ---------------------------------------------------------------- yardımcılar
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const randInt = (rng: () => number, a: number, b: number) => Math.floor(a + rng() * (b - a + 1));
export const randRange = (rng: () => number, r: readonly [number, number]) => randInt(rng, r[0], r[1]);
export const sec = (n: number) => n * 1000;

export function ok(key: string, params?: Result['params'], tone: Tone = 'good'): Result {
  return { ok: true, key, params, tone };
}
export function fail(key: string, params?: Result['params']): Result {
  return { ok: false, key, params, tone: 'bad' };
}

/** Deterministik hash (0-1) — kaçakçılık fiyatları vb. için */
export function hash01(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- oyuncu
export function newPlayer(name: string, now: number): Player {
  const s = C.start;
  return {
    v: 2,
    name,
    created: now,
    cash: s.cash,
    bank: s.bank,
    diamonds: s.diamonds,
    xp: 0,
    hp: C.maxStats.hp(0),
    energy: C.maxStats.energy(0),
    nerve: C.maxStats.nerve(0),
    str: s.str,
    def: s.def,
    int: s.int,
    city: s.city,
    jailUntil: 0,
    hospitalUntil: 0,
    premiumUntil: 0,
    ammo: 0,
    weapons: [],
    weapon: null,
    armors: [],
    armor: null,
    vehicles: [],
    properties: {},
    cars: [],
    extraGarage: 0,
    goods: {},
    cooldowns: {},
    regenAt: { energy: now, hp: now, nerve: now },
    interestAt: now,
    lastDaily: 0,
    attacks: {},
    inmates: [],
    inmatesAt: 0,
    crew: [],
    crewAt: 0,
    blackjack: null,
    stats: { crimes: 0, crimesFailed: 0, carsStolen: 0, kills: 0, losses: 0, jailed: 0, busts: 0, heists: 0, earned: 0, bountiesCollected: 0 },
    history: [],
    seq: 1,
  };
}

export function rankOf(xp: number): number {
  let r = 0;
  C.ranks.forEach((k, i) => {
    if (xp >= k.xp) r = i;
  });
  return r;
}
export const rank = (p: Player) => rankOf(p.xp);
export const maxEnergy = (p: Player) => C.maxStats.energy(rank(p));
export const maxHp = (p: Player) => C.maxStats.hp(rank(p));
export const maxNerve = (p: Player) => C.maxStats.nerve(rank(p));
export const isPremium = (p: Player, now: number) => p.premiumUntil > now;

export const jailLeft = (p: Player, now: number) => Math.max(0, (p.jailUntil - now) / 1000);
export const hospitalLeft = (p: Player, now: number) => Math.max(0, (p.hospitalUntil - now) / 1000);
export const cdLeft = (p: Player, key: string, now: number) => Math.max(0, ((p.cooldowns[key] ?? 0) - now) / 1000);

/** Bekleme süresi koy (premium daha kısa) */
export function setCd(p: Player, key: string, seconds: number, now: number) {
  const f = isPremium(p, now) ? C.premium.cooldownFactor : 1;
  p.cooldowns[key] = now + sec(seconds * f);
}

export function city(p: Player) {
  return C.cities.find((c) => c.id === p.city) ?? C.cities[0];
}

/** Hapis/hastane engeli */
export function blocked(p: Player, now: number): Result | null {
  const j = jailLeft(p, now);
  if (j) return fail('err.inJail', { time: j });
  const h = hospitalLeft(p, now);
  if (h) return fail('err.inHospital', { time: h });
  return null;
}

export function cooldownGuard(p: Player, key: string, now: number): Result | null {
  const l = cdLeft(p, key, now);
  return l ? fail('err.cooldown', { time: l }) : null;
}

// ---------------------------------------------------------------- ilerleme
function bucket(p: Player, now: number) {
  const hourStart = Math.floor(now / 3600000) * 3600000;
  let h = p.history[p.history.length - 1];
  if (!h || h.t !== hourStart) {
    h = { t: hourStart, earned: 0, crimes: 0, kills: 0, xp: 0 };
    p.history.push(h);
    // 8 günden eski kayıtları at
    const cutoff = now - 8 * 86400000;
    while (p.history.length && p.history[0].t < cutoff) p.history.shift();
  }
  return h;
}

export function earn(p: Player, amount: number, now: number) {
  amount = Math.floor(amount);
  p.cash += amount;
  p.stats.earned += amount;
  bucket(p, now).earned += amount;
}

export function track(p: Player, field: 'crimes' | 'kills', now: number) {
  bucket(p, now)[field]++;
}

/** XP ver; rütbe atlarsa yeni rütbe indeksini döndürür */
export function gainXp(p: Player, amount: number, now: number): number | undefined {
  const before = rank(p);
  p.xp += amount;
  bucket(p, now).xp += amount;
  const after = rank(p);
  if (after > before) {
    p.diamonds += C.rankUpDiamonds * (after - before);
    p.energy = maxEnergy(p);
    p.hp = maxHp(p);
    p.nerve = maxNerve(p);
    return after;
  }
  return undefined;
}

export function withRank(r: Result, rankUp?: number): Result {
  if (rankUp !== undefined) r.rankUp = rankUp;
  return r;
}

export function sendToJail(p: Player, seconds: number, now: number) {
  p.jailUntil = Math.max(p.jailUntil, now) + sec(seconds);
  p.stats.jailed++;
  p.blackjack = null;
}

export function sendToHospital(p: Player, seconds: number, now: number) {
  p.hp = 0;
  p.hospitalUntil = now + sec(seconds);
  p.blackjack = null;
}

// ---------------------------------------------------------------- zaman
function regenOne(p: Player, key: 'energy' | 'hp' | 'nerve', max: number, now: number) {
  const cfg = C.regen[key];
  const every = sec(cfg.every * (isPremium(p, now) ? C.regen.premiumFactor : 1));
  if (key === 'hp' && hospitalLeft(p, now)) {
    p.regenAt.hp = now;
    return;
  }
  if (p[key] >= max) {
    p.regenAt[key] = now;
    return;
  }
  const n = Math.floor((now - p.regenAt[key]) / every);
  if (n > 0) {
    p[key] = Math.min(max, p[key] + Math.ceil(max * cfg.pct) * n);
    p.regenAt[key] += n * every;
  }
}

/** Zamana bağlı her şeyi güncelle: dolumlar, faiz, hapis/hastane çıkışı */
export function tick(p: Player, ctx: Ctx): void {
  const { now } = ctx;
  regenOne(p, 'energy', maxEnergy(p), now);
  regenOne(p, 'hp', maxHp(p), now);
  regenOne(p, 'nerve', maxNerve(p), now);

  const hours = Math.floor((now - p.interestAt) / 3600000);
  if (hours > 0) {
    const h = Math.min(hours, C.bank.maxHours);
    const base = Math.min(p.bank, C.bank.interestCap);
    const gain = Math.floor(base * (Math.pow(1 + C.bank.interest, h) - 1));
    p.bank += gain;
    p.interestAt += hours * 3600000;
  }

  if (p.hospitalUntil && p.hospitalUntil <= now) {
    p.hospitalUntil = 0;
    p.hp = Math.max(p.hp, Math.round(maxHp(p) * C.hospital.dischargeHp));
  }
  if (p.jailUntil && p.jailUntil <= now) p.jailUntil = 0;

  for (const car of p.cars) if (car.arrivesAt && car.arrivesAt <= now) car.arrivesAt = 0;
}
