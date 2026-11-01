// Vektorové ikony her a postaviček. Vloží se jako <svg> sprite, používá se přes <use href="#i-…">.
(function () {
  var K = "#231f1c"; // obrys
  var S = 'stroke="' + K + '" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"';
  var sym = {
    // psaníčko se sázkovou pečetí
    psanicko:
      '<rect x="7" y="17" width="50" height="34" rx="4" fill="#fff8ee" ' + S + '/>' +
      '<path d="M8 19 L32 37 L56 19" fill="#f6e6cf" ' + S + '/>' +
      '<circle cx="32" cy="38" r="8.5" fill="#e04a4a" ' + S + '/>' +
      '<path d="M28.6 34.6 L35.4 41.4 M35.4 34.6 L28.6 41.4" stroke="#fff8ee" stroke-width="2.6" stroke-linecap="round"/>',
    // hrnek shora
    kaficka:
      '<circle cx="30" cy="34" r="23" fill="#f3e3cc" ' + S + '/>' +
      '<rect x="46" y="28" width="14" height="10" rx="5" fill="#fffaf2" ' + S + '/>' +
      '<circle cx="30" cy="34" r="15" fill="#fffaf2" ' + S + '/>' +
      '<circle cx="30" cy="34" r="10.5" fill="#6b3d24"/>' +
      '<path d="M25 34 a5 5 0 1 1 5 5" fill="none" stroke="#f6dcb6" stroke-width="2.6" stroke-linecap="round"/>',
    // lev se šibalským úsměvem
    sogi:
      '<circle cx="32" cy="33" r="25" fill="#e8892c" ' + S + '/>' +
      '<circle cx="32" cy="35" r="16" fill="#ffd27a" ' + S + '/>' +
      '<circle cx="18" cy="17" r="5" fill="#ffd27a" ' + S + '/>' +
      '<circle cx="46" cy="17" r="5" fill="#ffd27a" ' + S + '/>' +
      '<path d="M24 30 q3 -3 6 0 M34 30 q3 -3 6 0" fill="none" ' + S + '/>' +
      '<path d="M29.5 36 h5 l-2.5 3 z" fill="' + K + '"/>' +
      '<path d="M26 42 q6 5 12 -1" fill="none" ' + S + '/>',
    // ježek v letu, vyděšený
    jezek:
      '<path d="M32 6 L37 15 L47 10 L47 21 L58 22 L52 31 L60 39 L49 42 L50 53 L40 49 L34 59 L28 50 L18 55 L18 44 L7 41 L14 32 L6 24 L17 21 L16 10 L26 15 Z" fill="#7a5236" ' + S + '/>' +
      '<circle cx="33" cy="34" r="13.5" fill="#f2d9b4" ' + S + '/>' +
      '<circle cx="28" cy="31" r="4.6" fill="#fff" ' + S + ' stroke-width="2.4"/>' +
      '<circle cx="38.5" cy="31" r="4.6" fill="#fff" ' + S + ' stroke-width="2.4"/>' +
      '<circle cx="28.8" cy="31.5" r="1.4" fill="' + K + '"/>' +
      '<circle cx="39.3" cy="31.5" r="1.4" fill="' + K + '"/>' +
      '<ellipse cx="33.5" cy="40.5" rx="2.8" ry="3.4" fill="' + K + '"/>',
    // dílek melounu
    ovoce:
      '<path d="M7 20 Q32 34 57 20 L34 58 Q32 61 30 58 Z" fill="#ef5b52" ' + S + '/>' +
      '<path d="M7 20 Q32 34 57 20" fill="none" stroke="#4f9b45" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M7 20 Q32 34 57 20" fill="none" stroke="#9fd67f" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M4 20 Q32 38 60 20" fill="none" stroke="' + K + '" stroke-width="3.2" stroke-linecap="round"/>' +
      '<path d="M8.5 15.5 Q32 30 55.5 15.5" fill="none" stroke="' + K + '" stroke-width="3.2" stroke-linecap="round"/>' +
      '<ellipse cx="24" cy="34" rx="1.7" ry="2.5" fill="' + K + '"/><ellipse cx="38" cy="35" rx="1.7" ry="2.5" fill="' + K + '"/><ellipse cx="31" cy="45" rx="1.7" ry="2.5" fill="' + K + '"/>',
    // polštář, který dostal ránu
    polstar:
      '<path d="M10 14 Q32 20 54 14 Q48 32 54 50 Q32 44 10 50 Q16 32 10 14 Z" fill="#f4f0ff" ' + S + '/>' +
      '<path d="M22 28 l5 3 l-5 3 M42 28 l-5 3 l5 3" fill="none" ' + S + '/>' +
      '<path d="M27 41 q5 -4 10 0" fill="none" ' + S + '/>',
    // dílek dortu s třešní (Mlask!)
    dort:
      '<path d="M8 30 H58 V52 H8 Z" fill="#f2c27a" ' + S + '/>' +
      '<path d="M10 42 H56" stroke="#e85a7a" stroke-width="4"/>' +
      '<path d="M8 30 L44 17 L58 30 Z" fill="#fff8ee" ' + S + '/>' +
      '<path d="M8 30 H58 V34 Q55 39 51 34 Q46 40 41 34 Q36 38 31 34 Q25 40 20 34 Q14 39 8 35 Z" fill="#fff8ee" ' + S + '/>' +
      '<path d="M43 14 q2 -6 8 -8" fill="none" ' + S + '/>' +
      '<circle cx="43" cy="17" r="5.5" fill="#e04a4a" ' + S + '/>',
    // tančík
    tank:
      '<rect x="8" y="38" width="48" height="14" rx="7" fill="#4a4f4a" ' + S + '/>' +
      '<circle cx="16" cy="45" r="2.6" fill="#c9cfc6"/><circle cx="26" cy="45" r="2.6" fill="#c9cfc6"/><circle cx="38" cy="45" r="2.6" fill="#c9cfc6"/><circle cx="48" cy="45" r="2.6" fill="#c9cfc6"/>' +
      '<path d="M34 24 L54 13" stroke="' + K + '" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M34 24 L54 13" stroke="#6faa5e" stroke-width="3.4" stroke-linecap="round"/>' +
      '<path d="M12 38 Q12 30 20 30 L44 30 Q52 30 52 38 Z" fill="#6faa5e" ' + S + '/>' +
      '<path d="M20 30 Q22 18 32 18 Q42 18 44 30 Z" fill="#6faa5e" ' + S + '/>' +
      '<circle cx="31" cy="25" r="2" fill="' + K + '"/><circle cx="37" cy="25" r="2" fill="' + K + '"/>',
    // nafukovací kachna na vodě
    kachna:
      '<path d="M14 34 Q14 26 22 26 L22 22 Q22 10 34 10 Q46 10 46 22 Q46 30 40 32 L52 32 Q58 32 56 40 Q52 50 34 50 Q16 50 14 40 Z" fill="#ffd24a" ' + S + '/>' +
      '<path d="M46 19 Q56 18 58 22 Q54 26 46 25 Z" fill="#f28c28" ' + S + '/>' +
      '<circle cx="37" cy="18" r="2.3" fill="' + K + '"/>' +
      '<path d="M4 50 Q11 45 18 50 T32 50 T46 50 T60 50" fill="none" stroke="#2f7fc1" stroke-width="3.6" stroke-linecap="round"/>',
    // jamka s praporkem a míčkem
    jamka:
      '<ellipse cx="32" cy="46" rx="26" ry="12" fill="#6fbf5a" ' + S + '/>' +
      '<ellipse cx="38" cy="46" rx="7" ry="3.6" fill="' + K + '"/>' +
      '<path d="M38 46 V8" stroke="' + K + '" stroke-width="3.2" stroke-linecap="round"/>' +
      '<path d="M38 9 L56 15 L38 21 Z" fill="#e8473c" ' + S + '/>' +
      '<circle cx="19" cy="44" r="5" fill="#fff" ' + S + ' stroke-width="2.6"/>',
    // deska čtyř v řadě s žetony
    ctyrka:
      '<rect x="9" y="12" width="46" height="42" rx="6" fill="#3f7fd6" ' + S + '/>' +
      '<circle cx="21" cy="24" r="5.5" fill="#fff8ee"/><circle cx="32" cy="24" r="5.5" fill="#fff8ee"/><circle cx="43" cy="24" r="5.5" fill="#e8473c"/>' +
      '<circle cx="21" cy="42" r="5.5" fill="#ffd24a"/><circle cx="32" cy="42" r="5.5" fill="#e8473c"/><circle cx="43" cy="42" r="5.5" fill="#ffd24a"/>' +
      '<circle cx="21" cy="33" r="5.5" fill="#fff8ee"/><circle cx="32" cy="33" r="5.5" fill="#ffd24a"/><circle cx="43" cy="33" r="5.5" fill="#e8473c"/>',
    // tužka a čmáranice
    caranice:
      '<path d="M8 52 Q16 40 22 50 T36 48" fill="none" stroke="#2f7fc1" stroke-width="3.6" stroke-linecap="round"/>' +
      '<path d="M24 44 L48 10 L58 17 L34 51 L22 56 Z" fill="#ffd24a" ' + S + '/>' +
      '<path d="M44 15.5 L54 22.5" stroke="' + K + '" stroke-width="3.2"/>' +
      '<path d="M48 10 L58 17 L61 12.5 Q62 9 58 6.5 L55 4.5 Q52 3 50 6 Z" fill="#f28aa0" ' + S + '/>' +
      '<path d="M24 44 L34 51 L22 56 Z" fill="#f6dcb6" ' + S + '/>',
    // šipka do hry
    // putovní pohár: drží ho, kdo v místnosti vede
    pohar:
      '<path d="M21 16 H12 a8 8 0 0 0 10 12 M43 16 H52 a8 8 0 0 1 -10 12" fill="none" ' + S + '/>' +
      '<path d="M19 9 H45 V24 a13 13 0 0 1 -26 0 Z" fill="#ffcc3d" ' + S + '/>' +
      '<path d="M27 15 V25" stroke="#fff8ee" stroke-width="3.6" stroke-linecap="round"/>' +
      '<path d="M28.5 37 H35.5 L37 45 H27 Z" fill="#ffcc3d" ' + S + '/>' +
      '<rect x="19" y="45" width="26" height="9" rx="2.5" fill="#e8473c" ' + S + '/>',
    // série výher v řadě
    serie:
      '<path d="M33 7 C37 18 50 24 49 39 A17 17 0 0 1 15 39 C15 31 20 26 23 21 C25 27 28 29 29 29 C28 21 29 14 33 7 Z" fill="#ff8a3d" ' + S + '/>' +
      '<path d="M32 31 C36 37 41 39 41 45 A9 9 0 0 1 23 45 C23 40 28 37 32 31 Z" fill="#ffcc3d"/>',
    sipka:'<path d="M16 32 H46 M34 20 L46 32 L34 44" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    // zpět do místnosti
    zpet: '<path d="M48 32 H18 M30 20 L18 32 L30 44" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    // odkaz (dva články řetězu)
    odkaz: '<path d="M28 36 a9 9 0 0 0 12.7 0 l8 -8 a9 9 0 0 0 -12.7 -12.7 l-3 3 M36 28 a9 9 0 0 0 -12.7 0 l-8 8 a9 9 0 0 0 12.7 12.7 l3 -3" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>',
    // místnost: dvě židle u stolku
    mistnost: '<path d="M10 30 H54" ' + S + ' fill="none"/><path d="M18 30 V52 M46 30 V52" ' + S + ' fill="none"/>' +
      '<rect x="6" y="12" width="14" height="14" rx="3" fill="#ffb23f" ' + S + '/><rect x="44" y="12" width="14" height="14" rx="3" fill="#f5a8bf" ' + S + '/>' +
      '<circle cx="32" cy="22" r="6" fill="#fff8ee" ' + S + '/>'
  };
  var html = '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0" aria-hidden="true">';
  for (var k in sym) html += '<symbol id="i-' + k + '" viewBox="0 0 64 64">' + sym[k] + '</symbol>';
  // Kluk a holka, čelo na čele. Viewbox 0 0 260 150.
  html +=
    '<symbol id="i-dvojice" viewBox="0 0 260 150">' +
    // kluk: ucho, hlava, chomáč, obočí, oči koukají na ni, vyceněný úsměv
    '<circle cx="42" cy="84" r="11" fill="#f9c9a3" ' + S + '/>' +
    '<circle cx="86" cy="80" r="44" fill="#f9c9a3" ' + S + '/>' +
    '<path d="M70 38 q4 -14 13 -4 q3 -13 13 -2" fill="none" ' + S + '/>' +
    '<path d="M86 58 l17 5 M110 64 l13 -5" fill="none" stroke="' + K + '" stroke-width="5" stroke-linecap="round"/>' +
    '<ellipse cx="97" cy="76" rx="8.5" ry="10.5" fill="#fff" ' + S + '/>' +
    '<ellipse cx="117" cy="76" rx="7.5" ry="10" fill="#fff" ' + S + '/>' +
    '<circle cx="102" cy="78" r="3.6" fill="' + K + '"/><circle cx="121" cy="78" r="3.4" fill="' + K + '"/>' +
    '<path d="M90 98 Q108 116 126 96 Z" fill="#fff" ' + S + '/>' +
    '<path d="M99 100 v7 M108 101 v8 M117 100 v6" stroke="' + K + '" stroke-width="2.2"/>' +
    '<circle cx="75" cy="96" r="6.5" fill="#f08f7e" opacity=".55"/>' +
    // holka: drdoly, vlasy vzadu, obličej, ofina, přimhouřené oči, vyplazený jazyk
    '<circle cx="146" cy="30" r="15" fill="#a3542d" ' + S + '/>' +
    '<circle cx="214" cy="34" r="15" fill="#a3542d" ' + S + '/>' +
    '<path d="M150 42 l-6 6 M209 46 l7 6" stroke="#ffcc3d" stroke-width="5" stroke-linecap="round"/>' +
    '<circle cx="178" cy="82" r="46" fill="#a3542d" ' + S + '/>' +
    '<circle cx="173" cy="88" r="40" fill="#f9c9a3" ' + S + '/>' +
    '<path d="M134 82 Q140 46 178 46 Q212 48 218 80 Q196 62 168 70 Q150 74 134 82 Z" fill="#a3542d" ' + S + '/>' +
    // přimhouřené oči: spodní půlky elips s rovným víčkem, panenky u nosu (kouká po něm)
    '<path d="M145 83 a9 9 0 0 0 18 0 z" fill="#fff" ' + S + '/>' +
    '<path d="M166 83 a9 9.5 0 0 0 18 0 z" fill="#fff" ' + S + '/>' +
    '<circle cx="150" cy="86.5" r="3.3" fill="' + K + '"/><circle cx="171" cy="86.5" r="3.5" fill="' + K + '"/>' +
    '<path d="M143 83 h22 M164 83 h22" stroke="' + K + '" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M147 108 q10 4 20 -2" fill="none" ' + S + '/>' +
    '<path d="M151 109 q-1 11 7 11 q7 -1 5 -12" fill="#e8546a" ' + S + '/>' +
    '<circle cx="192" cy="104" r="6.5" fill="#f08f7e" opacity=".55"/>' +
    '</symbol>';
  html += '</svg>';
  document.body.insertAdjacentHTML("afterbegin", html);
})();
