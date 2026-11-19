'use client';
import { create } from 'zustand';
import { newPlayer, tick } from '@/engine/core';
import { refreshCrew, refreshInmates } from '@/engine/actions';
import type { Ctx, Player, Result } from '@/engine/types';

const SAVE_KEY = 'valkiew-save-v2';

export interface Toast {
  id: number;
  result: Result;
}

interface GameStore {
  player: Player | null;
  loaded: boolean;
  now: number;
  toasts: Toast[];
  lastResult: Result | null;
  load: () => void;
  start: (name: string) => void;
  /** Bir motor aksiyonunu çalıştır: kopya üzerinde uygula, kaydet, sonucu döndür */
  run: <A extends unknown[]>(fn: (p: Player, ctx: Ctx, ...args: A) => Result, ...args: A) => Result;
  heartbeat: () => void;
  dismiss: (id: number) => void;
  clearResult: () => void;
  reset: () => void;
}

const ctx = (): Ctx => ({ now: Date.now(), rng: Math.random });

function persist(p: Player | null) {
  try {
    if (p) localStorage.setItem(SAVE_KEY, JSON.stringify(p));
  } catch {
    /* depolama kullanılamıyor */
  }
}

/** Zamanla ilgili her şeyi uygula */
function advance(p: Player, c: Ctx) {
  tick(p, c);
  refreshInmates(p, c);
  refreshCrew(p, c);
}

let toastSeq = 1;

export const useGame = create<GameStore>((set, get) => ({
  player: null,
  loaded: false,
  now: Date.now(),
  toasts: [],
  lastResult: null,

  load() {
    let p: Player | null = null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.v === 2) p = { ...newPlayer(d.name, d.created), ...d };
      }
    } catch {
      p = null;
    }
    if (p) advance(p, ctx());
    set({ player: p, loaded: true, now: Date.now() });
  },

  start(name) {
    const c = ctx();
    const p = newPlayer(name.trim().slice(0, 16) || 'İsimsiz', c.now);
    advance(p, c);
    persist(p);
    set({ player: p });
  },

  run(fn, ...args) {
    const cur = get().player;
    if (!cur) return { ok: false, key: 'err.unknown', tone: 'bad' };
    const p: Player = structuredClone(cur);
    const c = ctx();
    advance(p, c);
    const result = fn(p, c, ...args);
    persist(p);
    const toast = { id: toastSeq++, result };
    set((s) => ({ player: p, now: c.now, lastResult: result, toasts: [...s.toasts.slice(-2), toast] }));
    setTimeout(() => get().dismiss(toast.id), result.rankUp !== undefined ? 4000 : 2600);
    return result;
  },

  heartbeat() {
    const cur = get().player;
    const c = ctx();
    if (!cur) return set({ now: c.now });
    const p: Player = structuredClone(cur);
    advance(p, c);
    set({ player: p, now: c.now });
    if (c.now % 15000 < 1000) persist(p);
  },

  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
  clearResult() {
    set({ lastResult: null });
  },
  reset() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* yok say */
    }
    set({ player: null, lastResult: null });
  },
}));

export const savePlayer = () => persist(useGame.getState().player);
