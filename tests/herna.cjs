// Test Herny: node tests/herna.cjs [URL] (výchozí živá adresa). Playwright z globální instalace (NODE_PATH = npm root -g).
// Chromium desktop 1280×800 a WebKit iPhone 13 na výšku: karty, dostupnost her, pravidla, klik do hry, naposledy hráno,
// rozvržení (bez vodorovného posouvání, dotykové cíle ≥ 44 px), manifest a ikony, chování bez sítě. Snímky do tests/shots.
const { chromium, webkit, devices } = require("playwright");
const fs = require("fs");
const path = require("path");

const URL_ = process.argv[2] || "https://sachasportrezervace-arch.github.io/herna/";
const SHOTS = process.env.SHOTS || path.join(__dirname, "shots");
fs.mkdirSync(SHOTS, { recursive: true });
const hryJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "games.json"), "utf8"));
let ok = 0, fail = 0;
function check(name, cond, info) {
  if (cond) { ok++; console.log("  PASS", name); } else { fail++; console.log("  FAIL", name, info === undefined ? "" : JSON.stringify(info)); }
}

function innerHeightOf(ctxOpts) { return (ctxOpts.viewport || {}).height || 0; }

async function stavyHer(request) {
  const out = {};
  for (const h of hryJson.hry) {
    const url = hryJson.zaklad + h.id + "/";
    const r = await request.fetch(url, { method: "HEAD" }).catch(() => null);
    out[h.id] = { url, status: r ? r.status() : 0, hraj: h.stav === "hraj" };
  }
  return out;
}

// Každá hra se stavem „hraj“ se musí opravdu načíst: HTTP 200, žádná chyba JS, něco se vykreslí.
async function hrySeNactou(browser, stavy) {
  console.log("\nhry se stavem hraj se načtou");
  for (const [id, s] of Object.entries(stavy)) {
    if (!s.hraj) continue;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const chyby = [];
    page.on("pageerror", (e) => chyby.push(e.message));
    const r = await page.goto(s.url, { waitUntil: "load", timeout: 30000 }).catch(() => null);
    await page.waitForTimeout(2000);
    const vidi = await page.evaluate(() => [...document.querySelectorAll("body *")].some((el) => { const b = el.getBoundingClientRect(); return b.width > 40 && b.height > 40; })).catch(() => false);
    check(`${id} se načte (HTTP ${r ? r.status() : 0}, bez chyby JS, vykreslí se)`, r && r.status() === 200 && chyby.length === 0 && vidi, chyby);
    await ctx.close();
  }
}

async function scenar(browser, nazev, ctxOpts, stavy) {
  console.log(`\n${nazev}`);
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const chyby = [];
  page.on("pageerror", (e) => chyby.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") chyby.push(m.text()); });

  await page.goto(URL_, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const karty = await page.$$eval(".hra", (l) => l.map((li) => ({ id: li.dataset.id, brzy: li.classList.contains("je-brzy"), href: (li.querySelector("a.hra-odkaz") || {}).href || null, solo: (li.querySelector("a.hra-solo") || {}).href || null })));
  check(`${hryJson.hry.length} karet podle games.json`, karty.length === hryJson.hry.length, karty.length);
  for (const k of karty) {
    const s = stavy[k.id];
    const maBytHratelna = s.hraj && s.status === 200;
    check(`${k.id}: „${k.brzy ? "brzy" : "hraj"}“ odpovídá games.json + HTTP ${s.status}`, maBytHratelna === !k.brzy, k);
    if (!k.brzy) check(`${k.id}: odkaz vede na ${s.url}`, k.href === s.url, k.href);
    const maSolo = !k.brzy && !!(hryJson.hry.find((h) => h.id === k.id) || {}).solo;
    check(`${k.id}: „Zkusit sám“ ${maSolo ? "vede na #solo" : "není"}`, maSolo ? k.solo === s.url + "#solo" : k.solo === null, k.solo);
  }
  check("pás „Místnost pro dva“ s tlačítkem Založit", await page.evaluate(() => !document.getElementById("pas").hidden && !!document.getElementById("pas-zalozit")));
  const prvniBrzy = karty.findIndex((k) => k.brzy);
  check("hratelné hry jsou napřed", prvniBrzy === -1 || karty.slice(prvniBrzy).every((k) => k.brzy), karty.map((k) => k.id));
  const mobil = (ctxOpts.viewport || {}).width < 600;
  const plocha = await page.evaluate(() => !document.getElementById("plocha").hidden);
  check(mobil ? "iPhone: nápověda Přidat na plochu je vidět" : "desktop: nápověda Přidat na plochu skrytá", plocha === mobil, plocha);
  if (mobil) {
    const celych = await page.$$eval(".hra", (l) => l.filter((li) => li.getBoundingClientRect().bottom <= innerHeight).length);
    // Pás „Místnost pro dva“ je nad kartami (hlavní cesta ke hraní), proto o kartu méně než dřív.
    const minimum = innerHeightOf(ctxOpts) >= 660 ? 2 : 1;
    const pasCely = await page.$eval("#pas", (p) => p.getBoundingClientRect().bottom <= innerHeight);
    check(`první obrazovka: celý pás místnosti a aspoň ${minimum} celé karty`, pasCely && celych >= minimum, { pasCely, celych });
  }
  await page.screenshot({ path: `${SHOTS}/${nazev}.png` });
  await page.screenshot({ path: `${SHOTS}/${nazev}-cela.png`, fullPage: true });

  // rozvržení
  const roz = await page.evaluate(() => {
    const sirka = document.documentElement.scrollWidth, vw = window.innerWidth;
    const male = [...document.querySelectorAll("button, a.hra-odkaz, a.hra-solo, a.tl, .hra")].map((el) => {
      const target = el.matches("a.hra-odkaz") ? el.closest(".hra") : el;
      const r = target.getBoundingClientRect();
      return { t: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) };
    }).filter((x) => x.w && (x.w < 44 || x.h < 44));
    const ikonyOk = [...document.querySelectorAll(".hra-ikona use")].every((u) => document.querySelector(u.getAttribute("href")));
    return { sirka, vw, male, ikonyOk };
  });
  check("bez vodorovného posouvání", roz.sirka <= roz.vw, roz);
  check("dotykové cíle ≥ 44 px", roz.male.length === 0, roz.male);
  check("všechny ikony existují ve spritu", roz.ikonyOk);

  // pravidla
  const prvni = karty.find((k) => !k.brzy);
  await page.click(`.hra[data-id="${prvni.id}"] .hra-pravidla`);
  await page.waitForTimeout(350);
  const panel = await page.evaluate(() => {
    const p = document.getElementById("panel");
    const r = p.querySelector(".panel-list").getBoundingClientRect();
    return { hidden: p.hidden, pravidel: p.querySelectorAll(".panel-pravidla li").length, href: p.querySelector(".panel-hraj").href, videt: r.top < innerHeight && r.bottom > 0, fokus: document.activeElement.className };
  });
  check("panel s pravidly se otevře", !panel.hidden && panel.videt && panel.pravidel >= 2, panel);
  check("panel: tlačítko Hraj vede do hry", panel.href === stavy[prvni.id].url, panel.href);
  check("panel: fokus na Zavřít", /panel-zavri/.test(panel.fokus), panel.fokus);
  await page.screenshot({ path: `${SHOTS}/${nazev}-pravidla.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(350);
  check("Escape panel zavře", await page.evaluate(() => document.getElementById("panel").hidden));

  // klik do hry + naposledy hráno
  const cil = karty.filter((k) => !k.brzy)[1] || prvni;
  // Klik prstem doprostřed popisku: odkaz z názvu je přes ::after roztažený na celou kartu.
  const twist = page.locator(`.hra[data-id="${cil.id}"] .hra-twist`);
  await twist.scrollIntoViewIfNeeded();
  const bod = await twist.boundingBox();
  await Promise.all([page.waitForURL((u) => u.href.startsWith(stavy[cil.id].url), { timeout: 20000 }), page.mouse.click(bod.x + bod.width / 2, bod.y + bod.height / 2)]);
  check(`klik na kartu otevře ${cil.id}`, page.url().startsWith(stavy[cil.id].url), page.url());
  await page.goBack({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const posl = await page.$eval(`.hra[data-id="${cil.id}"]`, (li) => (li.querySelector(".hra-posl") || {}).textContent || "");
  check("naposledy hráno se ukáže na kartě", /Naposledy/.test(posl), posl);

  check("žádné chyby JavaScriptu", chyby.length === 0, chyby);
  await ctx.close();
}

async function bezSite(browser) {
  console.log("\nbez HEAD kontroly (síť k hrám spadne)");
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.route(/github\.io\/(?!herna)[^/]+\/$/, (r) => (r.request().method() === "HEAD" ? r.abort() : r.continue()));
  await page.goto(URL_, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const brzy = await page.$$eval(".je-brzy", (l) => l.map((x) => x.dataset.id).sort());
  const cekane = hryJson.hry.filter((h) => h.stav === "brzy").map((h) => h.id).sort();
  check("bez odpovědi platí stav z games.json", JSON.stringify(brzy) === JSON.stringify(cekane), { brzy, cekane });
  await ctx.close();
}

(async () => {
  const ch = await chromium.launch();
  const wk = await webkit.launch();
  const req = (await ch.newContext()).request;
  const stavy = await stavyHer(req);
  console.log("HTTP her:", Object.entries(stavy).map(([k, v]) => `${k} ${v.status}`).join(", "));

  console.log("\nmanifest a ikony");
  const man = await req.get(new URL("manifest.webmanifest", URL_).href);
  check("manifest 200", man.status() === 200, man.status());
  const m = JSON.parse(await man.text());
  check("manifest: standalone, start_url, ikony 192 a 512", m.display === "standalone" && m.start_url && ["192x192", "512x512"].every((s) => m.icons.some((i) => i.sizes === s)), m);
  for (const f of ["apple-touch-icon.png", "icon-192.png", "icon-512.png", "games.json"]) {
    const r = await req.get(new URL(f, URL_).href);
    check(`${f} 200`, r.status() === 200, r.status());
  }
  await hrySeNactou(ch, stavy);

  await scenar(ch, "desktop-chromium-1280", { viewport: { width: 1280, height: 800 } }, stavy);
  await scenar(ch, "desktop-chromium-1440", { viewport: { width: 1440, height: 900 } }, stavy);
  await scenar(wk, "iphone13-webkit", { ...devices["iPhone 13"] }, stavy);
  await scenar(wk, "iphone-se-webkit", { ...devices["iPhone SE"] }, stavy);
  await bezSite(wk);

  await ch.close(); await wk.close();
  console.log(`\nVÝSLEDEK: ${ok} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
