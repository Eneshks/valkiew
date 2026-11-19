'use client';
import { useState } from 'react';
import { CONFIG as C } from '@/config/game';
import * as A from '@/engine/actions';
import * as K from '@/engine/casino';
import { hospitalLeft, jailLeft, maxHp, rank } from '@/engine/core';
import type { BlackjackHand, Result } from '@/engine/types';
import { formatTime, money, npcName, num, t, type Key } from '@/i18n';
import { useGame } from '@/store/game';
import { Bar, Big, Btn, Card, CdBtn, Info, Locked, Note, Pct, Section, Stat, Tag } from '../ui';

const usePlayer = () => useGame((s) => s.player!);
const useRun = () => useGame((s) => s.run);

// ================================================================ HAPİSHANE
export function JailView() {
  const p = usePlayer(), run = useRun(), now = useGame((s) => s.now);
  const left = jailLeft(p, now);
  return (
    <>
      {left > 0 ? (
        <>
          <Big label={t('jail.left')} value={`⛓️ ${formatTime(left)}`} color="text-blood2" />
          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={() => run(A.bribe, false)}>{t('jail.bribe', { money: A.bribeCost(p, now) })}</Btn>
            <Btn variant="ghost" onClick={() => run(A.bribe, true)}>{t('jail.lawyer', { n: C.diamondCosts.jailOut })}</Btn>
          </div>
          <CdBtn p={p} cd="escape" variant="red" className="w-full mt-2"
            label={t('jail.escape', { n: Math.round(A.escapeChance(p) * 100) })} onClick={() => run(A.escape)} />
          <Note>{t('jail.escapeNote', { time: C.jail.escapePenalty })}</Note>
        </>
      ) : <Note>{t('jail.freeNow')}</Note>}
      <Section>{t('jail.inmates')}</Section>
      {p.inmates.filter((i) => i.until > now).map((i) => (
        <Card key={i.uid}>
          <span className="text-2xl">🧔</span>
          <Info title={npcName(i.nameIdx)}><span>⏱ {formatTime((i.until - now) / 1000)}</span></Info>
          <CdBtn p={p} cd="bust" variant="ghost" disabled={left > 0}
            label={t('jail.bust', { n: Math.round(A.bustChance(p, i.difficulty) * 100) })} onClick={() => run(A.bustInmate, i.uid)} />
        </Card>
      ))}
    </>
  );
}

// ================================================================ HASTANE
export function HospitalView() {
  const p = usePlayer(), run = useRun(), now = useGame((s) => s.now);
  const left = hospitalLeft(p, now), mh = maxHp(p);
  return (
    <>
      <Big value={`❤️ ${num(p.hp)} / ${num(mh)}`} />
      <Bar value={p.hp} max={mh} className="h-2.5 mb-4" />
      {left > 0 ? (
        <>
          <Note>{t('hospital.inside', { time: left })}</Note>
          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={() => run(A.discharge, false)}>{t('hospital.discharge', { money: A.dischargeCost(p, now) })}</Btn>
            <Btn variant="ghost" onClick={() => run(A.discharge, true)}>{t('hospital.privateDoc', { n: C.diamondCosts.hospitalOut })}</Btn>
          </div>
        </>
      ) : (
        <Btn className="w-full" disabled={p.hp >= mh} onClick={() => run(A.heal)}>
          {p.hp >= mh ? t('hospital.healthy') : t('hospital.heal', { money: A.healCost(p) })}
        </Btn>
      )}
      <Note>{t('hospital.regen', { time: C.regen.hp.every, n: C.regen.hp.pct * 100 })}</Note>
    </>
  );
}

// ================================================================ SALON
export function GymView() {
  const p = usePlayer(), run = useRun();
  const stats = [['str', '💪'], ['def', '🛡️'], ['int', '🧠']] as const;
  return (
    <>
      <Big label={t('gym.power')} value={num(A.power(p))} color="text-gold2" />
      {stats.map(([k, ic]) => (
        <Card key={k}>
          <span className="text-2xl">{ic}</span>
          <Info title={`${t(`gym.${k}` as Key)}: ${p[k]}`} desc={t(`gym.${k}.d` as Key)}>
            <Tag icon="⚡">{C.gym.energy}</Tag>
            <Tag icon="💵">{money(A.trainCost(p, k))}</Tag>
          </Info>
          <CdBtn p={p} cd="gym" label={t('gym.train')} onClick={() => run(A.train, k)} />
        </Card>
      ))}
    </>
  );
}

// ================================================================ KUMARHANE
const SLOT_ICONS: Record<string, string> = { cherry: '🍒', lemon: '🍋', bell: '🔔', clover: '🍀', seven: '7️⃣', diamond: '💎' };
const CARD = (v: number) => (v === 1 ? 'A' : v === 11 ? 'J' : v === 12 ? 'Q' : v === 13 ? 'K' : String(v));

function Cards({ cards, hideSecond }: { cards: number[]; hideSecond?: boolean }) {
  return (
    <div className="flex gap-1.5">
      {cards.map((c, i) => (
        <div key={i} className={`w-9 h-12 rounded-md grid place-items-center font-display font-bold text-lg border ${hideSecond && i === 1 ? 'bg-blood/60 border-blood2 text-transparent' : 'bg-paper text-ink border-gold'}`}>
          {hideSecond && i === 1 ? '?' : CARD(c)}
        </div>
      ))}
    </div>
  );
}

export function CasinoView() {
  const p = usePlayer(), run = useRun();
  const [bet, setBet] = useState(String(Math.min(100, K.maxBet(p))));
  const [last, setLast] = useState<{ game: string; r: Result } | null>(null);
  const b = Number(bet);
  const play = (game: string, r: Result) => setLast({ game, r });
  const bj = p.blackjack;
  const bjShown: BlackjackHand | null = bj ?? (last?.game === 'bj' ? ((last.r.data as { hand?: BlackjackHand })?.hand ?? null) : null);

  return (
    <>
      <Note>{t('casino.notice')} {t('casino.maxBetLbl', { money: K.maxBet(p) })}</Note>
      <div className="flex items-center gap-2 mb-2">
        <input className="input" type="number" inputMode="numeric" min={1} value={bet} onChange={(e) => setBet(e.target.value)} />
        <Btn variant="ghost" size="sm" onClick={() => setBet(String(Math.max(1, Math.floor(b / 2))))}>½</Btn>
        <Btn variant="ghost" size="sm" onClick={() => setBet(String(Math.min(K.maxBet(p), b * 2)))}>2×</Btn>
      </div>

      <Section>🎡 {t('casino.roulette')}</Section>
      {last?.game === 'roulette' && last.r.data != null && (
        <div className="text-center mb-2 font-display text-2xl">
          <span className={(last.r.data as { color: string }).color === 'red' ? 'text-blood2' : (last.r.data as { color: string }).color === 'green' ? 'text-mint' : 'text-paper'}>
            ● {(last.r.data as { n: number }).n}
          </span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Btn variant="red" onClick={() => play('roulette', run(K.roulette, b, 'red'))}>{t('casino.red')}</Btn>
        <Btn variant="ghost" onClick={() => play('roulette', run(K.roulette, b, 'black'))}>{t('casino.black')}</Btn>
        <Btn onClick={() => play('roulette', run(K.roulette, b, 'green'))}>{t('casino.green', { n: C.casino.rouletteGreen })}</Btn>
        <Btn variant="ghost" onClick={() => play('roulette', run(K.roulette, b, 'even'))}>{t('casino.even')}</Btn>
        <Btn variant="ghost" onClick={() => play('roulette', run(K.roulette, b, 'odd'))}>{t('casino.odd')}</Btn>
      </div>

      <Section>🎰 {t('casino.slots')}</Section>
      <div className="flex items-center gap-3">
        <div className="flex-1 flex justify-center gap-2 text-3xl bg-coal rounded-lg py-2 border border-line">
          {((last?.game === 'slots' && (last.r.data as { reels?: string[] })?.reels) || ['seven', 'seven', 'seven']).map((r, i) => <span key={i}>{SLOT_ICONS[r]}</span>)}
        </div>
        <Btn onClick={() => play('slots', run(K.slots, b))}>{t('casino.spin')}</Btn>
      </div>
      <Note>{C.casino.slots.map((s) => `${SLOT_ICONS[s.id]}×${s.pay}`).join(' · ')}</Note>

      <Section>🎲 {t('casino.dice')}</Section>
      <Card>
        <Info title={t('casino.dice')} desc={t('casino.dice.d')}>
          {last?.game === 'dice' && last.r.data != null && (
            <span className="text-paper">{t('casino.you')} {(last.r.data as { mine: number[] }).mine.join('+')} · {t('casino.dealer')} {(last.r.data as { house: number[] }).house.join('+')}</span>
          )}
        </Info>
        <Btn onClick={() => play('dice', run(K.dice, b))}>{t('casino.roll')}</Btn>
      </Card>

      <Section>🃏 {t('casino.blackjack')}</Section>
      <div className="deco rounded-xl p-3">
        {bjShown && (
          <div className="grid gap-2 mb-3">
            <div className="flex items-center gap-3"><span className="w-16 text-smoke text-[12px]">{t('casino.dealer')}</span>
              <Cards cards={bjShown.dealer} hideSecond={!!bj} />{!bj && <b>{K.handValue(bjShown.dealer)}</b>}</div>
            <div className="flex items-center gap-3"><span className="w-16 text-smoke text-[12px]">{t('casino.you')}</span>
              <Cards cards={bjShown.player} /><b>{K.handValue(bjShown.player)}</b></div>
          </div>
        )}
        {bj ? (
          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={() => play('bj', run(K.bjHit))}>{t('casino.hit')}</Btn>
            <Btn variant="ghost" onClick={() => play('bj', run(K.bjStand))}>{t('casino.stand')}</Btn>
          </div>
        ) : <Btn className="w-full" onClick={() => play('bj', run(K.bjStart, b))}>{t('casino.deal')}</Btn>}
      </div>
    </>
  );
}

// ================================================================ DÖVÜŞ
export function FightView() {
  const p = usePlayer(), run = useRun(), now = useGame((s) => s.now);
  const w = C.weapons.find((x) => x.id === p.weapon);
  const mine = A.playerAttack(p) + A.playerDefense(p) * 0.5;
  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Stat k={t('fight.yourPower')} v={num(A.power(p))} />
        <Stat k={t('hud.nerve')} v={p.nerve} />
        <Stat k="🔫" v={num(p.ammo)} />
      </div>
      <Note>
        {w ? <>{t(`item.${w.id}` as Key)}{w.ammo && !p.ammo && <span className="text-blood2"> — {t('fight.noAmmo')}</span>}</> : t('fight.noWeapon')}
        {' '}{t('fight.note')}
      </Note>
      {C.rivals.map((r) => {
        const locked = rank(p) < r.minRank;
        const recent = A.attacksInWindow(p, r.id, now).length;
        return (
          <Card key={r.id} dim={locked}>
            <span className="text-2xl">🕴️</span>
            <Info title={t(`rival.${r.id}` as Key)}>
              <span>{t('fight.power')} <b className="text-paper">{num(A.rivalPower(r.id))}</b></span>
              <span>{t('fight.win')} <Pct p={A.winProbability(mine, A.rivalPower(r.id))} /></span>
              <Tag icon="💵">{money(r.cash[0] * C.combat.lootPct)}+</Tag>
              {r.bounty > 0 && A.bountyAvailable(p, r.id, now) && <span className="text-gold2 font-semibold">🎯 {t('fight.bounty', { money: r.bounty })}</span>}
              <span>{t('fight.recent', { n: recent, max: C.combat.sameTargetLimit })}</span>
            </Info>
            {locked ? <Locked rank={r.minRank} /> : <CdBtn p={p} cd="attack" variant="red" label={t('fight.attack')} onClick={() => run(A.attack, r.id)} />}
          </Card>
        );
      })}
    </>
  );
}
