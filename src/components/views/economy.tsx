'use client';
import { useState } from 'react';
import { CONFIG as C } from '@/config/game';
import * as A from '@/engine/actions';
import { isPremium, rank } from '@/engine/core';
import { leaderboard, type Board, type Period } from '@/engine/leaderboard';
import type { Stats } from '@/engine/types';
import { money, npcName, num, rankName, t, type Key } from '@/i18n';
import { useGame } from '@/store/game';
import { Bar, Btn, Card, Info, Locked, Note, Section, Stat } from '../ui';

const usePlayer = () => useGame((s) => s.player!);
const useRun = () => useGame((s) => s.run);

// ================================================================ SİLAHÇI
export function ShopView() {
  const p = usePlayer(), run = useRun();
  return (
    <>
      <Section>🔫 {t('shop.ammoTitle')} · {num(p.ammo)}</Section>
      <div className="grid grid-cols-3 gap-2">
        {[10, 50, 250].map((n) => (
          <Btn key={n} variant="ghost" onClick={() => run(A.buyAmmo, n)}>+{n} · {money(n * C.ammoPrice)}</Btn>
        ))}
      </div>
      <Section>{t('shop.weapons')}</Section>
      {C.weapons.map((w) => {
        const owned = p.weapons.includes(w.id), locked = rank(p) < w.minRank;
        return (
          <Card key={w.id} dim={locked && !owned} active={p.weapon === w.id}>
            <Info title={t(`item.${w.id}` as Key)}>
              <span>{t('shop.atk', { n: w.atk })}</span>
              {w.ammo && <span>🔫 {t('shop.usesAmmo')}</span>}
            </Info>
            {p.weapon === w.id ? <Btn disabled variant="ghost">{t('lbl.equipped')}</Btn>
              : owned ? <Btn variant="ghost" onClick={() => run(A.buyWeapon, w.id)}>{t('lbl.equip')}</Btn>
              : locked ? <Locked rank={w.minRank} />
              : <Btn onClick={() => run(A.buyWeapon, w.id)}>{money(w.price)}</Btn>}
          </Card>
        );
      })}
      <Section>{t('shop.armors')}</Section>
      {C.armors.map((a) => {
        const owned = p.armors.includes(a.id), locked = rank(p) < a.minRank;
        return (
          <Card key={a.id} dim={locked && !owned} active={p.armor === a.id}>
            <Info title={t(`item.${a.id}` as Key)}><span>{t('shop.def', { n: a.def })}</span></Info>
            {p.armor === a.id ? <Btn disabled variant="ghost">{t('lbl.equipped')}</Btn>
              : owned ? <Btn variant="ghost" onClick={() => run(A.buyArmor, a.id)}>{t('lbl.equip')}</Btn>
              : locked ? <Locked rank={a.minRank} />
              : <Btn onClick={() => run(A.buyArmor, a.id)}>{money(a.price)}</Btn>}
          </Card>
        );
      })}
      <Section>{t('shop.vehicles')}</Section>
      {C.vehicles.map((v) => {
        const owned = p.vehicles.includes(v.id), locked = rank(p) < v.minRank;
        return (
          <Card key={v.id} dim={locked && !owned} active={owned}>
            <Info title={t(`item.${v.id}` as Key)}>
              <span>{t('shop.cargo', { n: v.cargo })}</span>
              <span>{t('shop.discount', { n: Math.round(v.travelDiscount * 100) })}</span>
            </Info>
            {owned ? <Btn disabled variant="ghost">{t('lbl.owned')}</Btn>
              : locked ? <Locked rank={v.minRank} />
              : <Btn onClick={() => run(A.buyVehicle, v.id)}>{money(v.price)}</Btn>}
          </Card>
        );
      })}
    </>
  );
}

// ================================================================ MÜLKLER
export function PropertiesView() {
  const p = usePlayer(), run = useRun(), now = useGame((s) => s.now);
  const total = Object.keys(p.properties).reduce((a, id) => a + A.propertyPending(p, id, now), 0);
  return (
    <>
      <Btn className="w-full mb-1" disabled={total <= 0} onClick={() => run(A.collectProperties)}>{t('property.collect', { money: total })}</Btn>
      <Note>{t('property.note', { n: C.propertyMaxHours })}</Note>
      {C.properties.map((pr) => {
        const owned = p.properties[pr.id] !== undefined, locked = rank(p) < pr.minRank;
        return (
          <Card key={pr.id} dim={locked && !owned} active={owned}>
            <span className="text-2xl">{{ bar: '🍸', laundry: '🧺', nightclub: '🎷', casinoProp: '🎲' }[pr.id]}</span>
            <Info title={t(`item.${pr.id}` as Key)}>
              <span>{t('property.income', { money: pr.income })}</span>
              {owned && <span className="text-gold2">{t('property.pending', { money: A.propertyPending(p, pr.id, now) })}</span>}
            </Info>
            {owned ? <Btn disabled variant="ghost">{t('lbl.owned')}</Btn>
              : locked ? <Locked rank={pr.minRank} />
              : <Btn onClick={() => run(A.buyProperty, pr.id)}>{money(pr.price)}</Btn>}
          </Card>
        );
      })}
    </>
  );
}

// ================================================================ BANKA
export function BankView() {
  const p = usePlayer(), run = useRun();
  const [amt, setAmt] = useState('');
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Stat k={t('bank.onHand')} v={money(p.cash)} />
        <Stat k={t('bank.inBank')} v={money(p.bank)} />
      </div>
      <Note>{t('bank.note', { n: (C.bank.interest * 100).toFixed(1) })}</Note>
      <input className="input mb-2" type="number" inputMode="numeric" min={1} placeholder={t('lbl.amount')} value={amt} onChange={(e) => setAmt(e.target.value)} />
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Btn onClick={() => run(A.deposit, Number(amt))}>{t('bank.deposit')}</Btn>
        <Btn variant="ghost" onClick={() => run(A.withdraw, Number(amt))}>{t('bank.withdraw')}</Btn>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Btn variant="ghost" onClick={() => run(A.deposit, p.cash)}>{t('bank.depositAll')}</Btn>
        <Btn variant="ghost" onClick={() => run(A.withdraw, p.bank)}>{t('bank.withdrawAll')}</Btn>
      </div>
    </>
  );
}

// ================================================================ SIRALAMA
export function RankingView() {
  const p = usePlayer(), now = useGame((s) => s.now);
  const [board, setBoard] = useState<Board>('rank');
  const [period, setPeriod] = useState<Period>('all');
  const rows = leaderboard(p, board, period, now);
  const fmt = (v: number) => (board === 'wealth' ? money(v) : board === 'rank' ? `${num(v)} XP` : num(v));
  const tab = (on: boolean) => `px-3 py-1.5 rounded-md text-[13px] font-semibold border ${on ? 'bg-gold/15 border-gold text-gold2' : 'border-line text-smoke'}`;
  return (
    <>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {(['rank', 'wealth', 'kills', 'crimes'] as Board[]).map((b) => (
          <button key={b} type="button" className={tab(board === b)} onClick={() => setBoard(b)}>{t(`board.${b}` as Key)}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(['daily', 'weekly', 'all'] as Period[]).map((x) => (
          <button key={x} type="button" className={tab(period === x)} onClick={() => setPeriod(x)}>{t(`period.${x}` as Key)}</button>
        ))}
      </div>
      <ol>
        {rows.map((r, i) => (
          <li key={r.name + i} className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 ${r.me ? 'bg-gold/15 ring-1 ring-gold/60' : i % 2 ? 'bg-panel' : ''}`}>
            <span className={`w-7 text-center font-display font-bold ${i < 3 ? 'text-gold2' : 'text-smoke'}`}>{i + 1}</span>
            <span className="flex-1 truncate font-semibold">{r.me ? `${r.name} (${t('board.you')})` : npcName(Number(r.name.slice(1)))}</span>
            {r.rank !== undefined && <span className="text-smoke text-[12px]">{rankName(r.rank)}</span>}
            <b className="tabular">{fmt(r.value)}</b>
          </li>
        ))}
      </ol>
    </>
  );
}

// ================================================================ MALİKANE (PROFİL)
export function ProfileView() {
  const p = usePlayer(), run = useRun(), now = useGame((s) => s.now), reset = useGame((s) => s.reset);
  const r = rank(p), next = C.ranks[r + 1];
  const prem = isPremium(p, now);
  const dc = C.diamondCosts;
  return (
    <>
      <div className="text-center pt-1">
        <div className="text-smoke">{p.name} {prem && <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-gold text-ink font-bold">★ {t('hud.premium')}</span>}</div>
        <div className="font-display text-gold2 text-[30px] font-bold">{rankName(r)}</div>
        <div className="text-smoke text-[12.5px]">{num(p.xp)} XP · {next ? t('profile.next', { rank: r + 1, xp: next.xp }) : t('profile.top')}</div>
      </div>
      <Bar value={next ? p.xp - C.ranks[r].xp : 1} max={next ? next.xp - C.ranks[r].xp : 1} color="from-[#b8902a] to-gold2" className="h-2 my-3" />
      {A.dailyLeft(p, now) > 0
        ? <Btn className="w-full" disabled>{t('profile.dailyIn', { time: A.dailyLeft(p, now) })}</Btn>
        : <Btn className="w-full" onClick={() => run(A.claimDaily)}>{t('profile.daily')}</Btn>}

      <Section>{t('profile.stats')}</Section>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Stat k={t('hud.cash')} v={money(p.cash)} />
        <Stat k={t('bank.inBank')} v={money(p.bank)} />
        <Stat k={t('gym.power')} v={num(A.power(p))} />
        <Stat k={`${t('gym.str')} / ${t('gym.def')} / ${t('gym.int')}`} v={`${p.str} / ${p.def} / ${p.int}`} />
        {(Object.keys(p.stats) as (keyof Stats)[]).map((k) => (
          <Stat key={k} k={t(`stat.${k}` as Key)} v={k === 'earned' ? money(p.stats[k]) : num(p.stats[k])} />
        ))}
      </div>

      <Section>💎 {t('profile.diamondShop')} · {p.diamonds}</Section>
      <div className="deco rounded-xl p-3 mb-2">
        <div className="font-display text-gold2 font-bold">{t('premium.title')}</div>
        <Note>{t('premium.perks', { n: C.premium.days })}</Note>
        {prem
          ? <Btn className="w-full" disabled variant="ghost">{t('premium.active', { time: (p.premiumUntil - now) / 1000 })}</Btn>
          : <Btn className="w-full" onClick={() => run(A.buyPremium)}>{t('premium.buy', { n: C.premium.diamondPrice })}</Btn>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Btn variant="ghost" onClick={() => run(A.refillEnergy)}>{t('premium.energy', { n: dc.energyRefill })}</Btn>
        <Btn variant="ghost" onClick={() => run(A.refillNerve)}>{t('premium.nerve', { n: dc.nerveRefill })}</Btn>
        <Btn variant="ghost" onClick={() => run(A.buyGarageSlot)}>{t('premium.garageSlot', { n: dc.garageSlot })}</Btn>
        <Btn variant="ghost" onClick={() => {
          const n = window.prompt(t('premium.renamePrompt'), p.name);
          if (n) run(A.rename, n);
        }}>{t('premium.rename', { n: dc.rename })}</Btn>
      </div>
      <Note>{t('premium.earn')}</Note>

      <Section>{t('profile.ranks')}</Section>
      {C.ranks.map((k, i) => (
        <div key={k.id} className={`flex justify-between px-3 py-1.5 rounded-md mb-1 text-[13px] ${i === r ? 'bg-gold/15 ring-1 ring-gold/60' : i > r ? 'opacity-50' : ''}`}>
          <span>{i + 1}. {rankName(i)}</span><span className="text-smoke tabular">{num(k.xp)} XP</span>
        </div>
      ))}
      <Btn variant="ghost" className="w-full mt-4" onClick={() => { if (window.confirm(t('profile.resetConfirm'))) reset(); }}>{t('profile.reset')}</Btn>
    </>
  );
}
