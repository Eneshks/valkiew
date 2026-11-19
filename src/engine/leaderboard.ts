// Tek oyunculu sıralama: oyuncu, kurgusal NPC mafyozolarla karşılaştırılır.
import { C, hash01, mulberry32, rank } from './core';
import type { Player } from './types';

export type Board = 'rank' | 'wealth' | 'kills' | 'crimes';
export type Period = 'daily' | 'weekly' | 'all';

export interface Row {
  name: string; // NPC için i18n isim indeksi "#12", oyuncu için gerçek isim
  me: boolean;
  value: number;
  rank?: number;
}

const NPC_COUNT = 24;
const PERIOD_MS = { daily: 86400000, weekly: 7 * 86400000 } as const;

function playerValue(p: Player, board: Board, period: Period, now: number): number {
  if (period === 'all') {
    if (board === 'rank') return p.xp;
    if (board === 'wealth') return p.cash + p.bank;
    if (board === 'kills') return p.stats.kills;
    return p.stats.crimes;
  }
  const since = now - PERIOD_MS[period];
  const rows = p.history.filter((h) => h.t + 3600000 > since);
  if (board === 'rank') return rows.reduce((a, h) => a + h.xp, 0);
  if (board === 'wealth') return rows.reduce((a, h) => a + h.earned, 0);
  if (board === 'kills') return rows.reduce((a, h) => a + h.kills, 0);
  return rows.reduce((a, h) => a + h.crimes, 0);
}

/** NPC değerleri: oyuncunun yaşına göre büyüyen, döneme göre değişen kurgusal rakamlar */
function npcValue(i: number, board: Board, period: Period, now: number, created: number): number {
  const slot = period === 'all' ? 0 : Math.floor(now / PERIOD_MS[period]);
  const r = mulberry32(Math.floor(hash01(`${board}|${period}|${slot}|${i}`) * 1e9));
  const strength = Math.pow(r(), 2.2); // çoğu zayıf, birkaçı çok güçlü
  const ageDays = Math.max(1, (now - created) / 86400000);
  const growth = period === 'all' ? Math.min(ageDays, 60) : period === 'weekly' ? 7 : 1;
  const base = { rank: 1800, wealth: 40000, kills: 12, crimes: 60 }[board];
  return Math.round(base * growth * (0.15 + strength * 3));
}

export function leaderboard(p: Player, board: Board, period: Period, now: number): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < NPC_COUNT; i++) {
    const v = npcValue(i, board, period, now, p.created);
    rows.push({ name: '#' + ((i * 7) % 40), me: false, value: v, rank: board === 'rank' && period === 'all' ? npcRank(v) : undefined });
  }
  const mine = playerValue(p, board, period, now);
  rows.push({ name: p.name, me: true, value: mine, rank: board === 'rank' && period === 'all' ? rank(p) : undefined });
  return rows.sort((a, b) => b.value - a.value);
}

function npcRank(xp: number) {
  let r = 0;
  C.ranks.forEach((k, i) => { if (xp >= k.xp) r = i; });
  return r;
}
