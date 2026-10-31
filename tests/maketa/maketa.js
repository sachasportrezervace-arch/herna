// Maketa hry pro test Herny. S <meta name="herna-protokol"> plní protokol (react-apps/HERNA-PROTOKOL.md), bez něj se chová
// jako stará hra: „Založit výzvu“ dá do adresy #r.<id>, druhý hráč výzvu přijme. Partie: kdo klikne „Vyhrát partii“, vyhrál.
// Dokument na mantledb: herna-maketa-<id>/hra { x, o, sx, so, seatX, n, w, v }.
(function () {
  var API = "https://mantledb.sh/v2/herna-maketa-";
  var PROTOKOL = !!document.querySelector('meta[name="herna-protokol"]');
  var el = document.getElementById("hra");
  var dev = localStorage.getItem("maketa-dev") || Math.random().toString(36).slice(2, 14);
  localStorage.setItem("maketa-dev", dev);
  var p = new URLSearchParams(location.hash.slice(1));
  var herna = PROTOKOL && p.get("herna") === "1" && /^[0-9a-z]{6,24}$/.test(p.get("r") || "");
  var id = null, ja = null, d = null, seat = 0, poslano = {}, faze = "";

  function doHerny(z) { if (herna && window.parent !== window) { z.herna = 1; window.parent.postMessage(z, "*"); } }
  function nacti() { return fetch(API + id + "/hra", { cache: "no-store" }).then(function (r) { return r.status === 404 ? null : r.json(); }); }
  function uloz(n) { n.v = (n.v || 0) + 1; return fetch(API + id + "/hra", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(n) }).then(function () { d = n; kresli(); }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function kresli() {
    if (!d) { el.innerHTML = herna ? "<h1>Maketa</h1><p id='m-stav'>Čeká se, až hra naskočí…</p>" : "<h1>Maketa</h1><button id='m-zalozit'>Založit výzvu</button>"; hlas("ceka"); return; }
    if (!ja) { el.innerHTML = "<h1>Maketa</h1><p>Výzva od " + esc(d.x) + "</p><button id='m-prijmout'>Přijmout výzvu</button>"; return; }
    var obe = d.sx && d.so, vit = d.w ? d[d.w] : "";
    el.innerHTML = "<h1>Maketa · partie " + d.n + "</h1><p id='m-ja'>Hraješ za " + esc(d[ja]) + "</p>" +
      "<p id='m-stav'>" + (!obe ? "Čeká se na soupeře" : vit ? "Vyhrál(a) " + esc(vit) : "Partie běží") + "</p>" +
      (obe && !d.w ? "<button id='m-vyhrat'>Vyhrát partii</button>" : "") +
      (d.w ? "<button id='m-odveta'>Odveta</button>" + (herna ? "<button class='d' id='m-jina'>Jiná hra</button>" : "") : "");
    hlas(!obe ? "ceka" : d.w ? "konec" : "hraje");
    if (d.w && obe) {
      var klic = id + ":" + d.n;
      if (!poslano[klic]) { poslano[klic] = 1; doHerny({ typ: "vysledek", partie: klic, vitez: d.w === "x" ? d.seatX : 1 - d.seatX }); }
    }
  }
  function hlas(f) { if (f !== faze) { faze = f; doHerny({ typ: "stav", faze: f }); } }

  el.addEventListener("click", function (e) {
    var t = e.target.id;
    if (t === "m-zalozit") {
      id = Math.random().toString(36).slice(2, 12);
      ja = "x"; localStorage.setItem("maketa-r-" + id, "x");
      uloz({ x: "Hráč A", o: "Hráč B", sx: dev, so: "", seatX: 0, n: 1, w: null }).then(function () { location.hash = "#r." + id; });
    } else if (t === "m-prijmout") nacti().then(function (n) { if (n && !n.so) { n.so = dev; ja = "o"; localStorage.setItem("maketa-r-" + id, "o"); uloz(n); } });
    else if (t === "m-vyhrat") nacti().then(function (n) { if (!n.w) { n.w = ja; uloz(n); } });
    else if (t === "m-odveta") nacti().then(function (n) { if (n.w) { n.w = null; n.n++; uloz(n); } });
    else if (t === "m-jina") doHerny({ typ: "jina-hra" });
  });

  function sednout(n) {
    if (n.sx === dev) ja = "x"; else if (n.so === dev) ja = "o";
    else if (!n.so) { n.so = dev; ja = "o"; return uloz(n); }
    d = n; kresli();
  }
  function cyklus() {
    nacti().then(function (n) {
      if (herna && !ja && n) return sednout(n);
      if (n && (!d || n.v !== d.v)) { d = n; kresli(); }
    }).catch(function () {}).then(function () { setTimeout(cyklus, 1000); });
  }

  if (herna) {
    id = p.get("r"); seat = p.get("seat") === "1" ? 1 : 0;
    var names = (p.get("names") || "").split(",").map(function (s) { return decodeURIComponent(s); });
    doHerny({ typ: "pripraveno" });
    nacti().then(function (n) {
      if (!n && p.get("zaklada") === "1") { ja = "x"; return uloz({ x: names[seat], o: names[1 - seat], sx: dev, so: "", seatX: seat, n: 1, w: null }); }
      if (n) return sednout(n);
      kresli();
    }).then(cyklus);
  } else {
    var m = /^#r\.([0-9a-z]{6,24})$/.exec(location.hash);
    if (m) { id = m[1]; ja = localStorage.getItem("maketa-r-" + id); nacti().then(function (n) { d = n; kresli(); cyklus(); }); }
    else kresli();
    window.addEventListener("hashchange", function () { location.reload(); });
  }
})();
