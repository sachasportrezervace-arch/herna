# Deník – Herna

PŘEVZATO 31. 10. – dodělává session na účtu P, jiná session sem nepíše.

## 2026-10-31 – místnost pro dva (#m=), protokol pro hry, Zkusit sám
- **Hotovo (commit 30b8637, zatím nepushnuto):** `mistnost.js` = místnost `herna/#m=<id>` na mantledb `herna-<id>/mistnost`
  (jména, aktuální hra, skóre, posledních 30 partií, pojistka „Tohle je moje místnost, jsem Mark“, „Kdo tu hraje?“ pro třetí zařízení).
  Hra běží v iframe přes celou obrazovku s lištou (Místnost, název, skóre). Volba druhého hráče: karta „Mark chce hrát · Hra“ 1,6 s, pak hra.
  Uprostřed partie se přepnutí ptá. Hry bez protokolu: Herna čte hash výzvy v iframe (stejný origin) a pošle ho druhému.
  Protokol: `react-apps/HERNA-PROTOKOL.md`. Makety: `tests/maketa/` (protokol), `tests/maketa-stara/` (bez něj).
  `tools/stavy.cjs` nově ověřuje `#solo` (Trénink, bez chyby, bez mantledb) → `"solo": true` → odkaz „Zkusit sám“ na kartě a v pravidlech.
  Sólo teď: mlask, tancicky, psanicko, ctyrka-s-otockou. Nafukovací flotila (kvizove-lode) je nově „hraj“.
- **Ověřeno lokálně:** `node tests/mistnost.cjs http://127.0.0.1:8807/` → 48 PASS, 0 FAIL; `node tests/herna.cjs http://127.0.0.1:8807/` → 203 PASS, 0 FAIL.
  Laťka „3 celé karty na iPhonu“ snížena na pás místnosti + 2 karty (SE: + 1), pás je nová hlavní cesta.
- **Další krok:** design-eye „profi“ (rendery v tests/shots/mistnost-*.png), opravy, push, živý test obou testů, sem výsledek.

## 2026-10-31 – nové živé hry
- Polštářovka → **Mlask!**: id `mlask` (nové repo, stará adresa přesměrovává), nový twist a pravidla s tajnou obranou, nová ikona dílku dortu.
- `tools/stavy.cjs --zapis`: hraj nově Čtyřka s otočkou a Čáranice (Kafíčka po pushi cf776e9 se načtou). Brzy zůstávají Kvízové lodě a Jamka na míru (404).
- Lokálně `node tests/herna.cjs http://127.0.0.1:8807/` → 150 PASS, 0 FAIL, exit 0.
- Živě `node tests/herna.cjs` (commit 207e481) → 150 PASS, 0 FAIL, exit 0.

## 2026-10-31 – dokončení a nasazení (session na účtu P, převzato po `d14c4a27`)
- **Hotovo:**
  - Návrh B „večerní automat“ (design-eye kolo 1: lepší, ale nebyl profi) dotažený: kompaktní mobilní karta (text a ikona nahoře, typ, délka, Pravidla a Hraj v řádku), na iPhonu 390×664 jsou vidět 3 celé karty.
  - Ruční optická velikost písma (WebKit jinak slévá písmena), hratelné hry napřed, nápověda „Přidat na plochu“ jen v Safari na iPhonu.
  - Manifest a ikony na plochu (`tools/ikona.cjs`: icon.svg, PNG 180, 192 a 512).
  - Stavy her: `tools/stavy.cjs` ověří HTTP 200 a že se hra v Chromiu načte bez chyby JS, s `--zapis` je zapíše do games.json. Stránka za běhu jen zamkne hru, která začne vracet 404, a nic neodemyká.
  - Design-eye kolo 2: **PROFI** (OK s výhradami). LOW opravy hned: pruh zarovnaný s mřížkou, větší ikona na plochu, větší písmo karet na desktopu, panel na desktopu vystředěný.
  - Nové veřejné repo `sachasportrezervace-arch/herna`, Pages z `main`.
- **Ověřeno:** `node tests/herna.cjs http://127.0.0.1:8807/` → 140 PASS, 0 FAIL, exit 0 (Chromium 1280 a 1440, WebKit iPhone 13 a SE).
- **Živě:** `node tests/herna.cjs` (https://sachasportrezervace-arch.github.io/herna/) → 140 PASS, 0 FAIL, exit 0.
- **Stavy 31. 10.:** hraj = Psaníčko, Kafíčka, Zvířátkové šógi, Ježkomet, Ovocný souboj, Polštářovka, Tančíky. Brzy (404) = Kvízové lodě (Nafukovací flotila), Jamka na míru, Čtyřka s otočkou, Čáranice.
- **NEOVĚŘENO:** tloušťka písma a režim z plochy na fyzickém iPhonu (Playwright WebKit na Windows kreslí 400 skoro jako 800).
- **Zbývá:** při každé nové živé hře spustit `tools/stavy.cjs --zapis`, commit a push, živý test. Polštářovka se přejmenovává na „Mlask!“: až bude živě, změnit v games.json název a twist.
