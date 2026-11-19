import type { CrewRole } from '@/config/game';
import {
  C, blocked, cdLeft, city, clamp, cooldownGuard, earn, fail, gainXp, hash01, hospitalLeft, isPremium, jailLeft,
  maxEnergy, maxHp, maxNerve, ok, randInt, randRange, rank, sec, sendToHospital, sendToJail, setCd, track, withRank,
} from './core';
import type { Ctx, Player, Result } from './types';

const NPC_NAMES = 40; // i18n'deki npc.names listesinin uzunluğu

// ================================================================ SUÇLAR
export function crimeChance(p: Player, id: string): number {
  const c = C.crimes.find((x) => x.id === id)!;
  const f = C.crimeFormula;
  return clamp(c.chance + (rank(p) - c.minRank) * f.perRankAbove + p.int * f.perInt, f.min, f.max);
}

export function commitCrime(p: Player, ctx: Ctx, id: string): Result {
  const { now, rng } = ctx;
  const c = C.crimes.find((x) => x.id === id);
  if (!c) return fail('err.unknown');
  const b = blocked(p, now) ?? cooldownGuard(p, 'crime_' + id, now);
  if (b) return b;
  if (rank(p) < c.minRank) return fail('err.rank', { rank: c.minRank });
  if (p.energy < c.energy) return fail('err.energy');
  p.energy -= c.energy;
  setCd(p, 'crime_' + id, c.cooldown, now);
  if (rng() < crimeChance(p, id)) {
    const m = randRange(rng, c.money);
    earn(p, m, now);
    p.stats.crimes++;
    track(p, 'crimes', now);
    const r = gainXp(p, c.xp, now);
    return withRank(ok('crime.success', { crime: id, money: m, xp: c.xp }), r);
  }
  p.stats.crimesFailed++;
  if (rng() < c.jailChance) {
    sendToJail(p, c.jail, now);
    return fail('crime.jailed', { crime: id, time: c.jail });
  }
  return fail('crime.failed', { crime: id });
}

// ================================================================ ARABALAR
export const garageCap = (p: Player) => C.carTheft.garageBase + rank(p) * C.carTheft.garagePerRank + p.extraGarage;

export function carValue(p: Player, carUid: number): number {
  const car = p.cars.find((c) => c.uid === carUid);
  if (!car) return 0;
  const model = C.cars.find((m) => m.id === car.model)!;
  const demand = C.cities.find((c) => c.id === car.city)?.carDemand ?? 1;
  return Math.floor(model.value * (1 - car.damage / 100) * demand);
}

export function stealCar(p: Player, ctx: Ctx): Result {
  const { now, rng } = ctx;
  const t = C.carTheft;
  const b = blocked(p, now) ?? cooldownGuard(p, 'car', now);
  if (b) return b;
  if (p.energy < t.energy) return fail('err.energy');
  if (p.cars.length >= garageCap(p)) return fail('car.garageFull');
  p.energy -= t.energy;
  setCd(p, 'car', t.cooldown, now);
  const pool = C.cars.filter((c) => c.minRank <= rank(p));
  const weights = pool.map((_, i) => Math.pow(0.6, i));
  let roll = rng() * weights.reduce((a, w) => a + w, 0);
  let model = pool[0];
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { model = pool[i]; break; }
  }
  const chance = clamp(model.chance + p.int * t.perInt, 0.05, 0.95);
  if (rng() < chance) {
    const damage = randInt(rng, 0, t.maxDamage);
    p.cars.push({ uid: p.seq++, model: model.id, damage, city: p.city, arrivesAt: 0 });
    p.stats.carsStolen++;
    const tier = C.cars.findIndex((c) => c.id === model.id);
    const r = gainXp(p, t.xpBase + tier * t.xpPerTier, now);
    return withRank(ok('car.stolen', { car: model.id, damage }), r);
  }
  if (rng() < t.jailChance) {
    sendToJail(p, t.jail, now);
    return fail('car.jailed', { car: model.id, time: t.jail });
  }
  return fail('car.failed', { car: model.id });
}

export function sellCar(p: Player, ctx: Ctx, uid: number): Result {
  const b = blocked(p, ctx.now);
  if (b) return b;
  const idx = p.cars.findIndex((c) => c.uid === uid);
  if (idx < 0) return fail('err.unknown');
  const car = p.cars[idx];
  if (car.arrivesAt) return fail('car.inTransit');
  if (car.city !== p.city) return fail('car.otherCity', { city: car.city });
  const v = carValue(p, uid);
  p.cars.splice(idx, 1);
  earn(p, v, ctx.now);
  return ok('car.sold', { car: car.model, money: v });
}

export const shipFee = (p: Player, uid: number) => {
  const car = p.cars.find((c) => c.uid === uid);
  if (!car) return 0;
  const model = C.cars.find((m) => m.id === car.model)!;
  return Math.ceil(model.value * C.carTheft.shipFeePct);
};

export function shipCar(p: Player, ctx: Ctx, uid: number, to: string): Result {
  const b = blocked(p, ctx.now);
  if (b) return b;
  const car = p.cars.find((c) => c.uid === uid);
  if (!car) return fail('err.unknown');
  if (car.arrivesAt) return fail('car.inTransit');
  if (car.city === to) return fail('car.alreadyThere');
  if (!C.cities.some((c) => c.id === to)) return fail('err.unknown');
  const fee = shipFee(p, uid);
  if (p.cash < fee) return fail('err.cash');
  p.cash -= fee;
  car.city = to;
  car.arrivesAt = ctx.now + sec(C.carTheft.shipTime);
  return ok('car.shipped', { car: car.model, city: to, money: fee }, 'info');
}

// ================================================================ SEYAHAT
export function travelCost(p: Player, cityId: string): number {
  const c = C.cities.find((x) => x.id === cityId)!;
  const disc = Math.max(0, ...p.vehicles.map((v) => C.vehicles.find((x) => x.id === v)?.travelDiscount ?? 0));
  return Math.round(c.travel * (1 - disc));
}

export function travel(p: Player, ctx: Ctx, cityId: string): Result {
  const { now } = ctx;
  const c = C.cities.find((x) => x.id === cityId);
  if (!c) return fail('err.unknown');
  const b = blocked(p, now) ?? cooldownGuard(p, 'travel', now);
  if (b) return b;
  if (c.id === p.city) return fail('travel.here');
  if (rank(p) < c.minRank) return fail('err.rank', { rank: c.minRank });
  const cost = travelCost(p, cityId);
  if (p.cash < cost) return fail('err.cash');
  p.cash -= cost;
  p.city = c.id;
  setCd(p, 'travel', C.travel.cooldown, now);
  return ok('travel.done', { city: c.id }, 'info');
}

// ================================================================ KAÇAKÇILIK
export function goodPrice(goodId: string, cityId: string, now: number): number {
  const g = C.goods.find((x) => x.id === goodId)!;
  const s = C.smuggling;
  const slot = Math.floor(now / sec(s.period));
  const f = s.minF + hash01(`${cityId}|${goodId}|${slot}`) * (s.maxF - s.minF);
  return Math.max(1, Math.round(g.base * f));
}
export const goodSellPrice = (goodId: string, cityId: string, now: number) =>
  Math.floor(goodPrice(goodId, cityId, now) * C.smuggling.sellSpread);
export const priceChangeIn = (now: number) => {
  const p = sec(C.smuggling.period);
  return (p - (now % p)) / 1000;
};
export const cargoCap = (p: Player) =>
  C.smuggling.capBase + rank(p) * C.smuggling.capPerRank +
  p.vehicles.reduce((a, v) => a + (C.vehicles.find((x) => x.id === v)?.cargo ?? 0), 0);
export const cargoUsed = (p: Player) => Object.values(p.goods).reduce((a, b) => a + b, 0);

export function buyGood(p: Player, ctx: Ctx, goodId: string, qty: number): Result {
  const b = blocked(p, ctx.now);
  if (b) return b;
  qty = Math.floor(qty);
  if (!(qty > 0) || !C.goods.some((g) => g.id === goodId)) return fail('err.amount');
  if (cargoUsed(p) + qty > cargoCap(p)) return fail('smuggle.full', { cap: cargoCap(p) });
  const cost = goodPrice(goodId, p.city, ctx.now) * qty;
  if (p.cash < cost) return fail('err.cash');
  p.cash -= cost;
  p.goods[goodId] = (p.goods[goodId] ?? 0) + qty;
  return ok('smuggle.bought', { good: goodId, qty, money: cost }, 'info');
}

export function sellGood(p: Player, ctx: Ctx, goodId: string, qty: number): Result {
  const b = blocked(p, ctx.now);
  if (b) return b;
  qty = Math.min(Math.floor(qty), p.goods[goodId] ?? 0);
  if (!(qty > 0)) return fail('smuggle.none');
  const g = C.goods.find((x) => x.id === goodId)!;
  const v = goodSellPrice(goodId, p.city, ctx.now) * qty;
  p.goods[goodId] -= qty;
  if (!p.goods[goodId]) delete p.goods[goodId];
  earn(p, v, ctx.now);
  const r = gainXp(p, Math.ceil((qty * g.base) / 600), ctx.now);
  return withRank(ok('smuggle.sold', { good: goodId, qty, money: v }), r);
}

// ================================================================ HAPİSHANE
export const bribeCost = (p: Player, now: number) =>
  Math.ceil(jailLeft(p, now) * C.jail.bribePerSecond * (1 + rank(p) * C.jail.bribeRankFactor));

export function bribe(p: Player, ctx: Ctx, withDiamonds: boolean): Result {
  if (!jailLeft(p, ctx.now)) return fail('jail.notIn');
  if (withDiamonds) {
    if (p.diamonds < C.diamondCosts.jailOut) return fail('err.diamonds', { n: C.diamondCosts.jailOut });
    p.diamonds -= C.diamondCosts.jailOut;
  } else {
    const c = bribeCost(p, ctx.now);
    if (p.cash < c) return fail('err.cash');
    p.cash -= c;
  }
  p.jailUntil = 0;
  return ok('jail.free');
}

export function escapeChance(p: Player) {
  const j = C.jail;
  return clamp(j.escapeBase + p.int * j.escapePerInt, 0.05, j.escapeMax);
}

export function escape(p: Player, ctx: Ctx): Result {
  const { now, rng } = ctx;
  if (!jailLeft(p, now)) return fail('jail.notIn');
  const g = cooldownGuard(p, 'escape', now);
  if (g) return g;
  setCd(p, 'escape', C.jail.escapeCooldown, now);
  if (rng() < escapeChance(p)) {
    p.jailUntil = 0;
    const r = gainXp(p, 10, now);
    return withRank(ok('jail.escaped'), r);
  }
  p.jailUntil += sec(C.jail.escapePenalty);
  return fail('jail.escapeFailed', { time: C.jail.escapePenalty });
}

/** Hapishanedeki NPC mahkûmları yenile */
export function refreshInmates(p: Player, ctx: Ctx) {
  const { now, rng } = ctx;
  p.inmates = p.inmates.filter((i) => i.until > now);
  if (p.inmates.length >= C.jail.inmates - 1 && now - p.inmatesAt < sec(600)) return;
  while (p.inmates.length < C.jail.inmates) {
    p.inmates.push({
      uid: p.seq++,
      nameIdx: Math.floor(rng() * NPC_NAMES),
      until: now + sec(randInt(rng, 3, 25) * 60),
      difficulty: Math.round(rng() * 100) / 100,
    });
  }
  p.inmatesAt = now;
}

export function bustChance(p: Player, difficulty: number) {
  const j = C.jail;
  return clamp(j.bustBase - difficulty * 0.3 + p.int * j.bustPerInt, 0.05, 0.9);
}

export function bustInmate(p: Player, ctx: Ctx, uid: number): Result {
  const { now, rng } = ctx;
  const b = blocked(p, now) ?? cooldownGuard(p, 'bust', now);
  if (b) return b;
  const idx = p.inmates.findIndex((i) => i.uid === uid && i.until > now);
  if (idx < 0) return fail('jail.inmateGone');
  setCd(p, 'bust', C.jail.bustCooldown, now);
  const inmate = p.inmates[idx];
  if (rng() < bustChance(p, inmate.difficulty)) {
    p.inmates.splice(idx, 1);
    p.stats.busts++;
    const r = gainXp(p, C.jail.bustXp + Math.round(inmate.difficulty * 10), now);
    return withRank(ok('jail.busted', { name: inmate.nameIdx }), r);
  }
  sendToJail(p, C.jail.bustJail, now);
  return fail('jail.bustFailed', { time: C.jail.bustJail });
}

// ================================================================ HASTANE
export const healCost = (p: Player) => Math.ceil((maxHp(p) - p.hp) * C.hospital.healPerHp);
export const dischargeCost = (p: Player, now: number) => Math.ceil(hospitalLeft(p, now) * C.hospital.dischargePerSecond);

export function heal(p: Player, ctx: Ctx): Result {
  if (hospitalLeft(p, ctx.now)) return fail('hospital.admitted');
  if (p.hp >= maxHp(p)) return fail('hospital.healthy');
  const c = healCost(p);
  if (p.cash < c) return fail('err.cash');
  p.cash -= c;
  p.hp = maxHp(p);
  return ok('hospital.healed');
}

export function discharge(p: Player, ctx: Ctx, withDiamonds: boolean): Result {
  if (!hospitalLeft(p, ctx.now)) return fail('hospital.notIn');
  if (withDiamonds) {
    if (p.diamonds < C.diamondCosts.hospitalOut) return fail('err.diamonds', { n: C.diamondCosts.hospitalOut });
    p.diamonds -= C.diamondCosts.hospitalOut;
    p.hp = maxHp(p);
  } else {
    const c = dischargeCost(p, ctx.now);
    if (p.cash < c) return fail('err.cash');
    p.cash -= c;
    p.hp = Math.round(maxHp(p) * C.hospital.dischargeHp);
  }
  p.hospitalUntil = 0;
  return ok('hospital.discharged');
}

// ================================================================ SALON
export type TrainStat = 'str' | 'def' | 'int';
export const trainCost = (p: Player, stat: TrainStat) => Math.ceil(C.gym.costPerPoint * p[stat]);

export function train(p: Player, ctx: Ctx, stat: TrainStat): Result {
  const { now } = ctx;
  const b = blocked(p, now) ?? cooldownGuard(p, 'gym', now);
  if (b) return b;
  if (p.energy < C.gym.energy) return fail('err.energy');
  const cost = trainCost(p, stat);
  if (p.cash < cost) return fail('err.cash');
  p.energy -= C.gym.energy;
  p.cash -= cost;
  p[stat] += C.gym.gain;
  setCd(p, 'gym', C.gym.cooldown, now);
  const r = gainXp(p, C.gym.xp, now);
  return withRank(ok('gym.trained', { stat, value: p[stat] }), r);
}

// ================================================================ DÖVÜŞ
const weaponOf = (p: Player) => C.weapons.find((w) => w.id === p.weapon);
const armorOf = (p: Player) => C.armors.find((a) => a.id === p.armor);

export function playerAttack(p: Player): number {
  const k = C.combat;
  const w = weaponOf(p);
  let atk = w ? w.atk : 0;
  if (w?.ammo && p.ammo <= 0) atk *= k.noAmmoFactor;
  return p.str * k.strW + atk * k.weaponW;
}
export function playerDefense(p: Player): number {
  const k = C.combat;
  return p.def * k.defW + (armorOf(p)?.def ?? 0) * k.armorW;
}
/** Tek sayı olarak savaş gücü (gösterim için) */
export const power = (p: Player) => Math.round(playerAttack(p) + playerDefense(p) * 0.5);

export function rivalPower(id: string): number {
  const r = C.rivals.find((x) => x.id === id)!;
  const k = C.combat;
  return r.str * k.strW + r.atk * k.weaponW + r.def * k.defW * 0.5;
}

/** Saf savaş formülü: iki güç ve iki rastgele sayıdan sonuç (test edilebilir) */
export function fightRoll(mine: number, theirs: number, r1: number, r2: number): boolean {
  const k = C.combat.random;
  const a = mine * (1 - k + 2 * k * r1);
  const b = theirs * (1 - k + 2 * k * r2);
  return a > b;
}

/** Kazanma olasılığı (kapalı form: iki düzgün dağılımın karşılaştırması) */
export function winProbability(mine: number, theirs: number): number {
  const k = C.combat.random;
  // a ~ U[mine(1-k), mine(1+k)], b ~ U[theirs(1-k), theirs(1+k)]; P(a>b) sayısal integral
  const N = 200;
  let wins = 0;
  for (let i = 0; i < N; i++) {
    const a = mine * (1 - k + 2 * k * ((i + 0.5) / N));
    const lo = theirs * (1 - k), hi = theirs * (1 + k);
    wins += clamp((a - lo) / (hi - lo), 0, 1);
  }
  return wins / N;
}

export function attacksInWindow(p: Player, id: string, now: number) {
  return (p.attacks[id] ?? []).filter((t) => now - t < sec(C.combat.sameTargetWindow));
}

export function attack(p: Player, ctx: Ctx, rivalId: string): Result {
  const { now, rng } = ctx;
  const k = C.combat;
  const r = C.rivals.find((x) => x.id === rivalId);
  if (!r) return fail('err.unknown');
  const b = blocked(p, now) ?? cooldownGuard(p, 'attack', now);
  if (b) return b;
  if (rank(p) < r.minRank) return fail('err.rank', { rank: r.minRank });
  if (p.nerve < k.nerve) return fail('err.nerve');
  if (p.hp < maxHp(p) * k.minHpToFight) return fail('fight.tooHurt');
  const recent = attacksInWindow(p, rivalId, now);
  if (recent.length >= k.sameTargetLimit) return fail('fight.limit', { n: k.sameTargetLimit });

  p.nerve -= k.nerve;
  p.attacks[rivalId] = [...recent, now];
  setCd(p, 'attack', k.cooldown, now);

  const mine = playerAttack(p) + playerDefense(p) * 0.5;
  const w = weaponOf(p);
  if (w?.ammo && p.ammo > 0) p.ammo = Math.max(0, p.ammo - randRange(rng, k.ammoPerFight));

  if (fightRoll(mine, rivalPower(rivalId), rng(), rng())) {
    const loot = Math.floor(randRange(rng, r.cash) * k.lootPct);
    earn(p, loot, now);
    let bounty = 0;
    if (r.bounty && !cdLeft(p, 'bounty_' + r.id, now)) {
      bounty = r.bounty;
      earn(p, bounty, now);
      p.stats.bountiesCollected++;
      p.cooldowns['bounty_' + r.id] = now + sec(k.bountyCooldown);
    }
    p.stats.kills++;
    track(p, 'kills', now);
    p.hp = Math.max(1, p.hp - Math.round(maxHp(p) * (k.winDamage[0] + rng() * (k.winDamage[1] - k.winDamage[0]))));
    const ru = gainXp(p, r.xp, now);
    return withRank(ok(bounty ? 'fight.wonBounty' : 'fight.won', { rival: r.id, money: loot, bounty }), ru);
  }
  p.stats.losses++;
  const lost = Math.floor(p.cash * k.lossCashPct);
  p.cash -= lost;
  const dmg = Math.round(maxHp(p) * (k.lossDamage[0] + rng() * (k.lossDamage[1] - k.lossDamage[0])));
  p.hp -= dmg;
  if (p.hp <= 0) {
    sendToHospital(p, k.hospital, now);
    return fail('fight.hospital', { rival: r.id, money: lost, time: k.hospital });
  }
  return fail('fight.lost', { rival: r.id, money: lost, dmg });
}

export const bountyAvailable = (p: Player, id: string, now: number) => {
  const r = C.rivals.find((x) => x.id === id);
  return !!r?.bounty && !cdLeft(p, 'bounty_' + id, now);
};

// ================================================================ ORGANİZE SUÇ
export function refreshCrew(p: Player, ctx: Ctx, force = false) {
  const { now, rng } = ctx;
  if (!force && p.crew.length && now - p.crewAt < sec(3600)) return;
  const roles: CrewRole[] = ['driver', 'gunner', 'explosives'];
  p.crew = [];
  for (const role of roles) {
    for (let i = 0; i < C.heistFormula.candidates; i++) {
      const skill = randInt(rng, 20, 95);
      p.crew.push({ uid: p.seq++, nameIdx: Math.floor(rng() * NPC_NAMES), role, skill, cut: Math.round((0.04 + skill / 500) * 100) / 100 });
    }
  }
  p.crewAt = now;
}

export function heistChance(p: Player, heistId: string, picks: Partial<Record<CrewRole, number>>): number {
  const h = C.heists.find((x) => x.id === heistId)!;
  const f = C.heistFormula;
  let skill = 0;
  for (const role of h.crew) {
    const m = p.crew.find((c) => c.uid === picks[role] && c.role === role);
    skill += m ? m.skill : 0;
  }
  return clamp(h.base + skill * f.perSkill + p.int * f.perLeaderInt, f.min, f.max);
}

export function heistCut(p: Player, heistId: string, picks: Partial<Record<CrewRole, number>>): number {
  const h = C.heists.find((x) => x.id === heistId)!;
  return h.crew.reduce((a, role) => a + (p.crew.find((c) => c.uid === picks[role])?.cut ?? 0), 0);
}

export function runHeist(p: Player, ctx: Ctx, heistId: string, picks: Partial<Record<CrewRole, number>>): Result {
  const { now, rng } = ctx;
  const h = C.heists.find((x) => x.id === heistId);
  if (!h) return fail('err.unknown');
  const b = blocked(p, now) ?? cooldownGuard(p, 'heist_' + heistId, now);
  if (b) return b;
  if (rank(p) < h.minRank) return fail('err.rank', { rank: h.minRank });
  for (const role of h.crew) {
    if (!p.crew.some((c) => c.uid === picks[role] && c.role === role)) return fail('heist.missingCrew', { role });
  }
  if (p.nerve < h.nerve) return fail('err.nerve');
  p.nerve -= h.nerve;
  setCd(p, 'heist_' + heistId, h.cooldown, now);
  const chance = heistChance(p, heistId, picks);
  const cut = heistCut(p, heistId, picks);
  refreshCrew(p, ctx, true); // ekip dağılır, yenileri gelir
  if (rng() < chance) {
    const total = randRange(rng, h.money);
    const mine = Math.floor(total * (1 - cut));
    earn(p, mine, now);
    p.stats.heists++;
    const r = gainXp(p, h.xp, now);
    return withRank(ok('heist.success', { heist: h.id, money: mine, total }), r);
  }
  if (rng() < 0.6) {
    sendToJail(p, h.jail, now);
    return fail('heist.jailed', { heist: h.id, time: h.jail });
  }
  return fail('heist.failed', { heist: h.id });
}

// ================================================================ MAĞAZA
export function buyWeapon(p: Player, _ctx: Ctx, id: string): Result {
  const w = C.weapons.find((x) => x.id === id);
  if (!w) return fail('err.unknown');
  if (p.weapons.includes(id)) { p.weapon = id; return ok('shop.equipped', { item: id }, 'info'); }
  if (rank(p) < w.minRank) return fail('err.rank', { rank: w.minRank });
  if (p.cash < w.price) return fail('err.cash');
  p.cash -= w.price;
  p.weapons.push(id);
  p.weapon = id;
  return ok('shop.bought', { item: id });
}

export function buyArmor(p: Player, _ctx: Ctx, id: string): Result {
  const a = C.armors.find((x) => x.id === id);
  if (!a) return fail('err.unknown');
  if (p.armors.includes(id)) { p.armor = id; return ok('shop.equipped', { item: id }, 'info'); }
  if (rank(p) < a.minRank) return fail('err.rank', { rank: a.minRank });
  if (p.cash < a.price) return fail('err.cash');
  p.cash -= a.price;
  p.armors.push(id);
  p.armor = id;
  return ok('shop.bought', { item: id });
}

export function buyAmmo(p: Player, _ctx: Ctx, qty: number): Result {
  qty = Math.floor(qty);
  if (!(qty > 0)) return fail('err.amount');
  const cost = qty * C.ammoPrice;
  if (p.cash < cost) return fail('err.cash');
  p.cash -= cost;
  p.ammo += qty;
  return ok('shop.ammo', { qty, money: cost });
}

export function buyVehicle(p: Player, _ctx: Ctx, id: string): Result {
  const v = C.vehicles.find((x) => x.id === id);
  if (!v) return fail('err.unknown');
  if (p.vehicles.includes(id)) return fail('shop.owned');
  if (rank(p) < v.minRank) return fail('err.rank', { rank: v.minRank });
  if (p.cash < v.price) return fail('err.cash');
  p.cash -= v.price;
  p.vehicles.push(id);
  return ok('shop.bought', { item: id });
}

// ================================================================ MÜLKLER
export function propertyPending(p: Player, id: string, now: number): number {
  const since = p.properties[id];
  if (since === undefined) return 0;
  const pr = C.properties.find((x) => x.id === id)!;
  const hours = Math.min((now - since) / 3600000, C.propertyMaxHours);
  return Math.floor(pr.income * hours);
}

export function buyProperty(p: Player, ctx: Ctx, id: string): Result {
  const pr = C.properties.find((x) => x.id === id);
  if (!pr) return fail('err.unknown');
  if (p.properties[id] !== undefined) return fail('shop.owned');
  if (rank(p) < pr.minRank) return fail('err.rank', { rank: pr.minRank });
  if (p.cash < pr.price) return fail('err.cash');
  p.cash -= pr.price;
  p.properties[id] = ctx.now;
  return ok('shop.bought', { item: id });
}

export function collectProperties(p: Player, ctx: Ctx): Result {
  let total = 0;
  for (const id of Object.keys(p.properties)) {
    total += propertyPending(p, id, ctx.now);
    p.properties[id] = ctx.now;
  }
  if (total <= 0) return fail('property.nothing');
  earn(p, total, ctx.now);
  return ok('property.collected', { money: total });
}

// ================================================================ BANKA
export function deposit(p: Player, _ctx: Ctx, amount: number): Result {
  amount = Math.floor(amount);
  if (!(amount > 0)) return fail('err.amount');
  if (amount > p.cash) return fail('err.cash');
  p.cash -= amount;
  p.bank += amount;
  return ok('bank.deposited', { money: amount });
}

export function withdraw(p: Player, _ctx: Ctx, amount: number): Result {
  amount = Math.floor(amount);
  if (!(amount > 0)) return fail('err.amount');
  if (amount > p.bank) return fail('bank.insufficient');
  p.bank -= amount;
  p.cash += amount;
  return ok('bank.withdrawn', { money: amount });
}

// ================================================================ MALİKANE / ELMAS
export const dailyLeft = (p: Player, now: number) => Math.max(0, (p.lastDaily + sec(C.daily.every) - now) / 1000);

export function claimDaily(p: Player, ctx: Ctx): Result {
  const left = dailyLeft(p, ctx.now);
  if (left) return fail('err.cooldown', { time: left });
  const money = C.daily.cashPerRank * (rank(p) + 1);
  p.lastDaily = ctx.now;
  p.diamonds += C.daily.diamonds;
  earn(p, money, ctx.now);
  return ok('daily.claimed', { money, n: C.daily.diamonds });
}

function spend(p: Player, n: number): Result | null {
  if (p.diamonds < n) return fail('err.diamonds', { n });
  p.diamonds -= n;
  return null;
}

export function refillEnergy(p: Player, _ctx: Ctx): Result {
  if (p.energy >= maxEnergy(p)) return fail('refill.full');
  const e = spend(p, C.diamondCosts.energyRefill);
  if (e) return e;
  p.energy = maxEnergy(p);
  return ok('refill.energy');
}

export function refillNerve(p: Player, _ctx: Ctx): Result {
  if (p.nerve >= maxNerve(p)) return fail('refill.full');
  const e = spend(p, C.diamondCosts.nerveRefill);
  if (e) return e;
  p.nerve = maxNerve(p);
  return ok('refill.nerve');
}

export function buyGarageSlot(p: Player, _ctx: Ctx): Result {
  const e = spend(p, C.diamondCosts.garageSlot);
  if (e) return e;
  p.extraGarage++;
  return ok('premium.garage');
}

export function rename(p: Player, _ctx: Ctx, name: string): Result {
  name = name.trim().slice(0, 16);
  if (name.length < 2) return fail('premium.badName');
  const e = spend(p, C.diamondCosts.rename);
  if (e) return e;
  p.name = name;
  return ok('premium.renamed', { name });
}

export function buyPremium(p: Player, ctx: Ctx): Result {
  const e = spend(p, C.premium.diamondPrice);
  if (e) return e;
  p.premiumUntil = Math.max(p.premiumUntil, ctx.now) + sec(C.premium.days * 86400);
  return ok('premium.activated', { n: C.premium.days });
}

export { isPremium };
