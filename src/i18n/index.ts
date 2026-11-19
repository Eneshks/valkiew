import { CONFIG } from '@/config/game';
import { npcNames, tr, type Dict } from './tr';

// İleride: const dicts = { tr, en }; ve dil seçimi.
const dict: Dict = tr;
export const locale = 'tr-TR';

export type Key = keyof typeof tr;
type Params = Record<string, string | number | undefined>;

export function money(n: number): string {
  return '$' + Math.floor(n).toLocaleString(locale);
}
export function num(n: number): string {
  return Math.floor(n).toLocaleString(locale);
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  if (d) return t('time.d', { n: d, d }) + (h ? ` ${h} sa` : '');
  if (h) return t('time.hm', { h, m: String(m).padStart(2, '0') });
  if (m) return t('time.ms', { m, s: String(r).padStart(2, '0') });
  return t('time.s', { n: r });
}

export const rankName = (i: number) => t(('rank.' + CONFIG.ranks[i].id) as Key);
export const npcName = (i: number) => npcNames[i % npcNames.length];

/** Parametre adına göre otomatik biçimlendirme */
function renderParam(name: string, v: string | number): string {
  switch (name) {
    case 'money': case 'total': case 'bounty': return money(Number(v));
    case 'time': return formatTime(Number(v));
    case 'rank': return rankName(Number(v));
    case 'crime': return t(('crime.' + v) as Key);
    case 'car': return t(('car.' + v) as Key);
    case 'city': return t(('city.' + v) as Key);
    case 'good': return t(('good.' + v) as Key);
    case 'rival': return t(('rival.' + v) as Key);
    case 'heist': return t(('heist.' + v) as Key);
    case 'item': return t(('item.' + v) as Key);
    case 'role': return t(('heist.role.' + v) as Key);
    case 'stat': return t(('gym.' + v) as Key);
    case 'name': return typeof v === 'number' ? npcName(v) : v;
    default: return typeof v === 'number' ? num(v) : v;
  }
}

export function t(key: Key | string, params?: Params): string {
  const raw = (dict as Record<string, string>)[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, p) => (params[p] === undefined ? `{${p}}` : renderParam(p, params[p]!)));
}
