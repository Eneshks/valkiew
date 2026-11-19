# Valkiew – Mafya Şehri

Tarayıcıda oynanan, izometrik şehir haritalı mafya oyunu. Sokaklardan başla, şehrin babası ol.

## Oynamak
`index.html` dosyasını tarayıcıda aç. Kurulum gerekmez. İlerleme tarayıcıya (localStorage) kaydedilir.

## Mekânlar
| Bina | Ne işe yarar |
|---|---|
| 🥃 Meyhane | Suç işle (8 iş, rütbeyle açılır) |
| 🚗 Garaj | Araba çal, sat |
| 🔫 Silahçı | Silah, zırh, mermi |
| 💀 Arka Sokak | Rakiplerle dövüş |
| 🥊 Spor Salonu | Güç / savunma / çeviklik |
| 🏦 Banka | Parayı sakla, saatlik faiz |
| 🎰 Kumarhane | Yazı tura, zar, rulet |
| 📦 Karaborsa | 10 dakikada bir değişen fiyatlarla al-sat |
| ✈️ Havalimanı | 5 şehir, her biri farklı kazanç çarpanı |
| 🏥 Hastane / ⛓️ Hapishane | Tedavi, rüşvet, firar |
| 👑 Malikane | Profil, günlük ödül, enerji doldurma |

11 rütbe: Çaylak → Mafya Babası.

## Dosyalar
- `js/data.js` – oyun verileri (suçlar, silahlar, şehirler…)
- `js/state.js` – oyun mantığı ve kayıt
- `js/map.js` – kodla çizilen izometrik harita
- `js/ui.js` – arayüz ve paneller
