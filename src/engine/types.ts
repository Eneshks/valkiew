import type { CrewRole } from '@/config/game';

export interface OwnedCar {
  uid: number;
  model: string;
  damage: number; // 0-100
  city: string;
  arrivesAt: number; // ms, 0 = beklemiyor
}

export interface Inmate {
  uid: number;
  nameIdx: number;
  until: number;
  difficulty: number; // 0-1
}

export interface CrewCandidate {
  uid: number;
  nameIdx: number;
  role: CrewRole;
  skill: number; // 0-100
  cut: number; // pay oranı 0-1
}

export interface BlackjackHand {
  bet: number;
  player: number[];
  dealer: number[];
  deck: number[];
}

export interface Stats {
  crimes: number;
  crimesFailed: number;
  carsStolen: number;
  kills: number;
  losses: number;
  jailed: number;
  busts: number;
  heists: number;
  earned: number;
  bountiesCollected: number;
}

export interface Player {
  v: 2;
  name: string;
  created: number;
  cash: number;
  bank: number;
  diamonds: number;
  xp: number;
  hp: number;
  energy: number;
  nerve: number;
  str: number;
  def: number;
  int: number;
  city: string;
  jailUntil: number;
  hospitalUntil: number;
  premiumUntil: number;
  ammo: number;
  weapons: string[];
  weapon: string | null;
  armors: string[];
  armor: string | null;
  vehicles: string[];
  properties: Record<string, number>; // id -> son tahsilat zamanı
  cars: OwnedCar[];
  extraGarage: number;
  goods: Record<string, number>;
  cooldowns: Record<string, number>; // anahtar -> bitiş zamanı (ms)
  regenAt: { energy: number; hp: number; nerve: number };
  interestAt: number;
  lastDaily: number;
  attacks: Record<string, number[]>; // rakip id -> saldırı zamanları
  inmates: Inmate[];
  inmatesAt: number;
  crew: CrewCandidate[];
  crewAt: number;
  blackjack: BlackjackHand | null;
  stats: Stats;
  /** Günlük/haftalık sıralama için tarih damgalı kazanç kayıtları */
  history: { t: number; earned: number; crimes: number; kills: number; xp: number }[];
  seq: number;
}

export type Tone = 'good' | 'bad' | 'info';

/** Aksiyon sonucu. key: i18n anahtarı */
export interface Result {
  ok: boolean;
  key: string;
  params?: Record<string, string | number>;
  tone: Tone;
  rankUp?: number;
  data?: unknown;
}

export interface Ctx {
  now: number;
  rng: () => number;
}
