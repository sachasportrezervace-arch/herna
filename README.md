# Herna

Rozcestník her pro dva na jednom odkazu: https://sachasportrezervace-arch.github.io/herna/

Jedna statická stránka (bez buildu). Karty her se vykreslí z `games.json`, klik na kartu otevře hru, kde se zakládá výzva.
Na iPhonu jde dát na plochu (Sdílet, Přidat na plochu) a otevře se přes celou obrazovku.

## Soubory
- `index.html` – stránka a CSS (mobil na výšku, desktop od 960 px).
- `app.js` – karty, „naposledy hráno“ (localStorage), panel s pravidly, pojistka 404.
- `ikony.js` – vektorové ikony her a postavičky (SVG sprite).
- `games.json` – seznam her: název, twist, ikona, barva, typ, délka, stav (`hraj` / `brzy`), pravidla.
- `manifest.webmanifest`, `icon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` – přidání na plochu.

## Stavy her
„Hraj“ dostane jen hra, jejíž Pages URL vrací 200 a hra se v prohlížeči opravdu načte. Ověření a zápis:

```bash
NODE_PATH="$(npm root -g)" node tools/stavy.cjs --zapis
```

Pak commit a push. Stránka za běhu jen zamkne hru, která začne vracet 404; odemyká jen `games.json`.

Nová hra: přidej záznam do `games.json` (a ikonu do `ikony.js`), spusť `tools/stavy.cjs --zapis`.

## Test
```bash
NODE_PATH="$(npm root -g)" node tests/herna.cjs http://127.0.0.1:8807/
```
Bez argumentu testuje živou adresu. Chromium desktop 1280 a 1440, WebKit iPhone 13 a SE: stavy karet, načtení her, rozvržení,
dotykové cíle, pravidla, klik do hry, naposledy hráno, manifest a ikony, chování bez sítě.

Lokální server: `python -m http.server 8807 --bind 127.0.0.1`. Ikony na plochu: `node tools/ikona.cjs`.
