'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG as C, GAME_NAME } from '@/config/game';
import { city, hospitalLeft, isPremium, jailLeft, maxEnergy, maxHp, maxNerve, rank } from '@/engine/core';
import { money, num, rankName, t, type Key } from '@/i18n';
import { useGame } from '@/store/game';
import { createCityMap, type MapBuilding } from './map/cityMap';
import { VIEWS, viewById } from './views/registry';

// ================================================================ ÜST DURUM ÇUBUĞU
function StatusBar({ onOpen }: { onOpen: (id: string) => void }) {
  const p = useGame((s) => s.player!);
  const now = useGame((s) => s.now);
  const r = rank(p), next = C.ranks[r + 1];
  const prog = next ? (p.xp - C.ranks[r].xp) / (next.xp - C.ranks[r].xp) : 1;
  const meter = (icon: string, v: number, max: number, color: string, label: string) => (
    <div className="flex items-center gap-1.5 min-w-0" title={label}>
      <span className="text-[13px]">{icon}</span>
      <div className="flex-1 min-w-[44px]">
        <div className="text-[11.5px] font-semibold tabular leading-none mb-0.5">{num(v)}<span className="text-smoke">/{num(max)}</span></div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></div>
      </div>
    </div>
  );
  const jail = jailLeft(p, now), hosp = hospitalLeft(p, now);
  return (
    <header className="pt-safe sticky top-0 z-30 bg-ink/92 backdrop-blur border-b border-line">
      <div className="flex items-center gap-3 px-3 py-2">
        <button type="button" onClick={() => onOpen('profile')} className="flex items-center gap-2 min-w-0 shrink-0 text-left">
          <span className="w-10 h-10 rounded-full grid place-items-center text-xl bg-panel2 border-2 border-gold shadow">🕴️</span>
          <span className="min-w-0 hidden xs:block sm:block">
            <span className="block font-display font-bold text-gold2 text-[14px] leading-tight truncate max-w-[120px]">
              {rankName(r)}{isPremium(p, now) && <span className="ml-1 text-[10px] align-middle">★</span>}
            </span>
            <span className="block h-1.5 w-24 rounded-full bg-white/10 overflow-hidden mt-1"><span className="block h-full bg-gradient-to-r from-[#b8902a] to-gold2" style={{ width: `${prog * 100}%` }} /></span>
          </span>
        </button>
        <div className="grid grid-cols-3 gap-2 flex-1 min-w-0">
          {meter('❤️', p.hp, maxHp(p), 'bg-blood2', t('hud.hp'))}
          {meter('⚡', p.energy, maxEnergy(p), 'bg-gold2', t('hud.energy'))}
          {meter('🔥', p.nerve, maxNerve(p), 'bg-[#e8743b]', t('hud.nerve'))}
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="text-mint font-bold tabular text-[13.5px]" title={t('hud.cash')}>{money(p.cash)}</span>
          <span className="text-[#ffc2f1] font-bold tabular text-[12.5px]" title={t('hud.diamonds')}>💎 {num(p.diamonds)}</span>
        </div>
      </div>
      {(jail > 0 || hosp > 0) && (
        <button type="button" onClick={() => onOpen(jail ? 'jail' : 'hospital')}
          className={`w-full text-center text-[13px] font-semibold py-1.5 ${jail ? 'bg-blood/80' : 'bg-[#1a5278]/90'}`}>
          {jail ? t('hud.inJail', { time: jail }) : t('hud.inHospital', { time: hosp })}
        </button>
      )}
    </header>
  );
}

// ================================================================ HARİTA
function CityMapView({ onOpen }: { onOpen: (id: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const api = useRef<ReturnType<typeof createCityMap> | null>(null);
  const cityId = useGame((s) => s.player?.city);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const buildings: MapBuilding[] = useMemo(() => VIEWS.filter((v) => v.map).map((v) => ({
    id: v.id, bx: v.map![0], by: v.map![1], icon: v.icon, label: t(`nav.${v.id}` as Key),
  })), []);
  useEffect(() => {
    if (!ref.current) return;
    api.current = createCityMap(ref.current, buildings, (id) => openRef.current(id));
    return () => api.current?.destroy();
  }, [buildings]);
  useEffect(() => {
    const p = useGame.getState().player;
    if (p) api.current?.setTint(city(p).tint);
  }, [cityId]);
  return (
    <div className="relative w-full h-full">
      <canvas ref={ref} className="absolute inset-0 w-full h-full touch-none cursor-grab" aria-label={t('nav.map')} />
      <div className="absolute left-3 top-3 deco rounded-md px-2.5 py-1 text-[12.5px] font-display text-gold2">📍 {cityId && t(`city.${cityId}` as Key)}</div>
      <div className="absolute right-3 bottom-3 flex flex-col gap-1.5">
        {[['＋', () => api.current?.zoomBy(1.2)], ['－', () => api.current?.zoomBy(0.83)], ['⌖', () => api.current?.fit()]].map(([l, f]) => (
          <button key={l as string} type="button" onClick={f as () => void} className="w-9 h-9 rounded-md deco text-lg">{l as string}</button>
        ))}
      </div>
    </div>
  );
}

// ================================================================ MENÜLER
const SIDE_ORDER = ['map', 'crimes', 'heists', 'cars', 'smuggling', 'travel', 'fight', 'gym', 'shop', 'casino', 'bank', 'properties', 'hospital', 'jail', 'ranking', 'profile'];
const BOTTOM = ['map', 'crimes', 'fight', 'more', 'profile'];
const iconOf = (id: string) => (id === 'map' ? '🗺️' : id === 'more' ? '🏙️' : viewById(id)?.icon ?? '•');

function SideNav({ view, setView }: { view: string; setView: (v: string) => void }) {
  return (
    <nav className="hidden md:flex flex-col w-56 shrink-0 border-r border-line bg-coal overflow-y-auto scroll-thin">
      <div className="px-4 py-4 font-display text-2xl font-bold text-gold tracking-[0.12em]">{GAME_NAME.toUpperCase()}</div>
      {SIDE_ORDER.map((id) => (
        <button key={id} type="button" onClick={() => setView(id)}
          className={`flex items-center gap-3 px-4 py-2 text-left text-[14px] border-l-2 ${view === id ? 'border-gold bg-gold/10 text-gold2' : 'border-transparent text-smoke hover:text-paper hover:bg-white/5'}`}>
          <span className="w-6 text-center">{iconOf(id)}</span>{t(`nav.${id}` as Key)}
        </button>
      ))}
    </nav>
  );
}

function BottomNav({ view, setView }: { view: string; setView: (v: string) => void }) {
  return (
    <nav className="md:hidden pb-safe z-30 border-t border-line bg-coal/95 backdrop-blur">
      <div className="grid grid-cols-5">
        {BOTTOM.map((id) => {
          const on = view === id || (id === 'more' && !BOTTOM.includes(view));
          return (
            <button key={id} type="button" onClick={() => setView(id)}
              className={`flex flex-col items-center py-1.5 text-[11px] ${on ? 'text-gold2' : 'text-smoke'}`}>
              <span className="text-[21px] leading-7">{iconOf(id)}</span>{t(`nav.${id}` as Key)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function MoreMenu({ setView }: { setView: (v: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 p-3">
      {SIDE_ORDER.filter((id) => id !== 'map').map((id) => (
        <button key={id} type="button" onClick={() => setView(id)} className="deco rounded-xl py-4 flex flex-col items-center gap-1 text-[12.5px]">
          <span className="text-2xl">{iconOf(id)}</span>{t(`nav.${id}` as Key)}
        </button>
      ))}
    </div>
  );
}

// ================================================================ BİLDİRİM BALONLARI
function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-50 flex flex-col gap-1.5 items-center w-[min(440px,calc(100%-24px))] pointer-events-none">
      {toasts.map(({ id, result: r }) => (
        <div key={id} className="anim-rise w-full flex flex-col gap-1.5">
          <div className={`rounded-lg px-3 py-2 text-center font-semibold text-[14px] shadow-lg border bg-coal/95 ${r.tone === 'good' ? 'border-mint/50 text-mint' : r.tone === 'bad' ? 'border-blood2/60 text-[#ffb0b3]' : 'border-gold/50 text-gold2'}`}>
            {t(r.key, r.params)}
          </div>
          {r.rankUp !== undefined && (
            <div className="rounded-lg px-3 py-2.5 text-center font-display font-bold text-[17px] bg-gradient-to-b from-[#4a3a10] to-[#241c08] border border-gold text-gold2">
              {t('rank.up', { rank: r.rankUp })} +{C.rankUpDiamonds} 💎
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ================================================================ AÇILIŞ
function Welcome() {
  const start = useGame((s) => s.start);
  const [name, setName] = useState('');
  return (
    <div className="min-h-dvh grid place-items-center p-6 bg-[radial-gradient(ellipse_at_top,#2a2116,#0f0d0b_70%)]">
      <form className="deco rounded-2xl p-6 w-full max-w-sm text-center anim-pop" onSubmit={(e) => { e.preventDefault(); start(name); }}>
        <div className="text-5xl mb-2">🎩</div>
        <h1 className="font-display text-4xl font-bold text-gold tracking-[0.16em]">{GAME_NAME.toUpperCase()}</h1>
        <div className="h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent my-3" />
        <p className="text-smoke mb-5">{t('app.tagline')}</p>
        <input className="input text-center mb-3" maxLength={16} autoFocus placeholder={t('app.nickname')} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn w-full" type="submit">{t('app.start')}</button>
      </form>
    </div>
  );
}

// ================================================================ ANA KABUK
export default function Game() {
  const { player, loaded, load, heartbeat, clearResult } = useGame();
  const [view, setViewState] = useState('map');

  useEffect(() => {
    load();
    const id = setInterval(() => useGame.getState().heartbeat(), 1000);
    const save = () => { const p = useGame.getState().player; if (p) try { localStorage.setItem('valkiew-save-v2', JSON.stringify(p)); } catch { /* yok */ } };
    window.addEventListener('pagehide', save);
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => { clearInterval(id); window.removeEventListener('pagehide', save); };
  }, [load, heartbeat]);

  const setView = (v: string) => { clearResult(); setViewState(v); };

  if (!loaded) return <div className="min-h-dvh bg-ink" />;
  if (!player) return <Welcome />;

  const def = viewById(view);
  const View = def?.component;
  return (
    <div className="h-dvh flex flex-col md:flex-row overflow-hidden">
      <SideNav view={view} setView={setView} />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <StatusBar onOpen={setView} />
        <main className="flex-1 min-h-0 relative">
          {/* Harita her zaman bağlı kalır; diğer ekranlar üstüne açılır */}
          <div className={`absolute inset-0 ${view === 'map' ? '' : 'invisible'}`}><CityMapView onOpen={setView} /></div>
          {view === 'more' && <div className="absolute inset-0 overflow-y-auto bg-ink scroll-thin">
            <h2 className="font-display text-xl text-gold2 px-4 pt-4">{t('nav.more')}</h2><MoreMenu setView={setView} />
          </div>}
          {View && (
            <div className="absolute inset-0 overflow-y-auto bg-ink/97 scroll-thin" key={view}>
              <div className="max-w-2xl mx-auto px-3 pb-6">
                <div className="flex items-center gap-3 py-3 sticky top-0 bg-ink/95 backdrop-blur z-10">
                  <span className="w-11 h-11 rounded-lg grid place-items-center text-2xl deco">{def!.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display text-xl font-bold text-gold2 leading-tight">{t(`nav.${view}` as Key)}</h2>
                    <p className="text-smoke text-[12.5px] truncate">{t(`desc.${view}` as Key)}</p>
                  </div>
                  <button type="button" onClick={() => setView('map')} className="w-9 h-9 rounded-md deco" aria-label={t('app.close')}>✕</button>
                </div>
                <View />
              </div>
            </div>
          )}
        </main>
        <BottomNav view={view} setView={setView} />
      </div>
      <Toasts />
    </div>
  );
}
