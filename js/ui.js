// Arayüz: üst gösterge, bina panelleri, bildirimler.
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let current = null;       // açık panel id
let lastResult = null;    // panelde gösterilen son sonuç
const inputs = {};        // panel giriş değerleri (yeniden çizimde korunur)

const EXTRA_PANELS = {
  envanter: { name: 'Çanta', icon: '🎒', desc: 'Silahların, arabaların ve malların.' },
  gunluk: { name: 'Günlük', icon: '📜', desc: 'Son olanlar.' },
  hosgeldin: { name: 'Valkiew', icon: '🕴️', desc: 'Mafya şehrine hoş geldin.' },
};

function pctClass(p) { return p >= 0.7 ? 'hi' : p >= 0.45 ? 'mid' : 'lo'; }
function pct(p) { return `<span class="pct ${pctClass(p)}">%${Math.round(p * 100)}</span>`; }
function lockTag(minRank) { return `🔒 ${RANKS[minRank].name}`; }
function cdBtn(key, label, act, extra = '') {
  const left = cdLeft(key);
  return `<button class="btn" data-act="${act}" ${extra} ${left ? 'disabled' : ''}>${left ? '⏳ ' + fmtTime(left) : label}</button>`;
}
function val(key, def = '') { return inputs[key] ?? def; }

// ---- paneller ----
const PANELS = {
  meyhane() {
    let h = `<p class="note">Her işin bir riski var. Yakalanırsan hapse düşersin. Enerjin: <b>${S.energy}/${maxEnergy()}</b></p>`;
    for (const c of CRIMES) {
      const locked = rank() < c.minRank;
      const m = c.money.map(x => money(x * city().mod)).join(' – ');
      h += `<div class="row ${locked ? 'locked' : ''}"><div class="info">
        <div class="t">${c.name}</div><div class="d">${c.desc}</div>
        <div class="tags"><span>⚡ <b>${c.energy}</b></span><span>💵 <b>${m}</b></span><span>⭐ <b>${c.xp}</b></span><span>Başarı ${pct(crimeChance(c))}</span></div>
      </div>${locked ? `<button class="btn" disabled>${lockTag(c.minRank)}</button>` : cdBtn('crime_' + c.id, 'İşle', 'crime', `data-id="${c.id}"`)}</div>`;
    }
    return h;
  },

  garaj() {
    let h = `<div class="row"><div class="info"><div class="t">Araba çal</div>
      <div class="d">Sokaktaki arabalardan birini gözüne kestir. Pahalı arabalar daha zor.</div>
      <div class="tags"><span>⚡ <b>10</b></span><span>Garaj <b>${S.cars.length}/${garageCap()}</b></span></div></div>
      ${cdBtn('car', 'Çal', 'steal')}</div>`;
    h += `<h3>Garajın</h3>`;
    if (!S.cars.length) h += `<div class="empty">Garajın boş.</div>`;
    S.cars.forEach((c, i) => {
      const car = CARS[c.i];
      h += `<div class="row"><span style="font-size:22px">🚘</span><div class="info"><div class="t">${car.name}</div>
        <div class="tags"><span>Hasar <b>%${c.dmg}</b></span><span>Değer <b>${money(carValue(c))}</b></span></div></div>
        <button class="btn sec sm" data-act="sellcar" data-i="${i}">Sat</button></div>`;
    });
    if (S.cars.length > 1) h += `<button class="btn" style="width:100%" data-act="sellall">Hepsini sat (${money(S.cars.reduce((a, c) => a + carValue(c), 0))})</button>`;
    return h;
  },

  silahci() {
    let h = `<h3>Mermi · ${S.ammo} adet</h3><div class="grid3">`;
    for (const n of [10, 50, 250]) h += `<button class="btn sec" data-act="ammo" data-n="${n}">+${n}<br><small>${money(n * bulletPrice())}</small></button>`;
    h += `</div><p class="note">Ateşli silahlar mermi olmadan çok zayıflar. Her dövüş 3-8 mermi harcar.</p><h3>Silahlar</h3>`;
    WEAPONS.forEach((w, i) => {
      const owned = S.weapons.includes(i), locked = rank() < w.minRank;
      const btn = S.weapon === i ? `<button class="btn sec" disabled>Kuşanıldı</button>`
        : owned ? `<button class="btn sec" data-act="weapon" data-i="${i}">Kuşan</button>`
        : locked ? `<button class="btn" disabled>${lockTag(w.minRank)}</button>`
        : `<button class="btn" data-act="weapon" data-i="${i}">${money(w.price * city().mod)}</button>`;
      h += `<div class="row ${S.weapon === i ? 'active' : ''} ${locked && !owned ? 'locked' : ''}"><div class="info"><div class="t">${w.name}</div>
        <div class="tags"><span>Saldırı <b>+${w.atk}</b></span>${w.ammo ? '<span>🔫 Mermi kullanır</span>' : ''}</div></div>${btn}</div>`;
    });
    h += `<h3>Zırhlar</h3>`;
    ARMORS.forEach((a, i) => {
      const owned = S.armors.includes(i), locked = rank() < a.minRank;
      const btn = S.armor === i ? `<button class="btn sec" disabled>Giyildi</button>`
        : owned ? `<button class="btn sec" data-act="armor" data-i="${i}">Giy</button>`
        : locked ? `<button class="btn" disabled>${lockTag(a.minRank)}</button>`
        : `<button class="btn" data-act="armor" data-i="${i}">${money(a.price * city().mod)}</button>`;
      h += `<div class="row ${S.armor === i ? 'active' : ''} ${locked && !owned ? 'locked' : ''}"><div class="info"><div class="t">${a.name}</div>
        <div class="tags"><span>Savunma <b>+${a.def}</b></span></div></div>${btn}</div>`;
    });
    return h;
  },

  hastane() {
    const mh = maxHealth();
    let h = `<div class="big"><div class="n">❤️ ${S.health} / ${mh}</div></div>
      <div class="hpbar"><i style="width:${S.health / mh * 100}%"></i></div>`;
    if (hospLeft()) {
      h += `<div class="result bad">Yoğun bakımdasın. Taburcu olmana <b>${fmtTime(hospLeft())}</b> var.</div>
        <button class="btn" style="width:100%" data-act="hospskip">Özel doktor çağır (3 💎)</button>`;
    } else {
      h += `<button class="btn" style="width:100%" data-act="heal" ${S.health >= mh ? 'disabled' : ''}>
        ${S.health >= mh ? 'Sapasağlamsın' : 'Tedavi ol · ' + money(healCost())}</button>
        <p class="note">Can kendiliğinden de yavaşça dolar (20 sn'de 1).</p>`;
    }
    return h;
  },

  hapishane() {
    if (!jailLeft()) {
      return `<div class="big"><div class="n">🕊️</div></div><div class="result info">Şu an özgürsün. Böyle kalmaya bak.</div>
        <div class="grid2"><div class="stat"><div class="k">Toplam hapis</div><div class="v">${S.stats.jailed}</div></div>
        <div class="stat"><div class="k">Başarısız iş</div><div class="v">${S.stats.crimeFail}</div></div></div>`;
    }
    return `<div class="big"><div class="k">Kalan ceza</div><div class="n">⛓️ ${fmtTime(jailLeft())}</div></div>
      <div class="grid2">
        <button class="btn" data-act="bribe">Rüşvet · ${money(bribeCost())}</button>
        <button class="btn" data-act="bribegem">Avukat · 3 💎</button>
      </div>
      <div style="margin-top:8px">${cdBtn('escape', 'Firar et (riskli)', 'escape', 'style="width:100%"').replace('class="btn"', 'class="btn red"')}</div>
      <p class="note">Firar şansı çevikliğine bağlı. Yakalanırsan cezana 30 sn eklenir.</p>`;
  },

  banka() {
    return `<div class="grid2"><div class="stat"><div class="k">Üzerindeki</div><div class="v">${money(S.money)}</div></div>
      <div class="stat"><div class="k">Bankada</div><div class="v">${money(S.bank)}</div></div></div>
      <p class="note">Bankadaki para güvende ve saatte %${INTEREST_RATE * 100} faiz getirir.</p>
      <div class="inline"><input class="input" type="number" inputmode="numeric" min="1" placeholder="Miktar" data-key="bank" value="${esc(val('bank'))}"></div>
      <div class="grid2" style="margin-bottom:8px"><button class="btn" data-act="deposit">Yatır</button><button class="btn sec" data-act="withdraw">Çek</button></div>
      <div class="grid2"><button class="btn sec" data-act="depall">Tümünü yatır</button><button class="btn sec" data-act="wdall">Tümünü çek</button></div>`;
  },

  kumarhane() {
    const bet = val('bet', String(Math.min(100, maxBet())));
    return `<p class="note">En yüksek bahis (rütbene göre): <b>${money(maxBet())}</b> · Üzerindeki: <b>${money(S.money)}</b></p>
      <div class="inline"><input class="input" type="number" inputmode="numeric" min="1" data-key="bet" value="${esc(bet)}">
        <button class="btn sec sm" data-act="betx" data-f="0.5">½</button><button class="btn sec sm" data-act="betx" data-f="2">2×</button></div>
      <h3>🪙 Yazı Tura · 2×</h3><div class="grid2"><button class="btn" data-act="gamble" data-g="yazitura" data-p="yazi">Yazı</button><button class="btn" data-act="gamble" data-g="yazitura" data-p="tura">Tura</button></div>
      <h3>🎲 Zar · Kasadan yüksek at, 2×</h3><button class="btn" style="width:100%" data-act="gamble" data-g="zar">Zar at</button>
      <h3>🎡 Rulet</h3><div class="grid3">
        <button class="btn red" data-act="gamble" data-g="rulet" data-p="kirmizi">Kırmızı 2×</button>
        <button class="btn sec" data-act="gamble" data-g="rulet" data-p="siyah">Siyah 2×</button>
        <button class="btn" style="background:linear-gradient(180deg,#5fd58f,#2f9a5c);color:#062a14" data-act="gamble" data-g="rulet" data-p="yesil">Yeşil 14×</button></div>`;
  },

  spor() {
    const items = [['str', 'Güç', '💪', 'Dövüşte vuruş gücü'], ['def', 'Savunma', '🛡️', 'Darbelere dayanıklılık'], ['agi', 'Çeviklik', '🏃', 'Suç, araba ve firar şansı']];
    let h = `<div class="big"><div class="k">Toplam güç</div><div class="n">${num(power())}</div></div>`;
    for (const [k, n, ic, d] of items) {
      h += `<div class="row"><span style="font-size:22px">${ic}</span><div class="info"><div class="t">${n}: ${S[k]}</div><div class="d">${d}</div>
        <div class="tags"><span>⚡ <b>8</b></span><span>💵 <b>${money(trainCost(k))}</b></span></div></div>
        ${cdBtn('train', 'Çalış', 'train', `data-s="${k}"`)}</div>`;
    }
    return h;
  },

  havalimani() {
    let h = `<p class="note">Her şehirde kazançlar ve fiyatlar farklı. Uçuşlar arası 1 dk bekleme var.</p>`;
    for (const c of CITIES) {
      const here = c.id === S.city, locked = rank() < c.minRank;
      const btn = here ? `<button class="btn sec" disabled>Buradasın</button>`
        : locked ? `<button class="btn" disabled>${lockTag(c.minRank)}</button>`
        : cdBtn('travel', `Uç · ${money(Math.max(c.price, 300))}`, 'travel', `data-id="${c.id}"`);
      h += `<div class="row ${here ? 'active' : ''} ${locked ? 'locked' : ''}"><span style="font-size:22px">${here ? '📍' : '🌆'}</span>
        <div class="info"><div class="t">${c.name}</div><div class="tags"><span>Kazanç çarpanı <b>×${c.mod.toFixed(2)}</b></span></div></div>${btn}</div>`;
    }
    return h;
  },

  karaborsa() {
    let h = `<p class="note">Fiyatlar her 10 dakikada bir ve şehirden şehre değişir. Sonraki değişim: <b>${fmtTime(priceChangeIn())}</b><br>
      Depo: <b>${goodsCount()}/${goodsCap()}</b></p>
      <div class="inline"><span class="note" style="margin:0">Adet</span><input class="input" type="number" inputmode="numeric" min="1" data-key="qty" value="${esc(val('qty', '1'))}"></div>`;
    for (const g of GOODS) {
      const p = goodPrice(g), have = S.goods[g.id] || 0;
      const trend = p < g.base * 0.85 ? '🟢 ucuz' : p > g.base * 1.15 ? '🔴 pahalı' : '⚪ normal';
      h += `<div class="row"><div class="info"><div class="t">${g.name}</div>
        <div class="tags"><span>Alış <b>${money(p)}</b></span><span>Satış <b>${money(goodSellPrice(g))}</b></span><span>${trend}</span><span>Sende <b>${have}</b></span></div></div>
        <button class="btn sm" data-act="buygood" data-id="${g.id}">Al</button><button class="btn sec sm" data-act="sellgood" data-id="${g.id}" ${have ? '' : 'disabled'}>Sat</button></div>`;
    }
    return h;
  },

  arkasokak() {
    const w = WEAPONS[S.weapon];
    let h = `<div class="grid2"><div class="stat"><div class="k">Gücün</div><div class="v">${num(power())}</div></div>
      <div class="stat"><div class="k">Can / Mermi</div><div class="v">${S.health} · ${S.ammo}</div></div></div>
      <p class="note">${w ? `Silahın: <b>${w.name}</b>${w.ammo && !S.ammo ? ' — <span style="color:#ffb0b3">mermin yok, silah zayıf!</span>' : ''}` : 'Silahın yok. Silahçıya uğra.'} Her dövüş ⚡10 harcar.</p>`;
    RIVALS.forEach((r, i) => {
      const locked = rank() < r.minRank;
      h += `<div class="row ${locked ? 'locked' : ''}"><div class="info"><div class="t">${r.name}</div>
        <div class="tags"><span>Güç <b>${r.power}</b></span><span>💵 <b>${money(r.money[0] * city().mod)}+</b></span><span>Kazanma ${pct(winChance(r))}</span></div></div>
        ${locked ? `<button class="btn" disabled>${lockTag(r.minRank)}</button>` : cdBtn('attack', 'Saldır', 'attack', `data-i="${i}"`).replace('class="btn"', 'class="btn red"')}</div>`;
    });
    return h;
  },

  malikane() {
    const r = rank(), next = RANKS[r + 1];
    const prog = next ? (S.xp - RANKS[r].xp) / (next.xp - RANKS[r].xp) : 1;
    let h = `<div class="big"><div class="k">${esc(S.name)}</div><div class="n" style="color:var(--gold)">${RANKS[r].name}</div>
      <div class="note" style="margin:2px">${num(S.xp)} XP${next ? ` · sonraki: ${next.name} (${num(next.xp)})` : ' · zirvedesin'}</div></div>
      <div class="hpbar"><i style="width:${prog * 100}%;background:linear-gradient(90deg,var(--gold-d),var(--gold))"></i></div>
      <div class="grid2" style="margin-bottom:8px">
        ${dailyLeft() ? `<button class="btn" disabled>🎁 ${fmtTime(dailyLeft())}</button>` : `<button class="btn" data-act="daily">🎁 Günlük haraç</button>`}
        <button class="btn sec" data-act="refill">⚡ Enerji doldur (5 💎)</button></div>
      <h3>Durum</h3><div class="grid3">
        <div class="stat"><div class="k">Nakit</div><div class="v" style="font-size:15px">${money(S.money)}</div></div>
        <div class="stat"><div class="k">Banka</div><div class="v" style="font-size:15px">${money(S.bank)}</div></div>
        <div class="stat"><div class="k">Güç</div><div class="v" style="font-size:15px">${num(power())}</div></div>
        <div class="stat"><div class="k">Güç/Sav/Çev</div><div class="v" style="font-size:15px">${S.str}/${S.def}/${S.agi}</div></div>
        <div class="stat"><div class="k">Suç</div><div class="v" style="font-size:15px">${S.stats.crimes}</div></div>
        <div class="stat"><div class="k">Galibiyet</div><div class="v" style="font-size:15px">${S.stats.wins}</div></div>
        <div class="stat"><div class="k">Çalınan araba</div><div class="v" style="font-size:15px">${S.stats.carsStolen}</div></div>
        <div class="stat"><div class="k">Hapis</div><div class="v" style="font-size:15px">${S.stats.jailed}</div></div>
        <div class="stat"><div class="k">Toplam kazanç</div><div class="v" style="font-size:15px">${money(S.stats.earned)}</div></div>
      </div>
      <h3>Rütbeler</h3>`;
    RANKS.forEach((k, i) => {
      h += `<div class="row ${i === r ? 'active' : ''} ${i > r ? 'locked' : ''}" style="padding:7px 12px;margin-bottom:5px">
        <div class="info"><span class="t">${i + 1}. ${k.name}</span></div><span class="note" style="margin:0">${num(k.xp)} XP</span></div>`;
    });
    h += `<button class="btn sec" style="width:100%;margin-top:10px" data-act="reset">Oyunu sıfırla</button>`;
    return h;
  },

  envanter() {
    const w = WEAPONS[S.weapon], a = ARMORS[S.armor];
    let h = `<h3>Kuşanılan</h3><div class="grid2">
      <div class="stat"><div class="k">Silah</div><div class="v" style="font-size:15px">${w ? w.name : '—'}</div></div>
      <div class="stat"><div class="k">Zırh</div><div class="v" style="font-size:15px">${a ? a.name : '—'}</div></div></div>
      <h3>Arabalar (${S.cars.length})</h3>`;
    h += S.cars.length ? S.cars.map(c => `<div class="row"><div class="info"><div class="t">${CARS[c.i].name}</div><div class="tags"><span>Hasar <b>%${c.dmg}</b></span><span>Değer <b>${money(carValue(c))}</b></span></div></div></div>`).join('') : '<div class="empty">Araba yok.</div>';
    h += `<h3>Mallar (${goodsCount()}/${goodsCap()})</h3>`;
    const g = GOODS.filter(x => S.goods[x.id]);
    h += g.length ? g.map(x => `<div class="row"><div class="info"><div class="t">${x.name}</div></div><b>${S.goods[x.id]} adet</b></div>`).join('') : '<div class="empty">Depo boş.</div>';
    return h;
  },

  gunluk() {
    if (!S.log.length) return '<div class="empty">Henüz bir şey olmadı.</div>';
    return S.log.map(l => {
      const d = new Date(l.t);
      return `<div class="log-item ${l.type}"><time>${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</time><span>${esc(l.text)}</span></div>`;
    }).join('');
  },

  hosgeldin() {
    return `<div class="welcome"><div class="logo">🌃</div><h1>VALKIEW</h1>
      <p>Sokaklardan başla, şehrin babası ol. Suç işle, araba çal, rakiplerini alt et.</p>
      <input class="input" id="name-in" maxlength="16" placeholder="Takma adın" data-key="name" value="${esc(val('name'))}" style="text-align:center;margin-bottom:10px">
      <button class="btn" style="width:100%" data-act="start">Şehre gir</button></div>`;
  },
};

// ---- aksiyonlar ----
function act(el) {
  const a = el.dataset.act, d = el.dataset;
  let r = null;
  switch (a) {
    case 'crime': r = doCrime(d.id); break;
    case 'steal': r = stealCar(); break;
    case 'sellcar': r = sellCar(+d.i); break;
    case 'sellall': {
      let total = 0; while (S.cars.length) { total += carValue(S.cars[0]); sellCar(0); }
      r = R(true, `Tüm arabalar satıldı: +${money(total)}`); break;
    }
    case 'weapon': r = buyWeapon(+d.i); break;
    case 'armor': r = buyArmor(+d.i); break;
    case 'ammo': r = buyAmmo(+d.n); break;
    case 'heal': r = heal(); break;
    case 'hospskip': r = hospitalSkip(); break;
    case 'bribe': r = bribe(false); break;
    case 'bribegem': r = bribe(true); break;
    case 'escape': r = escape(); break;
    case 'deposit': r = deposit(+val('bank')); break;
    case 'withdraw': r = withdraw(+val('bank')); break;
    case 'depall': r = deposit(S.money); break;
    case 'wdall': r = withdraw(S.bank); break;
    case 'betx': inputs.bet = String(Math.max(1, Math.min(maxBet(), Math.floor((+val('bet') || 0) * +d.f)))); break;
    case 'gamble': r = gamble(d.g, +val('bet'), d.p); break;
    case 'train': r = train(d.s); break;
    case 'travel': r = travel(d.id); break;
    case 'buygood': r = buyGood(d.id, +val('qty', '1')); break;
    case 'sellgood': r = sellGood(d.id, +val('qty', '1')); break;
    case 'attack': r = attack(+d.i); break;
    case 'daily': r = claimDaily(); break;
    case 'refill': r = refillEnergy(); break;
    case 'reset':
      if (confirm('Tüm ilerlemen silinecek. Emin misin?')) { resetSave(); location.reload(); }
      return;
    case 'start': {
      const n = (val('name') || '').trim().slice(0, 16) || 'İsimsiz';
      S = newState(n);
      log(`${n} şehre ayak bastı.`, 'info');
      save(); current = null; closePanel(); updateHUD();
      toast(`Hoş geldin, ${n}! Meyhaneden ilk işini al.`, 'info');
      setTimeout(() => CityMap.focus('meyhane'), 300);
      return;
    }
  }
  if (r) {
    lastResult = r;
    if (!current) toast(r.msg, r.type); // panel açıkken sonuç zaten panelde görünüyor
  }
  if (pendingLevel) { toast(`⭐ Yeni rütbe: ${pendingLevel}! +5 💎`, 'level'); pendingLevel = null; }
  save();
  updateHUD();
  renderPanel();
}

// ---- panel yönetimi ----
function openPanel(id) {
  if (!S && id !== 'hosgeldin') return;
  const b = BUILDINGS.find(x => x.id === id) || EXTRA_PANELS[id];
  if (!b) return;
  current = id; lastResult = null;
  $('p-icon').textContent = b.icon;
  $('p-title').textContent = b.name + (BUILDINGS.includes(b) && S ? ` · ${city().name}` : '');
  $('p-desc').textContent = b.desc;
  $('panel').hidden = false;
  renderPanel();
  $('p-body').scrollTop = 0;
}
function closePanel() {
  if (current === 'hosgeldin') return;
  $('panel').hidden = true; current = null;
}
function renderPanel() {
  if (!current) return;
  const body = $('p-body');
  const st = body.scrollTop;
  let html = PANELS[current]();
  if (lastResult) html = `<div class="result ${lastResult.type}">${esc(lastResult.msg)}</div>` + html;
  if (body._html === html) return;
  body._html = html;
  // Sadece değişen satırları değiştir: tıklanan düğmeler DOM'dan kopmasın
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const next = [...tpl.content.childNodes], prev = [...body.childNodes];
  if (next.length !== prev.length) { body.replaceChildren(...next); body.scrollTop = st; return; }
  next.forEach((n, i) => {
    const o = prev[i];
    if (o.nodeType !== n.nodeType || (n.nodeType === 1 ? o.outerHTML !== n.outerHTML : o.textContent !== n.textContent)) o.replaceWith(n);
  });
  body.scrollTop = st;
}

// ---- gösterge ----
function updateHUD() {
  if (!S) return;
  const r = rank(), next = RANKS[r + 1];
  $('h-rank').textContent = RANKS[r].name;
  $('h-xp').style.width = (next ? (S.xp - RANKS[r].xp) / (next.xp - RANKS[r].xp) * 100 : 100) + '%';
  $('h-energy').textContent = `${S.energy}/${maxEnergy()}`;
  $('h-health').textContent = `${S.health}/${maxHealth()}`;
  $('h-health').parentElement.classList.toggle('low', S.health < maxHealth() * 0.3);
  $('h-ammo').textContent = num(S.ammo);
  $('h-city').textContent = city().name;
  $('h-money').textContent = money(S.money);
  $('h-gems').textContent = num(S.gems);
  const st = $('status');
  if (jailLeft()) {
    st.hidden = false; st.className = ''; st.dataset.open = 'hapishane';
    st.textContent = `⛓️ Hapistesin · ${fmtTime(jailLeft())}`;
  } else if (hospLeft()) {
    st.hidden = false; st.className = 'hosp'; st.dataset.open = 'hastane';
    st.textContent = `🏥 Hastanedesin · ${fmtTime(hospLeft())}`;
  } else st.hidden = true;
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  const box = $('toasts');
  box.prepend(el);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, type === 'level' ? 3500 : 2200);
}

// ---- olaylar ----
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-open],[data-close],[data-zoom],[data-fit]');
  if (!t) { if (e.target.id === 'panel') closePanel(); return; }
  if (t.dataset.act) { if (!t.disabled) act(t); return; }
  if (t.dataset.open) { openPanel(t.dataset.open); if (BUILDINGS.some(b => b.id === t.dataset.open)) CityMap.focus(t.dataset.open); return; }
  if ('close' in t.dataset) { closePanel(); return; }
  if (t.dataset.zoom) { CityMap.zoomBy(+t.dataset.zoom); return; }
  if ('fit' in t.dataset) CityMap.fit();
});
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.key;
  if (k) inputs[k] = e.target.value;
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePanel();
  if (e.key === 'Enter' && current === 'hosgeldin') act({ dataset: { act: 'start' } });
});

// ---- başlat ----
S = load();
CityMap.start(b => openPanel(b.id));
if (S) { tick(); updateHUD(); } else openPanel('hosgeldin');

setInterval(() => {
  if (!S) return;
  tick(); updateHUD();
  // giriş kutusuna yazı yazılırken paneli yeniden çizme
  const a = document.activeElement;
  if (current && !(a && a.tagName === 'INPUT' && $('panel').contains(a))) renderPanel();
  if (Date.now() % 10000 < 1000) save();
}, 1000);
window.addEventListener('beforeunload', () => { if (S) save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && S) save(); });
