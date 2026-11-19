/**
 * OYUN DENGESİ — tüm sayılar burada.
 * Fiyatları, ödülleri, bekleme sürelerini ve formül katsayılarını buradan değiştir.
 * Metinler (isimler, açıklamalar) src/i18n/tr.ts içinde, aynı id ile.
 */

export const GAME_NAME = 'Valkiew';

const MIN = 60; // saniye
const HOUR = 3600;

export const CONFIG = {
  start: {
    cash: 750,
    bank: 0,
    diamonds: 15,
    str: 5,
    def: 5,
    int: 5,
    city: 'istanbul',
  },

  /** Zamanla dolum: her `every` saniyede maksimumun `pct` kadarı */
  regen: {
    energy: { every: 5 * MIN, pct: 0.1 },
    hp: { every: 5 * MIN, pct: 0.1 },
    nerve: { every: 5 * MIN, pct: 0.1 },
    /** Premium üyelerde dolum aralığı bu katsayıyla çarpılır */
    premiumFactor: 0.6,
  },

  /** Rütbe tabanlı maksimumlar */
  maxStats: {
    energy: (rank: number) => 100 + rank * 10,
    hp: (rank: number) => 100 + rank * 25,
    nerve: (rank: number) => 10 + rank * 2,
  },

  ranks: [
    { id: 'serseri', xp: 0 },
    { id: 'haydut', xp: 150 },
    { id: 'tetikci', xp: 450 },
    { id: 'kabadayi', xp: 1100 },
    { id: 'soldato', xp: 2400 },
    { id: 'capo', xp: 4800 },
    { id: 'consigliere', xp: 9000 },
    { id: 'underboss', xp: 16000 },
    { id: 'boss', xp: 28000 },
    { id: 'godfather', xp: 50000 },
  ],
  rankUpDiamonds: 5,

  /** Premium üyelik (şimdilik elmasla) */
  premium: {
    days: 30,
    diamondPrice: 120,
    cooldownFactor: 0.75,
  },

  /** Elmas harcamaları */
  diamondCosts: {
    jailOut: 3,
    hospitalOut: 3,
    rename: 20,
    garageSlot: 10,
    energyRefill: 8,
    nerveRefill: 6,
  },

  daily: { diamonds: 3, cashPerRank: 350, every: 24 * HOUR },

  // ------------------------------------------------------------------ SUÇLAR
  /** chance: temel başarı, money: ödül aralığı, jailChance: başarısızlıkta hapis olasılığı */
  crimes: [
    { id: 'pickpocket', minRank: 0, energy: 4, chance: 0.9, money: [25, 80], xp: 5, cooldown: 20, jailChance: 0.35, jail: 45 },
    { id: 'kiosk', minRank: 0, energy: 6, chance: 0.8, money: [80, 200], xp: 9, cooldown: 40, jailChance: 0.4, jail: 90 },
    { id: 'shop', minRank: 1, energy: 9, chance: 0.74, money: [200, 480], xp: 15, cooldown: 70, jailChance: 0.45, jail: 150 },
    { id: 'protection', minRank: 2, energy: 12, chance: 0.7, money: [450, 950], xp: 24, cooldown: 2 * MIN, jailChance: 0.45, jail: 4 * MIN },
    { id: 'jeweler', minRank: 3, energy: 16, chance: 0.64, money: [900, 2100], xp: 38, cooldown: 3 * MIN, jailChance: 0.5, jail: 6 * MIN },
    { id: 'truck', minRank: 4, energy: 20, chance: 0.6, money: [2000, 4200], xp: 60, cooldown: 5 * MIN, jailChance: 0.5, jail: 8 * MIN },
    { id: 'casinoRaid', minRank: 5, energy: 26, chance: 0.55, money: [4200, 8800], xp: 95, cooldown: 8 * MIN, jailChance: 0.55, jail: 12 * MIN },
    { id: 'armored', minRank: 6, energy: 32, chance: 0.5, money: [8500, 17000], xp: 150, cooldown: 12 * MIN, jailChance: 0.55, jail: 16 * MIN },
    { id: 'port', minRank: 7, energy: 38, chance: 0.46, money: [16000, 32000], xp: 230, cooldown: 18 * MIN, jailChance: 0.6, jail: 22 * MIN },
    { id: 'bank', minRank: 8, energy: 48, chance: 0.4, money: [32000, 70000], xp: 380, cooldown: 30 * MIN, jailChance: 0.65, jail: 30 * MIN },
  ],
  crimeFormula: {
    /** Gereken rütbenin üstündeki her rütbe için şans bonusu */
    perRankAbove: 0.025,
    /** Her zekâ puanı için şans bonusu */
    perInt: 0.0015,
    min: 0.05,
    max: 0.95,
  },

  // ------------------------------------------------------------- ARABALAR
  cars: [
    { id: 'hatch', minRank: 0, value: 700, chance: 0.82, color: '#9a8c74' },
    { id: 'taxi', minRank: 0, value: 1300, chance: 0.74, color: '#e5c23a' },
    { id: 'sedan', minRank: 1, value: 2600, chance: 0.66, color: '#4c6fa8' },
    { id: 'pickup', minRank: 2, value: 4200, chance: 0.6, color: '#7a3d2c' },
    { id: 'coupe', minRank: 4, value: 9000, chance: 0.5, color: '#c8302f' },
    { id: 'limo', minRank: 6, value: 19000, chance: 0.4, color: '#1d1d22' },
    { id: 'super', minRank: 8, value: 48000, chance: 0.28, color: '#f07a1a' },
  ],
  carTheft: {
    energy: 8,
    cooldown: 90,
    jailChance: 0.45,
    jail: 2 * MIN,
    garageBase: 4,
    garagePerRank: 1,
    maxDamage: 45,
    perInt: 0.002,
    xpBase: 6,
    xpPerTier: 5,
    /** Başka şehre gönderme: değerin bu oranı kadar ücret, bu kadar saniye yolda */
    shipFeePct: 0.08,
    shipTime: 10 * MIN,
  },

  // --------------------------------------------------------------- ŞEHİRLER
  /** carDemand: o şehirde araba satış çarpanı; travel: bilet fiyatı */
  cities: [
    { id: 'istanbul', minRank: 0, travel: 400, carDemand: 1.0, tint: 'rgba(40,60,140,0.10)' },
    { id: 'palermo', minRank: 1, travel: 900, carDemand: 1.15, tint: 'rgba(150,90,30,0.13)' },
    { id: 'newyork', minRank: 2, travel: 1800, carDemand: 1.3, tint: 'rgba(30,110,140,0.12)' },
    { id: 'chicago', minRank: 3, travel: 2200, carDemand: 1.25, tint: 'rgba(90,40,140,0.14)' },
    { id: 'lasvegas', minRank: 5, travel: 4000, carDemand: 1.45, tint: 'rgba(170,40,110,0.13)' },
    { id: 'moscow', minRank: 6, travel: 5000, carDemand: 1.6, tint: 'rgba(160,170,200,0.14)' },
  ],
  travel: { cooldown: 5 * MIN },

  // ------------------------------------------------------------ KAÇAKÇILIK
  goods: [
    { id: 'cigs', base: 40 },
    { id: 'whiskey', base: 140 },
    { id: 'parts', base: 450 },
    { id: 'jewels', base: 1300 },
    { id: 'art', base: 5000 },
  ],
  smuggling: {
    /** Fiyatlar bu sürede bir değişir */
    period: 15 * MIN,
    /** fiyat = base * (minF + gürültü * (maxF - minF)) */
    minF: 0.55,
    maxF: 1.55,
    sellSpread: 0.92,
    capBase: 20,
    capPerRank: 15,
  },

  // ------------------------------------------------------- ORGANİZE SUÇ
  heists: [
    { id: 'warehouse', minRank: 2, nerve: 8, money: [6000, 12000], xp: 120, base: 0.45, cooldown: 1 * HOUR, jail: 10 * MIN, crew: ['driver', 'gunner'] },
    { id: 'armoredConvoy', minRank: 4, nerve: 12, money: [18000, 34000], xp: 260, base: 0.38, cooldown: 2 * HOUR, jail: 18 * MIN, crew: ['driver', 'gunner', 'explosives'] },
    { id: 'federalReserve', minRank: 7, nerve: 18, money: [70000, 130000], xp: 700, base: 0.3, cooldown: 4 * HOUR, jail: 30 * MIN, crew: ['driver', 'gunner', 'explosives'] },
  ],
  heistFormula: {
    /** Her ekip üyesinin yeteneği (0-100) başarıya bu katsayıyla eklenir */
    perSkill: 0.0022,
    perLeaderInt: 0.002,
    min: 0.05,
    max: 0.92,
    /** Aday sayısı (her rol için) */
    candidates: 3,
  },

  // ------------------------------------------------------------- DÖVÜŞ
  /** Rakip mafyozolar (NPC). bounty: başına konmuş ödül */
  rivals: [
    { id: 'thug', minRank: 0, str: 6, def: 5, atk: 4, cash: [150, 400], xp: 8, bounty: 0 },
    { id: 'enforcer', minRank: 1, str: 14, def: 12, atk: 12, cash: [450, 1100], xp: 16, bounty: 0 },
    { id: 'hitman', minRank: 2, str: 26, def: 20, atk: 28, cash: [1100, 2600], xp: 32, bounty: 1500 },
    { id: 'courier', minRank: 4, str: 45, def: 40, atk: 50, cash: [3000, 7000], xp: 60, bounty: 0 },
    { id: 'capoRival', minRank: 5, str: 70, def: 65, atk: 80, cash: [8000, 18000], xp: 110, bounty: 8000 },
    { id: 'underbossRival', minRank: 7, str: 110, def: 100, atk: 125, cash: [20000, 44000], xp: 200, bounty: 20000 },
    { id: 'donRival', minRank: 8, str: 160, def: 150, atk: 180, cash: [50000, 110000], xp: 400, bounty: 60000 },
  ],
  combat: {
    nerve: 2,
    /** saldırı = güç*strW + silah*weaponW; savunma = savunma*defW + zırh*armorW */
    strW: 1.0,
    weaponW: 1.2,
    defW: 0.8,
    armorW: 1.0,
    /** Rastgelelik: her taraf ±%random kadar oynar */
    random: 0.25,
    /** Kazanan, kaybedenin nakdinin bu oranını alır (bankadaki para güvende) */
    lootPct: 0.5,
    /** Kaybedersen nakdinin bu oranı rakibe gider */
    lossCashPct: 0.1,
    /** Ödül avı: aynı rakibin başındaki ödül bu sürede bir yenilenir */
    bountyCooldown: 6 * HOUR,
    /** Kaybedince alınan hasar (maksimum canın oranı) */
    lossDamage: [0.18, 0.35],
    winDamage: [0, 0.08],
    hospital: 10 * MIN,
    cooldown: 30,
    /** Aynı rakibe pencere içinde en fazla N saldırı */
    sameTargetLimit: 3,
    sameTargetWindow: 1 * HOUR,
    /** Ateşli silah mermi yoksa gücünün bu oranıyla vurur */
    noAmmoFactor: 0.35,
    ammoPerFight: [3, 8],
    minHpToFight: 0.15,
  },

  // ------------------------------------------------------------- EŞYALAR
  weapons: [
    { id: 'knuckles', atk: 6, price: 500, minRank: 0, ammo: false },
    { id: 'knife', atk: 12, price: 1800, minRank: 0, ammo: false },
    { id: 'pistol', atk: 30, price: 7500, minRank: 2, ammo: true },
    { id: 'shotgun', atk: 55, price: 22000, minRank: 4, ammo: true },
    { id: 'tommy', atk: 90, price: 55000, minRank: 6, ammo: true },
    { id: 'sniper', atk: 140, price: 130000, minRank: 8, ammo: true },
  ],
  armors: [
    { id: 'leather', def: 6, price: 900, minRank: 0 },
    { id: 'vest', def: 24, price: 11000, minRank: 3 },
    { id: 'heavy', def: 55, price: 50000, minRank: 6 },
  ],
  ammoPrice: 5,
  /** Araçlar: kaçakçılık kapasitesi ve seyahat indirimi verir */
  vehicles: [
    { id: 'scooter', price: 3000, minRank: 0, cargo: 10, travelDiscount: 0.05 },
    { id: 'van', price: 18000, minRank: 2, cargo: 40, travelDiscount: 0.1 },
    { id: 'yacht', price: 120000, minRank: 6, cargo: 120, travelDiscount: 0.3 },
  ],
  /** Mülkler: saatlik pasif gelir, en fazla `maxHours` saat birikir */
  properties: [
    { id: 'bar', price: 15000, minRank: 1, income: 450 },
    { id: 'laundry', price: 40000, minRank: 3, income: 1300 },
    { id: 'nightclub', price: 110000, minRank: 5, income: 3800 },
    { id: 'casinoProp', price: 320000, minRank: 7, income: 11000 },
  ],
  propertyMaxHours: 24,

  // ------------------------------------------------------------- BANKA
  bank: {
    /** Saatlik faiz */
    interest: 0.004,
    /** Faiz bu tutarın üstündeki paraya işlemez */
    interestCap: 2_000_000,
    maxHours: 48,
  },

  // -------------------------------------------------------- HAPİS / HASTANE
  jail: {
    bribePerSecond: 6,
    bribeRankFactor: 0.5,
    escapeBase: 0.25,
    escapePerInt: 0.004,
    escapeMax: 0.7,
    escapePenalty: 2 * MIN,
    escapeCooldown: 60,
    /** Başka mahkûmu kaçırma */
    bustBase: 0.45,
    bustPerInt: 0.003,
    bustXp: 12,
    bustJail: 3 * MIN,
    bustCooldown: 45,
    inmates: 5,
  },
  hospital: {
    healPerHp: 6,
    /** Hastanede yatarken erken çıkış: kalan sn başına ücret */
    dischargePerSecond: 4,
    dischargeHp: 0.4,
  },

  // ------------------------------------------------------------- SALON
  gym: {
    energy: 10,
    cooldown: 5,
    /** Kazanç: 1 + floor(stat / gainDivisor) azalan değil, sabit artış */
    gain: 1,
    xp: 2,
    costPerPoint: 12,
  },

  // ------------------------------------------------------------- KUMARHANE
  casino: {
    /** En yüksek bahis = base * (rütbe+1)^2 */
    maxBetBase: 500,
    cooldown: 1.2,
    rouletteGreen: 14,
    /** Slot: sembol -> 3'lü çarpan */
    slots: [
      { id: 'cherry', weight: 30, pay: 3 },
      { id: 'lemon', weight: 25, pay: 4 },
      { id: 'bell', weight: 18, pay: 8 },
      { id: 'clover', weight: 12, pay: 12 },
      { id: 'seven', weight: 6, pay: 30 },
      { id: 'diamond', weight: 3, pay: 75 },
    ],
    /** İki kiraz gelirse */
    slotTwoCherry: 1.5,
    blackjackPayout: 2.5,
  },
} as const;

export type Config = typeof CONFIG;
export type CrimeCfg = Config['crimes'][number];
export type RivalCfg = Config['rivals'][number];
export type HeistCfg = Config['heists'][number];
export type CityId = Config['cities'][number]['id'];
export type CrewRole = 'driver' | 'gunner' | 'explosives';
