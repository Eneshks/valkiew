'use client';
import { useState } from 'react';
import { CONFIG as C, type CrewRole } from '@/config/game';
import * as A from '@/engine/actions';
import { rank } from '@/engine/core';
import { formatTime, money, npcName, t, type Key } from '@/i18n';
import { useGame } from '@/store/game';
import { Btn, Card, CdBtn, Info, Locked, Note, Pct, Section, Tag } from '../ui';

const usePlayer = () => useGame((s) => s.player!);
const useRun = () => useGame((s) => s.run);

// ================================================================ SUÇLAR
export function CrimesView() {
  const p = usePlayer(), run = useRun();
  return (
    <>
      <Note>{t('lbl.energy')}: <b className="text-paper">{p.energy}</b></Note>
      {C.crimes.map((c) => {
        const locked = rank(p) < c.minRank;
        return (
          <Card key={c.id} dim={locked}>
            <Info title={t(`crime.${c.id}` as Key)} desc={t(`crime.${c.id}.d` as Key)}>
              <Tag icon="⚡">{c.energy}</Tag>
              <Tag icon="💵">{money(c.money[0])} – {money(c.money[1])}</Tag>
              <Tag icon="⭐">{c.xp}</Tag>
              <span>{t('lbl.chance')} <Pct p={A.crimeChance(p, c.id)} /></span>
              <span>⏱ {formatTime(c.cooldown)}</span>
            </Info>
            {locked ? <Locked rank={c.minRank} /> : <CdBtn p={p} cd={'crime_' + c.id} label={t('crime.do')} onClick={() => run(A.commitCrime, c.id)} />}
          </Card>
        );
      })}
    </>
  );
}

// ================================================================ ORGANİZE SUÇ
export function HeistsView() {
  const p = usePlayer(), run = useRun();
  const [picks, setPicks] = useState<Record<string, Partial<Record<CrewRole, number>>>>({});
  return (
    <>
      <Note>{t('lbl.nerve')}: <b className="text-paper">{p.nerve}</b></Note>
      {C.heists.map((h) => {
        const locked = rank(p) < h.minRank;
        const sel = picks[h.id] ?? {};
        const chance = A.heistChance(p, h.id, sel);
        const cut = A.heistCut(p, h.id, sel);
        return (
          <div key={h.id} className={`deco rounded-xl p-3 mb-3 ${locked ? 'opacity-50' : ''}`}>
            <div className="flex items-start gap-3">
              <Info title={t(`heist.${h.id}` as Key)} desc={t(`heist.${h.id}.d` as Key)}>
                <Tag icon="🔥">{h.nerve}</Tag>
                <Tag icon="💵">{money(h.money[0])} – {money(h.money[1])}</Tag>
                <Tag icon="⭐">{h.xp}</Tag>
                <span>⏱ {formatTime(h.cooldown)}</span>
              </Info>
              {locked && <Locked rank={h.minRank} />}
            </div>
            {!locked && (
              <>
                <div className="mt-2 text-[12px] text-smoke">{t('heist.pick')}</div>
                {h.crew.map((role) => (
                  <div key={role} className="mt-2">
                    <div className="text-[12px] font-semibold text-gold/90 mb-1">{t(`heist.role.${role}` as Key)}</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {p.crew.filter((c) => c.role === role).map((c) => {
                        const on = sel[role] === c.uid;
                        return (
                          <button key={c.uid} type="button"
                            onClick={() => setPicks({ ...picks, [h.id]: { ...sel, [role]: on ? undefined : c.uid } })}
                            className={`rounded-lg px-2 py-1.5 text-left text-[12px] border ${on ? 'border-gold bg-gold/15' : 'border-line bg-panel2'}`}>
                            <div className="font-semibold truncate">{npcName(c.nameIdx)}</div>
                            <div className="text-smoke">{t('heist.skill')} <b className="text-paper">{c.skill}</b> · {t('heist.cut')} %{Math.round(c.cut * 100)}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex-1 text-[12.5px] text-smoke">
                    {t('lbl.chance')} <Pct p={chance} /> · {t('heist.yourShare')} <b className="text-paper">%{Math.round((1 - cut) * 100)}</b>
                  </div>
                  <CdBtn p={p} cd={'heist_' + h.id} label={t('heist.start')} variant="red"
                    disabled={h.crew.some((r) => !sel[r])}
                    onClick={() => { run(A.runHeist, h.id, sel); setPicks({ ...picks, [h.id]: {} }); }} />
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

// ================================================================ GARAJ
export function CarsView() {
  const p = usePlayer(), run = useRun(), now = useGame((s) => s.now);
  const demand = C.cities.find((c) => c.id === p.city)?.carDemand ?? 1;
  return (
    <>
      <Card>
        <Info title={t('car.steal')} desc={t('car.steal.d')}>
          <Tag icon="⚡">{C.carTheft.energy}</Tag>
          <span>{t('car.garage')} <b className="text-paper">{p.cars.length}/{A.garageCap(p)}</b></span>
        </Info>
        <CdBtn p={p} cd="car" label={t('car.steal')} onClick={() => run(A.stealCar)} />
      </Card>
      <Note>{t('car.demand', { n: demand.toFixed(2) })}</Note>
      <Section>{t('car.garage')}</Section>
      {!p.cars.length && <Note>{t('car.empty')}</Note>}
      {p.cars.map((car) => {
        const transit = car.arrivesAt > now;
        const here = car.city === p.city && !transit;
        return (
          <Card key={car.uid}>
            <span className="text-2xl">🚘</span>
            <Info title={t(`car.${car.model}` as Key)}>
              <span>{t('car.damage')} <b className="text-paper">%{car.damage}</b></span>
              <span>{t('car.value')} <b className="text-paper">{money(A.carValue(p, car.uid))}</b></span>
              <span>📍 <b className="text-paper">{transit ? t('car.arriving', { time: (car.arrivesAt - now) / 1000 }) : t(`city.${car.city}` as Key)}</b></span>
            </Info>
            <div className="flex flex-col gap-1.5 items-end">
              <Btn size="sm" disabled={!here} onClick={() => run(A.sellCar, car.uid)}>{t('lbl.sell')}</Btn>
              <select className="input !py-1 !text-[12px] !w-28" value="" disabled={transit}
                onChange={(e) => e.target.value && run(A.shipCar, car.uid, e.target.value)}>
                <option value="">{t('car.shipTo')}</option>
                {C.cities.filter((c) => c.id !== car.city).map((c) => (
                  <option key={c.id} value={c.id}>{t(`city.${c.id}` as Key)} ×{c.carDemand} · {money(A.shipFee(p, car.uid))}</option>
                ))}
              </select>
            </div>
          </Card>
        );
      })}
    </>
  );
}

// ================================================================ KAÇAKÇILIK
export function SmugglingView() {
  const p = usePlayer(), run = useRun(), now = useGame((s) => s.now);
  const [qty, setQty] = useState('1');
  return (
    <>
      <Note>{t('smuggle.cargo', { used: A.cargoUsed(p), cap: A.cargoCap(p) })} · {t('smuggle.nextChange', { time: A.priceChangeIn(now) })}</Note>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-smoke text-[13px]">{t('lbl.qty')}</span>
        <input className="input" type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
        <Btn variant="ghost" size="sm" onClick={() => setQty(String(Math.max(1, A.cargoCap(p) - A.cargoUsed(p))))}>{t('lbl.all')}</Btn>
      </div>
      {C.goods.map((g) => {
        const price = A.goodPrice(g.id, p.city, now);
        const have = p.goods[g.id] ?? 0;
        const trend = price < g.base * 0.85 ? ['🟢', 'smuggle.cheap'] : price > g.base * 1.15 ? ['🔴', 'smuggle.expensive'] : ['⚪', 'smuggle.normal'];
        const best = C.cities.filter((c) => c.id !== p.city)
          .map((c) => ({ c: c.id, v: A.goodSellPrice(g.id, c.id, now) }))
          .sort((a, b) => b.v - a.v)[0];
        return (
          <Card key={g.id}>
            <Info title={t(`good.${g.id}` as Key)}>
              <span>{t('smuggle.buyPrice')} <b className="text-paper">{money(price)}</b></span>
              <span>{t('smuggle.sellPrice')} <b className="text-paper">{money(A.goodSellPrice(g.id, p.city, now))}</b></span>
              <span>{trend[0]} {t(trend[1] as Key)}</span>
              <span>{t('smuggle.have')} <b className="text-paper">{have}</b></span>
              {best && <span>↗ {t(`city.${best.c}` as Key)} <b className="text-paper">{money(best.v)}</b></span>}
            </Info>
            <div className="flex flex-col gap-1.5">
              <Btn size="sm" onClick={() => run(A.buyGood, g.id, Number(qty))}>{t('lbl.buy')}</Btn>
              <Btn size="sm" variant="ghost" disabled={!have} onClick={() => run(A.sellGood, g.id, Number(qty))}>{t('lbl.sell')}</Btn>
            </div>
          </Card>
        );
      })}
    </>
  );
}

// ================================================================ SEYAHAT
export function TravelView() {
  const p = usePlayer(), run = useRun();
  return (
    <>
      <Note>⏱ {formatTime(C.travel.cooldown)}</Note>
      {C.cities.map((c) => {
        const here = c.id === p.city;
        const locked = rank(p) < c.minRank;
        return (
          <Card key={c.id} dim={locked} active={here}>
            <span className="text-2xl">{here ? '📍' : '🌆'}</span>
            <Info title={t(`city.${c.id}` as Key)}>
              <span>{t('car.demand', { n: c.carDemand.toFixed(2) })}</span>
            </Info>
            {here ? <Btn disabled variant="ghost">{t('travel.current')}</Btn>
              : locked ? <Locked rank={c.minRank} />
              : <CdBtn p={p} cd="travel" label={t('travel.fly', { money: A.travelCost(p, c.id) })} onClick={() => run(A.travel, c.id)} />}
          </Card>
        );
      })}
    </>
  );
}
