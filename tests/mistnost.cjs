// Test místnosti Herny: node tests/mistnost.cjs [URL] (výchozí živá adresa). Playwright z globální instalace (NODE_PATH = npm root -g).
// Mark v Chromiu desktop 1440×900, Radka ve WebKitu iPhone 13. Do games.json se přidají dvě makety her:
// „maketa“ plní protokol Herny (tests/maketa), „maketa-stara“ ho neumí (tests/maketa-stara, výzva přes vlastní #r.<id>).
// Ověří: založení, pozvánku, pojistku proti přijetí pod jménem zakladatele, přijetí, přepnutí hry oběma směry,
// potvrzení uprostřed partie, předání výzvy staré hry, započtení výsledku jednou, „Jiná hra“, návrat po obnovení, třetí zařízení.
const { chromium, webkit, devices } = require("playwright");
const fs = require("fs");
const path = require("path");

const URL_ = process.argv[2] || "https://sachasportrezervace-arch.github.io/herna/";
const SHOTS = process.env.SHOTS || path.join(__dirname, "shots");
fs.mkdirSync(SHOTS, { recursive: true });
const MAKETA = new URL("tests/maketa/", URL_).href;
const STARA = new URL("tests/maketa-stara/", URL_).href;
let ok = 0, fail = 0;
function check(name, cond, info) {
  if (cond) { ok++; console.log("  PASS", name); } else { fail++; console.log("  FAIL", name, info === undefined ? "" : JSON.stringify(info)); }
}
const doc = async (id) => (await fetch(`https://mantledb.sh/v2/herna-${id}/mistnost`, { cache: "no-store" })).json();

async function kontext(browser, opts, jmeno) {
  const ctx = await browser.newContext(opts);
  await ctx.route(/\/games\.json(\?.*)?$/, async (route) => {
    const r = await route.fetch();
    const data = await r.json();
    data.hry.unshift(
      { id: "maketa", nazev: "Maketa", twist: "Testovací hra, která umí protokol Herny.", ikona: "ctyrka", barva: "#f7d36b", typ: "tahová", delka: "1 min", stav: "hraj", url: MAKETA, pravidla: ["Kdo klikne, vyhrál.", "Odveta je hned."] },
      { id: "maketa-stara", nazev: "Stará maketa", twist: "Testovací hra bez protokolu, výzva jde přes vlastní odkaz.", ikona: "kaficka", barva: "#f4c27a", typ: "tahová", delka: "1 min", stav: "hraj", url: STARA, pravidla: ["Založ výzvu, soupeř ji přijme.", "Kdo klikne, vyhrál."] }
    );
    await route.fulfill({ response: r, json: data });
  });
  const page = await ctx.newPage();
  page.chyby = [];
  page.on("pageerror", (e) => page.chyby.push(`${jmeno}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/mantledb|Failed to load resource/.test(m.text())) page.chyby.push(`${jmeno}: ${m.text()}`); });
  return { ctx, page };
}
const hra = (page) => page.frameLocator("#ram-telo iframe");
const src = (page) => page.$eval("#ram-telo iframe", (f) => f.src).catch(() => "");
const viditelne = (page, sel) => page.$eval(sel, (el) => !el.hidden && getComputedStyle(el).display !== "none").catch(() => false);
async function cekej(fn, ms = 15000) {
  const konec = Date.now() + ms;
  while (Date.now() < konec) { if (await fn().catch(() => false)) return true; await new Promise((r) => setTimeout(r, 250)); }
  return false;
}
async function rozvrzeni(page, nazev) {
  const r = await page.evaluate(() => {
    const vidim = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
    const male = [...document.querySelectorAll("button, a.tl, .mist-domu, a.hra-odkaz")].filter(vidim).map((el) => {
      const t = el.matches("a.hra-odkaz") ? el.closest(".hra") : el;
      const b = t.getBoundingClientRect();
      return { t: (el.textContent || "").trim().slice(0, 20), w: Math.round(b.width), h: Math.round(b.height) };
    }).filter((x) => x.w < 44 || x.h < 44);
    return { sirka: document.documentElement.scrollWidth, vw: innerWidth, male };
  });
  check(`${nazev}: bez vodorovného posouvání`, r.sirka <= r.vw, r);
  check(`${nazev}: dotykové cíle ≥ 44 px`, r.male.length === 0, r.male);
}

(async () => {
  const ch = await chromium.launch();
  const wk = await webkit.launch();
  const A = await kontext(ch, { viewport: { width: 1440, height: 900 } }, "Mark");
  const B = await kontext(wk, { ...devices["iPhone 13"] }, "Radka");
  const a = A.page, b = B.page;

  console.log("\nzaložení místnosti (Mark, Chromium 1440)");
  await a.goto(URL_, { waitUntil: "networkidle" });
  await a.waitForSelector("#pas:not([hidden])");
  check("úvod: pás Založit místnost", /Místnost pro dva/.test(await a.textContent("#pas")));
  await a.screenshot({ path: `${SHOTS}/mistnost-uvod-desktop.png` });
  await a.click("#pas-zalozit");
  await a.fill('input[name="ja"]', "Mark");
  await a.fill('input[name="on"]', "Radka");
  await a.screenshot({ path: `${SHOTS}/mistnost-zalozit-desktop.png` });
  await a.click('#dlg-form [type="submit"]');
  await a.waitForURL(/#m=[0-9a-z]{10}$/, { timeout: 15000 });
  const odkaz = a.url();
  const mid = /#m=([0-9a-z]{10})$/.exec(odkaz)[1];
  await a.waitForSelector("#dlg .dlg-odkaz");
  check("pozvánka ukáže odkaz místnosti", (await a.textContent("#dlg .dlg-odkaz")).trim() === odkaz, odkaz);
  await a.screenshot({ path: `${SHOTS}/mistnost-pozvanka-desktop.png` });
  await a.click('#dlg [data-dlg-zavri].tl');
  await a.waitForTimeout(300);
  check("hlavička: jména a skóre 0 : 0", (await a.textContent("#sk-j0")) === "Mark" && (await a.textContent("#sk-j1")) === "Radka" && (await a.textContent("#sk-0")) === "0" && (await a.textContent("#sk-1")) === "0");
  check("stav: odkaz zatím nikdo neotevřel + Poslat odkaz", /nikdo neotevřel/.test(await a.textContent("#mist-stav")) && await viditelne(a, "#mist-pozvat"));
  let d = await doc(mid);
  check("dokument: s0 = Mark, s1 volné, jména", d.s0 && d.s1 === "" && d.g.n.join() === "Mark,Radka", d);

  console.log("\npojistka: zakladatel na druhém zařízení (Chromium)");
  const D = await kontext(ch, { viewport: { width: 1280, height: 800 } }, "Mark-2");
  await D.page.goto(odkaz, { waitUntil: "networkidle" });
  await D.page.waitForSelector("#dlg:not([hidden]) .dlg-nadpis");
  check("pozvaný vidí „Mark tě zve do Herny“", /Mark tě zve do Herny/.test(await D.page.textContent("#dlg .dlg-nadpis")));
  const tlD = await D.page.$$eval("#dlg .tl", (l) => l.map((x) => x.textContent));
  check("tlačítka Jsem Radka / Tohle je moje místnost, jsem Mark", tlD[0] === "Jsem Radka, vstoupit" && /jsem Mark$/.test(tlD[1]), tlD);
  await D.page.click('[data-akce="jsem0"]');
  check("potvrzení „Hraješ tady jako Mark?“", /Hraješ tady jako Mark\?/.test(await D.page.textContent("#dlg .dlg-nadpis")));
  await D.page.click('[data-akce="potvrdit0"]');
  await D.page.waitForTimeout(400);
  check("druhé zařízení hraje za Marka", await D.page.$eval("#sk-j0", (e) => e.classList.contains("je-ja")));
  d = await doc(mid);
  check("místo pro Radku zůstalo volné", d.s1 === "", d.s1);
  await D.ctx.close();

  console.log("\nRadka přijme (WebKit iPhone 13)");
  await b.goto(odkaz, { waitUntil: "networkidle" });
  await b.waitForSelector('#dlg:not([hidden]) [data-akce="vstoupit"]');
  await b.screenshot({ path: `${SHOTS}/mistnost-pozvani-iphone.png` });
  await b.click('[data-akce="vstoupit"]');
  await b.waitForFunction(() => document.getElementById("sk-j1").classList.contains("je-ja"), null, { timeout: 15000 });
  check("Radka sedí na sedadle 1", true);
  d = await doc(mid);
  check("dokument: s1 obsazené", !!d.s1 && d.s1 !== d.s0);
  check("Mark uvidí, že Radka vstoupila", await cekej(async () => /Hrajete spolu/.test(await a.textContent("#mist-stav"))));
  await b.waitForTimeout(400);
  await b.screenshot({ path: `${SHOTS}/mistnost-iphone.png` });
  await b.screenshot({ path: `${SHOTS}/mistnost-iphone-cela.png`, fullPage: true });
  await rozvrzeni(b, "místnost iPhone");
  await a.screenshot({ path: `${SHOTS}/mistnost-desktop.png` });
  await rozvrzeni(a, "místnost desktop");

  console.log("\nMark vybere hru s protokolem");
  await a.click('.hra[data-id="maketa"] .hra-odkaz');
  check("Markovi se otevře hra v rámu", await cekej(() => viditelne(a, "#ram")));
  check("Mark: adresa hry s herna=1, seat=0, zaklada=1", await cekej(async () => /#herna=1&m=[0-9a-z]{10}&r=[0-9a-z]{10}k1&seat=0&names=Mark,Radka&zaklada=1$/.test(await src(a))), await src(a));
  check("Radka: karta „Mark chce hrát · Maketa“", await cekej(async () => await viditelne(b, "#volba") && /Mark chce hrát/.test(await b.textContent(".volba-kdo")) && (await b.textContent(".volba-hra")) === "Maketa"));
  await b.screenshot({ path: `${SHOTS}/mistnost-volba-iphone.png` });
  check("Radce se hra přepne sama (seat=1, zaklada=0)", await cekej(async () => await viditelne(b, "#ram") && /seat=1&names=Mark,Radka&zaklada=0$/.test(await src(b))), await src(b));
  check("oba hrají bez výzvy (Mark za Marka, Radka za Radku)", await cekej(async () => (await hra(a).locator("#m-ja").textContent()) === "Hraješ za Mark" && (await hra(b).locator("#m-ja").textContent()) === "Hraješ za Radka"));
  check("partie běží u obou", await cekej(async () => (await hra(a).locator("#m-stav").textContent()) === "Partie běží" && (await hra(b).locator("#m-stav").textContent()) === "Partie běží"));
  check("karta volby zmizela (nic přes hru)", await cekej(async () => !(await viditelne(b, "#volba")), 3000));
  await b.screenshot({ path: `${SHOTS}/mistnost-hra-iphone.png` });
  await a.screenshot({ path: `${SHOTS}/mistnost-hra-desktop.png` });

  console.log("\nvýsledek se započítá");
  await hra(b).locator("#m-vyhrat").click();
  check("skóre 0 : 1 v liště u obou", await cekej(async () => (await a.textContent("#ram-skore")).replace(/\s/g, "") === "Mark0:1Radka" && (await b.textContent("#ram-skore")).replace(/\s/g, "") === "Mark0:1Radka"), [await a.textContent("#ram-skore"), await b.textContent("#ram-skore")]);
  await a.waitForTimeout(7000); // i pojistný zápis Radky (po 4 s) musí poznat, že už je započteno
  d = await doc(mid);
  check("výsledek započtený jednou (sk 0:1, 1 záznam)", d.g.sk.join() === "0,1" && d.g.log.length === 1 && d.g.log[0].w === 1 && d.g.log[0].g === "maketa", d.g);

  console.log("\npřepnutí uprostřed partie chce potvrzení, stará hra bez protokolu");
  await hra(a).locator("#m-odveta").click();
  check("odveta běží", await cekej(async () => (await hra(a).locator("#m-stav").textContent()) === "Partie běží"));
  await a.click("#ram-zpet");
  check("Mark zpátky v místnosti", await cekej(async () => !(await viditelne(a, "#ram"))));
  check("místnost: Teď hrajete Maketa", /Teď hrajete\s*Maketa/.test(await a.textContent("#ted")) && await a.$eval('.hra[data-id="maketa"]', (li) => li.classList.contains("je-ted")));
  await a.screenshot({ path: `${SHOTS}/mistnost-ted-desktop.png` });
  await a.click('.hra[data-id="maketa-stara"] .hra-odkaz');
  await a.waitForSelector('#dlg:not([hidden]) [data-akce="prepnout"]');
  check("dotaz „Přepnout na Stará maketa?“", /Přepnout na Stará maketa\?/.test(await a.textContent("#dlg .dlg-nadpis")));
  await a.screenshot({ path: `${SHOTS}/mistnost-prepnout-desktop.png` });
  await a.click('[data-akce="prepnout"]');
  check("Mark: stará hra bez parametrů", await cekej(async () => (await src(a)) === STARA), await src(a));
  check("Radka: karta a pak „Mark zakládá partii“", await cekej(async () => await viditelne(b, "#ram-ceka") && /Mark zakládá partii/.test(await b.textContent("#ram-ceka"))));
  await b.screenshot({ path: `${SHOTS}/mistnost-ceka-iphone.png` });
  await hra(a).locator("#m-zalozit").click();
  check("Radce se otevře Markova výzva (#r.…)", await cekej(async () => /maketa-stara\/#r\.[0-9a-z]+$/.test(await src(b))), await src(b));
  check("Radka projde vlastní výzvou hry", await cekej(async () => (await hra(b).locator("#m-prijmout").count()) === 1));
  await hra(b).locator("#m-prijmout").click();
  check("stará hra běží u obou", await cekej(async () => (await hra(a).locator("#m-stav").textContent()) === "Partie běží" && (await hra(b).locator("#m-stav").textContent()) === "Partie běží"));

  console.log("\nRadka přepne zpátky (druhý směr)");
  await b.click("#ram-zpet");
  await b.waitForTimeout(300);
  await b.click('.hra[data-id="maketa"] .hra-odkaz');
  await b.waitForSelector('#dlg:not([hidden]) [data-akce="prepnout"]');
  check("Radka: dotaz na přepnutí rozehrané staré hry", /Přepnout na Maketa\?/.test(await b.textContent("#dlg .dlg-nadpis")));
  await b.screenshot({ path: `${SHOTS}/mistnost-prepnout-iphone.png` });
  await b.click('[data-akce="prepnout"]');
  check("Radka zakládá (seat=1, zaklada=1, k3)", await cekej(async () => /k3&seat=1&names=Mark,Radka&zaklada=1$/.test(await src(b))), await src(b));
  check("Mark: karta „Radka chce hrát“", await cekej(async () => await viditelne(a, "#volba") && /Radka chce hrát/.test(await a.textContent(".volba-kdo"))));
  await a.screenshot({ path: `${SHOTS}/mistnost-volba-desktop.png` });
  check("Markovi se hra přepne sama (zaklada=0)", await cekej(async () => /k3&seat=0&names=Mark,Radka&zaklada=0$/.test(await src(a))), await src(a));
  check("oba v nové partii", await cekej(async () => (await hra(a).locator("#m-stav").textContent()) === "Partie běží" && (await hra(b).locator("#m-stav").textContent()) === "Partie běží"));
  await hra(a).locator("#m-vyhrat").click();
  check("skóre 1 : 1 u obou", await cekej(async () => (await a.textContent("#ram-skore")).replace(/\s/g, "") === "Mark1:1Radka" && (await b.textContent("#ram-skore")).replace(/\s/g, "") === "Mark1:1Radka"));

  console.log("\nJiná hra, obnovení, třetí zařízení");
  await hra(a).locator("#m-jina").click();
  check("„Jiná hra“ vrátí Marka do místnosti", await cekej(async () => !(await viditelne(a, "#ram"))));
  await a.waitForTimeout(6000);
  d = await doc(mid);
  check("dokument: sk 1:1, 2 partie", d.g.sk.join() === "1,1" && d.g.log.length === 2, d.g);
  await a.reload({ waitUntil: "networkidle" });
  await a.waitForTimeout(1200);
  check("po obnovení: bez dialogu, Mark na svém místě, skóre 1 : 1", (await a.$eval("#dlg", (e) => e.hidden)) && await a.$eval("#sk-j0", (e) => e.classList.contains("je-ja")) && (await a.textContent("#sk-0")) === "1" && (await a.textContent("#sk-1")) === "1");
  check("poslední partie: 2 řádky", (await a.$$("#historie-seznam li")).length === 2);
  await a.screenshot({ path: `${SHOTS}/mistnost-skore-desktop.png` });
  await a.goto(URL_, { waitUntil: "networkidle" });
  await a.waitForSelector("#pas:not([hidden])");
  check("úvod: Vaše místnost Mark 1 : 1 Radka", /Vaše místnost\s*Mark 1 : 1 Radka/.test(await a.textContent("#pas")), await a.textContent("#pas"));
  await a.screenshot({ path: `${SHOTS}/mistnost-uvod-zpet-desktop.png` });
  const C = await kontext(wk, { ...devices["iPhone 13"] }, "Třetí");
  await C.page.goto(odkaz, { waitUntil: "networkidle" });
  await C.page.waitForSelector("#dlg:not([hidden]) .dlg-nadpis");
  check("třetí zařízení: „Kdo tu hraje?“", /Kdo tu hraje\?/.test(await C.page.textContent("#dlg .dlg-nadpis")));
  await C.ctx.close();

  check("žádné chyby JavaScriptu", a.chyby.length === 0 && b.chyby.length === 0, a.chyby.concat(b.chyby));
  await ch.close(); await wk.close();
  console.log(`\nVÝSLEDEK: ${ok} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
