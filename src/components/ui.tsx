'use client';
import type { ReactNode } from 'react';
import { cdLeft } from '@/engine/core';
import type { Player, Result } from '@/engine/types';
import { formatTime, t } from '@/i18n';
import { useGame } from '@/store/game';

export function Card({ children, className = '', dim = false, active = false }: { children: ReactNode; className?: string; dim?: boolean; active?: boolean }) {
  return (
    <div className={`deco rounded-xl px-3 py-2.5 mb-2 flex items-center gap-3 ${dim ? 'opacity-50' : ''} ${active ? 'ring-1 ring-gold/70' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function Info({ title, desc, children }: { title: ReactNode; desc?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="font-semibold">{title}</div>
      {desc && <div className="text-smoke text-[12.5px] leading-snug">{desc}</div>}
      {children && <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[12px] text-smoke">{children}</div>}
    </div>
  );
}

export function Tag({ icon, children }: { icon?: string; children: ReactNode }) {
  return <span>{icon && <span className="mr-0.5">{icon}</span>}<b className="text-paper font-semibold">{children}</b></span>;
}

export function Pct({ p }: { p: number }) {
  const c = p >= 0.7 ? 'text-mint' : p >= 0.45 ? 'text-gold2' : 'text-blood2';
  return <b className={`${c} font-bold`}>%{Math.round(p * 100)}</b>;
}

export function Section({ children }: { children: ReactNode }) {
  return <h3 className="font-display text-gold/90 uppercase tracking-[0.14em] text-[12px] mt-5 mb-2 first:mt-0 flex items-center gap-2">
    <span className="h-px w-4 bg-gold/40" />{children}<span className="h-px flex-1 bg-gold/20" />
  </h3>;
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-smoke text-[12.5px] my-2 leading-snug">{children}</p>;
}

export function Stat({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="deco rounded-xl px-3 py-2">
      <div className="text-smoke text-[11.5px]">{k}</div>
      <div className="font-bold text-[16px] tabular truncate">{v}</div>
    </div>
  );
}

export function Btn({ children, onClick, disabled, variant = 'gold', size, className = '', title }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'gold' | 'red' | 'ghost'; size?: 'sm'; className?: string; title?: string;
}) {
  const v = variant === 'red' ? 'btn-red' : variant === 'ghost' ? 'btn-ghost' : '';
  return <button type="button" title={title} className={`btn ${v} ${size === 'sm' ? 'btn-sm' : ''} ${className}`} disabled={disabled} onClick={onClick}>{children}</button>;
}

/** Bekleme süresi varsa geri sayım gösteren düğme */
export function CdBtn({ p, cd, label, onClick, disabled, variant, className }: {
  p: Player; cd: string; label: ReactNode; onClick: () => void; disabled?: boolean; variant?: 'gold' | 'red' | 'ghost'; className?: string;
}) {
  const now = useGame((s) => s.now);
  const left = cdLeft(p, cd, now);
  return <Btn variant={variant} className={className} disabled={disabled || left > 0} onClick={onClick}>{left > 0 ? `⏳ ${formatTime(left)}` : label}</Btn>;
}

export function Locked({ rank }: { rank: number }) {
  return <Btn disabled>{t('app.locked', { rank })}</Btn>;
}

export function ResultBanner({ r }: { r: Result | null }) {
  if (!r) return null;
  const c = r.tone === 'good' ? 'bg-mint/10 text-mint border-mint/30' : r.tone === 'bad' ? 'bg-blood/15 text-[#ffb0b3] border-blood/40' : 'bg-gold/10 text-gold2 border-gold/30';
  return <div className={`anim-pop rounded-lg border px-3 py-2 mb-3 text-center font-semibold ${c}`}>{t(r.key, r.params)}</div>;
}

export function Bar({ value, max, color = 'from-blood to-blood2', className = 'h-2' }: { value: number; max: number; color?: string; className?: string }) {
  return (
    <div className={`${className} rounded-full bg-white/10 overflow-hidden`}>
      <div className={`h-full bg-gradient-to-r ${color} transition-[width] duration-300`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
    </div>
  );
}

export function Big({ label, value, color = 'text-paper' }: { label?: ReactNode; value: ReactNode; color?: string }) {
  return (
    <div className="text-center py-3">
      {label && <div className="text-smoke text-[12px]">{label}</div>}
      <div className={`font-display text-[32px] font-bold tabular ${color}`}>{value}</div>
    </div>
  );
}
