// Oyun verileri: rütbeler, suçlar, arabalar, silahlar, şehirler, mallar, rakipler.
'use strict';

const RANKS = [
  { name: 'Çaylak', xp: 0 },
  { name: 'Serseri', xp: 120 },
  { name: 'Yankesici', xp: 350 },
  { name: 'Tetikçi', xp: 800 },
  { name: 'Haraççı', xp: 1600 },
  { name: 'Fedai', xp: 3200 },
  { name: 'Kabadayı', xp: 6000 },
  { name: 'Sağ Kol', xp: 11000 },
  { name: 'Danışman', xp: 20000 },
  { name: 'Baba', xp: 36000 },
  { name: 'Mafya Babası', xp: 65000 },
];

// energy: enerji maliyeti, base: temel başarı şansı, money: ödül aralığı,
// jail: yakalanırsa hapis süresi (sn), cd: bekleme süresi (sn)
const CRIMES = [
  { id: 'cuzdan', name: 'Yankesicilik', desc: 'Kalabalık çarşıda cüzdan avla.', energy: 5, minRank: 0, base: 0.88, money: [20, 70], xp: 5, jail: 20, cd: 8 },
  { id: 'bufe', name: 'Büfe soygunu', desc: 'Gece yarısı köşedeki büfeyi boşalt.', energy: 8, minRank: 0, base: 0.78, money: [70, 180], xp: 9, jail: 35, cd: 15 },
  { id: 'harac', name: 'Haraç toplama', desc: 'Mahalle esnafından "koruma parası" al.', energy: 12, minRank: 1, base: 0.72, money: [180, 420], xp: 16, jail: 60, cd: 25 },
  { id: 'kuyumcu', name: 'Kuyumcu soygunu', desc: 'Vitrini kır, altınları kap.', energy: 18, minRank: 2, base: 0.64, money: [500, 1300], xp: 30, jail: 110, cd: 40 },
  { id: 'tir', name: 'Tır kaçırma', desc: 'Otoyolda yük dolu bir tırı yolundan çevir.', energy: 24, minRank: 3, base: 0.58, money: [1400, 3200], xp: 55, jail: 170, cd: 60 },
  { id: 'baskin', name: 'Kumarhane baskını', desc: 'Rakip ailenin kasasını boşalt.', energy: 30, minRank: 5, base: 0.52, money: [3800, 8500], xp: 100, jail: 260, cd: 90 },
  { id: 'liman', name: 'Liman kaçakçılığı', desc: 'Konteynerleri gümrükten geçir.', energy: 36, minRank: 7, base: 0.46, money: [9000, 20000], xp: 180, jail: 380, cd: 120 },
  { id: 'merkez', name: 'Merkez Bankası soygunu', desc: 'Hayatının vurgunu. Ya hep ya hiç.', energy: 50, minRank: 9, base: 0.36, money: [28000, 65000], xp: 380, jail: 600, cd: 240 },
];

const CARS = [
  { name: 'Paslı Hatchback', value: 600, chance: 0.82, minRank: 0, color: '#9a8c74' },
  { name: 'Eski Taksi', value: 1100, chance: 0.74, minRank: 0, color: '#e5c23a' },
  { name: 'Klasik Sedan', value: 2200, chance: 0.66, minRank: 1, color: '#4c6fa8' },
  { name: 'Pikap', value: 3500, chance: 0.6, minRank: 2, color: '#7a3d2c' },
  { name: 'Spor Coupe', value: 7500, chance: 0.5, minRank: 4, color: '#c8302f' },
  { name: 'Lüks Limuzin', value: 16000, chance: 0.4, minRank: 6, color: '#1d1d22' },
  { name: 'Süper Spor', value: 42000, chance: 0.28, minRank: 8, color: '#f07a1a' },
];

// ammo: true olan silahlar mermi ile çok daha güçlü
const WEAPONS = [
  { name: 'Muşta', atk: 6, price: 400, minRank: 0, ammo: false },
  { name: 'Sustalı Çakı', atk: 12, price: 1500, minRank: 0, ammo: false },
  { name: 'Tabanca', atk: 28, price: 6000, minRank: 2, ammo: true },
  { name: 'Pompalı Tüfek', atk: 50, price: 18000, minRank: 4, ammo: true },
  { name: 'Hafif Makineli', atk: 80, price: 45000, minRank: 6, ammo: true },
  { name: 'Keskin Nişancı Tüfeği', atk: 125, price: 110000, minRank: 8, ammo: true },
];

const ARMORS = [
  { name: 'Deri Ceket', def: 6, price: 900, minRank: 0 },
  { name: 'Kurşun Geçirmez Yelek', def: 22, price: 9000, minRank: 3 },
  { name: 'Ağır Zırh', def: 48, price: 42000, minRank: 6 },
];

const CITIES = [
  { id: 'istanbul', name: 'İstanbul', mod: 1.0, minRank: 0, price: 0, tint: 'rgba(40,60,140,0.10)' },
  { id: 'marsilya', name: 'Marsilya', mod: 1.12, minRank: 1, price: 800, tint: 'rgba(30,110,140,0.12)' },
  { id: 'palermo', name: 'Palermo', mod: 1.25, minRank: 3, price: 2500, tint: 'rgba(150,90,30,0.13)' },
  { id: 'chicago', name: 'Chicago', mod: 1.4, minRank: 5, price: 6000, tint: 'rgba(90,40,140,0.14)' },
  { id: 'lasvegas', name: 'Las Vegas', mod: 1.6, minRank: 7, price: 15000, tint: 'rgba(170,40,110,0.13)' },
];

const GOODS = [
  { id: 'sigara', name: 'Kaçak Sigara', base: 40 },
  { id: 'viski', name: 'Viski', base: 120 },
  { id: 'parca', name: 'Silah Parçası', base: 400 },
  { id: 'mucevher', name: 'Mücevher', base: 1200 },
  { id: 'tablo', name: 'Çalıntı Tablo', base: 4500 },
];

const RIVALS = [
  { name: 'Sokak Serserisi', power: 14, money: [40, 140], xp: 7, minRank: 0 },
  { name: 'Mahalle Çetesinden Biri', power: 35, money: [150, 380], xp: 15, minRank: 0 },
  { name: 'Rakip Tetikçi', power: 80, money: [500, 1200], xp: 32, minRank: 2 },
  { name: 'Kartel Kuryesi', power: 150, money: [1400, 3200], xp: 60, minRank: 4 },
  { name: 'Rakip Aile Fedaisi', power: 260, money: [4000, 9000], xp: 110, minRank: 6 },
  { name: 'Rakip Aile Babası', power: 480, money: [12000, 30000], xp: 240, minRank: 8 },
];

// Haritadaki binalar. bx/by: 4x4 iç blok ızgarasındaki yer.
const BUILDINGS = [
  { id: 'hapishane', name: 'Hapishane', icon: '⛓️', bx: 0, by: 0, desc: 'Yakalananların durağı. Rüşvet ya da firar.' },
  { id: 'kumarhane', name: 'Kumarhane', icon: '🎰', bx: 1, by: 0, desc: 'Şansını dene, ya kazan ya kaybet.' },
  { id: 'havalimani', name: 'Havalimanı', icon: '✈️', bx: 3, by: 0, desc: 'Başka şehirlere uç, yeni fırsatlar bul.' },
  { id: 'silahci', name: 'Silahçı', icon: '🔫', bx: 0, by: 1, desc: 'Silah, zırh ve mermi.' },
  { id: 'meyhane', name: 'Meyhane', icon: '🥃', bx: 1, by: 1, desc: 'İşler burada konuşulur. Suç işle.' },
  { id: 'hastane', name: 'Hastane', icon: '🏥', bx: 2, by: 1, desc: 'Yaralarını sar.' },
  { id: 'spor', name: 'Spor Salonu', icon: '🥊', bx: 0, by: 2, desc: 'Güç, savunma ve çeviklik çalış.' },
  { id: 'banka', name: 'Banka', icon: '🏦', bx: 1, by: 2, desc: 'Paranı güvene al, faiz kazan.' },
  { id: 'garaj', name: 'Garaj', icon: '🚗', bx: 2, by: 2, desc: 'Araba çal, sat, para kazan.' },
  { id: 'karaborsa', name: 'Karaborsa', icon: '📦', bx: 3, by: 2, desc: 'Ucuza al, pahalıya sat.' },
  { id: 'arkasokak', name: 'Arka Sokak', icon: '💀', bx: 1, by: 3, desc: 'Rakiplerle hesaplaş.' },
  { id: 'malikane', name: 'Malikane', icon: '👑', bx: 2, by: 3, desc: 'Karargâhın. Profil ve günlük ödül.' },
];

const PARKS = [[2, 0], [3, 3], [0, 3]];
const HOUSE_BLOCKS = [[3, 1]];
