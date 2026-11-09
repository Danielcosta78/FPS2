/* ==========================================================================
   POUSSIÈRE : ville de pierre ocre en plein désert, deux sites de bombe, trois routes (90 × 114 m). Plan original, dans l'esprit des grands
   classiques à deux sites : on s'en sert surtout en mode Pose de bombe, mais les autres modes y marchent aussi (Alpha au sud, Bravo au nord).
   Le plan est un dessin en grille (PQ.rows, une case = 3 m, nord en haut) : # bâtiment, . sol, R sol couvert (tunnel), L muret bas ; les caisses, fûts,
   sacs de sable, voitures, palmiers et barrières de béton sont dans PQ.props (case « colonne,ligne »). Modifier le dessin modifie la carte : les
   bâtiments, le tunnel et les murets en sont tirés (pqRects), les collisions suivent, la navigation des bots aussi.
   OUEST « Tunnel »  : ruelle couverte de 36 m, qui débouche sur la place du site B.
   CENTRE « Rue »    : rue pavée, goulet de deux cases au milieu (les Portes du milieu), qui monte à la cour de Bravo.
   EST « Longue »    : longue ruelle à lignes de vue, qui débouche sur la place du site A.
   Deux passages de traverse relient la rue à l'ouest et à l'est. La cour de Bravo a une porte sur chaque place.
   Axe long nord-sud (Z). Alpha au sud (+Z), Bravo au nord (-Z) ; les apparitions de Bravo sont le miroir de celles d'Alpha.
   ========================================================================== */
const PQ = {
  c: 3, W: 30, H: 38, x0: -45, z0: -57,
  rows: [
    '###########........###########',
    '###########........###########',
    '..........#........#..........',
    '..........#........#..........',
    '.......LL.#........#..........',
    '..........#........#..........',
    '..............................',
    '..............................',
    '..........#........#..........',
    '..........#........#......LL..',
    '..........#........#..........',
    '..........#........#..........',
    '...########......########.....',
    '...########......########.....',
    '...########..L...########.....',
    '...########..L...########.....',
    'RRR########......########.....',
    'RRR########...................',
    'RRR########...................',
    'RRR##########..##########..L..',
    'RRR##########..##########..L..',
    'RRR########......########..L..',
    'RRR########..L...########.....',
    'RRR########..L...########.....',
    'RRR..............########.....',
    'RRR..............########.....',
    'RRR########......########.....',
    'RRR########...L..########.....',
    '...########...L..########.....',
    '...########......########.....',
    '...########......########.....',
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '..............................'
  ],
  props: { '12,0': 'p', '17,0': 'p', '4,3': 'p', '21,3': 'p', '2,4': 'c', '3,4': 'c', '28,4': 'c', '12,5': 's', '17,5': 's', '24,5': 'c', '25,5': 'c', '25,6': 'c', '5,7': 'c', '6,7': 'c', '5,8': 'c', '1,9': 'c', '22,9': 'c', '8,10': 'c', '22,10': 'c', '6,11': 's', '24,11': 's', '2,12': 'o', '28,12': 'o', '27,15': 'c', '1,21': 'c', '27,23': 'c', '1,25': 'o', '26,26': 'v', '13,29': 'c', '5,31': 'j', '6,31': 'j', '12,31': 's', '16,31': 's', '23,31': 'j', '24,31': 'j', '7,33': 'v', '22,34': 'v', '2,35': 'p', '27,35': 'p' },
};
/* Une case : hors du dessin, c'est l'enceinte (un mur) */
function pqCh(c, r) { return c < 0 || r < 0 || c >= PQ.W || r >= PQ.H ? '#' : PQ.rows[r][c]; }
function pqCx(c) { return PQ.x0 + (c + 0.5) * PQ.c; }
function pqCz(r) { return PQ.z0 + (r + 0.5) * PQ.c; }
/* Une case praticable (ni bâtiment ni muret) */
function pqFree(c, r) { const h = pqCh(c, r); return h !== '#' && h !== 'L'; }
/* Rectangles de cases de même nature, fusionnés au plus large (au plus mc colonnes sur mr lignes) */
function pqRects(ch, mc = 99, mr = 99) {
  const seen = new Set(), out = [];
  for (let r = 0; r < PQ.H; r++) for (let c = 0; c < PQ.W; c++) {
    if (pqCh(c, r) !== ch || seen.has(c + ',' + r)) continue;
    let c1 = c; while (c1 + 1 < PQ.W && c1 + 1 - c < mc && pqCh(c1 + 1, r) === ch && !seen.has((c1 + 1) + ',' + r)) c1++;
    let r1 = r;
    for (;;) {
      if (r1 + 1 >= PQ.H || r1 + 1 - r >= mr) break;
      let ok = true; for (let k = c; k <= c1; k++) if (pqCh(k, r1 + 1) !== ch || seen.has(k + ',' + (r1 + 1))) { ok = false; break; }
      if (!ok) break; r1++;
    }
    for (let j = r; j <= r1; j++) for (let k = c; k <= c1; k++) seen.add(k + ',' + j);
    out.push({ c0: c, c1, r0: r, r1, x0: PQ.x0 + c * PQ.c, x1: PQ.x0 + (c1 + 1) * PQ.c, z0: PQ.z0 + r * PQ.c, z1: PQ.z0 + (r1 + 1) * PQ.c });
  }
  return out;
}
/* Les faces d'un bâtiment à habiller : celles qui donnent sur une case non bâtie (n : vers -z, s : vers +z, e : vers +x, w : vers -x) */
function pqFaces(t) {
  const open = (c, r) => pqCh(c, r) !== '#';
  let f = '';
  for (let c = t.c0; c <= t.c1; c++) if (open(c, t.r0 - 1)) { f += 'n'; break; }
  for (let c = t.c0; c <= t.c1; c++) if (open(c, t.r1 + 1)) { f += 's'; break; }
  for (let r = t.r0; r <= t.r1; r++) if (open(t.c1 + 1, r)) { f += 'e'; break; }
  for (let r = t.r0; r <= t.r1; r++) if (open(t.c0 - 1, r)) { f += 'w'; break; }
  return f;
}
/* Apparitions d'Alpha : trois rangées de quatre dans la cour du sud, au milieu (celles de Bravo en sont le miroir : x, -z) ; au centre d'une case de la navigation */
const PQ_SPAWNS = [[-7.5, 43.5], [-1.5, 43.5], [4.5, 43.5], [10.5, 43.5], [-7.5, 46.5], [-1.5, 46.5], [4.5, 46.5], [10.5, 46.5], [-7.5, 49.5], [-1.5, 49.5], [4.5, 49.5], [10.5, 49.5]];
/* Points d'intérêt des bots : un point toutes les quatre cases sur le sol libre (route L ouest, M milieu, E est), et des postes de tenue aux portes et aux sites */
function pqPoi() {
  const lane = (x) => (x < -12 ? 'L' : x > 6 ? 'E' : 'M'), out = [];
  for (let r = 2; r < PQ.H - 3; r += 4) for (let c = 1; c < PQ.W; c += 4) {
    if (!pqFree(c, r) || PQ.props[c + ',' + r]) continue;
    out.push([pqCx(c), 0, pqCz(r), lane(pqCx(c))]);
  }
  for (const [c, r] of [[10, 6], [10, 7], [19, 6], [19, 7], [13, 19], [14, 19], [13, 20], [14, 20], [3, 25], [9, 24], [18, 17], [23, 18]]) out.push([pqCx(c), 0, pqCz(r), lane(pqCx(c)), 1]);
  return out;
}
const PQ_BASE = typeof ATMO_DEFAULT !== 'undefined' ? ATMO_DEFAULT : {}; // (garde : un nom qui changerait ne doit pas empêcher le jeu de se charger)
const ATMO_POUSSIERE = Object.assign({}, PQ_BASE, {
  sun: [-0.4, 0.8, 0.45], sunColor: 0xfff0d6, vmSun: 0xfff0d6, fog: [0.82, 0.74, 0.6], fogD: 0.0045, fogSun: 0.5,
  sky: Object.assign({}, PQ_BASE.sky, { zen: [0.2, 0.38, 0.74], mid: [0.45, 0.62, 0.86], hor: [0.86, 0.8, 0.68], gnd: [0.5, 0.42, 0.32], glow: [1.0, 0.9, 0.7], halo: [0.9, 0.85, 0.75], disk: [9, 8, 6] }),
  hdri: null, lit: false,
});
try {
MAP_DEFS.poussiere = {
  type: 'mid', // moyenne à trois couloirs : README « Règles de conception d'une carte » ; règle le choix des armes des bots (botArmForMap)
  bounds: { x0: -45, x1: 45, z0: -57, z1: 57 },
  textures: ['plaster', 'plaster2', 'stone', 'brick', 'cobble', 'pavers', 'asphalt', 'rooftiles', 'wood', 'shutter', 'ashlar', 'concrete', 'crate', 'canvas', 'linge', 'cardboard', 'rollshutter', 'steel', 'paintwood', 'burlap', 'timber', 'palmbark'],
  surfaces: ['ripple', 'palmbark'],
  // ambiance enregistrée : celle de Khamsin (vent chaud, rafales, chiens au loin, tourterelles)
  sound: { pack: 'amb_sable', bed: 0.4, spots: [
    { id: 'a_gust', every: [10, 24], gain: 0.4, dist: [4, 12], y: [2, 7] },
    { id: 'a_dog', every: [20, 50], gain: 0.35, dist: [60, 120], y: [0, 2] },
    { id: 'a_dove', every: [14, 34], gain: 0.3, dist: [15, 40], y: [5, 10] },
    { id: 'a_cloth', every: [12, 30], gain: 0.3, dist: [6, 20], y: [2, 5] },
  ] },
  art: { cam: [37.5, 1.5, 54], look: [33, 3.2, -10], fov: 58 }, // illustration des menus : la longue ruelle de l'est (à régénérer : tools/dev/illustrations.js)
  landmarks: [[-8, 33.6, 61, 'minaret sud'], [-8, 33.6, -61, 'minaret nord']],
  build() { SR.rng = rngOf(8802); pqBuild(); },
  splat: { x0: -72, z0: -88, w: 144, d: 176, ppm: 4 },
  spawns: PQ_SPAWNS,
  poi: pqPoi(),
  // domination : A et C dans la rue, à l'approche des bases ; B au milieu, dans les Portes
  dom: [[-1.5, 31.5], [-1.5, 1.5], [-1.5, -31.5]],
  // mode Pose de bombe (09ib-bombe.js) : un site au centre de chaque place, au nord (côté de Bravo)
  bomb: [[30, -36], [-30, -36]],
  lane: (x) => (x < -12 ? 'L' : x > 6 ? 'E' : 'M'),
  sniper: [37.5, 0, 31.5],
  coverZ: 38,
  heli: [50, 64],
  cam: 58,
  surface: (p) => (Math.abs(p.z) > 34 ? 'dirt' : 'concrete'),
  zones: [
    [_t('Base Alpha'), -45, 45, 34.5, 57], [_t('Base Bravo'), -12, 12, -57, -34.5],
    [_t('Tunnel couvert'), -45, -36, -9, 30], [_t('Rue du milieu'), -12, 6, -34.5, 34.5], [_t('Longue ruelle'), 27, 45, -22, 34.5],
    [_t('Portes du milieu'), -12, 6, 1.5, 7.5], [_t('Passage de traverse'), -36, -12, 15, 21], [_t('Passage de traverse'), 6, 27, -6, 0],
    [_t('Place du site B'), -45, -15, -51, -21], [_t('Place du site A'), 15, 45, -51, -21],
  ],
  atmo: ATMO_POUSSIERE,
};
MAPS.push({ id: 'poussiere', name: 'Poussière', tag: _t('Désert, deux sites'), ok: true,
  desc: _t('Une ville de pierre ocre sous un ciel sans nuage. Deux sites, trois chemins, et personne ne sait lequel est le bon.') });
} catch (e) { console.warn('Poussière : carte non déclarée', e); }

/* ---------- Sol ---------- */
/* Carte de répartition du sol (4 px par mètre) : r pavés, a terre ; le sable est le fond. Pavés dans les places et la rue du milieu, terre battue
   dans les deux ruelles et les cours, sable ailleurs ; bords irréguliers (bruit). */
function pqGround() {
  const S = SPLAT, W = S.w * S.ppm, H = S.d * S.ppm, px = new Float32Array(W * H * 4), N = makeNoise(5151);
  const W2 = W >> 1, H2 = H >> 1, n1a = new Float32Array(W2 * H2), n2a = new Float32Array(W2 * H2);
  for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) {
    const x = S.x0 + (i * 2 + 1) / S.ppm, z = S.z0 + (j * 2 + 1) / S.ppm, k = j * W2 + i;
    n1a[k] = N.fbm(x * 0.05, z * 0.05, 32, 32, 3); n2a[k] = N.fbm(x * 0.21 + 3.1, z * 0.21, 32, 32, 2);
  }
  const zone = (ch, x0, x1, z0, z1, soft = 0.8, k = 1) => {
    const i0 = Math.max(0, Math.floor((x0 - soft - S.x0) * S.ppm)), i1 = Math.min(W - 1, Math.ceil((x1 + soft - S.x0) * S.ppm));
    const j0 = Math.max(0, Math.floor((z0 - soft - S.z0) * S.ppm)), j1 = Math.min(H - 1, Math.ceil((z1 + soft - S.z0) * S.ppm));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = S.x0 + (i + 0.5) / S.ppm, z = S.z0 + (j + 0.5) / S.ppm;
      const d = Math.min(x - x0, x1 - x, z - z0, z1 - z) + (n1a[(j >> 1) * W2 + (i >> 1)] - 0.5) * 1.6;
      const o = (j * W + i) * 4;
      px[o + ch] = Math.max(px[o + ch], smoothstep(-soft, soft, d) * k);
    }
  };
  zone(3, -45, 45, -57, 57, 1.5, 0.7);                       // terre battue partout dans l'enceinte
  zone(0, -45, -15, -51, -21, 1.0); zone(0, 15, 45, -51, -21, 1.0); // pavés des deux places
  zone(0, -12, 6, -34.5, 34.5, 0.6);                          // pavés de la rue du milieu
  zone(0, -12, 12, -57, -34.5, 0.8, 0.8);                     // pavés de la cour de Bravo
  const out = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, o = k * 4, h2 = (j >> 1) * W2 + (i >> 1), n1 = n1a[h2], n2 = n2a[h2];
    const patch = smoothstep(0.6, 0.74, n1 + (n2 - 0.5) * 0.3), keep = 1 - patch * 0.7 * (1 - smoothstep(0.35, 0.65, n2)); // plaques de sable éparses
    const paved = px[o];
    out[o] = Math.round(clamp(paved * keep, 0, 1) * 255);
    out[o + 3] = Math.round(clamp(px[o + 3] * keep * (1 - paved) * (0.35 + n2 * 0.55), 0, 1) * 255);
  }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  MAT.ground = groundMat(t, [S.x0, S.z0, S.w, S.d]);
  const M = DECOR; WORLD.force = 'g';
  M.save().color([1, 1, 1]).local(1); M.aoFn = null;
  M.plane('ground', 260, 260, 1, 1);
  M.restore(); WORLD.force = null;
}

/* ---------- Plan ---------- */
function pqBuild() {
  const R = rngOf(2077);
  NO_DOOR.length = 0;
  pqRing(R);
  pqBackdrop(R);
  // bâtiments : les rectangles de # en blocs d'au plus 4 colonnes sur 6 lignes (12 × 18 m), hauteur et teinte tirées de la place du bloc
  for (const t of pqRects('#', 4, 6)) {
    const k = (t.c0 * 31 + t.r0 * 17) % 7, h = [7, 8.4, 9.6][k % 3], brick = k === 4;
    building(t.x0, t.x1, t.z0, t.z1, h, { tint: brick ? [0.95, 0.72, 0.58] : PAL.plaster[k % PAL.plaster.length], key: brick ? 'brick' : 'plaster', faces: pqFaces(t) });
  }
  // tunnel couvert : une dalle au-dessus des cases R (le plafond est à 3,4 m)
  for (const t of pqRects('R')) box('plaster', t.x0, t.x1, 3.4, 4.2, t.z0, t.z1, { tint: [0.9, 0.82, 0.68] });
  // murets bas (1,3 m) : dans le sens des murets voisins
  for (let r = 0; r < PQ.H; r++) for (let c = 0; c < PQ.W; c++) {
    if (pqCh(c, r) !== 'L') continue;
    const cx = pqCx(c), cz = pqCz(r), along = pqCh(c - 1, r) === 'L' || pqCh(c + 1, r) === 'L' || pqCh(c, r - 1) !== 'L' && pqCh(c, r + 1) !== 'L';
    const x0 = along ? cx - 1.5 : cx - 0.3, x1 = along ? cx + 1.5 : cx + 0.3, z0 = along ? cz - 0.3 : cz - 1.5, z1 = along ? cz + 0.3 : cz + 1.5;
    box('ashlar', x0, x1, 0, 1.3, z0, z1, { tint: [0.9, 0.84, 0.72] });
  }
  // accessoires
  for (const [key, ch] of Object.entries(PQ.props)) {
    const [c, r] = key.split(',').map(Number), cx = pqCx(c), cz = pqCz(r);
    if (ch === 'c') { crate(cx, 0, cz, 1.2, R() * 0.6); if (R() < 0.7) crate(cx + 0.95, 0, cz - 0.5, 1.0, R()); if (R() < 0.5) crate(cx, 1.2, cz, 1.0, R() * 0.5); }
    else if (ch === 'o') { barrel(cx, cz); barrel(cx + 0.7, cz + 0.4); }
    else if (ch === 's') sandbags(cx, cz, 3, 'x', 3);
    else if (ch === 'v') car(cx, cz, R() < 0.5 ? 0 : Math.PI / 2, undefined, false, R.pick(['sedan', 'hatch', 'offroad']), { dust: 1 });
    else if (ch === 'p') palm(cx, cz, 7 + R() * 2);
    else if (ch === 'j') jersey(cx, cz, 3, 'x');
  }
  // lampadaires aux deux entrées de la rue du milieu et aux portes des places
  lampPost(pqCx(11) - 1.2, pqCz(29), 0); lampPost(pqCx(16) + 1.2, pqCz(29), Math.PI); lampPost(pqCx(11) - 1.2, pqCz(12), 0); lampPost(pqCx(16) + 1.2, pqCz(12), Math.PI);
  pqGround(); // après les bâtiments
  NO_DOOR.length = 0;
}
/* Enceinte : une rangée de façades autour du dessin, tournées vers l'intérieur (hors du jeu) */
function pqRing(R) {
  const X0 = PQ.x0, X1 = PQ.x0 + PQ.W * PQ.c, Z0 = PQ.z0, Z1 = PQ.z0 + PQ.H * PQ.c, D = 8;
  const side = (s) => {
    const horiz = s === 'n' || s === 's', a0 = horiz ? X0 : Z0 - D, a1 = horiz ? X1 : Z1 + D;
    for (let a = a0; a < a1;) {
      let w = Math.min(a1 - a, 6 + R() * 7); if (a1 - (a + w) < 6) w = a1 - a; // (le reste de la rangée est absorbé : pas de bout de bâtiment trop étroit)
      const h = 7 + R() * 7, brick = R() < 0.18;
      let x0, x1, z0, z1, face;
      if (s === 'w') { x0 = X0 - D; x1 = X0; z0 = a; z1 = a + w; face = 'e'; }
      if (s === 'e') { x0 = X1; x1 = X1 + D; z0 = a; z1 = a + w; face = 'w'; }
      if (s === 'n') { x0 = a; x1 = a + w; z0 = Z0 - D; z1 = Z0; face = 's'; }
      if (s === 's') { x0 = a; x1 = a + w; z0 = Z1; z1 = Z1 + D; face = 'n'; }
      building(x0, x1, z0, z1, h, { tint: brick ? [0.95, 0.72, 0.58] : R.pick(PAL.plaster), key: brick ? 'brick' : 'plaster', faces: face });
      a += w;
    }
  };
  side('w'); side('e'); side('n'); side('s');
}
/* Arrière-plan : quartiers lointains, deux minarets derrière les bases, dunes */
function pqBackdrop(R) {
  for (let i = 0; i < 70; i++) {
    const ang = R() * TAU, d = 110 + R() * 60, x = Math.cos(ang) * d * 0.85, z = Math.sin(ang) * d * 1.1;
    const h = 8 + Math.floor(R() * 7) * 3.2, w = 8 + R() * 14;
    farBuilding(x, z, w, w * (0.6 + R() * 0.8), h, R.pick(PAL.plaster), R);
  }
  minaret(70, -110, 36); domeHouse(-86, 120, 1.1); domeHouse(110, 50, 0.8);
  minaret(-8, 61, 35, { col: true }); minaret(-8, -61, 35, { rond: true }); // un repère derrière chaque base : on sait de quel côté on regarde
  dunes();
}
