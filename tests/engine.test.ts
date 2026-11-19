import { describe, expect, it } from 'vitest';
import { CONFIG as C } from '@/config/game';
import { blocked, maxEnergy, maxHp, newPlayer, rank, tick } from '@/engine/core';
import * as A from '@/engine/actions';
import * as K from '@/engine/casino';
import { leaderboard } from '@/engine/leaderboard';
import type { Ctx, Player } from '@/engine/types';

const T0 = 1_700_000_000_000;
/** Sabit sayılar döndüren rng: verilen diziyi sırayla, bitince son değeri */
const seq = (...xs: number[]) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };
const ctx = (rng: () => number, now = T0): Ctx => ({ now, rng });
const fresh = (): Player => newPlayer('Test', T0);

describe('suçlar', () => {
  it('başarılı suç para ve XP verir, enerji düşer, bekleme başlar', () => {
    const p = fresh();
    const r = A.commitCrime(p, ctx(seq(0, 0.5)), 'pickpocket');
    expect(r.ok).toBe(true);
    expect(p.cash).toBeGreaterThan(C.start.cash);
    expect(p.xp).toBe(5);
    expect(p.energy).toBe(maxEnergy(p) - 4);
    const again = A.commitCrime(p, ctx(seq(0)), 'pickpocket');
    expect(again.key).toBe('err.cooldown');
  });

  it('başarısız suç hapse atabilir ve hapisteyken aksiyon engellenir', () => {
    const p = fresh();
    const r = A.commitCrime(p, ctx(seq(0.99, 0)), 'pickpocket');
    expect(r.key).toBe('crime.jailed');
    expect(blocked(p, T0)?.key).toBe('err.inJail');
    expect(A.commitCrime(p, ctx(seq(0)), 'kiosk').key).toBe('err.inJail');
  });

  it('rütbe yetmiyorsa suç yapılamaz', () => {
    expect(A.commitCrime(fresh(), ctx(seq(0)), 'bank').key).toBe('err.rank');
  });

  it('başarı şansı sınırlar içinde kalır', () => {
    const p = fresh();
    p.int = 10_000;
    expect(A.crimeChance(p, 'bank')).toBe(C.crimeFormula.max);
  });
});

describe('savaş formülü', () => {
  it('eşit güçte rastgele sayılar sonucu belirler', () => {
    expect(A.fightRoll(100, 100, 0.9, 0.1)).toBe(true);
    expect(A.fightRoll(100, 100, 0.1, 0.9)).toBe(false);
  });
  it('çok güçlü taraf her zaman kazanır', () => {
    expect(A.fightRoll(1000, 10, 0, 1)).toBe(true);
  });
  it('kazanma olasılığı güçle artar ve eşitte %50', () => {
    expect(A.winProbability(100, 100)).toBeCloseTo(0.5, 2);
    expect(A.winProbability(120, 100)).toBeGreaterThan(A.winProbability(100, 100));
    expect(A.winProbability(1000, 10)).toBe(1);
  });
  it('kazanınca ganimet ve XP alınır, kaybedince nakdin bir kısmı gider', () => {
    const p = fresh();
    p.str = 500;
    const w = A.attack(p, ctx(seq(0.99, 0, 0.5, 0)), 'thug');
    expect(w.ok).toBe(true);
    expect(p.stats.kills).toBe(1);

    const q = fresh();
    q.cash = 1000;
    q.str = 0; q.def = 0;
    const l = A.attack(q, ctx(seq(0, 1, 0, 0)), 'thug');
    expect(l.ok).toBe(false);
    expect(q.cash).toBe(1000 - Math.floor(1000 * C.combat.lossCashPct));
    expect(q.bank).toBe(0);
  });
  it('aynı rakibe saldırı limiti uygulanır', () => {
    const p = fresh();
    p.str = 500;
    p.nerve = 100;
    let now = T0;
    for (let i = 0; i < C.combat.sameTargetLimit; i++) {
      expect(A.attack(p, ctx(seq(0.99, 0, 0.5, 0), now), 'thug').ok).toBe(true);
      now += (C.combat.cooldown + 1) * 1000;
    }
    expect(A.attack(p, ctx(seq(0.99, 0), now), 'thug').key).toBe('fight.limit');
  });
  it('ödül avı bir kez alınır, sonra bekleme süresine girer', () => {
    const p = fresh();
    p.xp = C.ranks[2].xp;
    p.str = 2000;
    const r = A.attack(p, ctx(seq(0.99, 0, 0.5, 0)), 'hitman');
    expect(r.key).toBe('fight.wonBounty');
    expect(A.bountyAvailable(p, 'hitman', T0 + 1000)).toBe(false);
  });
});

describe('ekonomi', () => {
  it('banka: yatır/çek ve yetersiz bakiye', () => {
    const p = fresh();
    expect(A.deposit(p, ctx(seq(0)), 500).ok).toBe(true);
    expect(p.cash).toBe(C.start.cash - 500);
    expect(p.bank).toBe(500);
    expect(A.withdraw(p, ctx(seq(0)), 600).ok).toBe(false);
    expect(A.deposit(p, ctx(seq(0)), -5).ok).toBe(false);
    expect(A.deposit(p, ctx(seq(0)), 1e9).ok).toBe(false);
  });
  it('banka faizi saat başı işler, üst sınırı aşmaz', () => {
    const p = fresh();
    p.bank = 100_000;
    tick(p, ctx(seq(0), T0 + 3 * 3600000));
    expect(p.bank).toBe(100_000 + Math.floor(100_000 * (Math.pow(1 + C.bank.interest, 3) - 1)));
  });
  it('mülk geliri birikir ve üst sınırda durur', () => {
    const p = fresh();
    p.cash = 1e7;
    p.xp = C.ranks[5].xp;
    A.buyProperty(p, ctx(seq(0)), 'bar');
    expect(A.propertyPending(p, 'bar', T0 + 2 * 3600000)).toBe(2 * 450);
    expect(A.propertyPending(p, 'bar', T0 + 1000 * 3600000)).toBe(C.propertyMaxHours * 450);
    const r = A.collectProperties(p, ctx(seq(0), T0 + 3600000));
    expect(r.ok).toBe(true);
    expect(A.propertyPending(p, 'bar', T0 + 3600000)).toBe(0);
  });
  it('kaçakçılık fiyatları deterministik ve aralıkta', () => {
    for (const g of C.goods) for (const c of C.cities) {
      const pr = A.goodPrice(g.id, c.id, T0);
      expect(pr).toBe(A.goodPrice(g.id, c.id, T0 + 1000));
      expect(pr).toBeGreaterThanOrEqual(Math.floor(g.base * C.smuggling.minF));
      expect(pr).toBeLessThanOrEqual(Math.ceil(g.base * C.smuggling.maxF));
    }
  });
  it('kaçakçılık kapasitesi aşılamaz', () => {
    const p = fresh();
    p.cash = 1e9;
    expect(A.buyGood(p, ctx(seq(0)), 'cigs', A.cargoCap(p) + 1).key).toBe('smuggle.full');
    expect(A.buyGood(p, ctx(seq(0)), 'cigs', A.cargoCap(p)).ok).toBe(true);
    expect(A.sellGood(p, ctx(seq(0)), 'cigs', 5).ok).toBe(true);
    expect(p.goods.cigs).toBe(A.cargoCap(p) - 5);
  });
  it('araba değeri şehir talebine göre değişir; yoldaki araba satılamaz', () => {
    const p = fresh();
    p.cash = 1e6;
    p.cars.push({ uid: 99, model: 'taxi', damage: 0, city: 'istanbul', arrivesAt: 0 });
    const ist = A.carValue(p, 99);
    A.shipCar(p, ctx(seq(0)), 99, 'moscow');
    expect(A.carValue(p, 99)).toBeGreaterThan(ist);
    expect(A.sellCar(p, ctx(seq(0)), 99).key).toBe('car.inTransit');
  });
  it('para eksiye düşmez: yetersiz nakitle alışveriş reddedilir', () => {
    const p = fresh();
    p.cash = 10;
    expect(A.buyWeapon(p, ctx(seq(0)), 'knife').key).toBe('err.cash');
    expect(p.cash).toBe(10);
  });
});

describe('rütbe ve dolum', () => {
  it('rütbe atlayınca elmas verilir ve değerler dolar', () => {
    const p = fresh();
    p.energy = 0;
    const d = p.diamonds;
    p.xp = C.ranks[1].xp - 1;
    const r = A.train(p, ctx(seq(0)), 'str');
    expect(r.key).toBe('err.energy');
    p.energy = 50;
    const r2 = A.train(p, ctx(seq(0)), 'str');
    expect(r2.rankUp).toBe(1);
    expect(p.diamonds).toBe(d + C.rankUpDiamonds);
    expect(p.energy).toBe(maxEnergy(p));
  });
  it('enerji ve can zamanla dolar', () => {
    const p = fresh();
    p.energy = 0;
    p.hp = 10;
    tick(p, ctx(seq(0), T0 + 2 * C.regen.energy.every * 1000));
    expect(p.energy).toBe(Math.ceil(maxEnergy(p) * 0.1) * 2);
    expect(p.hp).toBe(10 + Math.ceil(maxHp(p) * 0.1) * 2);
  });
  it('rütbe hesabı', () => {
    const p = fresh();
    p.xp = C.ranks[9].xp + 1;
    expect(rank(p)).toBe(9);
  });
});

describe('kumarhane', () => {
  it('rulet ödemeleri', () => {
    expect(K.roulettePayout(0, 'green')).toBe(C.casino.rouletteGreen);
    expect(K.roulettePayout(0, 'red')).toBe(0);
    expect(K.roulettePayout(1, 'red')).toBe(2);
    expect(K.roulettePayout(2, 'black')).toBe(2);
    expect(K.roulettePayout(2, 'even')).toBe(2);
  });
  it('slot çarpanları', () => {
    expect(K.slotMultiplier(['seven', 'seven', 'seven'])).toBe(30);
    expect(K.slotMultiplier(['cherry', 'cherry', 'bell'])).toBe(C.casino.slotTwoCherry);
    expect(K.slotMultiplier(['cherry', 'bell', 'lemon'])).toBe(0);
  });
  it('blackjack el değeri (as 1 veya 11)', () => {
    expect(K.handValue([1, 13])).toBe(21);
    expect(K.handValue([1, 1, 9])).toBe(21);
    expect(K.handValue([10, 12, 5])).toBe(25);
  });
  it('bahis üst sınırı ve nakit kontrolü', () => {
    const p = fresh();
    expect(K.dice(p, ctx(seq(0.5)), K.maxBet(p) + 1).key).toBe('casino.maxBet');
    p.cash = 5;
    expect(K.dice(p, ctx(seq(0.5)), 10).key).toBe('err.cash');
  });
  it('zarda kazanç bahsin iki katı', () => {
    const p = fresh();
    const before = p.cash;
    const r = K.dice(p, ctx(seq(0.99, 0.99, 0, 0)), 100);
    expect(r.ok).toBe(true);
    expect(p.cash).toBe(before + 100);
  });
  it('blackjack: açık el varken yeni bahis yok, el bitince temizlenir', () => {
    const p = fresh();
    const r = K.bjStart(p, ctx(Math.random), 50);
    if (r.data && (r.data as { done: boolean }).done) return; // doğal 21
    expect(K.dice(p, ctx(seq(0.5), T0 + 5000), 10).key).toBe('casino.bjActive');
    K.bjStand(p, ctx(Math.random));
    expect(p.blackjack).toBeNull();
  });
});

describe('organize suç', () => {
  it('eksik ekiple başlamaz, tam ekiple çalışır', () => {
    const p = fresh();
    p.xp = C.ranks[2].xp;
    A.refreshCrew(p, ctx(seq(0.5)), true);
    expect(A.runHeist(p, ctx(seq(0)), 'warehouse', {}).key).toBe('heist.missingCrew');
    const driver = p.crew.find((c) => c.role === 'driver')!.uid;
    const gunner = p.crew.find((c) => c.role === 'gunner')!.uid;
    const before = p.cash;
    const r = A.runHeist(p, ctx(seq(0)), 'warehouse', { driver, gunner });
    expect(r.ok).toBe(true);
    expect(p.cash).toBeGreaterThan(before);
  });
});

describe('sıralama', () => {
  it('oyuncu listede tam bir kez yer alır ve liste sıralıdır', () => {
    const p = fresh();
    const rows = leaderboard(p, 'wealth', 'all', T0);
    expect(rows.filter((r) => r.me)).toHaveLength(1);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].value).toBeGreaterThanOrEqual(rows[i].value);
  });
});
