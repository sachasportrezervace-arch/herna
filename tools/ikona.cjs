// Ikona Herny: node tools/ikona.cjs
// Z postaviček v ikony.js složí icon.svg (kluk a holka nad oranžovým pultem) a vyrenderuje PNG 180, 192 a 512.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..");
let sprite = "";
const doc = { body: { insertAdjacentHTML: (_, h) => { sprite = h; } } };
new Function("document", fs.readFileSync(path.join(DIR, "ikony.js"), "utf8"))(doc);
const dvojice = sprite.match(/<symbol id="i-dvojice"[^>]*>([\s\S]*?)<\/symbol>/)[1];

// Postavičky (viewBox 260×150) zvětšené 2,2× tak, aby seděly bradou na nízkém pultu.
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
  '<rect width="512" height="512" fill="#1c2140"/>' +
  '<g transform="translate(-30 135) scale(2.2)">' + dvojice + "</g>" +
  '<rect x="0" y="432" width="512" height="80" fill="#ffb23f"/>' +
  '<rect x="0" y="426" width="512" height="8" fill="#231f1c"/>' +
  "</svg>\n";
fs.writeFileSync(path.join(DIR, "icon.svg"), svg);

(async () => {
  const b = await chromium.launch();
  for (const [n, s] of [["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${s}" height="${s}" `)}</body></html>`);
    await p.screenshot({ path: path.join(DIR, n) });
    await p.close();
    console.log(n, s);
  }
  await b.close();
})();
