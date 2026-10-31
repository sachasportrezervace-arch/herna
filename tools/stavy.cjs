// Stavy her: node tools/stavy.cjs [--zapis]
// Pro každou hru z games.json ověří Pages URL (HTTP 200) a že se hra v Chromiu načte (bez chyby JS, něco vykreslí).
// „hraj“ dostane jen hra, která projde obojím. S --zapis přepíše stav v games.json. Exit 0 i při „brzy“ (to je stav, ne chyba).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SOUBOR = path.join(__dirname, "..", "games.json");
const data = JSON.parse(fs.readFileSync(SOUBOR, "utf8"));

async function overHru(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const chyby = [];
  page.on("pageerror", (e) => chyby.push(e.message));
  try {
    const r = await page.goto(url, { waitUntil: "load", timeout: 30000 });
    const status = r ? r.status() : 0;
    if (status !== 200) return { status, nacte: false, duvod: "HTTP " + status };
    await page.waitForTimeout(2500);
    const obsah = await page.evaluate(() => {
      const viditelne = [...document.querySelectorAll("body *")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 40 && r.height > 40 && getComputedStyle(el).visibility !== "hidden";
      }).length;
      return { titulek: document.title, viditelne };
    });
    const nacte = chyby.length === 0 && obsah.viditelne > 0;
    return { status, nacte, titulek: obsah.titulek, duvod: nacte ? "" : chyby[0] || "nic se nevykreslilo" };
  } catch (e) {
    return { status: 0, nacte: false, duvod: e.message.split("\n")[0] };
  } finally {
    await ctx.close();
  }
}

// Sólo (react-apps/HRY-SOLO-2026-10-31.md): <url>#solo ukáže „Trénink“, nespadne a nevolá sync (mantledb.sh).
// Jen pak dostane hra v games.json "solo": true a Herna u ní ukáže v panelu Pravidla tlačítko „Trénink bez soupeře“.
async function overSolo(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const chyby = [], sync = [];
  page.on("pageerror", (e) => chyby.push(e.message));
  page.on("request", (r) => { if (r.url().includes("mantledb.sh")) sync.push(r.method() + " " + r.url()); });
  try {
    const r = await page.goto(url + "#solo", { waitUntil: "load", timeout: 30000 });
    if (!r || r.status() !== 200) return { solo: false, duvod: "HTTP " + (r ? r.status() : 0) };
    await page.waitForTimeout(3500);
    const trenink = await page.evaluate(() => /trénink/i.test(document.body.innerText));
    const solo = trenink && chyby.length === 0 && sync.length === 0;
    return { solo, duvod: solo ? "" : !trenink ? "bez „Trénink“" : chyby[0] || "sync: " + sync[0] };
  } catch (e) {
    return { solo: false, duvod: e.message.split("\n")[0] };
  } finally {
    await ctx.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  let zmen = 0;
  for (const h of data.hry) {
    const url = h.url || data.zaklad + h.id + "/";
    const v = await overHru(browser, url);
    const novy = v.nacte ? "hraj" : "brzy";
    if (novy !== h.stav) zmen++;
    const s = novy === "hraj" ? await overSolo(browser, url) : { solo: false, duvod: "" };
    if (!!h.solo !== s.solo) zmen++;
    console.log(`${novy === "hraj" ? "HRAJ" : "brzy"}  ${h.id.padEnd(18)} HTTP ${v.status}  ${v.titulek ? "„" + v.titulek + "“" : ""} ${v.duvod}${novy !== h.stav ? "  (bylo " + h.stav + ")" : ""}` +
      (novy === "hraj" ? `  sólo: ${s.solo ? "ano" : "ne (" + s.duvod + ")"}` : ""));
    h.stav = novy;
    if (s.solo) h.solo = true; else delete h.solo;
  }
  await browser.close();
  if (process.argv.includes("--zapis")) {
    fs.writeFileSync(SOUBOR, JSON.stringify(data, null, 2) + "\n");
    console.log(`games.json zapsán, změn: ${zmen}`);
  } else console.log(`změn proti games.json: ${zmen} (zapiš přes --zapis)`);
})();
