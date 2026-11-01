// Herna: vykreslí hry z games.json, ověří dostupnost (HEAD), pamatuje si naposledy hranou hru a ukáže pravidla.
// Místnost (mistnost.js) se napojí přes window.Herna.
(function () {
  var seznam = document.getElementById("hry");
  var zdroj = seznam.getAttribute("data-zdroj") || "games.json";
  var KLIC = "herna.naposledy";
  var hry = [];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function nactiNaposledy() {
    try { return JSON.parse(localStorage.getItem(KLIC)) || null; } catch (e) { return null; }
  }
  function ulozNaposledy(id) {
    try { localStorage.setItem(KLIC, JSON.stringify({ id: id, t: Date.now() })); } catch (e) {}
  }
  function predChvili(t) {
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 2) return "před chvílí";
    if (m < 60) return "před " + m + " min";
    var h = Math.round(m / 60);
    if (h < 24) return "před " + h + " h";
    var d = Math.round(h / 24);
    return d === 1 ? "včera" : "před " + d + " dny";
  }

  function karta(h, posl) {
    var hraj = h.stav === "hraj";
    var naposledy = posl && posl.id === h.id ? '<span class="hra-posl">Naposledy ' + esc(predChvili(posl.t)) + "</span>" : "";
    // Odkaz je jen na názvu, jeho ::after roztáhne klik na celou kartu (tlačítko Pravidla leží nad ním).
    var nazev = hraj
      ? '<a class="hra-odkaz" href="' + esc(h.url) + '" data-id="' + esc(h.id) + '">' + esc(h.nazev) + "</a>"
      : esc(h.nazev);
    return (
      '<li class="hra' + (hraj ? "" : " je-brzy") + '" style="--c:' + esc(h.barva) + '" data-id="' + esc(h.id) + '">' +
      '<span class="hra-ikona" aria-hidden="true"><svg><use href="#i-' + esc(h.ikona) + '"/></svg></span>' +
      '<div class="hra-text">' + naposledy +
      '<h2 class="hra-nazev">' + nazev + "</h2>" +
      '<p class="hra-twist">' + esc(h.twist) + "</p>" +
      "</div>" +
      '<div class="hra-meta"><span class="hra-typ hra-typ-' + (h.typ === "živá" ? "ziva" : "tahova") + '">' + esc(h.typ) + "</span>" +
      '<span class="hra-delka">' + esc(h.delka) + "</span>" +
      '<button class="hra-pravidla" type="button" data-pravidla="' + esc(h.id) + '" aria-label="Pravidla: ' + esc(h.nazev) + '">Pravidla</button>' +
      "</div>" +
      (hraj
        ? '<span class="hra-akce" aria-hidden="true">Hraj<svg><use href="#i-sipka"/></svg></span>'
        : '<span class="hra-akce hra-brzy">Brzy</span>') +
      "</li>"
    );
  }

  function vykresli() {
    var posl = nactiNaposledy();
    // Hratelné napřed, jinak pořadí z games.json.
    var serazene = hry.filter(function (h) { return h.stav === "hraj"; })
      .concat(hry.filter(function (h) { return h.stav !== "hraj"; }));
    seznam.innerHTML = serazene.map(function (h) { return karta(h, posl); }).join("");
    poVykresleni.forEach(function (f) { f(); });
  }
  var poVykresleni = [], poNacteni = [];

  // Pojistka: hra „hraj“, jejíž stránka vrací 404, se zamkne. Odemyká jen games.json
  // (tools/stavy.cjs ověří, že se hra opravdu načte). Bez sítě platí hodnota z games.json.
  function overDostupnost() {
    hry.forEach(function (h) {
      if (h.stav !== "hraj") return;
      fetch(h.url, { method: "HEAD", cache: "no-store" })
        .then(function (r) { if (r.status === 404) { h.stav = "brzy"; vykresli(); } })
        .catch(function () {});
    });
  }

  // Panel s pravidly
  var panel = document.getElementById("panel");
  var predchoziFokus = null;
  function otevriPanel(id) {
    var h = hry.filter(function (x) { return x.id === id; })[0];
    if (!h || !panel) return;
    predchoziFokus = document.activeElement;
    panel.style.setProperty("--c", h.barva);
    panel.querySelector(".panel-ikona").innerHTML = '<svg aria-hidden="true"><use href="#i-' + esc(h.ikona) + '"/></svg>';
    panel.querySelector(".panel-nazev").textContent = h.nazev;
    panel.querySelector(".panel-meta").textContent = h.typ + " · " + h.delka;
    panel.querySelector(".panel-pravidla").innerHTML = (h.pravidla || []).map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("");
    var tl = panel.querySelector(".panel-hraj");
    if (h.stav === "hraj") { tl.href = h.url; tl.setAttribute("data-id", h.id); tl.removeAttribute("aria-disabled"); tl.textContent = "Hraj " + h.nazev; }
    else { tl.removeAttribute("href"); tl.removeAttribute("data-id"); tl.setAttribute("aria-disabled", "true"); tl.textContent = "Brzy"; }
    var solo = panel.querySelector(".panel-solo");
    solo.hidden = !(h.stav === "hraj" && h.solo);
    solo.href = h.url + "#solo";
    panel.hidden = false;
    document.documentElement.classList.add("panel-otevreny");
    requestAnimationFrame(function () { panel.classList.add("je-otevreny"); });
    panel.querySelector(".panel-zavri").focus();
  }
  function zavriPanel() {
    if (!panel || panel.hidden) return;
    panel.classList.remove("je-otevreny");
    document.documentElement.classList.remove("panel-otevreny");
    setTimeout(function () { panel.hidden = true; }, 220);
    if (predchoziFokus) predchoziFokus.focus();
  }

  document.addEventListener("click", function (e) {
    var p = e.target.closest("[data-pravidla]");
    if (p) { otevriPanel(p.getAttribute("data-pravidla")); return; }
    if (e.target.closest("[data-zavri]")) { zavriPanel(); return; }
    var a = e.target.closest("a[data-id]");
    if (a) ulozNaposledy(a.getAttribute("data-id"));
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") zavriPanel(); });

  // Na iPhonu v Safari nápověda, jak si Hernu dát na plochu (v režimu z plochy se neukáže).
  var plocha = document.getElementById("plocha");
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (plocha && ios && !navigator.standalone && !matchMedia("(display-mode: standalone)").matches) plocha.hidden = false;

  fetch(zdroj, { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var zaklad = data.zaklad || "";
      hry = data.hry.map(function (h) { h.url = h.url || zaklad + h.id + "/"; return h; });
      vykresli();
      poNacteni.forEach(function (f) { f(); });
      if (!seznam.hasAttribute("data-bez-kontroly")) overDostupnost();
    })
    .catch(function () {
      seznam.innerHTML = '<li class="chyba">Seznam her se nenačetl. Zkus stránku obnovit.</li>';
    });

  window.Herna = {
    esc: esc,
    hra: function (id) { return hry.filter(function (h) { return h.id === id; })[0] || null; },
    hratelne: function () { return hry.filter(function (h) { return h.stav === "hraj"; }); },
    nacteno: function () { return hry.length > 0; },
    poNacteni: function (f) { if (hry.length) f(); poNacteni.push(f); },
    poVykresleni: function (f) { poVykresleni.push(f); },
    zavriPanel: zavriPanel
  };
})();
