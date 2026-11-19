# Valkiew — Mafya Şehri

Tarayıcıda (masaüstü ve mobil) oynanan, noir temalı mafya / gangster RPG'si.
**Şu anki sürüm tek oyunculu:** sunucu ve veritabanı yok, ilerleme tarayıcıda (localStorage) saklanır.

## Kurulum

```bash
npm install
npm run dev      # geliştirme: http://localhost:3000
npm test         # oyun mantığı testleri (vitest)
npm run build    # statik çıktı: out/ klasörü
npm start        # out/ klasörünü yerelde yayınla
```

`out/` klasörü herhangi bir statik sunucuya (Nginx, Netlify, Vercel, GitHub Pages…) yüklenebilir.
Telefonda "Ana ekrana ekle" ile uygulama gibi açılır (PWA).

## Teknoloji
- Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- Zustand (durum yönetimi), Vitest (testler)
- Harita: canvas üzerinde kodla çizilen izometrik şehir (harici görsel yok)

## Klasör yapısı
```
src/
  config/game.ts      ← TÜM OYUN DENGESİ (fiyatlar, ödüller, süreler, formüller)
  engine/             ← saf oyun mantığı (arayüzden bağımsız, ileride sunucuya taşınabilir)
    core.ts           oyuncu, rütbe, dolum, faiz, bekleme süreleri
    actions.ts        suç, araba, organize suç, kaçakçılık, seyahat, hapis, hastane, salon, dövüş, mağaza, mülk, banka, elmas
    casino.ts         rulet, slot, zar, blackjack (yalnızca oyun parası)
    leaderboard.ts    sıralamalar (NPC rakiplerle)
  i18n/               ← metinler (tr.ts). Yeni dil = yeni sözlük dosyası
  store/game.ts       ← oyun durumu ve kayıt
  components/         ← arayüz (durum çubuğu, menüler, harita, ekranlar)
tests/engine.test.ts  ← savaş, ekonomi, kumarhane, rütbe testleri
```

## Oyunda neler var
| Bölüm | İçerik |
|---|---|
| Suçlar | 10 seviye suç; başarı şansı, ödül, XP, enerji, bekleme süresi, hapis riski |
| Organize suç | 3 büyük soygun; şoför / silahçı / patlayıcı uzmanı seç, payları dağıt |
| Garaj | Araba çal; sat ya da araba talebi yüksek şehre gönder |
| Kaçakçılık | 5 mal, 6 şehir, 15 dakikada bir değişen fiyatlar |
| Seyahat | İstanbul, Palermo, New York, Chicago, Las Vegas, Moskova |
| Dövüş | 7 rakip mafyozo, ödül avı, aynı rakibe saatlik saldırı limiti; formül config'de |
| Hapishane | Rüşvet, avukat (elmas), firar; diğer mahkûmları kaçırma |
| Hastane | Tedavi, erken taburcu |
| Salon | Güç, savunma, zekâ |
| Kumarhane | Rulet, slot, zar, blackjack |
| Silahçı | Silah, zırh, mermi, araç (kapasite + seyahat indirimi) |
| Mülkler | Saatlik pasif gelir (bar, çamaşırhane, gece kulübü, kumarhane) |
| Banka | Saatlik faiz; dövüşte kaybedilmez |
| Sıralama | Rütbe, servet, indirilen, suç × günlük / haftalık / tüm zamanlar |
| Malikane | Profil, istatistik, günlük ödül, elmas harcamaları, premium üyelik |

Rütbeler: Serseri → Sokak Haydudu → Tetikçi → Kabadayı → Soldato → Capo → Consigliere → Underboss → Boss → Godfather

## Oyun adı
`src/config/game.ts` içindeki `GAME_NAME` ve `public/manifest.webmanifest` değiştirilerek oyunun adı değiştirilir.

## Sonraki aşamalar (henüz yok)
Çok oyunculu sunucu (NestJS + PostgreSQL + Redis), gerçek PvP, aileler, sohbet, bildirimler,
gerçek ödeme, admin paneli, Docker ile kurulum. `src/engine` sunucuya taşınacak şekilde arayüzden bağımsız yazıldı.
