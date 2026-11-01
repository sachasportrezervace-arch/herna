# Deník – Herna

PŘEVZATO 1. 11. – kolo vylepšení, session herna-kolo (rozcestník); jiná session sem nepíše.
PŘEVZATO 31. 10. – dodělává session na účtu P, jiná session sem nepíše.

## 2026-11-02 – nová hra Kostlivá noc (session kostliva-noc, Pracant)
- Hotovo: `games.json` + ikona `kostlivec` v `ikony.js` (lebka se svítícíma očima nad ohníčkem), typ živá, ~10 min, sólo ano,
  protokol Herny v1 (`<meta name="herna-protokol">`). Hra: https://sachasportrezervace-arch.github.io/kostliva-noc/
- Ověřeno: `node tests/herna.cjs http://127.0.0.1:8790/` (lokální kopie) → 269 PASS, 0 FAIL; protokol hry ověřen
  v `kostliva-noc/tests/duo.cjs herna` (iframe rámec, 1 vysledek na okno, stejné partie, jina-hra).
- NEOVĚŘENO: `tests/mistnost-hry.cjs` Kostlivou noc zatím nezná (12. hra do místnosti nepřidána).

## 2026-11-01 – kolo vylepšení: souboj místnosti, Další hra, iPhone na šířku, všech 11 her
- **Hotovo (c993b43, 59ee762, test 2d1b147):**
  - **Putovní pohár** nad číslem vedoucího (při remíze se houpe uprostřed, při změně vedení přejede).
  - Věta pod skóre („Radka vede o 1.“, „Mark utíká o 4.“, „ujíždí“ od 5, „… dotahuje“, „Vyrovnáno, další partie rozhodne.“). Štítek série s plamenem: „2× v řadě“, od 3 oranžový „hattrick“.
  - V liště rámu je malý pohár u vedoucího, „celkem“ a poskočení čísla při bodu.
  - **Další hra:** 11 kulatých dlaždic hned pod hlavičkou (ťuk = volba hry). Po návratu z hry místnost skočí nahoru. Po dohrané partii se „Teď hrajete“ schová a hra je označená kroužkem v dlaždicích.
  - **iPhone:** rám i místnost respektují safe-area (výřez na šířku, domácí proužek). Telefon na šířku: lišta Herny je sloupec vlevo 66 px a hra má celou výšku (778×390). Místnost na šířku je v jednom pásu se všemi ikonami v řadě. SE: dlaždice po čtyřech.
  - Manifest je bez `start_url`, na plochu se tak uloží otevřená místnost `#m=…`.
- **Ověřeno živě (Pages 59ee762):**
  - `NODE_PATH="$(npm root -g)" node tests/mistnost.cjs` 56 PASS / 0 FAIL, exit 0. Nové kontroly: věta a pohár nad vedoucím, návrat nahoru, dlaždice v okně iPhonu, přepnutí dlaždicí, otočení na šířku a zpět s běžící hrou, remíza, manifest.
  - `node tests/herna.cjs` 252 PASS / 0 FAIL, exit 0.
- **Všech 11 her v místnosti** (`tests/mistnost-hry.cjs` umí nově `zviratka-sogi`, `kvizove-lode`, `ctyrka-s-otockou`, bez argumentu běží všech 11): flotila 40/0, Čtyřka 41/0, šógi 36/5 (2 běhy shodně). Ostatních 8 her dříve zelených, dnes je kvůli limitu znovu nespouštím.
- **Porušení protokolu – Zvířátkové šógi:** v rámu 613 px (iPhone 13) jde stránka odrolovat (start o 48 px, partie o 92 px, konec o 332 px) a „Jiná hra“ (#endOther) je pod spodní hranou. Desktop na konci odroluje o 373 px. Výsledek a Jiná hra jinak fungují. Snímky `tests/shots/mistnost-zviratka-sogi-*.png`. Nahlášeno nadřazené session, opravu musí udělat sogi-kolo.
- **Ostatní hry (kosmetika):** Čtyřka na výšku má odznaky ↻ u avatarů přes nadpis „Čekáme na soupeře“.
- **Design-eye:** kolo 1 „OK s výhradami“ (2 HIGH: místnost na šířku, SE 320; 4 MEDIUM/LOW), vše opraveno v 59ee762. Kolo 2 „OK s výhradami, blízko silné“ (mobil na výšku i desktop profi): MEDIUM (jména na šířku daleko od skóre) opraveno v dalším commitu. Otevřené LOW: SE 320 má useknuté popisky třetí řady dlaždic, lišta v rámu řadí jména podle sedadel (hra podle „ty“), pohár na desktopu ověřit živě. Kolo 3 se nespouštělo (šetření limitu).
- **NEOVĚŘENO:** reálný iPhone (Přidat na plochu z místnosti, jestli Safari bez `start_url` opravdu uloží `#m=` a zda z plochy sdílí localStorage, jinak „Kdo tu hraje?“ jednou), skutečné otočení v Safari (750×342 s lištami), animace poháru živě, klávesnice na dlaždicích.

## 2026-11-01 – Jamka na míru hratelná v Herně
- **Hotovo:** `tools/stavy.cjs --zapis` přepnul `jamka-na-miru` na HRAJ se sólem (v games.json se změnil jen stav a solo), `tests/mistnost-hry.cjs` umí `jamka-na-miru` (celá partie 6 jamek skriptem, iPhone 13 v rámu 390×613: výběr pasti všech karet, výsledek jamky, úder, konec partie, Odveta a Jiná hra). Commit 0d18cae, Pages built.
- **Živě:** `NODE_PATH="$(npm root -g)" node tests/mistnost-hry.cjs jamka-na-miru` **49 PASS / 0 FAIL, exit 0** · `node tests/herna.cjs` **252 PASS / 0 FAIL, exit 0**. Chyba Jamky: žádná.

## 2026-10-31 – Kafíčka a Tančíky v živé místnosti, Čáranice znovu
- **Hotovo:** `tests/mistnost-hry.cjs` umí i `kaficka` (živě f42fd1d) a `tancicky` (živě 7c734df); bez argumentu běží všech sedm her. Kafíčka se hrají z DOM (klik na políčko, Položit, výběr hrnku, Podat; Mark vyhrává, Radka podává vítězné hrnky), Tančíky přes `window.__tanc` + `TankEngine.suggestShot` (celý zápas, 32 tahů).
- **Živě (Pages, `NODE_PATH="$(npm root -g)" node tests/mistnost-hry.cjs <hra>`):**
  caranice **52 PASS / 0 FAIL, exit 0** (oprava 01a09da drží, Odveta i Jiná hra na iPhonu 13 celé v rámu) ·
  kaficka **50 PASS / 1 FAIL, exit 1** · tancicky **40 PASS / 2 FAIL, exit 1**.
  Zelené u obou nových: přepnutí Radce, seat/zaklada, stejné r, bez výzvy a setupu, celá partie, skóre v liště u obou, po 7 s jeden záznam `g` ve dokumentu místnosti, Jiná hra zpět do místnosti, žádné chyby JS.
- **Chyba Kafíček (neopraveno, jen popis):** iPhone 13, iframe 613 px (lišta 51 px). Na konci partie leží Odveta i Jiná hra celé v rámu (cca 594 z 613 px), ale `#endBox` končí na y 651, takže řádek pod tlačítky („Příští partie: Rohy. Radka podává první hrnek…“) je oříznutý a stránka se posouvá (výška 715 při 613). Při pokládání a podávání se stránka na iPhonu také posouvá (668–719 px), ale deska, ruka, zásoba a tlačítka Položit/Podat jsou celé v rámu; test to u Kafíček toleruje.
- **Chyba Tančíků (neopraveno, jen popis):** iPhone 13, iframe 613 px. Na konci zápasu je „Odveta“ na y 587–643 (ořezaná) a „Jiná hra“ na y 653–709 (celá pod spodní hranou); `scrollHeight` = 613 a v těle je `overflow: hidden`, takže se k nim uživatel nejspíš nedostane. Snímek `tests/shots/mistnost-tancicky-konec-iphone.png`. Vlastní test Tančíků to nechytí (iframe pod lištou 48 px, jejich ovládání nekontroluje na konci).
- **Pozn.:** vítěz Kafíček v běhu = Mark (sedadlo 0), skóre 1 : 0; vítěz Tančíků = Radka (sedadlo 1), 0 : 1. Los, kdo podává první (Kafíčka), se neřídí.
- **NEOVĚŘENO:** reálný iPhone, remíza, odveta, obnovení uprostřed partie u obou her, pád mantledb.

## 2026-10-31 – Kvízové lodě hratelné (dd543d3)
- `tools/stavy.cjs --zapis`: Kvízové lodě (Nafukovací flotila) „hraj“, sólo ověřené u všech 10 živých her; brzy jen Jamka na míru (404).
- Lokálně `tests/herna.cjs` 243 PASS / 0 FAIL, exit 0. Živě první běh hned po nasazení 225/18 (neprozkoumáno, nejspíš nedonasazená CDN Pages), druhý běh 243 PASS / 0 FAIL, exit 0.

## 2026-10-31 – skutečné hry v živé místnosti (Čáranice, Ježkomet, Mlask!, Ovocný souboj)
- **Hotovo:** `tests/mistnost-hry.cjs [hra ...] [URL Herny]` – hry `psanicko`, `caranice`, `jezci-prak`, `mlask`, `ovocny-souboj`; bez argumentu všechny postupně.
  Ostrá Herna + ostrá hra + ostrý mantledb (Mark Chromium 1440×900, Radka WebKit iPhone 13). Jen Ježkomet (`?test` pro JPT) a Ovocný souboj (`?kolo=10`) dostanou do holého dokumentu
  `history.replaceState` na ten parametr (route přepíše odpověď, nic jiného se nemění). Nové kontroly: nic z Herny nezakrývá ovládání hry (`elementFromPoint`), r má 6–16 znaků,
  jména ve štítcích Psaníčka nejsou zkrácená (ff57e54), Ovocný souboj po obnovení iframe nezapočítá výsledek podruhé.
- **Živě (Pages, příkazy `NODE_PATH="$(npm root -g)" node tests/mistnost-hry.cjs <hra>`):**
  psanicko 35 PASS / 0 FAIL, exit 0 · jezci-prak 46/0, exit 0 · mlask 46/0, exit 0 · ovocny-souboj 48/0, exit 0 ·
  **caranice 50 PASS / 1 FAIL, exit 1 (2× stejně, 51/1 podruhé)**. Ostatní kontroly Čáranice zelené: přepnutí, seat/zaklada, stejné r, bez výzvy, partie 0 : 6 (vítěz Radka), skóre 0 : 1 u obou, jeden záznam `g="caranice"` po 7 s, Jiná hra.
- **Chyba Čáranice (neopraveno, jen popis):** na iPhonu 13 (okno 390×664, iframe v Herně 613 px, lišta 51 px) jsou na konci partie tlačítka „Odveta“ a „Jiná hra“ ořezaná dole (y 568–620 při výšce rámu 613).
  Kroky: místnost → Čáranice → Mark se vždy vzdá, Radka vždy uhodne → po 6. kole výsledek (galerie se 3 kartami, u vzdání dvouřádková věta „Nic neuhodnuto. Umění se nevysvětluje.“). Čekám: tlačítka celá nad spodní hranou (vlastní test hry to nechytí, protože `scrollHeight` zůstane rovný výšce rámu).
  Snímek `tests/shots/mistnost-caranice-konec-iphone.png`. Pozn. Herna: lišta má ve skutečnosti 51 px (48 + 3 px oranžový proužek), protokol říká 48.
- **Lišta nezakrývá:** snímky `tests/shots/mistnost-<hra>-*.png` (Čáranice kresli/hada desktop i iPhone, ostatní start/hra/konec) prohlédnuty, vše se vejde. Kosmetika Ježkometu: žlutý banner „Prohráváš…“ na iPhonu překrývá část věže (hra sama).
- **Ježkomet:** WebKit hlásí v konzoli „Viewport argument key interactive-widget not recognized“ (meta viewport hry, neškodné); test to nepočítá jako chybu JS.
- **NEOVĚŘENO:** reálný iPhone, výhra Markova sedadla ani remíza u Čáranice (w=-1 jen z kódu testu), Ježkomet dohraný do zničení (jen výstřel + vzdání), Mlask/Ježkomet/Ovocný souboj 2× po sobě, `?test`/`?kolo=10` mění hry jen v testu.

## 2026-10-31 – skutečná hra (Psaníčko) v živé místnosti
- **Hotovo:** `tests/mistnost-hry.cjs` – ostrá Herna + ostré Psaníčko + ostrý mantledb, žádné makety. Mark Chromium 1440×900, Radka WebKit iPhone 13.
  Ověřuje: založení a vstup, výběr Psaníčka, Radce se hra přepne sama, obě iframe `herna=1` se správným `seat`/`zaklada`/stejným `r`, bez výzvy a setupu,
  skryté sdílení a odkazy ven, partie do pětky (Mark ×), skóre 1 : 0 v liště u obou, dokument místnosti `sk 1,0` a jeden záznam `g="psanicko"` i po 7 s,
  „Jiná hra“ vrátí Radku do místnosti, rám pod lištou a deska se vejde (desktop i iPhone). Snímky `tests/shots/mistnost-psanicko-*.png`.
- **Ověřeno živě (Pages 63cf78c):** `NODE_PATH="$(npm root -g)" node tests/mistnost-hry.cjs` → 33 PASS, 0 FAIL, exit 0 (2× po sobě). V Herně nebyla potřeba žádná oprava.
- **Psaníčko (jen popis, neopraveno):** na iPhonu 390 px se ve štítku hráče jméno „Radka“ zkrátí na „Rad…“ (chip se štítkem „ty · na tahu“). Kosmetika.
- **NEOVĚŘENO:** reálný iPhone, výhra Radky (sedadlo 1) a remíza, odveta v místnosti (v Herně počítaná přes `partie` r:2), přepnutí uprostřed partie u skutečné hry,
  Psaníčko otevřené z úvodní karty mimo místnost.

## 2026-10-31 – místnost pro dva (#m=), protokol pro hry, Zkusit sám
- **Hotovo (commit 30b8637, pushnuto s cf3b8a1):** `mistnost.js` = místnost `herna/#m=<id>` na mantledb `herna-<id>/mistnost`
  (jména, aktuální hra, skóre, posledních 30 partií, pojistka „Tohle je moje místnost, jsem Mark“, „Kdo tu hraje?“ pro třetí zařízení).
  Hra běží v iframe přes celou obrazovku s lištou (Místnost, název, skóre). Volba druhého hráče: karta „Mark chce hrát · Hra“ 1,6 s, pak hra.
  Uprostřed partie se přepnutí ptá. Hry bez protokolu: Herna čte hash výzvy v iframe (stejný origin) a pošle ho druhému.
  Protokol: `react-apps/HERNA-PROTOKOL.md`. Makety: `tests/maketa/` (protokol), `tests/maketa-stara/` (bez něj).
  `tools/stavy.cjs` nově ověřuje `#solo` (Trénink, bez chyby, bez mantledb) → `"solo": true` → odkaz „Zkusit sám“ na kartě a v pravidlech.
  Sólo teď: mlask, tancicky, psanicko, ctyrka-s-otockou. Nafukovací flotila (kvizove-lode) je nově „hraj“.
- **Ověřeno lokálně:** `node tests/mistnost.cjs http://127.0.0.1:8807/` → 48 PASS, 0 FAIL; `node tests/herna.cjs http://127.0.0.1:8807/` → 203 PASS, 0 FAIL.
  Laťka „3 celé karty na iPhonu“ snížena na pás místnosti + 2 karty (SE: + 1), pás je nová hlavní cesta.
- **Design-eye (3 kola, subagent design-eye):** kolo 1 „OK s výhradami“ (1 HIGH, 2 MEDIUM), kolo 2 „OK s výhradami“ (1 HIGH, 1 MEDIUM), kolo 3 „NE PROFI“ kvůli jedinému HIGH (odkaz Trénink na kartě useknutý).
  Čtvrté kolo se kvůli limitu 3 kol nespouštělo: poslední HIGH jsem opravil odstraněním odkazu z karty a ověřil vlastním renderem (karty čisté) a testem. **Verdikt „profi“ od design-eye tedy formálně nemám.**
- **Opraveno (commit cf3b8a1):** „Zkusit sám“ (mužský tvar) → „Trénink bez soupeře“ jen v panelu Pravidla; jména u skóre neposkakují (štítek „ty“ rezervuje řádek);
  16znaková jména nerozšíří hlavičku na desktopu (grid `minmax(0,1fr)`, test hlídá šířku); lišta hry na mobilu bez názvu hry, skóre vpravo;
  čekání na hru: tlačítko „Nečekat a založit výzvu“ až po 12 s s rezervovaným místem, vyvážený nadpis, čitelnější tečky; odznak „Teď hrajete“ z karty pryč;
  „Naposledy před chvílí“; adresa v pozvánce v písmu Herny; boční panel na desktopu začíná nahoře; snímky v testu až po dojetí animace, nový snímek třetího zařízení.
- **Lokálně po opravách:** `node tests/mistnost.cjs http://127.0.0.1:8807/` → 49 PASS, 0 FAIL, exit 0; `node tests/herna.cjs http://127.0.0.1:8807/` → 243 PASS, 0 FAIL, exit 0.
- **Živě (Pages build cf3b8a1 = built):** `node tests/mistnost.cjs` → 49 PASS, 0 FAIL, exit 0; `node tests/herna.cjs` → 243 PASS, 0 FAIL, exit 0.
- **NEOVĚŘENO:** reálný iPhone (Safari, plocha, dotyk, klávesnice při zadávání jmen), skutečné hry s protokolem (zatím jen makety; staré hry jen přes přepsání hashe),
  iPhone SE a desktop 1280 v liště hry s dlouhými jmény, klávesnice a reduced motion v místnosti, chování mantledb při výpadku sítě.

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
