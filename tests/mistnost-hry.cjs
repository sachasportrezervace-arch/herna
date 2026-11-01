// Skutečná hra v živé místnosti Herny: node tests/mistnost-hry.cjs [psanicko|caranice ...] [URL Herny]
// Bez názvu hry se spustí všechny hry postupně (psanicko, caranice, jezci-prak, mlask, ovocny-souboj, kaficka, tancicky, jamka-na-miru, zviratka-sogi, kvizove-lode, ctyrka-s-otockou). Výchozí URL je živá Herna.
// Playwright z globální instalace (NODE_PATH = npm root -g). Mark v Chromiu 1440×900, Radka ve WebKitu iPhone 13.
// Žádné makety a žádné přepisy games.json: je to ostrá Herna, ostrá hra i ostrý mantledb.
// Ověří: založení, vstup Radky, výběr hry, automatické přepnutí Radce (herna=1, seat, zaklada, stejné r), žádná výzva ani setup,
// celá partie, skóre v liště a v dokumentu místnosti (jeden záznam, i po 7 s), „Jiná hra“ zpět do místnosti.
// Snímky: tests/shots/mistnost-<hra>-*.png (lišta Herny nesmí zakrývat hru ani ovládání, vše se musí vejít).
const { chromium, webkit, devices } = require("playwright");
const fs = require("fs");
const path = require("path");

const ZIVA = "https://sachasportrezervace-arch.github.io/herna/";
const SHOTS = process.env.SHOTS || path.join(__dirname, "shots");
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, fail = 0;
function check(name, cond, info) {
  if (cond) { ok++; console.log("  PASS", name); } else { fail++; console.log("  FAIL", name, info === undefined ? "" : JSON.stringify(info)); }
}
const doc = async (id) => (await fetch(`https://mantledb.sh/v2/herna-${id}/mistnost`, { cache: "no-store" })).json();

async function kontext(browser, opts, jmeno) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.chyby = [];
  page.on("dialog", (d) => d.accept()); // Čáranice se při vzdání ptá přes confirm()
  page.on("pageerror", (e) => page.chyby.push(`${jmeno}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/mantledb|Failed to load resource|interactive-widget/.test(m.text())) page.chyby.push(`${jmeno}: ${m.text()}`); });
  return { ctx, page };
}
const src = (page) => page.$eval("#ram-telo iframe", (f) => f.src).catch(() => "");
const viditelne = (page, sel) => page.$eval(sel, (el) => !el.hidden && getComputedStyle(el).display !== "none").catch(() => false);
const ramecek = (page) => page.frames().find((f) => f !== page.mainFrame());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function cekej(fn, ms = 15000) {
  const konec = Date.now() + ms;
  while (Date.now() < konec) { if (await fn().catch(() => false)) return true; await sleep(250); }
  return false;
}
const skore = async (page) => (await page.textContent("#ram-skore")).replace(/\s/g, "");

// ───────────────────────── Psaníčko ─────────────────────────
// značky jsou <g stroke> v #board (bez .ghost); × má červený stroke. Index políčka = řádek * 15 + sloupec.
async function znacky(f) {
  return f.evaluate(() => [...document.querySelectorAll("#board > g[stroke]")].filter((g) => !g.classList.contains("ghost")).length);
}
async function tapni(page, f, i) {
  const box = await f.locator("#board").boundingBox();
  await page.mouse.click(box.x + ((i % 15) + 0.65) / 15.3 * box.width, box.y + (Math.floor(i / 15) + 0.65) / 15.3 * box.height);
  await f.locator("#confirmBtn:enabled").click();
}
// × (sedadlo 0, Mark) skládá pětku v řadě 7, ○ (sedadlo 1, Radka) táhne po řadě 0 a nikdy nemá pět.
async function dohrejPsanicko(hraci, rada) {
  const plan = { x: [3, 4, 5, 6, 7].map((c) => rada * 15 + c), o: [0, 2, 4, 6, 8, 10, 12] };
  for (let k = 0; k < 14; k++) {
    let na = null;
    for (let t = 0; t < 80 && !na; t++) {
      for (const P of hraci) if (await P.f.locator("#composer").isVisible()) na = P;
      if (!na) { if (await hraci[0].f.locator("#endBox").isVisible()) return; await hraci[0].page.waitForTimeout(150); }
    }
    if (!na) throw new Error("nikdo není na tahu");
    const n = await znacky(na.f);
    await tapni(na.page, na.f, plan[na.znak].shift());
    await na.f.waitForFunction((n) => document.querySelectorAll("#board > g[stroke]:not(.ghost)").length > n, n);
    if (k === 3) for (const P of hraci) await P.page.screenshot({ path: `${SHOTS}/mistnost-psanicko-${P.nazev}.png` });
    if (await na.f.locator("#endBox").isVisible()) break;
  }
}

const PSANICKO = {
  id: "psanicko",
  nazev: "Psaníčko",
  vitez: 0, // Mark (×) skládá pět v řadě
  skryteIds: ["newGameBtn", "copyTopBtn", "waitCopy", "fsBtn", "soloBtn", "share"],
  async pripravena(P) { await P.f.locator("#game").waitFor({ timeout: 20000 }); },
  async bezUi(P) { return !(await P.f.locator("#intro").isVisible()) && !(await P.f.locator("#setup").isVisible()); },
  jmena: (P) => P.f.locator("#players").innerText(),
  async fit(P) {
    const h = await P.f.evaluate(() => {
      const d = document.querySelector("#board").getBoundingClientRect();
      return { l: Math.round(d.left), r: Math.round(d.right), t: Math.round(d.top), b: Math.round(d.bottom), vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth };
    });
    return { ok: h.l >= 0 && h.r <= h.vw + 1 && h.sw <= h.vw + 1 && h.t >= -1 && h.t < h.vh - 100, info: h };
  },
  fitNazev: "deska se vejde do rámu (vodorovně celá, svisle viditelná)",
  // štítky hráčů nesmí zkrátit jméno (iPhone 390 px: „Radka“, ne „Rad…“); vzor psanicko/tests/herna-e2e.cjs
  async dodatecne(A, B) {
    for (const P of [A, B]) {
      const cut = await P.f.evaluate(() => [...document.querySelectorAll("#players .chip b")].filter((b) => b.scrollWidth > b.clientWidth).map((b) => b.textContent));
      const txt = await P.f.locator("#players").innerText();
      check(`${P.nazev}: jména ve štítcích hráčů nejsou zkrácená (celé „Radka“, bez „…“)`, cut.length === 0 && /Radka/.test(txt) && !/…|\.\.\./.test(txt), { cut, txt: txt.replace(/\s+/g, " ") });
    }
  },
  ovladani: () => [],
  async partie(A, B) {
    await dohrejPsanicko([A, B], 7);
    for (const P of [A, B]) await P.f.locator("#endBox").waitFor({ timeout: 15000 });
    check("partie skončila u obou", true);
    return 0;
  },
  async vitezZeHry() { return 0; },
  primarni: (P) => P.f.locator("#endPrimary"),
  sekundarni: (P) => P.f.locator("#endSecondary"),
};

// ───────────────────────── Čáranice ─────────────────────────
// Hra vystavuje window.__car (state().view, state().seat, word(k)); partie = 6 kol, kdo kreslí určuje pravidlo hry.
const HOUSE = [[[.25, .55], [.25, .85], [.75, .85], [.75, .55], [.25, .55]], [[.2, .57], [.5, .3], [.8, .57]]];
async function kresli(P, shapes) {
  if (P.nazev === "desktop") {
    const b = await P.f.locator("#cv").boundingBox();
    for (const pts of shapes) {
      await P.page.mouse.move(b.x + pts[0][0] * b.width, b.y + pts[0][1] * b.height);
      await P.page.mouse.down();
      for (const [x, y] of pts.slice(1)) await P.page.mouse.move(b.x + x * b.width, b.y + y * b.height, { steps: 5 });
      await P.page.mouse.up(); await sleep(100);
    }
    return;
  }
  await P.f.evaluate(async (shapes) => {
    const cv = document.getElementById("cv"), r = cv.getBoundingClientRect(), sl = (ms) => new Promise((f) => setTimeout(f, ms));
    const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 11, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true, clientX: r.left + x * r.width, clientY: r.top + y * r.height, button: type === "pointermove" ? -1 : 0, buttons: type === "pointerup" ? 0 : 1 }));
    for (const pts of shapes) {
      ev("pointerdown", ...pts[0]);
      for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; for (let s = 1; s <= 5; s++) { ev("pointermove", x0 + (x1 - x0) * s / 5, y0 + (y1 - y0) * s / 5); await sl(16); } }
      ev("pointerup", ...pts[pts.length - 1]); await sl(80);
    }
  }, shapes);
}
const stCar = (P) => P.f.evaluate(() => window.__car ? __car.state() : {});
const cekejView = (P, re, ms = 40000) => P.f.waitForFunction((re) => window.__car && new RegExp(re).test(__car.state().view), re.source, { timeout: ms })
  .catch(async (e) => { console.log("  ČEKÁNÍ NA", re, "STAV", JSON.stringify(await stCar(P).catch(() => ({})))); throw e; });
const maInk = (P) => P.f.evaluate(() => { const c = document.getElementById("cv"); if (!c) return false; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 64) if (d[i]) return true; return false; }).catch(() => false);

// jedno kolo k: D kreslí, G hádá (trefí, nebo se vzdá), pak oba odkliknou odhalení
async function kolo(k, D, G, vzdat, hook) {
  await cekejView(D, new RegExp(`^pick:${k}$`));
  await D.f.waitForSelector("#karty");
  await D.f.locator('#karty [data-i="0"]').click();
  await D.f.click("#bGo");
  await cekejView(D, new RegExp(`^draw:${k}$`)); await cekejView(G, new RegExp(`^guess:${k}$`));
  await kresli(D, HOUSE);
  await sleep(1200);
  if (hook) await hook(k, D, G);
  if (vzdat) await G.f.click("#bVzdat");
  else { const w = await D.f.evaluate((k) => __car.word(k), k); await G.f.fill("#fTip", w); await G.f.press("#fTip", "Enter"); }
  await cekejView(D, new RegExp(`^reveal:${k}$`)); await cekejView(G, new RegExp(`^reveal:${k}$`));
  await sleep(250);
  await D.f.click("#bNext"); await G.f.click("#bNext");
}
// Mark (x) se vždy vzdá a Radka (o) vždy uhodne, takže vyhraje Radka (sedadlo 1).
async function partieCaranice(A, B, hook) {
  for (let i = 0; i < 6; i++) {
    const k = i + 1;
    const drawerX = (i + 2) % 2 === 0; // zrcadlí R.drawerOf pro partii 1: lichá kola kreslí x
    const [D, G] = drawerX ? [A, B] : [B, A];
    await kolo(k, D, G, G.znak === "x", hook);
  }
}

const CARANICE = {
  id: "caranice",
  nazev: "Čáranice",
  vitez: 1,
  async sedadla(A, B) {
    const sA = await stCar(A), sB = await stCar(B);
    check("Mark hraje za x (seat 0, zakladatel kreslí první), Radka za o (seat 1)", sA.seat === "x" && sB.seat === "o" && sA.view === "pick:1" && sB.view === "wait:1", [sA, sB]);
  },
  skryteIds: ["link", "bCreate", "bSolo", "bAccept", "bAsX", "fName", "bFull", "bShare", "bCopy"],
  async pripravena(P) {
    await P.f.waitForFunction(() => window.__car && ["pick:1", "wait:1"].includes(__car.state().view), null, { timeout: 40000 });
  },
  async bezUi(P) {
    const s = await stCar(P);
    const videt = await P.f.evaluate(() => ["bCreate", "bAccept", "fName", "bSolo", "link"].filter((id) => { const e = document.getElementById(id); return e && e.checkVisibility(); }));
    return !/intro|setup|share|herna-/.test(s.view) && videt.length === 0;
  },
  async jmena(P) { return (await P.f.evaluate(() => [...document.querySelectorAll("#top .jm")].map((e) => e.textContent))).join(" "); },
  // fáze: start (pick/wait), kresli, hada, konec
  selektory: { start: [], kresli: ["#cv", "#bDone", "#bUndo"], hada: ["#cv", "#fTip", "#bVzdat"], konec: ["#bOdveta", "#bJina"] },
  async fit(P, faze) {
    const sel = this.selektory[faze] || [];
    const r = await P.f.evaluate((sel) => {
      const o = { sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth, kde: {} };
      let ok = o.sh <= o.ih + 1 && o.sw <= o.iw + 1;
      for (const s of sel) {
        const e = document.querySelector(s);
        if (!e || !e.checkVisibility()) { ok = false; o.kde[s] = "chybí"; continue; }
        const b = e.getBoundingClientRect();
        if (b.top < -1 || b.bottom > o.ih + 1 || b.left < -1 || b.right > o.iw + 1) { ok = false; o.kde[s] = [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }
      }
      return { ok, o };
    }, sel);
    return { ok: r.ok, info: r.o };
  },
  fitNazev: "hra se vejde do rámu (bez posunu, plátno a ovládání celé na obrazovce)",
  ovladani(faze) { return this.selektory[faze] || []; },
  async partie(A, B) {
    const hook = async (k, D, G) => {
      if (k > 2) return;
      if (k === 1) check("kresba dorazí hádači (kolo 1, Markova kresba na iPhone)", await cekej(() => maInk(G), 8000));
      if (k === 2) check("kresba dorazí hádači (kolo 2, Radčina kresba na desktop)", await cekej(() => maInk(G), 8000));
      for (const P of [D, G]) {
        await P.page.screenshot({ path: `${SHOTS}/mistnost-caranice-${P === D ? "kresli" : "hada"}-${P.nazev}.png` });
      }
      await vejdeSe(D, `${D.nazev} kreslí (kolo ${k})`, "kresli");
      await vejdeSe(G, `${G.nazev} hádá (kolo ${k})`, "hada");
    };
    await partieCaranice(A, B, hook);
    for (const P of [A, B]) await cekejView(P, /^partie:6$/);
    check("partie skončila u obou (partie:6)", true);
    await A.f.waitForFunction(() => document.querySelectorAll("#galerie .kr svg path").length > 5, null, { timeout: 10000 }).catch(() => {});
    const [sx, so] = await A.f.evaluate(() => [...document.querySelectorAll(".vysledek .sk")].map((e) => +e.textContent));
    const exp = sx > so ? 0 : so > sx ? 1 : null;
    console.log(`  (výsledek hry: x ${sx} : o ${so}, vítěz = ${exp === null ? "remíza" : "sedadlo " + exp})`);
    check("vítěz podle plánu (Radka uhodla všechna kola, Mark se vzdal)", exp === 1, { sx, so });
    return exp;
  },
  primarni: (P) => P.f.locator("#bOdveta"),
  sekundarni: (P) => P.f.locator("#bJina"),
};
CARANICE.fit = CARANICE.fit.bind(CARANICE);
CARANICE.ovladani = CARANICE.ovladani.bind(CARANICE);

// ───────────────────────── Ježkomet (jezci-prak) ─────────────────────────
// Hra vystavuje window.JPT jen s ?test, proto se holý /jezci-prak/ v ostré Herně přesměruje na /jezci-prak/?test
// (fragment #herna=… zůstane). Nic jiného se nemění. Seat 0 = tým x, kdo začíná, se losuje; partie = jeden výstřel
// a pak se Mark vzdá (vítěz Radka = sedadlo 1), výsledek přijde až po dopřehrání tahu.
const jpt = (P) => P.f.evaluate(() => window.JPT.info());
const jptVis = (f, sel) => f.$eval(sel, (e) => !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden").catch(() => false);
async function jptSkryjBanner(f) { if (await jptVis(f, "#banner")) await f.click("#banner").catch(() => {}); }
async function jptVystrel(P, O) {
  await P.f.waitForFunction(() => document.title.startsWith("Jsi na tahu"), null, { timeout: 40000 });
  await jptSkryjBanner(P.f);
  await P.f.waitForFunction(() => { const c = window.JPT.cam(); return Math.abs(c.x - c.home.x) < 12 && Math.abs(c.s - c.home.s) < 0.03 && !c.user; }, null, { timeout: 9000, polling: 100 }).catch(() => {});
  const i0 = await jpt(P);
  const best = await P.f.evaluate(() => window.JPT.best(4500));
  const [sx0, sy0] = await P.f.evaluate(() => window.JPT.sling());
  const r = await P.page.$eval("#ram-telo iframe", (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top]; });
  const sx = sx0 + r[0], sy = sy0 + r[1];
  if (P.nazev === "desktop") {
    await P.page.mouse.move(sx, sy); await P.page.mouse.down();
    for (let i = 1; i <= 6; i++) await P.page.mouse.move(sx + best.dx * i / 6, sy + best.dy * i / 6);
    await P.page.mouse.up();
  } else {
    await P.f.evaluate(async ([sx0, sy0, dx, dy]) => {
      const cv = document.getElementById("stage"), sl = (ms) => new Promise((f) => setTimeout(f, ms));
      const ev = (t, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: 12, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y, buttons: t === "pointerup" ? 0 : 1 }));
      ev("pointerdown", sx0, sy0);
      for (let i = 1; i <= 6; i++) { ev("pointermove", sx0 + dx * i / 6, sy0 + dy * i / 6); await sl(16); }
      ev("pointerup", sx0 + dx, sy0 + dy);
    }, [sx0, sy0, best.dx, best.dy]);
  }
  await P.f.waitForFunction((n) => { const i = window.JPT.info(); return i.n > n && !i.busy && !i.acting; }, i0.n, { timeout: 90000, polling: 50 });
  await O.f.waitForFunction((n) => { const i = window.JPT.info(); return i.n > n && !i.replay; }, i0.n, { timeout: 90000, polling: 50 });
}
const JEZKOMET = {
  id: "jezci-prak",
  nazev: "Ježkomet",
  vitez: 1,
  skryteIds: ["share", "soloBtn", "waitCopy", "setup", "intro", "mCopy", "mNew"],
  // do holého dokumentu se před hrou vloží replaceState na ?test (route nesmí přesměrovat, jen přepíše odpověď)
  async kontext(ctx) {
    await ctx.route("**/jezci-prak/", async (route) => {
      const resp = await route.fetch();
      const body = (await resp.text()).replace(/<head[^>]*>/i, (m) => m + "<script>history.replaceState(null,'',location.pathname+'?test'+location.hash)</script>");
      await route.fulfill({ response: resp, body });
    });
  },
  async pripravena(P) { await P.f.waitForFunction(() => window.JPT && window.JPT.info() && window.JPT.info().view === "play" && !!window.JPT.info().me, null, { timeout: 40000, polling: 100 }); },
  async sedadla(A, B) {
    const [iA, iB] = [await jpt(A), await jpt(B)];
    check("Mark = tým x (sedadlo 0), Radka = tým o (sedadlo 1), stejná partie (seed, mapa)", iA.me === "x" && iB.me === "o" && iA.sd === iB.sd && iA.map === iB.map, [iA.me, iB.me, iA.sd, iB.sd]);
  },
  async bezUi(P) { return !(await jptVis(P.f, "#intro")) && !(await jptVis(P.f, "#setup")) && !(await jptVis(P.f, "#share")) && !(await jptVis(P.f, "#soloBtn")); },
  async jmena(P) { return (await P.f.textContent("#nmX")) + " " + (await P.f.textContent("#nmO")); },
  selektory: { start: ["#stage", "#menuBtn"], hra: ["#stage", "#menuBtn"], konec: ["#endPrimary", "#endSecondary"] },
  async fit(P, faze) { return fitFrame(P, this.selektory[faze] || []); },
  fitNazev: "hra se vejde do rámu (bez posunu, plátno a ovládání celé na obrazovce)",
  ovladani(faze) { return this.selektory[faze] || []; },
  async partie(A, B) {
    const iA = await jpt(A);
    const [P, O] = iA.p === "x" ? [A, B] : [B, A];
    console.log(`  (začíná ${iA.p === "x" ? "Mark" : "Radka"}, mapa ${iA.map})`);
    await jptVystrel(P, O);
    check("po výstřelu mají oba stejný stav (jednotky, těla, tah)", await cekej(async () => { const [x, y] = [await jpt(A), await jpt(B)]; return x.units === y.units && x.bodies === y.bodies && x.n === y.n; }, 15000));
    for (const Q of [A, B]) await Q.page.screenshot({ path: `${SHOTS}/mistnost-jezci-prak-hra-${Q.nazev}.png` });
    await vejdeSe(A, "desktop (po výstřelu)", "hra");
    await vejdeSe(B, "iPhone (po výstřelu)", "hra");
    // Mark se vzdá přes nabídku (potvrzení confirm() řeší handler dialogu)
    await jptSkryjBanner(A.f);
    await A.f.waitForFunction(() => { const i = window.JPT.info(); return !i.acting && !i.busy && !i.replay; }, null, { timeout: 40000 });
    await A.f.click("#menuBtn");
    await A.f.click("#mResign");
    for (const Q of [A, B]) await Q.f.waitForFunction(() => { const i = window.JPT.info(); return i.ph === "end" && !i.replay && !i.acting && !document.getElementById("endBox").hidden; }, null, { timeout: 40000, polling: 100 });
    check("partie skončila u obou (Mark se vzdal)", true);
    return 1;
  },
  primarni: (P) => P.f.locator("#endPrimary"),
  sekundarni: (P) => P.f.locator("#endSecondary"),
};

// ───────────────────────── Mlask! (mlask) ─────────────────────────
// Hra vystavuje window.__pol (info, solve, dragFor); partii dohrají oba nejlepšími hody podle solve().
const polInfo = (P) => P.f.evaluate(() => window.__pol.info());
const polWait = (P, fn, arg) => P.f.waitForFunction(fn, arg, { timeout: 40000 });
async function polHod(P, vx, vy) {
  const d = await P.f.evaluate(([a, b]) => window.__pol.dragFor(a, b), [vx, vy]);
  const off = await P.page.$eval("#ram-telo iframe", (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top]; });
  const pts = [0, 0.25, 0.5, 0.75, 1].map((u) => [d.x0 + (d.x1 - d.x0) * u, d.y0 + (d.y1 - d.y0) * u]);
  if (P.nazev === "desktop") {
    await P.page.mouse.move(pts[0][0] + off[0], pts[0][1] + off[1]); await P.page.mouse.down();
    for (const [x, y] of pts.slice(1)) await P.page.mouse.move(x + off[0], y + off[1], { steps: 2 });
    await P.page.mouse.up();
  } else {
    await P.f.evaluate((q) => {
      const cv = document.getElementById("cv");
      const fire = (type, [x, y]) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 11, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: type === "pointerup" ? 0 : 1 }));
      fire("pointerdown", q[0]); q.slice(1).forEach((z) => fire("pointermove", z)); fire("pointerup", q[q.length - 1]);
    }, pts);
  }
}
const MLASK = {
  id: "mlask",
  nazev: "Mlask!",
  skryteIds: ["share", "soloBtn", "copyTopBtn", "newGameBtn", "setup", "intro", "copyLinkBtn"],
  async pripravena(P) { await P.f.waitForFunction(() => window.__pol && window.__pol.info().view === "play", null, { timeout: 40000 }); },
  async sedadla(A, B) {
    const [iA, iB] = [await polInfo(A), await polInfo(B)];
    check("Mark = sedadlo 0, Radka = sedadlo 1, stejná místnost hry", iA.me === 0 && iB.me === 1 && !!iA.room && iA.room === iB.room, [iA.me, iB.me, iA.room, iB.room]);
    const nm = async (P) => P.f.evaluate(() => [document.getElementById("nm0").textContent, document.getElementById("nm1").textContent]);
    const [na, nb] = [await nm(A), await nm(B)];
    check("jména z Herny: sedadlo 0 = Mark, sedadlo 1 = Radka (u obou)", na[0].startsWith("Mark") && na[1].startsWith("Radka") && nb[0].startsWith("Mark") && nb[1].startsWith("Radka"), [na, nb]);
  },
  async bezUi(P) { return !(await jptVis(P.f, "#intro")) && !(await jptVis(P.f, "#setup")) && !(await jptVis(P.f, "#share")) && !(await jptVis(P.f, "#info")) && !(await jptVis(P.f, "#soloBtn")); },
  async jmena(P) { return (await P.f.textContent("#nm0")) + " " + (await P.f.textContent("#nm1")); },
  selektory: { start: ["#cv", "#menuBtn"], hra: ["#cv", "#menuBtn"], konec: ["#endPrimary", "#endSecondary"] },
  async fit(P, faze) { return fitFrame(P, this.selektory[faze] || []); },
  fitNazev: "hra se vejde do rámu (bez posunu, plátno a ovládání celé na obrazovce)",
  ovladani(faze) { return this.selektory[faze] || []; },
  async partie(A, B) {
    let n = 0, snimek = false;
    while (n < 45) {
      const ia = await polInfo(A);
      if (ia.over) break;
      const j = ia.thrower, P = j === 0 ? A : B, O = j === 0 ? B : A;
      await polWait(P, () => window.__pol.info().canThrow);
      const best = await P.f.evaluate(() => window.__pol.solve(0, 0));
      const k0 = (await polInfo(P)).k;
      if (!snimek) {
        snimek = true;
        for (const Q of [A, B]) await Q.page.screenshot({ path: `${SHOTS}/mistnost-mlask-hra-${Q.nazev}.png` });
        await vejdeSe(A, "desktop (před hodem)", "hra");
        await vejdeSe(B, "iPhone (před hodem)", "hra");
      }
      await polHod(P, best.vx, best.vy);
      await polWait(P, (k) => window.__pol.info().k === k + 1, k0);
      await polWait(O, (k) => window.__pol.info().k === k + 1, k0);
      for (const X of [O, P]) await polWait(X, (k) => { const i = window.__pol.info(); return i.shownK === k + 1 && !i.playing; }, k0);
      n++;
    }
    const fa = await polInfo(A), fb = await polInfo(B);
    console.log(`  (partie: ${n} hodů, konec ${JSON.stringify(fa.over)}, HP ${fa.hp})`);
    check("partie skončila vítězem, u obou stejně", !!fa.over && fa.over.win != null && JSON.stringify(fa.over) === JSON.stringify(fb.over), fa.over);
    for (const Q of [A, B]) await polWait(Q, () => !document.getElementById("end").hidden);
    return fa.over && fa.over.win != null ? fa.over.win : null;
  },
  primarni: (P) => P.f.locator("#endPrimary"),
  sekundarni: (P) => P.f.locator("#endSecondary"),
};

// ───────────────────────── Ovocný souboj (ovocny-souboj) ─────────────────────────
// Živá hra, oba hrají současně; window.__ovs (state().phase/seat/go, targets()). Kolo se zkracuje na 10 s parametrem ?kolo=10
// (replaceState vložený do holého dokumentu, jako u Ježkometu). Hraje jen Radka (sedadlo 1), takže vyhrává ona; Mark jen čeká.
const ovsSt = (P) => P.f.evaluate(() => __ovs.state());
const ovsFaze = (P, ph, ms = 40000) => P.f.waitForFunction((ph) => [].concat(ph).includes(__ovs.state().phase), ph, { timeout: ms });
async function ovsHraj(P, ms) {
  const F = P.f, konec = Date.now() + ms;
  const vp = await F.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const off = await P.page.$eval("#ram-telo iframe", (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top]; });
  while (Date.now() < konec) {
    const s = await F.evaluate(() => __ovs.state());
    if (s.phase !== "play") { if (s.phase === "wait" || s.phase === "result") break; await sleep(100); continue; }
    const t = (await F.evaluate(() => __ovs.targets())).filter((o) => o.y > 150 && o.y < vp.height - 60 && o.x > 10 && o.x < vp.width - 10);
    const bomby = t.filter((o) => o.kind === "bomba");
    const pick = t.filter((o) => o.kind !== "bomba" && bomby.every((b) => Math.hypot(b.x - o.x, b.y - o.y) > b.r + 70)).sort((a, b) => a.x - b.x).slice(0, 6);
    if (pick.length) {
      const cx = (x) => Math.max(4, Math.min(vp.width - 4, x)), pts = [];
      for (const f of pick) { pts.push([cx(f.x - f.r * 1.4) + off[0], f.y - 4 + off[1]], [cx(f.x + f.r * 1.4) + off[0], f.y + 4 + off[1]]); if (f.ice) pts.push([cx(f.x - f.r * 1.4) + off[0], f.y + 8 + off[1]], [cx(f.x + f.r * 1.4) + off[0], f.y - 8 + off[1]]); }
      await P.page.mouse.move(pts[0][0], pts[0][1]); await P.page.mouse.down();
      for (const [x, y] of pts.slice(1)) await P.page.mouse.move(x, y, { steps: 3 });
      await P.page.mouse.up();
    }
    await sleep(140);
  }
}
const OVOCNY = {
  id: "ovocny-souboj",
  nazev: "Ovocný souboj",
  vitez: 1,
  skryteIds: ["bCreate", "bSolo", "bBack", "bShare", "bCopy", "bAccept", "bMine", "msg", "fs", "iosHint"],
  async kontext(ctx) {
    await ctx.route("**/ovocny-souboj/", async (route) => {
      const resp = await route.fetch();
      const body = (await resp.text()).replace(/<head[^>]*>/i, (m) => m + "<script>history.replaceState(null,'',location.pathname+'?kolo=10'+location.hash)</script>");
      await route.fulfill({ response: resp, body });
    });
  },
  async pripravena(P) { await P.f.waitForSelector("#bReady:not([disabled])", { timeout: 40000 }); },
  async sedadla(A, B) {
    const nm = (P) => P.f.evaluate(() => ({ me: document.getElementById("nameMe").textContent, opp: document.getElementById("nameOpp").textContent, seat: __ovs.state().seat }));
    const [a, b] = [await nm(A), await nm(B)];
    check("Mark = x proti Radce, Radka = o proti Markovi (jména podle sedadel)", a.me === "Mark" && a.opp === "Radka" && a.seat === "x" && b.me === "Radka" && b.opp === "Mark" && b.seat === "o", [a, b]);
  },
  async bezUi(P) { return (await P.f.locator("#bCreate, #bAccept, #bSolo").count()) === 0 && (await P.f.locator("#panel h2").count()) >= 0; },
  async jmena(P) { return (await P.f.textContent("#nameMe")) + " " + (await P.f.textContent("#nameOpp")); },
  selektory: { start: ["#bReady"], hra: ["#blade", "#hud"], konec: ["#bNext", "#bOther"] },
  async fit(P, faze) { return fitFrame(P, this.selektory[faze] || []); },
  fitNazev: "hra se vejde do rámu (bez posunu, ovládání celé na obrazovce)",
  ovladani(faze) { return this.selektory[faze] || []; },
  async partie(A, B) {
    await Promise.all([A.f.click("#bReady"), B.f.click("#bReady")]);
    await Promise.all([ovsFaze(A, "play"), ovsFaze(B, "play")]);
    await sleep(1500);
    for (const Q of [A, B]) await Q.page.screenshot({ path: `${SHOTS}/mistnost-ovocny-souboj-hra-${Q.nazev}.png` });
    await vejdeSe(A, "desktop (kolo běží)", "hra");
    await vejdeSe(B, "iPhone (kolo běží)", "hra");
    await ovsHraj(B, 12000);
    await Promise.all([ovsFaze(A, "result"), ovsFaze(B, "result")]);
    const [ha, hb] = await Promise.all([A.f.innerText(".tag h2"), B.f.innerText(".tag h2")]);
    check("oba vidí stejný nadpis výsledku (Souboj bere Radka)", ha === hb && ha === "Souboj bere Radka", [ha, hb]);
    return 1;
  },
  // po reloadu hra znovu pošle pripraveno a stejný vysledek: Herna ho nesmí započítat podruhé
  async obnov(A) {
    await A.f.evaluate(() => { setTimeout(() => location.reload(), 0); });
    await sleep(1000);
    await A.f.waitForFunction(() => window.__ovs && __ovs.state().phase === "result", null, { timeout: 30000 });
    check("po obnovení Markovy hry je pořád výsledek (stejná partie)", true);
  },
  primarni: (P) => P.f.locator("#bNext"),
  sekundarni: (P) => P.f.locator("#bOther"),
};

// ───────────────────────── Kafíčka (kaficka) ─────────────────────────
// Quarto s hrnky, bez sázky, kdo podává první se losuje (hs = sedadlo Herny za x, Mark = sedadlo 0 = x). Bez testovacího rozhraní:
// stav se čte z DOM (#game[data-ph] = place|pick|wait, #board .cell.full[aria-label], #trayCups .pick, #handDesc), tahy jsou kliky.
// Mark (x) vítězí, kdykoli může, a nepodává Radce vítězný hrnek; Radka (o) podává Markovi vítězné hrnky. Výsledek se čte z #endTitle.
function kafLines(m) {
  const L = [];
  for (let r = 0; r < 4; r++) L.push([0, 1, 2, 3].map((c) => r * 4 + c));
  for (let c = 0; c < 4; c++) L.push([0, 1, 2, 3].map((r) => r * 4 + c));
  L.push([0, 5, 10, 15], [3, 6, 9, 12]);
  if (m === 1) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) L.push([r * 4 + c, r * 4 + c + 1, r * 4 + c + 4, r * 4 + c + 5]);
  if (m === 2) L.push([0, 3, 12, 15], [5, 6, 9, 10]);
  if (m === 3) for (const d of [1, -1]) for (let c0 = 0; c0 < 4; c0++) { if ((d === 1 && c0 === 0) || (d === -1 && c0 === 3)) continue; L.push([0, 1, 2, 3].map((r) => r * 4 + (c0 + d * r + 8) % 4)); }
  return L;
}
function kafDokonci(g, cup, cell, m) {
  const h = g.slice(); h[cell] = cup;
  return kafLines(m).some((l) => l.includes(cell) && l.every((c) => h[c] !== null) && (l.reduce((a, c) => a & h[c], 15) || l.reduce((a, c) => a & ~h[c] & 15, 15)));
}
const kafHrnek = (label) => { const s = label.split(": ").pop().toLowerCase().split(", "); return (s[0].startsWith("velký") ? 1 : 0) | (s[1] === "espresso" ? 2 : 0) | (s[2] === "hranatý" ? 4 : 0) | (s[3] === "s pěnou" ? 8 : 0); };
const nahodny = (a) => a[Math.floor(Math.random() * a.length)];
async function kafStav(f) {
  const r = await f.evaluate(() => ({
    ph: document.getElementById("game").dataset.ph, view: document.body.dataset.view,
    cells: [...document.querySelectorAll("#board .cell.full")].map((c) => [+c.dataset.i, c.getAttribute("aria-label")]),
    tray: [...document.querySelectorAll("#trayCups .pick")].map((b) => ({ id: +b.dataset.id, back: b.classList.contains("back") })),
    desc: document.getElementById("handDesc").textContent, m: +document.getElementById("board").dataset.m,
    end: !document.getElementById("endBox").hidden, ho: !document.getElementById("handover").hidden,
  }));
  const g = new Array(16).fill(null);
  r.cells.forEach(([i, l]) => { g[i] = kafHrnek(l); });
  r.g = g;
  r.held = r.ph === "place" ? kafHrnek(r.desc.split(". ")[0].replace(/^./, (c) => c.toLowerCase())) : null;
  r.free = g.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
  return r;
}
// jeden tah hráče (položit, nebo vybrat a podat); vrací true, když něco odehrál
async function kafTah(P, strat) {
  const f = P.f;
  const s = await kafStav(f);
  if (s.ho) { await f.locator("#handover").click({ position: { x: 20, y: 20 }, timeout: 1500 }).catch(() => {}); await sleep(500); return true; }
  if (s.end || s.view === "end") return false;
  if (s.ph === "place") {
    const vyhra = s.free.find((c) => kafDokonci(s.g, s.held, c, s.m));
    const cell = strat === "win" && vyhra !== undefined ? vyhra : nahodny(s.free);
    try {
      await f.locator(`#board .cell[data-i="${cell}"]`).click({ timeout: 2000 });
      await f.waitForSelector("#board .cell.ghost", { timeout: 700 });
    } catch { await sleep(100); return false; }
    if (!P.kafFit.place) { P.kafFit.place = true; await vejdeSe(P, `${P.nazev} pokládá hrnek`, "pokladani"); await P.page.screenshot({ path: `${SHOTS}/mistnost-kaficka-pokladani-${P.nazev}.png` }); }
    try { await f.locator("#placeBtn").click({ timeout: 2000 }); } catch { await sleep(100); return false; }
    await sleep(250); return true;
  }
  if (s.ph === "pick") {
    const cand = s.tray.filter((t) => !t.back);
    const vitezne = cand.filter((t) => s.free.some((c) => kafDokonci(s.g, t.id, c, s.m)));
    const bezpecne = cand.filter((t) => !vitezne.includes(t));
    const volba = strat === "feed" && vitezne.length ? nahodny(vitezne) : strat === "win" && bezpecne.length ? nahodny(bezpecne) : nahodny(cand);
    try {
      await f.locator(`#trayCups .pick[data-id="${volba.id}"]`).click({ timeout: 2000 });
      await f.waitForFunction(() => !document.getElementById("giveBtn").disabled, null, { timeout: 700 });
    } catch { await sleep(100); return false; }
    if (!P.kafFit.pick) { P.kafFit.pick = true; await vejdeSe(P, `${P.nazev} podává hrnek`, "podavani"); await P.page.screenshot({ path: `${SHOTS}/mistnost-kaficka-podavani-${P.nazev}.png` }); }
    try { await f.locator("#giveBtn").click({ timeout: 2000 }); } catch { await sleep(100); return false; }
    await sleep(250); return true;
  }
  return false;
}
const kafKonec = (P) => P.f.evaluate(() => !document.getElementById("endBox").hidden).catch(() => false);
const KAFICKA = {
  id: "kaficka",
  nazev: "Kafíčka",
  vitez: 0,
  skryteIds: ["newGameBtn", "copyTopBtn", "fsBtn", "setup", "intro", "share", "waitBox", "soloBtn", "infoNew"],
  async pripravena(P) {
    P.kafFit = {};
    await P.f.waitForFunction(() => !document.getElementById("game").hidden && document.body.dataset.view === "play" && !/nesedí/.test(document.getElementById("oppWhat").textContent) && !!document.getElementById("game").dataset.ph, null, { timeout: 40000 });
  },
  async sedadla(A, B) {
    const t = (P) => P.f.evaluate(() => document.getElementById("oppTag").textContent.trim().toLowerCase());
    const [a, b] = [await t(A), await t(B)];
    check("Mark (sedadlo 0) hraje proti Radce, Radka proti Markovi", a === "radka" && b === "mark", [a, b]);
    const fz = [await kafStav(A.f), await kafStav(B.f)].map((s) => s.ph).sort().join();
    check("jeden podává (losem), druhý čeká", fz === "pick,wait", fz);
  },
  async bezUi(P) {
    return !(await jptVis(P.f, "#setup")) && !(await jptVis(P.f, "#intro")) && !(await jptVis(P.f, "#share")) && !(await jptVis(P.f, "#waitBox")) && !(await jptVis(P.f, "#soloBtn"));
  },
  async jmena(P) { return P.f.evaluate(() => document.getElementById("sackTop").textContent + " " + document.getElementById("oppTag").textContent); },
  selektory: { start: ["#board"], pokladani: ["#board", "#hand", "#placeBtn"], podavani: ["#board", "#tray", "#giveBtn"], konec: ["#endBox", "#endPrimary", "#endSecondary"] },
  // Kafíčka se na mobilu smí v rámu posouvat (pod ovládáním leží pravidla, to autoři testují); měří se, že vybrané prvky jsou celé nad spodní hranou
  async fit(P, faze) {
    const r = await fitFrame(P, this.selektory[faze] || []);
    if (!r.ok && r.info.sw <= r.info.iw + 1 && Object.keys(r.info.kde).length === 0) return { ok: true, info: r.info };
    return r;
  },
  fitNazev: "deska a ovládání celé nad spodní hranou iframe (stránka se smí posouvat)",
  ovladani(faze) { return faze === "start" ? [] : (this.selektory[faze] || []).filter((s) => s !== "#board"); },
  async partie(A, B) {
    const t0 = Date.now();
    let kroky = 0;
    while (Date.now() - t0 < 240000) {
      if ((await kafKonec(A)) && (await kafKonec(B))) break;
      const x = await kafTah(A, "win"), y = await kafTah(B, "feed");
      if (x || y) kroky++; else await sleep(300);
    }
    const hotovo = await cekej(async () => (await kafKonec(A)) && (await kafKonec(B)), 15000);
    check("partie skončila u obou", hotovo, { kroky });
    await sleep(1000);
    const nadpis = (P) => P.f.evaluate(() => document.getElementById("endTitle").textContent);
    const [ta, tb] = [await nadpis(A), await nadpis(B)];
    const v = /Vyhráváš/.test(ta) ? 0 : /Vyhráváš/.test(tb) ? 1 : /Remíza/.test(ta) && /Remíza/.test(tb) ? null : -1;
    console.log(`  (partie: ${kroky} tahů, „${ta}“ / „${tb}“, vítěz = ${v === null ? "remíza" : "sedadlo " + v})`);
    check("oba vidí stejný výsledek (jeden vyhrál, nebo remíza)", v !== -1 && !(/Vyhráváš/.test(ta) && /Vyhráváš/.test(tb)), [ta, tb]);
    return v === -1 ? null : v;
  },
  primarni: (P) => P.f.locator("#endPrimary"),
  sekundarni: (P) => P.f.locator("#endSecondary"),
};
KAFICKA.fit = KAFICKA.fit.bind(KAFICKA);
KAFICKA.ovladani = KAFICKA.ovladani.bind(KAFICKA);

// ───────────────────────── Tančíky (tancicky) ─────────────────────────
// Dělostřelecký souboj, sázka v Herně vždy „Jen o čest“. Hra vystavuje window.__tanc (state, me, play, skip, inputs, busy, animating)
// a TankEngine.suggestShot; partie = celý zápas (kola do zničení tanku nebo 16 tahů). Oba hráči střílejí doporučenou střelou,
// Mark (sedadlo 0, zakladatel) = tank 0, Radka = tank 1; vítěz je index tanku = sedadlo Herny (null = remíza). Výsledek se čte ze state().winner.
const tcSnap = (P) => P.f.evaluate(() => { const t = window.__tanc; if (!t) return null; const s = t.state(); return s ? { cur: s.cur, me: t.me(), over: !!s.matchOver, winner: s.winner, anim: t.animating(), busy: t.busy(), view: document.body.dataset.view, n: t.inputs().length, gi: (t.series() || [0, 0]).join(":"), round: s.round } : { view: document.body.dataset.view, me: t.me(), none: true }; }).catch(() => null);
async function tcTah(P) {
  for (let k = 0; k < 4; k++) {
    const ok = await P.f.evaluate(async () => {
      try {
        const sh = document.getElementById("shop"); if (sh && !sh.hidden) document.getElementById("shopDone").click();
        return await window.__tanc.play(window.TankEngine.suggestShot(window.__tanc.state()));
      } catch (e) { return "err:" + e.message; }
    });
    if (ok === true) return;
    await sleep(1500);
  }
  throw new Error(P.nazev + ": play() odmítl tah 4×");
}
const TANCICKY = {
  id: "tancicky",
  nazev: "Tančíky",
  async pripravena(P) {
    P.tcFit = false;
    await P.f.waitForFunction(() => window.__tanc && document.body.dataset.view === "play" && window.__tanc.me() !== null, null, { timeout: 40000 });
  },
  async sedadla(A, B) {
    const [a, b] = [await tcSnap(A), await tcSnap(B)];
    check("Mark = tank 0 (sedadlo 0), Radka = tank 1 (sedadlo 1), stejná série", !!a && !!b && a.me === 0 && b.me === 1 && a.gi === b.gi, [a, b]);
  },
  async bezUi(P) {
    const v = await P.f.evaluate(() => {
      const shown = (id) => { const e = document.getElementById(id); return !!e && e.checkVisibility(); };
      return ["acceptBtn", "setupForm", "soloBtn", "createBtn", "localBtn", "a2hs"].filter(shown);
    });
    return v.length === 0 && (await P.f.evaluate(() => document.body.dataset.view)) === "play";
  },
  skryteIds: ["acceptBtn", "setupForm", "soloBtn", "createBtn", "localBtn", "copyTopBtn", "leaveBtn", "fullscreenBtn", "a2hs", "copyEndBtn", "menuBtn", "challengeBtn", "watchBtn"],
  jmena: (P) => P.f.evaluate(() => document.body.innerText),
  selektory: { start: ["#cv", "#ctrl"], hra: ["#cv", "#ctrl"], konec: ["#endTitle", "#endScore", "#rematchBtn", "#otherGameBtn"] },
  async fit(P, faze) { return fitFrame(P, this.selektory[faze] || []); },
  fitNazev: "hra se vejde do rámu (bez posunu, plátno a ovládání celé nad spodní hranou iframe)",
  ovladani(faze) { return faze === "konec" ? ["#rematchBtn", "#otherGameBtn"] : []; },
  async partie(A, B) {
    const t0 = Date.now(); let tahy = 0, snimek = false;
    while (Date.now() - t0 < 600000) {
      const [a, b] = [await tcSnap(A), await tcSnap(B)];
      for (const [P, s] of [[A, a], [B, b]]) if (s && s.anim) await P.f.evaluate(() => window.__tanc.skip()).catch(() => {});
      if (a && b && a.over && b.over && !a.anim && !b.anim && !a.busy && !b.busy) break;
      for (const [P, s] of [[A, a], [B, b]]) if (s && !s.none && !s.over && !s.anim && !s.busy && s.cur === s.me) { await tcTah(P); tahy++; }
      if (!snimek && tahy >= 2) {
        snimek = true;
        for (const Q of [A, B]) await Q.page.screenshot({ path: `${SHOTS}/mistnost-tancicky-hra-${Q.nazev}.png` });
        await vejdeSe(A, "desktop (zápas běží)", "hra");
        await vejdeSe(B, "iPhone (zápas běží)", "hra");
      }
      await sleep(250);
    }
    const [a, b] = [await tcSnap(A), await tcSnap(B)];
    check("zápas skončil u obou (matchOver)", !!a && !!b && a.over && b.over, [a, b]);
    await Promise.all([A, B].map((P) => P.f.waitForSelector("body[data-view=end]", { timeout: 30000 }))).catch(() => {});
    const w = a && (a.winner === 0 || a.winner === 1) ? a.winner : null;
    console.log(`  (zápas: ${tahy} tahů, vítěz = ${w === null ? "remíza" : "sedadlo " + w})`);
    check("oba vidí stejného vítěze", !!b && a.winner === b.winner, [a && a.winner, b && b.winner]);
    return w;
  },
  primarni: (P) => P.f.locator("#rematchBtn"),
  sekundarni: (P) => P.f.locator("#otherGameBtn"),
};
TANCICKY.fit = TANCICKY.fit.bind(TANCICKY);
TANCICKY.ovladani = TANCICKY.ovladani.bind(TANCICKY);

// ───────────────────────── Jamka na míru (jamka-na-miru) ─────────────────────────
// Tahový minigolf, 6 jamek, před každou jamkou se staví past soupeři. Hra vystavuje window.__jm (state, viewInfo, autoTrap, bot, shoot, scene.skip).
// Partie = celých 6 jamek (~3 minuty): Mark (sedadlo 0 = x) i Radka (o) hrají skriptem (autoTrap + bot). Vítěz = méně ran (x je sedadlo 0), shoda = remíza.
// Na iPhonu 13 (iframe 390×613) se při hře měří past (výběr všech karet), výsledek jamky a úder; karta konce a Odveta měří obecná část testu.
const jmSt = (P) => P.f.evaluate(() => window.__jm && window.__jm.state()).catch(() => null);
const JM_SELS = ["#topbar .chip", "#holePill", "#bMenu", "#dock", "#dock button", "#dock .say", "#bCam", "#view .panel", "#view button", ".endcard h2", ".endcard .score", ".endcard .cardwrap", ".endcard .titles", ".endcard .wait", ".endcard .trn-note"];
const jmSoucet = (a) => a.reduce((s, v) => s + v, 0);
// jeden krok hráče: přeskočí animace, postaví past, nebo vystřelí; vrací stav před krokem
async function jmKrok(P) {
  const s = await jmSt(P);
  if (!s || s.ph === "end") return s;
  if (s.busy || s.result) { await P.f.evaluate(() => window.__jm.scene.skip()).catch(() => {}); return s; }
  if (s.ph === "trap" && s.me && !s.pend[s.me]) await P.f.evaluate(() => window.__jm.autoTrap()).catch(() => {});
  else if (s.ph === "play" && s.p === s.me) await P.f.evaluate(() => { const b = window.__jm.bot(); window.__jm.shoot(b.A, b.P); }).catch(() => {});
  return s;
}
const JAMKA = {
  id: "jamka-na-miru",
  nazev: "Jamka na míru",
  async kontext(ctx) {
    await ctx.addInitScript(() => { try { localStorage.setItem("jm-ioshint", "1"); } catch {} }); // nápověda „přidat na plochu“ na iOS by zakrývala hru
  },
  async pripravena(P) {
    P.jmFit = new Set();
    await P.f.waitForFunction(() => window.__jm && window.__jm.state() && !window.__jm.viewInfo().view, null, { timeout: 40000 });
  },
  async sedadla(A, B) {
    const [a, b] = [await jmSt(A), await jmSt(B)];
    check("Mark (sedadlo 0) hraje za x, Radka za o, obě ve fázi pasti", !!a && !!b && a.me === "x" && b.me === "o" && a.ph === "trap" && b.ph === "trap", [a && [a.me, a.ph], b && [b.me, b.ph]]);
  },
  async bezUi(P) {
    const v = await P.f.evaluate(() => ({ view: window.__jm.viewInfo().view, vid: ["bCreate", "bSolo", "bShare", "bShare2", "bCopy"].filter((id) => { const e = document.getElementById(id); return e && e.checkVisibility(); }) }));
    return !v.view && v.vid.length === 0;
  },
  skryteIds: ["bCreate", "bSolo", "bShare", "bShare2", "bCopy"],
  jmena: (P) => P.f.evaluate(() => document.querySelector("#chipX .nm").textContent + " " + document.querySelector("#chipO .nm").textContent),
  selektory: { start: ["#dock .tc"], past: ["#dock .tc"], uder: ["#dock"], vysledek: [], konec: ["#bAgain", "#bOther"] },
  // celá hra se musí vejít do rámu: žádný z měřených prvků nesmí přečnívat, #view ani stránka se nesmí posouvat
  async fit(P, faze) {
    const r = await P.f.evaluate(({ sels, ovl }) => {
      const W = innerWidth, H = innerHeight, d = document.documentElement, v = document.getElementById("view"), kde = {};
      for (const sel of sels) for (const el of document.querySelectorAll(sel)) {
        const b = el.getBoundingClientRect(); if (!b.width || !b.height || getComputedStyle(el).visibility === "hidden") continue;
        if (b.top < -1 || b.bottom > H + 1 || b.left < -1 || b.right > W + 1) kde[sel] = [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)];
      }
      for (const sel of ovl) { const e = document.querySelector(sel); if (!e || !e.checkVisibility()) kde[sel] = "chybí"; }
      if (!v.hidden && v.scrollHeight > v.clientHeight + 1) kde["#view scrolluje"] = [v.scrollHeight, v.clientHeight];
      return { ok: Object.keys(kde).length === 0 && d.scrollHeight <= H + 1 && d.scrollWidth <= W + 1, o: { sh: d.scrollHeight, ih: H, sw: d.scrollWidth, iw: W, kde } };
    }, { sels: JM_SELS, ovl: this.selektory[faze] || [] });
    return { ok: r.ok, info: r.o };
  },
  fitNazev: "hra se vejde do rámu (bez posunu, žádný prvek neusekne spodní ani boční hrana iframe)",
  ovladani(faze) { return this.selektory[faze] || []; },
  async partie(A, B) {
    const t0 = Date.now();
    let mereno = 0;
    while (Date.now() - t0 < 12 * 60 * 1000) {
      const x = await jmKrok(A);
      // iPhone (B) se při hře průběžně měří: výběr pasti (všechny tři karty), výsledek jamky, úder; každá fáze jednou
      const s = await jmSt(B);
      if (s && !s.busy && s.ph === "trap" && s.me && !s.pend[s.me] && !s.result && !B.jmFit.has("past")) {
        B.jmFit.add("past");
        await vejdeSe(B, "iPhone (výběr pasti)", "past");
        for (const k of await B.f.evaluate(() => [...document.querySelectorAll("#dock .tc")].map((b) => b.dataset.k))) {
          await B.f.evaluate((k) => document.querySelector(`#dock .tc[data-k="${k}"]`).click(), k); await sleep(300);
          const r = await H.fit(B, "past"); mereno++;
          check(`iPhone (past ${k}): ${H.fitNazev}`, r.ok, r.info);
        }
        await B.page.screenshot({ path: `${SHOTS}/mistnost-jamka-na-miru-past-iphone.png` });
      } else if (s && s.result && !B.jmFit.has("vysledek")) {
        B.jmFit.add("vysledek");
        await vejdeSe(B, "iPhone (výsledek jamky)", "vysledek");
        await B.page.screenshot({ path: `${SHOTS}/mistnost-jamka-na-miru-vysledek-iphone.png` });
      } else if (s && !s.busy && s.ph === "play" && s.p === s.me && !B.jmFit.has("uder")) {
        B.jmFit.add("uder");
        await vejdeSe(B, "iPhone (úder)", "uder");
        await B.page.screenshot({ path: `${SHOTS}/mistnost-jamka-na-miru-uder-iphone.png` });
      }
      const y = await jmKrok(B);
      if (x && y && x.ph === "end" && y.ph === "end") break;
      await sleep(250);
    }
    const [a, b] = [await jmSt(A), await jmSt(B)];
    check("partie došla do konce na obou zařízeních se stejným skóre", !!a && !!b && a.ph === "end" && b.ph === "end" && JSON.stringify(a.sc) === JSON.stringify(b.sc), a && { s: (Date.now() - t0) / 1000 | 0, x: a.sc.x, o: a.sc.o });
    for (const P of [A, B]) await P.f.waitForSelector("#bAgain", { timeout: 40000 }).catch(() => {}); // karta konce přijde až po výsledku poslední jamky
    await sleep(800);
    const sx = jmSoucet(a.sc.x), so = jmSoucet(a.sc.o);
    const v = sx < so ? 0 : so < sx ? 1 : null;
    console.log(`  (partie: ran x ${sx} / o ${so}, vítěz = ${v === null ? "remíza" : "sedadlo " + v}, ${mereno} měření karet pasti)`);
    return v;
  },
  primarni: (P) => P.f.locator("#bAgain"),
  sekundarni: (P) => P.f.locator("#bOther"),
};
JAMKA.fit = JAMKA.fit.bind(JAMKA);
JAMKA.ovladani = JAMKA.ovladani.bind(JAMKA);

// ───────────────────────── Zvířátkové šógi (zviratka-sogi) ─────────────────────────
// Hra žádný testovací háček nevystavuje, hraje se přes DOM (klik na pole / figurku v zásobě). Tahy plánuje živý engine.js hry
// (stáhne se z GitHub Pages a vyhodnotí v Node): nejkratší řada tahů, po které vyhraje „o“ = Radka (sedadlo 1) chycením lva nebo lvem v cíli.
// Zakladatel (Mark) je „x“; kdo táhne první, říká dokument hry na mantledb (zviratka-<r>/hra, g.s). Tah = dva kliky (odkud, kam), nebo (figurka ze zásoby, kam).
async function sgEngine() {
  const t = await (await fetch(ZIVA.replace(/herna\/$/, "") + "zviratka-sogi/engine.js", { cache: "no-store" })).text();
  const m = { exports: {} };
  new Function("module", t)(m);
  return m.exports;
}
// nejkratší platná řada tahů (zápis jako v dokumentu: m<z><na> / d<typ><na>), po které vyhraje `winner` (lev chycen, nebo lev v cíli)
function sgLine(S, vr, starter, winner, maxPly = 9) {
  const s0 = S.initial(starter, vr);
  let level = [{ s: s0, m: [] }];
  const seen = new Set([S.key(s0)]);
  for (let d = 0; d < maxPly; d++) {
    const next = [];
    for (const n of level) for (const mv of S.moves(n.s)) {
      const r = S.apply(n.s, mv), m = [...n.m, S.enc(mv)];
      if (r.info.lionCaught || r.info.lionHome) { if (r.info.p === winner) return m; continue; }
      const k = S.key(r.s);
      if (seen.has(k)) continue;
      seen.add(k); next.push({ s: r.s, m });
    }
    level = next;
  }
  throw new Error(`žádná řada do ${maxPly} tahů pro ${vr}/${starter}/${winner}`);
}
const sgMuj = (P) => P.f.waitForFunction(() => document.title.startsWith("Jsi na tahu"), null, { timeout: 30000 });
async function sgTah(P, O, m, posledni) {
  await sgMuj(P);
  if (m[0] === "m") { await P.f.locator(`#board .cell[data-i="${parseInt(m[1], 12)}"]`).click(); await P.f.locator(`#board .cell[data-i="${parseInt(m[2], 12)}"]`).click(); }
  else { await P.f.locator(`#seatBot .hp[data-t="${m[1]}"]`).first().click(); await P.f.locator(`#board .cell[data-i="${parseInt(m[2], 12)}"]`).click(); }
  if (posledni) await O.f.waitForSelector("#endBox:not([hidden])", { timeout: 30000 }); else await sgMuj(O);
}
const SOGI = {
  id: "zviratka-sogi",
  nazev: "Zvířátkové šógi",
  vitez: 1, // Radka (o) chytí lva
  skryteIds: ["soloBtn", "share", "fsBtn", "setup", "intro", "mCopy", "mNew", "infoNew"],
  async pripravena(P) { await P.f.waitForFunction(() => { const g = document.getElementById("game"); return g && !g.hidden && g.checkVisibility(); }, null, { timeout: 40000 }); },
  async bezUi(P) { return !(await P.f.locator("#setup").isVisible()) && !(await P.f.locator("#intro").isVisible()) && !(await P.f.locator("#share").isVisible()) && !(await P.f.locator("#soloBtn").isVisible()); },
  jmena: (P) => P.f.evaluate(() => (document.querySelector("#seatTop .nm")?.textContent || "") + " " + (document.querySelector("#seatBot .nm")?.textContent || "")),
  // na konci má „Odveta“ jen poražený (vítěz čeká), proto se měří „Jiná hra“, kterou mají oba
  selektory: { start: ["#board", "#seatTop", "#seatBot", "#status"], hra: ["#board", "#seatTop", "#seatBot", "#status"], konec: ["#endOther"] },
  // skutečné posouvání: stránka se do rámu nevejde, když ji jde odrolovat (pouhé scrollHeight > výška může být nepřístupný přesah)
  async fit(P, faze) {
    const o = await fitFrame(P, this.selektory[faze] || []);
    const sy = await P.f.evaluate(() => { scrollTo(0, 99999); const y = scrollY; scrollTo(0, 0); return Math.round(y); });
    return { ok: o.ok && sy === 0 && o.info.sw <= o.info.iw + 1, info: { ...o.info, odrolovat: sy } };
  },
  fitNazev: "hra se vejde do rámu (bez posunu, deska, jména i stav nad spodní hranou iframe)",
  ovladani(faze) { return faze === "konec" ? ["#endOther"] : []; },
  async partie(A, B) {
    const r = /&r=([0-9a-z]+)&/.exec(await src(A.page))[1];
    const d = await (await fetch(`https://mantledb.sh/v2/zviratka-${r}/hra`, { cache: "no-store" })).json();
    check("dokument hry: Mark = x, Radka = o (jména z Herny)", d.g.x === "Mark" && d.g.o === "Radka", [d.g.x, d.g.o]);
    const S = await sgEngine();
    const line = sgLine(S, S.vrOf(d.g.vr), d.g.s, "o");
    const [first, second] = d.g.s === "x" ? [A, B] : [B, A];
    console.log(`  (začíná ${d.g.s === "x" ? "Mark" : "Radka"}, varianta ${S.vrOf(d.g.vr)}, ${line.length} tahů)`);
    for (const [k, m] of line.entries()) {
      const [P, O] = k % 2 === 0 ? [first, second] : [second, first];
      await sgTah(P, O, m, k === line.length - 1);
      if (k === 1) {
        for (const Q of [A, B]) await Q.page.screenshot({ path: `${SHOTS}/mistnost-zviratka-sogi-hra-${Q.nazev}.png` });
        await vejdeSe(A, "desktop (partie běží)", "hra");
        await vejdeSe(B, "iPhone (partie běží)", "hra");
      }
    }
    for (const P of [A, B]) await P.f.waitForSelector("#endBox:not([hidden])", { timeout: 15000 });
    check("partie skončila u obou", true);
    return 1;
  },
  primarni: (P) => P.f.locator("#endPrimary"),
  sekundarni: (P) => P.f.locator("#endOther"),
};
SOGI.fit = SOGI.fit.bind(SOGI);
SOGI.ovladani = SOGI.ovladani.bind(SOGI);

// ───────────────────────── Kvízové lodě (kvizove-lode) ─────────────────────────
// Námořní bitva s kvízem. Bez háčku na window; hraje se přes DOM pomocníky z repa hry (tests/lib.cjs: drive, fits, správné odpovědi ze zdrojů otázek),
// jen se čte, nic se tam nezapisuje (jiné umístění repa: proměnná KL_REPO). Mark zná flotilu soupeře (z jeho localStorage), odpovídá správně
// a střílí na jistotu → vyhraje (sedadlo 0); Radka střílí náhodně a odpovídá ze 2/3 špatně. Rozmístění: „Náhodně“ + „Hotovo“,
// první kategorii vybere ten, kdo nezačíná (fáze cat0).
const KL_REPO = process.env.KL_REPO || path.join(__dirname, "..", "..", "kvizove-lode");
let klLib = null;
const kl = () => klLib || (klLib = require(path.join(KL_REPO, "tests", "lib.cjs")));
const klFaze = (P) => P.f.evaluate(() => { const b = document.getElementById("board"); return b && !document.getElementById("game").hidden ? b.dataset.phase : ""; }).catch(() => "");
const KVIZ = {
  id: "kvizove-lode",
  nazev: "Nafukovací flotila", // název karty v Herně (hra sama se jmenuje Kvízové lodě)
  vitez: 0,
  skryteIds: ["copyTopBtn", "newGameBtn", "soloBtn", "setup", "intro", "share", "copyLinkBtn"],
  async pripravena(P) { await P.f.waitForSelector('#board[data-phase="place"]', { timeout: 40000 }); },
  async sedadla(A, B) {
    const w = async (P) => P.f.evaluate(() => document.getElementById("board").dataset.me);
    const [a, b] = [await w(A), await w(B)];
    check("Mark = x (sedadlo 0, zakladatel), Radka = o; obě ve fázi rozmístění", a === "x" && b === "o", [a, b]);
  },
  async bezUi(P) { return !(await P.f.locator("#setup").isVisible()) && !(await P.f.locator("#intro").isVisible()) && !(await P.f.locator("#share").isVisible()) && !(await P.f.locator("#soloBtn").isVisible()); },
  jmena: (P) => P.f.locator("#people").innerText(),
  selektory: { start: ["#randomBtn", "#doneBtn"], hra: [], konec: ["#rematchBtn", "#jinaHraBtn"] },
  // lib.fits: bez posouvání stránky, bazény, panel, karta otázky a ovladače celé v okně, text ≥ 14 px
  async fit(P, faze) {
    const bad = await kl().fits(P.f, P.nazev);
    const o = await fitFrame(P, this.selektory[faze] || []);
    return { ok: bad.length === 0 && o.ok, info: bad.length ? bad : o.info };
  },
  fitNazev: "hra se vejde do rámu (bez posunu, bazény, panel a ovládání v okně, text ≥ 14 px)",
  ovladani(faze) { return faze === "konec" ? ["#rematchBtn", "#jinaHraBtn"] : []; },
  async partie(A, B) {
    const { drive } = kl();
    for (const P of [A, B]) { await P.f.waitForSelector('#board[data-phase="place"]', { timeout: 20000 }); await P.f.click("#randomBtn"); await P.f.click("#doneBtn"); }
    let vybrano = false;
    for (let i = 0; i < 300 && !vybrano; i++) {
      for (const P of [A, B]) if ((await klFaze(P)) === "cat0") { await P.f.locator("#panel .chip").first().click(); vybrano = true; break; }
      if (!vybrano) await sleep(100);
    }
    check("po rozmístění si někdo vybral první kategorii", vybrano);
    const cfg = (P, win) => ({ name: P.nazev, diff: win ? [3, 2, 3] : [1, 2], right: win ? () => true : (i) => i % 3 === 0, aim: win ? "perfect" : "random", radar: win ? 1 : 0, cats: ["sport", "veda", "zemepis"], timeout: 500000 });
    const t0 = Date.now();
    // jednou za partii změřit rozvržení na iPhonu uprostřed hry (otázka / střelba), ne jen začátek a konec
    let zmereno = false;
    const mereni = (async () => {
      while (!zmereno && Date.now() - t0 < 500000) {
        const ph = await klFaze(B);
        if (/^(answer-me|shoot-me)$/.test(ph) && await B.f.locator("#qcard:not(.answered), #pwEnemy.aim").count().catch(() => 0)) {
          zmereno = true; await sleep(600);
          await B.page.screenshot({ path: `${SHOTS}/mistnost-kvizove-lode-hra-iphone.png` });
          await vejdeSe(B, `iPhone (fáze ${ph})`, "hra");
        }
        await sleep(300);
      }
    })();
    await Promise.all([drive(A.f, B.f, cfg(A, true)), drive(B.f, A.f, cfg(B, false))]);
    zmereno = true; await mereni.catch(() => {});
    await Promise.all([A, B].map((P) => P.f.waitForSelector("#endBox", { timeout: 20000 })));
    await sleep(1200);
    const nadpis = (P) => P.f.evaluate(() => document.getElementById("endTitle").textContent);
    console.log(`  (partie ${(Date.now() - t0) / 1000 | 0} s, „${await nadpis(A)}“ / „${await nadpis(B)}“)`);
    check("partie skončila u obou", true);
    return 0;
  },
  primarni: (P) => P.f.locator("#rematchBtn"),
  sekundarni: (P) => P.f.locator("#jinaHraBtn"),
};
KVIZ.fit = KVIZ.fit.bind(KVIZ);
KVIZ.ovladani = KVIZ.ovladani.bind(KVIZ);

// ───────────────────────── Čtyřka s otočkou (ctyrka-s-otockou) ─────────────────────────
// Hra vystavuje window.__c4 (g = {cfg, m, n}, me, view, animating, busy). Tahy volí živý src/engine.js hry (ESM, stáhne se a načte přes data: URL;
// stejné funkce replay/step jako ve hře): Mark (x, sedadlo 0) skládá čtyřku, Radka (o) se vyhýbá výhře i darování. Tah = najetí a klik do sloupce
// (desktop myší, iPhone dvěma tapy). Vítěz = sedadlo 0.
let c4Engine = null;
async function c4Eng() {
  if (c4Engine) return c4Engine;
  const t = await (await fetch(ZIVA.replace(/herna\/$/, "") + "ctyrka-s-otockou/src/engine.js", { cache: "no-store" })).text();
  if (/^\s*import\s/m.test(t)) throw new Error("engine.js hry už má importy, test ho neumí načíst samostatně");
  return (c4Engine = await import("data:text/javascript;base64," + Buffer.from(t).toString("base64")));
}
const c4St = (P) => P.f.evaluate(() => ({ g: __c4.g, me: __c4.me, anim: __c4.animating, busy: __c4.busy, view: __c4.view }));
function c4Vyber(E, s, me, winner) {
  const cols = [...Array(s.w).keys()].filter((c) => E.step(s, String(c)));
  const winsFor = (who) => cols.filter((c) => E.step({ ...s, turn: who }, String(c))?.st.over?.who === who);
  if (me === winner) { const w = winsFor(me); return w.length ? w[0] : cols[0]; }
  const bad = new Set([...winsFor(me), ...winsFor(winner)]);
  return [...cols].reverse().find((c) => !bad.has(c)) ?? cols[cols.length - 1];
}
async function c4Hod(E, P, col) {
  const g = await P.f.$("#grid"), box = await g.boundingBox();
  const w = E.replay((await c4St(P)).g.cfg, []).st.w;
  const pos = { x: (col + .5) * box.width / w, y: box.height * .5 };
  if (P.nazev === "iphone") { await g.tap({ position: pos }); await P.page.waitForTimeout(150); await g.tap({ position: pos }); }
  else { await P.page.mouse.move(box.x + pos.x, box.y + pos.y); await P.page.waitForTimeout(80); await P.page.mouse.click(box.x + pos.x, box.y + pos.y); }
}
const CTYRKA = {
  id: "ctyrka-s-otockou",
  nazev: "Čtyřka s otočkou",
  vitez: 0,
  skryteIds: ["setup", "share", "intro", "soloBtn", "linkBtn", "newBtn", "fsBtn"],
  async pripravena(P) { await P.f.waitForFunction(() => window.__c4 && __c4.view === "play" && __c4.me, null, { timeout: 40000 }); },
  async sedadla(A, B) {
    const [a, b] = [await c4St(A), await c4St(B)];
    check("Mark = x (sedadlo 0), Radka = o (sedadlo 1), stejná partie (n, cfg)", a.me === "x" && b.me === "o" && a.g.n === b.g.n && JSON.stringify(a.g.cfg) === JSON.stringify(b.g.cfg), [a.me, b.me, a.g.n, b.g.n]);
  },
  async bezUi(P) { return (await c4St(P)).view === "play" && !(await P.f.evaluate(() => ["setup", "share", "intro"].some((id) => document.getElementById(id).checkVisibility()))); },
  jmena: (P) => P.f.evaluate(() => document.getElementById("nmX").textContent + " " + document.getElementById("nmO").textContent),
  selektory: { start: ["#grid", "#rotL", "#rotR"], hra: ["#grid", "#rotL", "#rotR"], konec: ["#againBtn", "#otherBtn"] },
  async fit(P, faze) { return fitFrame(P, this.selektory[faze] || []); },
  fitNazev: "hra se vejde do rámu (bez posunu, deska a tlačítka otočky / konce celé nad spodní hranou iframe)",
  ovladani(faze) { return faze === "konec" ? ["#againBtn", "#otherBtn"] : []; },
  async partie(A, B) {
    const E = await c4Eng();
    let tahy = 0;
    for (let i = 0; i < 80; i++) {
      const s = await c4St(A);
      if (s.anim || s.busy) { await sleep(300); continue; }
      const r = E.replay(s.g.cfg, s.g.m).st;
      if (r.over) break;
      const [P, O] = r.turn === "x" ? [A, B] : [B, A], pred = s.g.m.length;
      await c4Hod(E, P, c4Vyber(E, r, r.turn, "x"));
      const ok = await cekej(async () => { const a = await c4St(P), b = await c4St(O); return a.g.m.length === pred + 1 && b.g.m.length === pred + 1 && !a.anim && !b.anim && !a.busy && !b.busy; }, 20000);
      if (!ok) throw new Error("tah nedošel druhému hráči");
      if (++tahy === 3) {
        for (const Q of [A, B]) await Q.page.screenshot({ path: `${SHOTS}/mistnost-ctyrka-s-otockou-hra-${Q.nazev}.png` });
        await vejdeSe(A, "desktop (partie běží)", "hra");
        await vejdeSe(B, "iPhone (partie běží)", "hra");
      }
    }
    const hotovo = await cekej(async () => { const [a, b] = [await c4St(A), await c4St(B)]; return E.replay(a.g.cfg, a.g.m).st.over && E.replay(b.g.cfg, b.g.m).st.over && !a.anim && !b.anim && !a.busy && !b.busy; }, 20000);
    check("partie skončila u obou", hotovo, { tahy });
    for (const P of [A, B]) await P.f.waitForSelector("#againBtn", { timeout: 20000 }).catch(() => {}); // karta konce přijde po dopřehrání animace
    console.log(`  (partie: ${tahy} tahů, vítěz = Mark)`);
    return 0;
  },
  primarni: (P) => P.f.locator("#againBtn"),
  sekundarni: (P) => P.f.locator("#otherBtn"),
};
CTYRKA.fit = CTYRKA.fit.bind(CTYRKA);
CTYRKA.ovladani = CTYRKA.ovladani.bind(CTYRKA);

// ───────────────────────── společné ─────────────────────────
let H = null;
// Stránka ve hře se nesmí posouvat a vybrané prvky musí být celé v rámu.
async function fitFrame(P, sel) {
  const r = await P.f.evaluate((sel) => {
    const o = { sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth, kde: {} };
    let ok = o.sh <= o.ih + 1 && o.sw <= o.iw + 1;
    for (const s of sel) {
      const e = document.querySelector(s);
      if (!e || !e.checkVisibility()) { ok = false; o.kde[s] = "chybí"; continue; }
      const b = e.getBoundingClientRect();
      if (b.top < -1 || b.bottom > o.ih + 1 || b.left < -1 || b.right > o.iw + 1) { ok = false; o.kde[s] = [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }
    }
    return { ok, o };
  }, sel);
  return { ok: r.ok, info: r.o };
}
// Lišta Herny nesmí zakrývat hru a hra se musí vejít (bez vodorovného posouvání, rám pod lištou, ovládání pod lištou).
async function vejdeSe(P, popis, faze) {
  const r = await P.page.evaluate(() => {
    const l = document.querySelector(".ram-lista").getBoundingClientRect();
    const fr = document.querySelector("#ram-telo iframe").getBoundingClientRect();
    return { listaDole: Math.round(l.bottom), ramHore: Math.round(fr.top), ramDole: Math.round(fr.bottom), vh: innerHeight, vw: innerWidth, strana: document.documentElement.scrollWidth };
  });
  check(`${popis}: rám hry začíná pod lištou a končí v okně`, r.ramHore >= r.listaDole - 1 && r.ramDole <= r.vh + 1 && r.strana <= r.vw, r);
  const h = await H.fit(P, faze);
  check(`${popis}: ${H.fitNazev}`, h.ok, h.info);
  const ovl = H.ovladani(faze);
  if (ovl.length) {
    const zakryte = [];
    for (const s of ovl) {
      const c = await P.f.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, s);
      if (!c) { zakryte.push(s + " (není)"); continue; }
      const kryje = await P.page.evaluate(({ c }) => {
        const fr = document.querySelector("#ram-telo iframe"), b = fr.getBoundingClientRect();
        const e = document.elementFromPoint(b.left + c.x, b.top + c.y);
        return e === fr;
      }, { c });
      if (!kryje) zakryte.push(s);
    }
    check(`${popis}: nic z Herny (lišta, karta) nezakrývá ovládání hry`, zakryte.length === 0, zakryte);
  }
}

async function scenar(hra, URL_) {
  H = hra;
  console.log(`\n══════ ${H.nazev} (${H.id}) v místnosti ${URL_} ══════`);
  const ch = await chromium.launch();
  const wk = await webkit.launch();
  const A = await kontext(ch, { viewport: { width: 1440, height: 900 } }, "Mark");
  const B = await kontext(wk, { ...devices["iPhone 13"] }, "Radka");
  const a = A.page, b = B.page;
  A.nazev = "desktop"; B.nazev = "iphone"; A.znak = "x"; B.znak = "o"; A.page = a; B.page = b;
  const id = H.id;
  const vitez = H.vitez;
  try {
    if (H.kontext) for (const C of [A, B]) await H.kontext(C.ctx);
    console.log("\nzaložení místnosti a vstup Radky");
    await a.goto(URL_, { waitUntil: "networkidle" });
    await a.waitForSelector("#pas:not([hidden])");
    await a.click("#pas-zalozit");
    await a.fill('input[name="ja"]', "Mark");
    await a.fill('input[name="on"]', "Radka");
    await a.click('#dlg-form [type="submit"]');
    await a.waitForURL(/#m=[0-9a-z]{10}$/, { timeout: 15000 });
    const odkaz = a.url();
    const mid = /#m=([0-9a-z]{10})$/.exec(odkaz)[1];
    await a.waitForSelector("#dlg .dlg-odkaz");
    await a.click('#dlg [data-dlg-zavri].tl');
    await b.goto(odkaz, { waitUntil: "networkidle" });
    await b.waitForSelector('#dlg:not([hidden]) [data-akce="vstoupit"]');
    await b.click('[data-akce="vstoupit"]');
    await b.waitForFunction(() => document.getElementById("sk-j1").classList.contains("je-ja"), null, { timeout: 15000 });
    check("Radka sedí na sedadle 1", true);
    check("Mark uvidí, že Radka vstoupila", await cekej(async () => /Hrajete spolu/.test(await a.textContent("#mist-stav"))));

    console.log(`\nMark vybere ${H.nazev}`);
    check(`karta ${H.nazev} je k hraní`, await a.$eval(`.hra[data-id="${id}"] .hra-odkaz`, (e) => !!e.href).catch(() => false));
    await a.click(`.hra[data-id="${id}"] .hra-odkaz`);
    check("Markovi se otevře hra v rámu", await cekej(() => viditelne(a, "#ram")));
    const reA = new RegExp(`/${id}/#herna=1&m=[0-9a-z]{10}&r=[0-9a-z]{10,16}&seat=0&names=Mark,Radka&zaklada=1$`);
    const reB = new RegExp(`/${id}/#herna=1&m=[0-9a-z]{10}&r=[0-9a-z]{10,16}&seat=1&names=Mark,Radka&zaklada=0$`);
    check(`Mark: ${id}/ s herna=1, seat=0, zaklada=1`, await cekej(async () => reA.test(await src(a))), await src(a));
    check(`Radka: karta „Mark chce hrát · ${H.nazev}“`, await cekej(async () => await viditelne(b, "#volba") && /Mark chce hrát/.test(await b.textContent(".volba-kdo")) && (await b.textContent(".volba-hra")) === H.nazev));
    check("Radce se hra přepne sama (seat=1, zaklada=0, stejné r)", await cekej(async () => await viditelne(b, "#ram") && reB.test(await src(b))), await src(b));
    const rA = /&r=([0-9a-z]+)&/.exec(await src(a))?.[1], rB = /&r=([0-9a-z]+)&/.exec(await src(b))?.[1];
    check("obě iframe mají stejné r hry", !!rA && rA === rB, [rA, rB]);
    check("r má 6 až 16 znaků (limit her)", !!rA && rA.length >= 6 && rA.length <= 16, rA);
    A.f = ramecek(a); B.f = ramecek(b);
    check(`obě iframe mají herna=1 a jsou z ${id}/`, /herna=1/.test(await src(a)) && /herna=1/.test(await src(b)) && A.f.url().includes(`/${id}/`) && B.f.url().includes(`/${id}/`), [A.f.url(), B.f.url()]);
    for (const P of [A, B]) await H.pripravena(P);
    check("obě hry sedí v partii", true);
    if (H.sedadla) await H.sedadla(A, B);
    check("nikdo nevidí výzvu ani setup", (await H.bezUi(A)) && (await H.bezUi(B)));
    const chips = await H.jmena(A);
    check("jména z Herny ve hře", chips.includes("Mark") && chips.includes("Radka"), chips.replace(/\s+/g, " "));
    if (H.dodatecne) await H.dodatecne(A, B);
    const skryte = [];
    for (const P of [A, B]) skryte.push(await P.f.evaluate((ids) => ids.filter((id) => { const e = document.getElementById(id); return e && e.checkVisibility(); }), H.skryteIds));
    check("hra skryje sdílení, výzvu a odkazy ven", skryte.every((s) => s.length === 0), skryte);
    check("karta volby zmizela (nic přes hru)", await cekej(async () => !(await viditelne(b, "#volba")), 4000));
    await a.waitForTimeout(500);
    await a.screenshot({ path: `${SHOTS}/mistnost-${id}-start-desktop.png` });
    await b.screenshot({ path: `${SHOTS}/mistnost-${id}-start-iphone.png` });
    await vejdeSe(A, "desktop", "start");
    await vejdeSe(B, "iPhone", "start");
    check("lišta Herny: Místnost + skóre 0 : 0 (u obou)", (await skore(a)) === "Mark0:0Radka" && (await skore(b)) === "Mark0:0Radka", [await skore(a), await skore(b)]);

    console.log(`\npartie (${H.nazev})`);
    const v = await H.partie(A, B);
    const sk = [v === 0 ? 1 : 0, v === 1 ? 1 : 0];
    const skTxt = `Mark${sk[0]}:${sk[1]}Radka`;
    check(`skóre ${sk[0]} : ${sk[1]} v liště u obou`, await cekej(async () => (await skore(a)) === skTxt && (await skore(b)) === skTxt), [await skore(a), await skore(b)]);
    await a.waitForTimeout(600);
    await a.screenshot({ path: `${SHOTS}/mistnost-${id}-konec-desktop.png` });
    await b.screenshot({ path: `${SHOTS}/mistnost-${id}-konec-iphone.png` });
    const sek = await H.sekundarni(B).textContent();
    check("konec: Odveta + Jiná hra", sek.trim() === "Jiná hra" && /odvet/i.test(await H.primarni(B).textContent()), sek);
    await vejdeSe(A, "desktop (konec)", "konec");
    await vejdeSe(B, "iPhone (konec)", "konec");
    await a.waitForTimeout(7000); // i pojistný zápis druhého hráče musí poznat, že už je započteno
    const w = v === null ? -1 : v;
    const d = await doc(mid);
    check(`dokument místnosti: sk ${sk.join()} a jeden záznam ${id} (w=${w})`, d.g && d.g.sk.join() === sk.join() && d.g.log.length === 1 && d.g.log[0].g === id && d.g.log[0].w === w, d.g);
    check(`skóre v liště po 7 s pořád ${sk[0]} : ${sk[1]}`, (await skore(a)) === skTxt && (await skore(b)) === skTxt);
    if (H.obnov) {
      // hra po obnovení znovu pošle pripraveno a stejný vysledek: nesmí se započítat podruhé
      await H.obnov(A);
      await a.waitForTimeout(7000);
      const dr = await doc(mid);
      check("po obnovení hry se výsledek nezapočetl podruhé (dokument: stejné sk, jeden záznam)", dr.g && dr.g.sk.join() === sk.join() && dr.g.log.length === 1, dr.g);
      check(`skóre v liště po obnovení pořád ${sk[0]} : ${sk[1]}`, (await skore(a)) === skTxt && (await skore(b)) === skTxt, [await skore(a), await skore(b)]);
    }
    if (vitez !== undefined && v !== vitez) console.log(`  POZOR: vítěz ${v} se liší od plánu ${vitez}`);

    console.log("\nJiná hra vrátí hráče do místnosti");
    await H.sekundarni(B).click();
    check("Radka je zpátky v místnosti", await cekej(async () => !(await viditelne(b, "#ram")) && await viditelne(b, "#hry")));
    check(`v místnosti skóre ${sk[0]} : ${sk[1]}`, (await b.textContent("#sk-0")) === String(sk[0]) && (await b.textContent("#sk-1")) === String(sk[1]), [await b.textContent("#sk-0"), await b.textContent("#sk-1")]);
    await b.waitForTimeout(500);
    await b.screenshot({ path: `${SHOTS}/mistnost-${id}-po-iphone.png` });
    await a.click("#ram-zpet");
    check("Mark zpátky v místnosti (lišta Místnost)", await cekej(async () => !(await viditelne(a, "#ram"))));
    const d2 = await doc(mid);
    check("po návratu pořád jeden záznam", d2.g.log.length === 1 && d2.g.sk.join() === sk.join(), d2.g);

    check("žádné chyby JavaScriptu", a.chyby.length === 0 && b.chyby.length === 0, a.chyby.concat(b.chyby));
  } finally {
    await ch.close().catch(() => {}); await wk.close().catch(() => {});
  }
}

(async () => {
  const HRY = { psanicko: PSANICKO, caranice: CARANICE, "jezci-prak": JEZKOMET, jezkomet: JEZKOMET, mlask: MLASK, "ovocny-souboj": OVOCNY, kaficka: KAFICKA, tancicky: TANCICKY, "jamka-na-miru": JAMKA, "zviratka-sogi": SOGI, "kvizove-lode": KVIZ, "ctyrka-s-otockou": CTYRKA };
  let URL_ = ZIVA;
  const ids = [];
  for (const arg of process.argv.slice(2)) {
    if (/^https?:\/\//.test(arg)) URL_ = arg;
    else if (HRY[arg]) ids.push(arg);
    else { console.error(`Neznámý argument „${arg}“. Hry: ${Object.keys(HRY).join(", ")}, nebo URL Herny.`); process.exit(2); }
  }
  if (!ids.length) ids.push("psanicko", "caranice", "jezci-prak", "mlask", "ovocny-souboj", "kaficka", "tancicky", "jamka-na-miru", "zviratka-sogi", "kvizove-lode", "ctyrka-s-otockou");
  for (const id of ids) await scenar(HRY[id], URL_);
  console.log(`\nVÝSLEDEK: ${ok} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
