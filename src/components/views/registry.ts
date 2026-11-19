import type { ComponentType } from 'react';
import { CarsView, CrimesView, HeistsView, SmugglingView, TravelView } from './street';
import { CasinoView, FightView, GymView, HospitalView, JailView } from './city';
import { BankView, ProfileView, PropertiesView, RankingView, ShopView } from './economy';

export interface ViewDef {
  id: string;
  icon: string;
  component: ComponentType;
  /** Haritadaki blok konumu (yoksa haritada yok) */
  map?: [number, number];
}

export const VIEWS: ViewDef[] = [
  { id: 'crimes', icon: '🥃', component: CrimesView, map: [1, 1] },
  { id: 'heists', icon: '🧨', component: HeistsView, map: [2, 0] },
  { id: 'cars', icon: '🚗', component: CarsView, map: [2, 2] },
  { id: 'smuggling', icon: '📦', component: SmugglingView, map: [3, 2] },
  { id: 'travel', icon: '✈️', component: TravelView, map: [3, 0] },
  { id: 'fight', icon: '💀', component: FightView, map: [1, 3] },
  { id: 'gym', icon: '🥊', component: GymView, map: [0, 2] },
  { id: 'shop', icon: '🔫', component: ShopView, map: [0, 1] },
  { id: 'casino', icon: '🎰', component: CasinoView, map: [1, 0] },
  { id: 'bank', icon: '🏦', component: BankView, map: [1, 2] },
  { id: 'properties', icon: '🏘️', component: PropertiesView, map: [3, 1] },
  { id: 'hospital', icon: '🏥', component: HospitalView, map: [2, 1] },
  { id: 'jail', icon: '⛓️', component: JailView, map: [0, 0] },
  { id: 'ranking', icon: '🏆', component: RankingView },
  { id: 'profile', icon: '👑', component: ProfileView, map: [2, 3] },
];

export const viewById = (id: string) => VIEWS.find((v) => v.id === id);
