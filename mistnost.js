// Místnost Herny: jeden odkaz #m=<id> pro všechny hry. Protokol s hrami: react-apps/HERNA-PROTOKOL.md.
// Dokument na mantledb.sh (bez účtu, CORS) herna-<id>/mistnost: { app, v, s0, s1, u, g }
// v = počítadlo zápisů (každý zápis nejdřív znovu načte), s0 / s1 = token zařízení na sedadle ("" = volné), u = čas zápisu.
// g = { n: [jméno0, jméno1], hra: null | { id, kdo, k, h }, sk: [body0, body1], log: [{ p, g, w, t }] }
// hra.kdo = sedadlo, které hru vybralo, hra.k roste s každou volbou (z něj je místnost hry), hra.h = hash výzvy hry bez protokolu.
// log = poslední partie: p = klíč partie od hry, g = id hry, w = vítězné sedadlo (-1 remíza).
(function () {
  var H = window.Herna;
  if (!H) return;
  var API = "https://mantledb.sh/v2/";
  var RE_M = /^#m=([0-9a-z]{10})$/;
  var esc = H.esc;
  var $ = function (id) { return document.getElementById(id); };
  var koren = document.documentElement;

  function nacti(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function uloz(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function randId(n) {
    return Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(n)), function (b) { return (b % 36).toString(36); }).join("");
  }
  var DEV = nacti("herna.zarizeni") || randId(16);
  uloz("herna.zarizeni", DEV);

  // ---------- síť ----------
  function req(url, opt) {
    opt = opt || {};
    var ac = new AbortController(), t = setTimeout(function () { ac.abort(); }, 10000);
    opt.cache = "no-store"; opt.signal = ac.signal;
    return fetch(url, opt).finally(function () { clearTimeout(t); });
  }
  function docUrl(id) { return API + "herna-" + id + "/mistnost"; }
  function nactiDoc(id) {
    return req(docUrl(id)).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("load " + r.status);
      return r.json();
    });
  }
  function ulozDoc(id, d) {
    d.u = Date.now();
    return req(docUrl(id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) })
      .then(function (r) { if (!r.ok) throw new Error("save " + r.status); return d; });
  }

  // Kontrola všeho, co přijde ze sítě. Neplatný dokument = null.
  function jmeno(s) { return typeof s === "string" ? s.trim().slice(0, 16) : ""; }
  function cislo(n, max) { return typeof n === "number" && n >= 0 && n % 1 === 0 ? Math.min(n, max) : 0; }
  function platnyHash(h) { return typeof h === "string" && /^#[0-9A-Za-z._~=&%,-]{1,200}$/.test(h) && h !== "#solo" && h.indexOf("#herna=") !== 0; }
  function dekoduj(d) {
    if (!d || d.app !== "herna" || !d.g || !Array.isArray(d.g.n)) return null;
    var g = d.g, n = [jmeno(g.n[0]), jmeno(g.n[1])];
    if (!n[0] || !n[1]) return null;
    var hra = null;
    if (g.hra && typeof g.hra.id === "string" && H.hra(g.hra.id)) {
      hra = { id: g.hra.id, kdo: g.hra.kdo === 1 ? 1 : 0, k: cislo(g.hra.k, 1e6), h: platnyHash(g.hra.h) ? g.hra.h : "" };
    }
    var sk = Array.isArray(g.sk) ? [cislo(g.sk[0], 9999), cislo(g.sk[1], 9999)] : [0, 0];
    var log = (Array.isArray(g.log) ? g.log : []).filter(function (x) {
      return x && typeof x.p === "string" && typeof x.g === "string" && (x.w === 0 || x.w === 1 || x.w === -1);
    }).slice(0, 30);
    return { v: cislo(d.v, 1e9), s0: typeof d.s0 === "string" ? d.s0 : "", s1: typeof d.s1 === "string" ? d.s1 : "", n: n, hra: hra, sk: sk, log: log };
  }

  // Zápis: znovu načíst, upravit, uložit s v + 1. zmena(d) upraví syrový dokument a vrátí false, když není co měnit.
  function zapis(zmena) {
    var id = mid;
    return nactiDoc(id).then(function (d) {
      if (!dekoduj(d)) throw new Error("doc");
      if (zmena(d) === false) return d;
      d.v = (d.v || 0) + 1;
      return ulozDoc(id, d);
    }).then(function (d) { if (id === mid) aplikuj(d, true); return d; });
  }

  // ---------- stav ----------
  var mid = null;       // id místnosti
  var stav = null;      // dekódovaný dokument
  var seat = null;      // 0 | 1 | null (ještě nevstoupil)
  var ram = { id: null, k: -1, protokol: null, h: "" };   // hra v rámu
  var faze = null, fazeK = -1;   // fáze hry z protokolu (ceka / hraje / konec) pro volbu k
  var ifr = null;

  function jmenoSedadla(s) { return stav ? stav.n[s] : ""; }
  function pamatujMistnost() {
    if (!stav || seat === null) return;
    var seznam = [];
    try { seznam = JSON.parse(nacti("herna.mistnosti")) || []; } catch (e) {}
    seznam = seznam.filter(function (x) { return x && x.id !== mid; });
    seznam.unshift({ id: mid, n: stav.n, sk: stav.sk, seat: seat, t: Date.now() });
    uloz("herna.mistnosti", JSON.stringify(seznam.slice(0, 5)));
  }
  function mojeMistnosti() {
    try { return (JSON.parse(nacti("herna.mistnosti")) || []).filter(function (x) { return x && RE_M.test("#m=" + x.id) && Array.isArray(x.n); }); } catch (e) { return []; }
  }

  // ---------- toast ----------
  var toastT = null;
  function toast(text) {
    var t = $("toast");
    t.textContent = text; t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; }, 2600);
  }

  // ---------- dialog ----------
  var dlg = $("dlg"), dlgZavritelny = true, dlgFokus = null;
  function otevriDialog(html, zavritelny) {
    dlgZavritelny = zavritelny !== false;
    if (dlg.hidden) dlgFokus = document.activeElement;
    dlg.querySelector(".dlg-obsah").innerHTML = html;
    dlg.hidden = false;
    koren.classList.add("panel-otevreny");
    requestAnimationFrame(function () { dlg.classList.add("je-otevreny"); });
    var f = dlg.querySelector("[autofocus], input, .tl");
    if (f) f.focus();
  }
  function zavriDialog() {
    if (dlg.hidden) return;
    dlg.classList.remove("je-otevreny");
    koren.classList.remove("panel-otevreny");
    setTimeout(function () { if (!dlg.classList.contains("je-otevreny")) dlg.hidden = true; }, 220);
    if (dlgFokus && dlgFokus.focus) dlgFokus.focus();
  }
  dlg.addEventListener("click", function (e) {
    if (e.target.closest("[data-dlg-zavri]") && dlgZavritelny) zavriDialog();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !dlg.hidden && dlgZavritelny) zavriDialog(); });

  function ikona(h) { return '<span class="dlg-ikona" style="--c:' + esc(h.barva) + '"><svg aria-hidden="true"><use href="#i-' + esc(h.ikona) + '"/></svg></span>'; }
  var IKONA_MISTNOSTI = '<span class="dlg-ikona"><svg aria-hidden="true"><use href="#i-mistnost"/></svg></span>';

  // Založení místnosti
  function dialogZalozit() {
    var ja = nacti("herna.jmeno") || "", on = nacti("herna.souper") || "";
    otevriDialog(
      IKONA_MISTNOSTI +
      '<h2 class="dlg-nadpis" id="dlg-nadpis">Založit místnost</h2>' +
      '<p class="dlg-text">Jeden odkaz pro všechny hry. Pošleš ho jednou, hru pak vybírá kdokoli z vás a skóre se sčítá.</p>' +
      '<form id="dlg-form" novalidate>' +
      '<label class="dlg-pole">Tvoje jméno<input name="ja" maxlength="16" autocomplete="nickname" required value="' + esc(ja) + '"></label>' +
      '<label class="dlg-pole">Koho zveš<input name="on" maxlength="16" autocomplete="off" required value="' + esc(on) + '"></label>' +
      '<div class="dlg-akce"><button class="tl" type="submit">Založit místnost</button>' +
      '<button class="tl tl-2" type="button" data-dlg-zavri>Zpět</button></div></form>'
    );
    var form = $("dlg-form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var n = [jmeno(form.ja.value), jmeno(form.on.value)];
      if (!n[0]) { form.ja.focus(); toast("Napiš svoje jméno."); return; }
      if (!n[1]) { form.on.focus(); toast("Napiš jméno soupeře."); return; }
      if (n[0].toLowerCase() === n[1].toLowerCase()) { form.on.focus(); toast("Jména se musí lišit."); return; }
      uloz("herna.jmeno", n[0]); uloz("herna.souper", n[1]);
      var tl = form.querySelector("[type=submit]");
      tl.disabled = true; tl.textContent = "Zakládám…";
      var id = randId(10);
      ulozDoc(id, { app: "herna", v: 1, s0: DEV, s1: "", g: { n: n, hra: null, sk: [0, 0], log: [] } })
        .then(function () {
          uloz("herna.m." + id, "0");
          noveZalozena = true;
          zavriDialog();
          location.hash = "#m=" + id;
        })
        .catch(function () { tl.disabled = false; tl.textContent = "Založit místnost"; toast("Spojení nevyšlo, zkus to znovu."); });
    });
  }
  var noveZalozena = false;

  function odkaz() { return location.origin + location.pathname + "#m=" + mid; }
  function dialogPozvat() {
    var sdilet = !!navigator.share && matchMedia("(pointer:coarse)").matches;
    otevriDialog(
      IKONA_MISTNOSTI +
      '<h2 class="dlg-nadpis" id="dlg-nadpis">Pošli pozvánku</h2>' +
      '<p class="dlg-text">Odkaz stačí poslat jednou, třeba do chatu. ' + esc(jmenoSedadla(1)) + ' ho otevře a vstoupí, hry pak vybíráte přímo tady.</p>' +
      '<code class="dlg-odkaz">' + esc(odkaz()) + '</code>' +
      '<div class="dlg-akce">' +
      (sdilet ? '<button class="tl" type="button" data-akce="sdilet">Poslat odkaz</button><button class="tl tl-2" type="button" data-akce="kopirovat">Zkopírovat</button>'
              : '<button class="tl" type="button" data-akce="kopirovat">Zkopírovat odkaz</button>') +
      '<button class="tl tl-2" type="button" data-dlg-zavri>Hotovo</button></div>'
    );
  }
  function kopiruj() {
    var url = odkaz();
    var hotovo = function () { toast("Odkaz je zkopírovaný, vlož ho do chatu."); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(hotovo, function () { toast("Odkaz označ a zkopíruj ručně."); });
    else toast("Odkaz označ a zkopíruj ručně.");
  }
  dlg.addEventListener("click", function (e) {
    var a = e.target.closest("[data-akce]");
    if (!a) return;
    var akce = a.getAttribute("data-akce");
    if (akce === "kopirovat") kopiruj();
    else if (akce === "sdilet") navigator.share({ title: "Herna", text: jmenoSedadla(0) + " tě zve do Herny", url: odkaz() }).catch(function () {});
    else if (akce === "vstoupit") vstoupit();
    else if (akce === "jsem0") dialogJsem(0);
    else if (akce === "jsem1") dialogJsem(1);
    else if (akce === "potvrdit0") prevzit(0);
    else if (akce === "potvrdit1") prevzit(1);
    else if (akce === "zpet-vstup") dialogVstup();
    else if (akce === "prepnout") { zavriDialog(); if (cekaPrepnuti) prepni(cekaPrepnuti); }
    else if (akce === "nova") { location.hash = ""; dialogZalozit(); }
  });

  // Pozvaný otevřel odkaz: přijmout pod svým jménem, nebo se přihlásit jako zakladatel (pojistka jako introMine ve hrách).
  function dialogVstup() {
    otevriDialog(
      IKONA_MISTNOSTI +
      '<h2 class="dlg-nadpis" id="dlg-nadpis">' + esc(jmenoSedadla(0)) + ' tě zve do Herny</h2>' +
      '<p class="dlg-text">Hrajete spolu všechny hry na tomhle odkazu. Hru vybírá kdokoli z vás, druhému se otevře sama a skóre se sčítá.</p>' +
      '<div class="dlg-akce"><button class="tl" type="button" data-akce="vstoupit" autofocus>Jsem ' + esc(jmenoSedadla(1)) + ', vstoupit</button>' +
      '<button class="tl tl-2" type="button" data-akce="jsem0">Tohle je moje místnost, jsem ' + esc(jmenoSedadla(0)) + '</button></div>',
      false
    );
  }
  // Obě místa obsazená a tohle zařízení neznáme: kdo jsi?
  function dialogKdo() {
    otevriDialog(
      IKONA_MISTNOSTI +
      '<h2 class="dlg-nadpis" id="dlg-nadpis">Kdo tu hraje?</h2>' +
      '<p class="dlg-text">V místnosti už sedí oba. Vyber, za koho hraješ v tomhle prohlížeči.</p>' +
      '<div class="dlg-akce"><button class="tl" type="button" data-akce="jsem0">Jsem ' + esc(jmenoSedadla(0)) + '</button>' +
      '<button class="tl" type="button" data-akce="jsem1">Jsem ' + esc(jmenoSedadla(1)) + '</button></div>',
      false
    );
  }
  function dialogJsem(s) {
    otevriDialog(
      IKONA_MISTNOSTI +
      '<h2 class="dlg-nadpis" id="dlg-nadpis">Hraješ tady jako ' + esc(jmenoSedadla(s)) + '?</h2>' +
      '<p class="dlg-text">V tomhle prohlížeči pak hraješ jako ' + esc(jmenoSedadla(s)) + ' ve všech hrách místnosti.' +
      (s === 0 && !stav.s1 ? " Místo pro druhého hráče zůstane volné." : "") + '</p>' +
      '<div class="dlg-akce"><button class="tl" type="button" data-akce="potvrdit' + s + '">Ano, jsem ' + esc(jmenoSedadla(s)) + '</button>' +
      '<button class="tl tl-2" type="button" data-akce="zpet-vstup">Zpět</button></div>',
      false
    );
  }
  function prevzit(s) {
    seat = s; uloz("herna.m." + mid, String(s));
    zavriDialog();
    vstoupeno(true);
  }
  function vstoupit() {
    var tl = dlg.querySelector('[data-akce="vstoupit"]');
    if (tl) { tl.disabled = true; tl.textContent = "Vstupuju…"; }
    var obsazeno = false;
    zapis(function (d) {
      if (d.s1 && d.s1 !== DEV) { obsazeno = true; return false; }
      if (d.s1 === DEV) return false;
      d.s1 = DEV;
    }).then(function () {
      if (obsazeno) { toast("Místo už zabral někdo jiný."); dialogKdo(); return; }
      prevzit(1);
    }).catch(function () {
      if (tl) { tl.disabled = false; tl.textContent = "Jsem " + jmenoSedadla(1) + ", vstoupit"; }
      toast("Spojení nevyšlo, zkus to znovu.");
    });
  }

  // ---------- vykreslení místnosti ----------
  function vykresliMistnost() {
    if (!stav) return;
    var j0 = $("sk-j0"), j1 = $("sk-j1");
    j0.textContent = stav.n[0]; j1.textContent = stav.n[1];
    j0.classList.toggle("je-ja", seat === 0); j1.classList.toggle("je-ja", seat === 1);
    [0, 1].forEach(function (s) {
      var b = $("sk-" + s), nove = String(stav.sk[s]);
      if (b.textContent !== nove) {
        var bylo = b.textContent !== "" && b.textContent !== nove && b.getAttribute("data-hotovo");
        b.textContent = nove;
        if (bylo) { b.classList.remove("bod"); void b.offsetWidth; b.classList.add("bod"); }
      }
      b.setAttribute("data-hotovo", "1");
    });
    document.querySelector(".skore").setAttribute("aria-label", stav.n[0] + " " + stav.sk[0] + ", " + stav.n[1] + " " + stav.sk[1]);
    var st = $("mist-stav"), poz = $("mist-pozvat");
    if (!stav.s1) { st.textContent = seat === 0 ? "Odkaz zatím nikdo neotevřel." : "Místnost čeká na druhého hráče."; poz.hidden = seat !== 0; }
    else { st.textContent = seat === null ? "V místnosti sedí oba." : "Hrajete spolu. Hru vybírá kdokoli z vás."; poz.hidden = true; }
    vykresliRamSkore();

    // Teď hrajete
    var ted = $("ted"), hra = stav.hra && H.hra(stav.hra.id);
    if (hra && seat !== null) {
      ted.style.setProperty("--c", hra.barva);
      ted.innerHTML = '<span class="ted-ikona" aria-hidden="true"><svg><use href="#i-' + esc(hra.ikona) + '"/></svg></span>' +
        '<div><p class="ted-stitek">Teď hrajete</p><p class="ted-nazev">' + esc(hra.nazev) + '</p></div>' +
        '<button class="tl" type="button" id="ted-hraj">Pokračovat</button>';
      ted.hidden = false;
    } else ted.hidden = true;
    oznacKarty();

    // Poslední partie
    var hist = $("historie");
    if (stav.log.length) {
      $("historie-seznam").innerHTML = stav.log.slice(0, 6).map(function (x) {
        var h = H.hra(x.g);
        return "<li><span>" + esc(h ? h.nazev : x.g) + "</span><span>" + (x.w === -1 ? "remíza" : esc(stav.n[x.w]) + " +1") + "</span></li>";
      }).join("");
      hist.hidden = false;
    } else hist.hidden = true;
  }
  function vykresliRamSkore() {
    if (!stav) return;
    $("ram-skore").innerHTML = '<span class="rs-jm">' + esc(stav.n[0]) + '</span><b>' + stav.sk[0] + '</b><i>:</i><b>' + stav.sk[1] + '</b><span class="rs-jm">' + esc(stav.n[1]) + "</span>";
    $("ram-skore").setAttribute("aria-label", "Skóre: " + stav.n[0] + " " + stav.sk[0] + ", " + stav.n[1] + " " + stav.sk[1]);
  }
  function oznacKarty() {
    if (!mid) return;
    var cur = stav && stav.hra ? stav.hra.id : null;
    Array.prototype.forEach.call(document.querySelectorAll("#hry .hra"), function (li) {
      var je = li.getAttribute("data-id") === cur && seat !== null;
      li.classList.toggle("je-ted", je);
    });
  }
  H.poVykresleni(oznacKarty);

  // ---------- přijetí změny z dokumentu ----------
  function aplikuj(d, vlastni) {
    var s = dekoduj(d);
    if (!s) return;
    if (stav && s.v === stav.v && !vlastni) return;
    var pred = stav;
    stav = s;
    if (!pred || s.v !== pred.v) zmenaT = Date.now();
    vykresliMistnost();
    if (seat === null) return;
    pamatujMistnost();
    var nova = s.hra && (!pred || !pred.hra || pred.hra.k !== s.hra.k || pred.hra.id !== s.hra.id || pred.hra.kdo !== s.hra.kdo);
    if (nova && pred && s.hra.kdo !== seat) { ukazVolbu(s.hra); return; }
    // Hra bez protokolu: výzva založená druhým hráčem se otevře i tady.
    if (!nova && s.hra && ram.id === s.hra.id && ram.k === s.hra.k && ram.protokol === false && s.hra.h && s.hra.h !== hashRamu()) nactiStarou(s.hra.h);
  }

  // ---------- dotazování ----------
  var pollT = null, zmenaT = Date.now();
  function interval() {
    var idle = Date.now() - zmenaT;
    if (document.hidden) return 20000;
    return idle < 5 * 60e3 ? 2500 : idle < 30 * 60e3 ? 8000 : 20000;
  }
  function poll(hned) {
    clearTimeout(pollT);
    var id = mid;
    if (!id) return;
    pollT = setTimeout(function () {
      nactiDoc(id).then(function (d) { if (id === mid) aplikuj(d); }).catch(function () {}).then(function () { if (id === mid) poll(); });
    }, hned ? 0 : interval());
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && mid) { zmenaT = Date.now(); poll(true); } });

  // ---------- výběr hry ----------
  var cekaPrepnuti = null;
  function vyber(id) {
    if (!stav || seat === null) return;
    var h = H.hra(id);
    if (!h || h.stav !== "hraj") return;
    var cur = stav.hra;
    if (cur && cur.id === id) { otevriHru(); return; }
    var znama = fazeK === (cur && cur.k) ? faze : null;
    // Neznámá fáze: u hry s protokolem (nebo dosud neověřené) se raději zeptáme, u staré hry jen když je výzva založená.
    var rozehrano = cur && (znama ? znama === "hraje" : !!cur.h || protokolCache[cur.id] !== false);
    if (!rozehrano) { prepni(id); return; }
    var stara = H.hra(cur.id);
    cekaPrepnuti = id;
    otevriDialog(
      ikona(h) +
      '<h2 class="dlg-nadpis" id="dlg-nadpis">Přepnout na ' + esc(h.nazev) + '?</h2>' +
      '<p class="dlg-text">' + esc(stara.nazev) + ' ještě běží. Rozehraná partie se nezapočítá a hra se přepne oběma.</p>' +
      '<div class="dlg-akce"><button class="tl" type="button" data-akce="prepnout">Přepnout</button>' +
      '<button class="tl tl-2" type="button" data-dlg-zavri>Hrát dál</button></div>'
    );
  }
  var prepina = false;
  function prepni(id) {
    if (prepina) return;
    prepina = true;
    zapis(function (d) {
      var k = (d.g.hra && typeof d.g.hra.k === "number" ? d.g.hra.k : 0) + 1;
      d.g.hra = { id: id, kdo: seat, k: k, h: "" };
    }).then(function () { prepina = false; otevriHru(); })
      .catch(function () { prepina = false; toast("Spojení nevyšlo, zkus to znovu."); });
  }

  // Karta „Mark chce hrát · Kafíčka“: jen mezi hrami, ne přes běžící hru.
  var volbaT = null;
  function ukazVolbu(hra) {
    var h = H.hra(hra.id), v = $("volba");
    zavriDialog();
    v.style.setProperty("--c", h.barva);
    v.querySelector(".volba-ikona").innerHTML = '<svg aria-hidden="true"><use href="#i-' + esc(h.ikona) + '"/></svg>';
    v.querySelector(".volba-kdo").textContent = jmenoSedadla(hra.kdo) + " chce hrát";
    v.querySelector(".volba-hra").textContent = h.nazev;
    v.hidden = false;
    requestAnimationFrame(function () { v.classList.add("je-videt"); });
    clearTimeout(volbaT);
    volbaT = setTimeout(function () {
      otevriHru();
      v.classList.remove("je-videt");
      volbaT = setTimeout(function () { v.hidden = true; }, 200);
    }, 1600);
  }

  // ---------- hra v rámu ----------
  var protokolCache = {};
  function umiProtokol(h) {
    if (protokolCache[h.id] !== undefined) return Promise.resolve(protokolCache[h.id]);
    return fetch(h.url, { cache: "no-cache" }).then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (t) { return /<meta[^>]+name=["']herna-protokol["'][^>]*content=["']1["']/i.test(t); })
      .catch(function () { return false; })
      .then(function (p) { protokolCache[h.id] = p; return p; });
  }
  function hashRamu() {
    try { return ifr && ifr.contentWindow ? ifr.contentWindow.location.hash : ram.h; } catch (e) { return ram.h; }
  }
  // Pro každou hru nový iframe: změna src by se zapsala do historie prohlížeče a tlačítko zpět by listovalo ve hře.
  function nastavSrc(url) {
    zrusIframe();
    ifr = document.createElement("iframe");
    ifr.setAttribute("allow", "clipboard-read; clipboard-write; fullscreen; autoplay");
    ifr.title = H.hra(ram.id).nazev;
    ifr.src = url;
    $("ram-ceka").hidden = true;
    $("ram-telo").appendChild(ifr);
  }
  function zrusIframe() { if (ifr) { ifr.remove(); ifr = null; } }
  function ukazCekani(h) {
    zrusIframe();
    var c = $("ram-ceka");
    c.style.setProperty("--c", h.barva);
    c.innerHTML = ikona(h) + "<h2>" + esc(jmenoSedadla(stav.hra.kdo)) + " zakládá partii</h2>" +
      "<p>Hra naskočí sama, jakmile bude výzva hotová. Pak ji jen přijmeš.</p>" +
      '<div class="tecky" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<p class="ram-dlouho skryte" id="ram-dlouho">Trvá to dlouho?</p>' +
      '<button class="tl tl-2 skryte" type="button" id="ram-sam">Nečekat a založit výzvu</button>';
    c.hidden = false;
    // Tlačítko až po chvíli: hned po výběru hry se čeká, jinak by vznikly dvě výzvy naráz.
    var jedn = c.innerHTML;
    setTimeout(function () {
      var d = $("ram-dlouho"), t = $("ram-sam");
      if (!d || !t || c.hidden || c.innerHTML !== jedn) return;
      d.classList.remove("skryte"); t.classList.remove("skryte");
    }, 12000);
  }
  function nactiStarou(hash) {
    var h = H.hra(ram.id);
    ram.h = hash;
    nastavSrc(h.url + hash);
  }
  function otevriHru() {
    if (!stav || !stav.hra || seat === null) return;
    var hra = stav.hra, h = H.hra(hra.id);
    ukazRam(h);
    if (ram.id === hra.id && ram.k === hra.k && ram.protokol !== null) return;   // hra už v rámu běží
    ram = { id: hra.id, k: hra.k, protokol: null, h: "" };
    faze = null; fazeK = hra.k;
    zrusIframe();
    umiProtokol(h).then(function (p) {
      if (ram.k !== hra.k || ram.id !== hra.id) return;
      ram.protokol = p;
      if (p) {
        nastavSrc(h.url + "#herna=1&m=" + mid + "&r=" + mid + "k" + hra.k + "&seat=" + seat +
          "&names=" + encodeURIComponent(stav.n[0]) + "," + encodeURIComponent(stav.n[1]) + "&zaklada=" + (hra.kdo === seat ? 1 : 0));
      } else if (stav.hra.h) nactiStarou(stav.hra.h);
      else if (hra.kdo === seat) nastavSrc(h.url);
      else ukazCekani(h);
    });
  }
  function ukazRam(h) {
    var r = $("ram");
    $("ram-nazev").textContent = h.nazev;
    vykresliRamSkore();
    if (r.hidden) {
      r.hidden = false;
      koren.classList.add("ram-otevreny");
      $("ram-zpet").focus();
    }
  }
  function skryjRam() {
    var r = $("ram");
    if (r.hidden) return;
    r.hidden = true;
    koren.classList.remove("ram-otevreny");
    vykresliMistnost();
  }
  function zpetDoMistnosti() { skryjRam(); }
  $("ram-zpet").addEventListener("click", zpetDoMistnosti);
  $("ram").addEventListener("click", function (e) {
    if (e.target.closest("#ram-sam")) nastavSrc(H.hra(ram.id).url);
  });

  // Hra bez protokolu: založená výzva (hash v rámu, stejný origin) se pošle druhému hráči.
  setInterval(function () {
    if (!stav || !stav.hra || ram.protokol !== false || ram.k !== stav.hra.k || !ifr) return;
    var hash;
    try { hash = ifr.contentWindow.location.hash; } catch (e) { return; }
    if (!platnyHash(hash) || hash === ram.h || hash === stav.hra.h) return;
    ram.h = hash;
    var k = ram.k;
    zapis(function (d) {
      if (!d.g.hra || d.g.hra.k !== k) return false;
      d.g.hra.h = hash;
    }).catch(function () { ram.h = ""; });
  }, 800);

  // Zprávy od hry (protokol verze 1)
  window.addEventListener("message", function (e) {
    if (!ifr || e.source !== ifr.contentWindow) return;
    var z = e.data;
    if (!z || typeof z !== "object" || z.herna !== 1 || typeof z.typ !== "string") return;
    if (z.typ === "pripraveno") ram.protokol = true;
    else if (z.typ === "stav" && /^(ceka|hraje|konec)$/.test(z.faze)) { faze = z.faze; fazeK = ram.k; }
    else if (z.typ === "vysledek") zapocti(z);
    else if (z.typ === "jina-hra") zpetDoMistnosti();
  });

  // Výsledek pošlou oba hráči. Zapisuje sedadlo 0, sedadlo 1 jen jako pojistka po chvíli, když zápis chybí.
  function zapocti(z) {
    var p = typeof z.partie === "string" ? z.partie.slice(0, 48) : "";
    if (!p || !stav) return;
    var w = z.vitez === 0 || z.vitez === 1 ? z.vitez : -1, g = ram.id;
    faze = "konec"; fazeK = ram.k;
    var pokus = function (zbyva) {
      if (stav.log.some(function (x) { return x.p === p; })) return;
      zapis(function (d) {
        var log = Array.isArray(d.g.log) ? d.g.log : [];
        if (log.some(function (x) { return x && x.p === p; })) return false;
        if (w >= 0) {
          var sk = Array.isArray(d.g.sk) ? d.g.sk : [0, 0];
          sk[w] = cislo(sk[w], 9999) + 1;
          d.g.sk = [cislo(sk[0], 9999), cislo(sk[1], 9999)];
        }
        log.unshift({ p: p, g: g, w: w, t: Date.now() });
        d.g.log = log.slice(0, 30);
      }).then(function () {
        // Kontrola, že zápis nepřepsal souběžný zápis druhého hráče.
        if (zbyva > 0) setTimeout(function () { nactiDoc(mid).then(function (d) { aplikuj(d); pokus(zbyva - 1); }).catch(function () {}); }, 1500);
      }).catch(function () { if (zbyva > 0) setTimeout(function () { pokus(zbyva - 1); }, 2000); });
    };
    setTimeout(function () { pokus(2); }, seat === 0 ? 0 : 4000);
  }

  // ---------- klik na hru v místnosti ----------
  document.addEventListener("click", function (e) {
    if (!mid || seat === null) return;
    if (e.target.closest("#ted-hraj")) { otevriHru(); return; }
    if (e.target.closest("#mist-pozvat")) { dialogPozvat(); return; }
    var a = e.target.closest("a[data-id]");
    if (!a || a.closest("#dlg")) return;
    e.preventDefault();
    if (a.classList.contains("panel-hraj")) H.zavriPanel();
    vyber(a.getAttribute("data-id"));
  }, true);

  // ---------- úvod: pás s místností ----------
  function vykresliPas() {
    var pas = $("pas"), m = mojeMistnosti()[0];
    pas.classList.toggle("pas-ma", !!m);
    if (m) {
      pas.innerHTML = '<span class="pas-ikona" aria-hidden="true"><svg><use href="#i-mistnost"/></svg></span>' +
        '<div class="pas-text"><p class="pas-stitek">Vaše místnost</p><p class="pas-nadpis">' + esc(m.n[0]) + " " + esc((m.sk || [0, 0])[0]) + " : " + esc((m.sk || [0, 0])[1]) + " " + esc(m.n[1]) + "</p>" +
        '<p class="pas-popis">Jeden odkaz pro všechny hry, skóre se sčítá.</p></div>' +
        '<div class="pas-akce"><a class="tl" href="#m=' + esc(m.id) + '">Vstoupit</a><button class="tl tl-2" type="button" id="pas-nova">Nová</button></div>';
    } else {
      pas.innerHTML = '<span class="pas-ikona" aria-hidden="true"><svg><use href="#i-mistnost"/></svg></span>' +
        '<div class="pas-text"><p class="pas-stitek">Hrajte spolu</p><p class="pas-nadpis">Místnost pro dva</p>' +
        '<p class="pas-popis">Jeden odkaz na všechny hry, skóre se sčítá.</p></div>' +
        '<div class="pas-akce"><button class="tl" type="button" id="pas-zalozit" aria-label="Založit místnost">Založit</button></div>';
    }
    pas.hidden = false;
  }
  $("pas").addEventListener("click", function (e) {
    if (e.target.closest("#pas-zalozit, #pas-nova")) dialogZalozit();
  });

  // ---------- start ----------
  function domu() {
    mid = null; stav = null; seat = null;
    clearTimeout(pollT);
    koren.classList.remove("v-mistnost");
    skryjRam();
    zrusIframe();
    ram = { id: null, k: -1, protokol: null, h: "" };
    $("ted").hidden = true; $("historie").hidden = true;
    oznacKarty();
    document.title = "Herna";
    vykresliPas();
  }
  function vstoupeno(prvni) {
    vykresliMistnost();
    pamatujMistnost();
    poll();
    if (noveZalozena && seat === 0) { noveZalozena = false; dialogPozvat(); }
    else if (prvni && stav.hra && stav.hra.kdo !== seat) ukazVolbu(stav.hra);
  }
  function otevriMistnost(id) {
    if (mid === id) return;
    domu();
    mid = id;
    koren.classList.add("v-mistnost");
    $("pas").hidden = true;
    $("mist-stav").textContent = "Načítám místnost…";
    $("sk-j0").textContent = ""; $("sk-j1").textContent = "";
    document.title = "Herna · místnost";
    nactiDoc(id).then(function (d) {
      if (mid !== id) return;
      var s = dekoduj(d);
      if (!s) {
        $("mist-stav").textContent = "Tahle místnost neexistuje nebo je poškozená.";
        otevriDialog(IKONA_MISTNOSTI + '<h2 class="dlg-nadpis" id="dlg-nadpis">Místnost nenalezena</h2>' +
          '<p class="dlg-text">Odkaz je neúplný, nebo místnost zmizela. Můžeš založit novou.</p>' +
          '<div class="dlg-akce"><button class="tl" type="button" data-akce="nova">Založit novou místnost</button>' +
          '<a class="tl tl-2" href="./">Do Herny</a></div>', false);
        return;
      }
      stav = s;
      var ul = nacti("herna.m." + id);
      if (ul === "0" || ul === "1") seat = +ul;
      else if (s.s0 === DEV) seat = 0;
      else if (s.s1 && s.s1 === DEV) seat = 1;
      if (seat !== null) { uloz("herna.m." + id, String(seat)); vstoupeno(false); return; }
      vykresliMistnost();
      poll();
      if (!s.s1) dialogVstup(); else dialogKdo();
    }).catch(function () {
      if (mid !== id) return;
      $("mist-stav").textContent = "Spojení nevyšlo. Zkus stránku obnovit.";
      setTimeout(function () { if (mid === id) { mid = null; otevriMistnost(id); } }, 4000);
    });
  }
  function start() {
    var m = RE_M.exec(location.hash);
    if (m) otevriMistnost(m[1]);
    else domu();
  }
  window.addEventListener("hashchange", start);
  H.poNacteni(start);
})();
