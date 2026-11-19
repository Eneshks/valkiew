// Kumarhane — YALNIZCA oyun içi parayla. Gerçek parayla kumar yoktur.
import { C, blocked, cooldownGuard, earn, fail, ok, rank, setCd } from './core';
import type { BlackjackHand, Ctx, Player, Result } from './types';

const K = C.casino;
export const maxBet = (p: Player) => K.maxBetBase * Math.pow(rank(p) + 1, 2);

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export type RoulettePick = 'red' | 'black' | 'green' | 'even' | 'odd';

/** Ortak bahis kontrolü; geçerse bahsi düşer */
function takeBet(p: Player, ctx: Ctx, bet: number): Result | null {
  const b = blocked(p, ctx.now) ?? cooldownGuard(p, 'casino', ctx.now);
  if (b) return b;
  if (p.blackjack) return fail('casino.bjActive');
  bet = Math.floor(bet);
  if (!(bet > 0)) return fail('err.amount');
  if (bet > maxBet(p)) return fail('casino.maxBet', { money: maxBet(p) });
  if (bet > p.cash) return fail('err.cash');
  p.cash -= bet;
  setCd(p, 'casino', K.cooldown, ctx.now);
  return null;
}

function settle(p: Player, ctx: Ctx, bet: number, win: number, detail: Record<string, string | number>): Result {
  if (win > bet) {
    p.cash += bet; // bahis geri
    earn(p, win - bet, ctx.now); // net kazanç istatistiğe
    return ok('casino.win', { ...detail, money: win - bet });
  }
  p.cash += win;
  if (win === bet) return ok('casino.push', detail, 'info');
  return fail('casino.lose', { ...detail, money: bet });
}

export function roulettePayout(n: number, pick: RoulettePick): number {
  if (pick === 'green') return n === 0 ? K.rouletteGreen : 0;
  if (n === 0) return 0;
  if (pick === 'red') return RED.has(n) ? 2 : 0;
  if (pick === 'black') return RED.has(n) ? 0 : 2;
  if (pick === 'even') return n % 2 === 0 ? 2 : 0;
  return n % 2 === 1 ? 2 : 0;
}

export function roulette(p: Player, ctx: Ctx, bet: number, pick: RoulettePick): Result {
  const e = takeBet(p, ctx, bet);
  if (e) return e;
  const n = Math.floor(ctx.rng() * 37);
  const color = n === 0 ? 'green' : RED.has(n) ? 'red' : 'black';
  const r = settle(p, ctx, bet, bet * roulettePayout(n, pick), { n, color });
  r.data = { n, color };
  return r;
}

export function dice(p: Player, ctx: Ctx, bet: number): Result {
  const e = takeBet(p, ctx, bet);
  if (e) return e;
  const d = () => 1 + Math.floor(ctx.rng() * 6);
  const mine = [d(), d()], house = [d(), d()];
  const a = mine[0] + mine[1], b = house[0] + house[1];
  const r = settle(p, ctx, bet, a > b ? bet * 2 : a === b ? bet : 0, { mine: a, house: b });
  r.data = { mine, house };
  return r;
}

export function spinReel(rng: () => number): string {
  const total = K.slots.reduce((s, x) => s + x.weight, 0);
  let roll = rng() * total;
  for (const s of K.slots) {
    roll -= s.weight;
    if (roll < 0) return s.id;
  }
  return K.slots[0].id;
}

export function slotMultiplier(reels: string[]): number {
  if (reels[0] === reels[1] && reels[1] === reels[2]) return K.slots.find((s) => s.id === reels[0])!.pay;
  const cherries = reels.filter((r) => r === 'cherry').length;
  return cherries === 2 ? K.slotTwoCherry : 0;
}

export function slots(p: Player, ctx: Ctx, bet: number): Result {
  const e = takeBet(p, ctx, bet);
  if (e) return e;
  const reels = [spinReel(ctx.rng), spinReel(ctx.rng), spinReel(ctx.rng)];
  const r = settle(p, ctx, bet, Math.floor(bet * slotMultiplier(reels)), {});
  r.data = { reels };
  return r;
}

// ---------------------------------------------------------------- blackjack
/** Kart: 1-13 (1 = As, 11-13 = resim) */
export function handValue(cards: number[]): number {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c === 1) { aces++; total += 11; } else total += Math.min(c, 10);
  }
  while (total > 21 && aces) { total -= 10; aces--; }
  return total;
}

function newDeck(rng: () => number): number[] {
  const d: number[] = [];
  for (let s = 0; s < 4; s++) for (let v = 1; v <= 13; v++) d.push(v);
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function finish(p: Player, ctx: Ctx, h: BlackjackHand): Result {
  const pv = handValue(h.player);
  if (pv <= 21) while (handValue(h.dealer) < 17) h.dealer.push(h.deck.pop()!);
  const dv = handValue(h.dealer);
  let win = 0;
  const natural = h.player.length === 2 && pv === 21;
  if (pv > 21) win = 0;
  else if (natural && !(h.dealer.length === 2 && dv === 21)) win = Math.floor(h.bet * K.blackjackPayout);
  else if (dv > 21 || pv > dv) win = h.bet * 2;
  else if (pv === dv) win = h.bet;
  p.blackjack = null;
  const r = settle(p, ctx, h.bet, win, { mine: pv, house: dv });
  r.data = { hand: { ...h, deck: [] }, done: true };
  return r;
}

export function bjStart(p: Player, ctx: Ctx, bet: number): Result {
  const e = takeBet(p, ctx, bet);
  if (e) return e;
  const deck = newDeck(ctx.rng);
  const h: BlackjackHand = { bet: Math.floor(bet), player: [deck.pop()!, deck.pop()!], dealer: [deck.pop()!, deck.pop()!], deck };
  if (handValue(h.player) === 21) return finish(p, ctx, h);
  p.blackjack = h;
  return { ok: true, key: 'casino.bjDealt', tone: 'info', data: { hand: { ...h, deck: [] }, done: false } };
}

export function bjHit(p: Player, ctx: Ctx): Result {
  const h = p.blackjack;
  if (!h) return fail('casino.bjNone');
  h.player.push(h.deck.pop()!);
  if (handValue(h.player) >= 21) return finish(p, ctx, h);
  return { ok: true, key: 'casino.bjDealt', tone: 'info', data: { hand: { ...h, deck: [] }, done: false } };
}

export function bjStand(p: Player, ctx: Ctx): Result {
  const h = p.blackjack;
  if (!h) return fail('casino.bjNone');
  return finish(p, ctx, h);
}
