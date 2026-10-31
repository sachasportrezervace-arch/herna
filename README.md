# Herna

Rozcestník her pro dva na jednom odkazu: https://sachasportrezervace-arch.github.io/herna/

Jedna statická stránka (bez buildu). Karty her se vykreslí z `games.json`, klik na kartu otevře hru, kde se zakládá výzva.
Na iPhonu jde dát na plochu (Sdílet, Přidat na plochu) a otevře se přes celou obrazovku.

## Soubory
- `index.html` – stránka a CSS (mobil na výšku, desktop od 960 px).
- `mistnost.js` – místnost pro dva (viz níže).
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

## Místnost
Adresa `https://sachasportrezervace-arch.github.io/herna/#m=<id>` je místnost pro dva: jména, aktuální hra, skóre a posledních
30 partií (mantledb `herna-<id>/mistnost`). Hru vybírá kdokoli, otevře se v iframe přes celou obrazovku s lištou
(Místnost, název, skóre) a druhému hráči se přepne sama. Kód je v `mistnost.js`. Hry, které umí protokol (meta
`herna-protokol`), dostanou parametry v adrese a hlásí výsledek do skóre; starým hrám Herna přepošle hash výzvy.
Protokol pro hry: `../HERNA-PROTOKOL.md`. Hry bez soupeře: u her se `solo: true` je v panelu Pravidla tlačítko
„Trénink bez soupeře“ (`#solo`), `tools/stavy.cjs` ověřuje, že `#solo` v Chromiu běží bez chyby a bez mantledb.

Test místnosti (Mark v Chromiu 1440, Radka ve WebKitu iPhone 13, makety her v `tests/maketa/` a `tests/maketa-stara/`):
```bash
NODE_PATH="$(npm root -g)" node tests/mistnost.cjs http://127.0.0.1:8807/
```
Bez argumentu běží proti živé adrese. Snímky jdou do `tests/shots/mistnost-*.png`.

## Test
```bash
NODE_PATH="$(npm root -g)" node tests/herna.cjs http://127.0.0.1:8807/
```
Bez argumentu testuje živou adresu. Chromium desktop 1280 a 1440, WebKit iPhone 13 a SE: stavy karet, načtení her, rozvržení,
dotykové cíle, pravidla, klik do hry, naposledy hráno, manifest a ikony, chování bez sítě.

Lokální server: `python -m http.server 8807 --bind 127.0.0.1`. Ikony na plochu: `node tools/ikona.cjs`.
