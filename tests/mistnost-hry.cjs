// Skutečná hra (Psaníčko) v živé místnosti Herny: node tests/mistnost-hry.cjs [URL] (výchozí živá adresa).
// Playwright z globální instalace (NODE_PATH = npm root -g). Mark v Chromiu 1440×900, Radka ve WebKitu iPhone 13.
// Žádné makety a žádné přepisy games.json: je to ostrá Herna, ostré Psaníčko i ostrý mantledb.
// Ověří: založení, vstup Radky, výběr Psaníčka, automatické přepnutí Radce (herna=1, seat, zaklada), žádná výzva ani setup,
// partie do výhry (pět v řadě), skóre v liště a v dokumentu místnosti (jeden záznam, i po 7 s), „Jiná hra“ zpět do místnosti.
const { chromium, webkit, devices } = require("playwright");
const fs = require("fs");
const path = require("path");

const URL_ = process.argv[2] || "https://sachasportrezervace-arch.github.io/herna/";
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
  page.on("pageerror", (e) => page.chyby.push(`${jmeno}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/mantledb|Failed to load resource/.test(m.text())) page.chyby.push(`${jmeno}: ${m.text()}`); });
  return { ctx, page };
}
const hra = (page) => page.frameLocator("#ram-telo iframe");
const src = (page) => page.$eval("#ram-telo iframe", (f) => f.src).catch(() => "");
const viditelne = (page, sel) => page.$eval(sel, (el) => !el.hidden && getComputedStyle(el).display !== "none").catch(() => false);
const ramecek = (page) => page.frames().find((f) => f !== page.mainFrame());
async function cekej(fn, ms = 15000) {
  const konec = Date.now() + ms;
  while (Date.now() < konec) { if (await fn().catch(() => false)) return true; await new Promise((r) => setTimeout(r, 250)); }
  return false;
}

// Psaníčko: značky jsou <g stroke> v #board (bez .ghost); × má červený stroke. Index políčka = řádek * 15 + sloupec.
async function znacky(f) {
  return f.evaluate(() => [...document.querySelectorAll("#board > g[stroke]")].filter((g) => !g.classList.contains("ghost")).length);
}
async function tapni(page, f, i) {
  const box = await f.locator("#board").boundingBox();
  await page.mouse.click(box.x + ((i % 15) + 0.65) / 15.3 * box.width, box.y + (Math.floor(i / 15) + 0.65) / 15.3 * box.height);
  await f.locator("#confirmBtn:enabled").click();
}
// × (sedadlo 0, Mark) skládá pětku v řadě 7, ○ (sedadlo 1, Radka) táhne po řadě 0 a nikdy nemá pět.
async function dohrej(hraci, rada) {
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
// Lišta Herny nesmí zakrývat hru a hra se musí vejít (bez vodorovného posouvání, deska v rámu, pod lištou).
async function vejdeSe(P, popis) {
  const r = await P.page.evaluate(() => {
    const l = document.querySelector(".ram-lista").getBoundingClientRect();
    const fr = document.querySelector("#ram-telo iframe").getBoundingClientRect();
    return { listaDole: Math.round(l.bottom), ramHore: Math.round(fr.top), ramDole: Math.round(fr.bottom), vh: innerHeight, vw: innerWidth, strana: document.documentElement.scrollWidth };
  });
  check(`${popis}: rám hry začíná pod lištou a končí v okně`, r.ramHore >= r.listaDole - 1 && r.ramDole <= r.vh + 1 && r.strana <= r.vw, r);
  const h = await P.f.evaluate(() => {
    const d = document.querySelector("#board").getBoundingClientRect();
    return { l: Math.round(d.left), r: Math.round(d.right), t: Math.round(d.top), b: Math.round(d.bottom), vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth };
  });
  check(`${popis}: deska se vejde do rámu (vodorovně celá, svisle viditelná)`, h.l >= 0 && h.r <= h.vw + 1 && h.sw <= h.vw + 1 && h.t >= -1 && h.t < h.vh - 100, h);
}

(async () => {
  const ch = await chromium.launch();
  const wk = await webkit.launch();
  const A = await kontext(ch, { viewport: { width: 1440, height: 900 } }, "Mark");
  const B = await kontext(wk, { ...devices["iPhone 13"] }, "Radka");
  const a = A.page, b = B.page;
  A.nazev = "desktop"; B.nazev = "iphone"; A.znak = "x"; B.znak = "o"; A.page = a; B.page = b;

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

  console.log("\nMark vybere Psaníčko");
  check("karta Psaníčko je k hraní", await a.$eval('.hra[data-id="psanicko"] .hra-odkaz', (e) => !!e.href).catch(() => false));
  await a.click('.hra[data-id="psanicko"] .hra-odkaz');
  check("Markovi se otevře hra v rámu", await cekej(() => viditelne(a, "#ram")));
  check("Mark: psanicko/ s herna=1, seat=0, zaklada=1", await cekej(async () => /\/psanicko\/#herna=1&m=[0-9a-z]{10}&r=[0-9a-z]{10,16}&seat=0&names=Mark,Radka&zaklada=1$/.test(await src(a))), await src(a));
  check("Radka: karta „Mark chce hrát · Psaníčko“", await cekej(async () => await viditelne(b, "#volba") && /Mark chce hrát/.test(await b.textContent(".volba-kdo")) && (await b.textContent(".volba-hra")) === "Psaníčko"));
  check("Radce se hra přepne sama (seat=1, zaklada=0, stejné r)", await cekej(async () => await viditelne(b, "#ram") && /\/psanicko\/#herna=1&m=[0-9a-z]{10}&r=[0-9a-z]{10,16}&seat=1&names=Mark,Radka&zaklada=0$/.test(await src(b))), await src(b));
  const rA = /&r=([0-9a-z]+)&/.exec(await src(a))?.[1], rB = /&r=([0-9a-z]+)&/.exec(await src(b))?.[1];
  check("obě iframe mají stejné r hry", !!rA && rA === rB, [rA, rB]);
  A.f = ramecek(a); B.f = ramecek(b);
  check("obě iframe mají herna=1 a jsou z psanicko/", /herna=1/.test(await src(a)) && /herna=1/.test(await src(b)) && /\/psanicko\//.test(A.f.url()) && /\/psanicko\//.test(B.f.url()), [A.f.url(), B.f.url()]);
  for (const P of [A, B]) await P.f.locator("#game").waitFor({ timeout: 20000 });
  check("obě hry sedí v partii (#game)", true);
  check("nikdo nevidí výzvu (#intro) ani setup (#setup)", !(await A.f.locator("#intro").isVisible()) && !(await B.f.locator("#intro").isVisible()) && !(await A.f.locator("#setup").isVisible()) && !(await B.f.locator("#setup").isVisible()));
  const chips = await A.f.locator("#players").innerText();
  check("jména z Herny ve hře", chips.includes("Mark") && chips.includes("Radka"), chips.replace(/\s+/g, " "));
  const skryte = [];
  for (const P of [A, B]) skryte.push(await P.f.evaluate(() => ["newGameBtn", "copyTopBtn", "waitCopy", "fsBtn", "soloBtn", "share"].filter((id) => { const e = document.getElementById(id); return e && e.checkVisibility(); })));
  check("hra skryje sdílení, výzvu a odkazy ven", skryte.every((s) => s.length === 0), skryte);
  check("karta volby zmizela (nic přes hru)", await cekej(async () => !(await viditelne(b, "#volba")), 4000));
  await a.waitForTimeout(500);
  await a.screenshot({ path: `${SHOTS}/mistnost-psanicko-start-desktop.png` });
  await b.screenshot({ path: `${SHOTS}/mistnost-psanicko-start-iphone.png` });
  await vejdeSe(A, "desktop");
  await vejdeSe(B, "iPhone");
  check("lišta Herny: Místnost + skóre 0 : 0 (u obou)", (await a.textContent("#ram-skore")).replace(/\s/g, "") === "Mark0:0Radka" && (await b.textContent("#ram-skore")).replace(/\s/g, "") === "Mark0:0Radka", [await a.textContent("#ram-skore"), await b.textContent("#ram-skore")]);

  console.log("\npartie do výhry (Mark ×, pět v řadě)");
  await dohrej([A, B], 7);
  for (const P of [A, B]) await P.f.locator("#endBox").waitFor({ timeout: 15000 });
  check("partie skončila u obou", true);
  check("skóre 1 : 0 v liště u obou", await cekej(async () => (await a.textContent("#ram-skore")).replace(/\s/g, "") === "Mark1:0Radka" && (await b.textContent("#ram-skore")).replace(/\s/g, "") === "Mark1:0Radka"), [await a.textContent("#ram-skore"), await b.textContent("#ram-skore")]);
  await a.waitForTimeout(600);
  await a.screenshot({ path: `${SHOTS}/mistnost-psanicko-konec-desktop.png` });
  await b.screenshot({ path: `${SHOTS}/mistnost-psanicko-konec-iphone.png` });
  const sek = await B.f.locator("#endSecondary").textContent();
  check("konec: Odveta + Jiná hra", sek === "Jiná hra" && /odvet/i.test(await B.f.locator("#endPrimary").textContent()), sek);
  await vejdeSe(A, "desktop (konec)");
  await vejdeSe(B, "iPhone (konec)");
  await a.waitForTimeout(7000); // i pojistný zápis druhého hráče musí poznat, že už je započteno
  const d = await doc(mid);
  check("dokument místnosti: sk 1,0 a jeden záznam psanicko (vítěz 0)", d.g && d.g.sk.join() === "1,0" && d.g.log.length === 1 && d.g.log[0].g === "psanicko" && d.g.log[0].w === 0, d.g);
  check("skóre v liště po 7 s pořád 1 : 0", (await a.textContent("#ram-skore")).replace(/\s/g, "") === "Mark1:0Radka" && (await b.textContent("#ram-skore")).replace(/\s/g, "") === "Mark1:0Radka");

  console.log("\nJiná hra vrátí hráče do místnosti");
  await B.f.locator("#endSecondary").click();
  check("Radka je zpátky v místnosti", await cekej(async () => !(await viditelne(b, "#ram")) && await viditelne(b, "#hry")));
  check("v místnosti skóre 1 : 0", (await b.textContent("#sk-0")) === "1" && (await b.textContent("#sk-1")) === "0", [await b.textContent("#sk-0"), await b.textContent("#sk-1")]);
  await b.waitForTimeout(500);
  await b.screenshot({ path: `${SHOTS}/mistnost-psanicko-po-iphone.png` });
  await a.click("#ram-zpet");
  check("Mark zpátky v místnosti (lišta Místnost)", await cekej(async () => !(await viditelne(a, "#ram"))));
  const d2 = await doc(mid);
  check("po návratu pořád jeden záznam", d2.g.log.length === 1 && d2.g.sk.join() === "1,0", d2.g);

  check("žádné chyby JavaScriptu", a.chyby.length === 0 && b.chyby.length === 0, a.chyby.concat(b.chyby));
  await ch.close(); await wk.close();
  console.log(`\nVÝSLEDEK: ${ok} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
