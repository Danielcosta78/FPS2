/* ==========================================================================
   MODE BOMBE (en construction, phase 1)
   Alpha attaque et pose la bombe sur l'un des deux sites (A ou B), Bravo les défend. Une seule vie par manche, le premier camp à la limite
   de manches l'emporte. Ce fichier suit le modèle de la domination (09i-modes.js) : il s'y accroche sans réécrire ce fichier (modeStart,
   modeEnd, domHud et domMinimap sont enveloppées plus bas) et réutilise ses balises (domBuild).
   Phase 1, ce qui existe : le mode est enregistré (seulement avec ?bomba=1 dans l'adresse, tant qu'il n'est pas terminé), les deux sites
   se posent sur la carte (MAP_DEFS.<id>.bomb : [[x, z], [x, z]], sinon bombDefaults) et se voient en jeu, à l'écran et sur la mini-carte.
   Les sites se placent à la souris avec l'outil des zones (?outil=zones, 09zn-outil-zones.js).
   À venir : phase 2 les manches, la pose, le désamorçage et l'explosion ; phase 3 les bots ; phase 4 le salon en ligne.
   ========================================================================== */
const BOMB_DEV = new URLSearchParams(location.search).get('bomba') === '1';
const BOMB = { rad: DOM.rad, names: ['A', 'B'], sites: [], mk: [], col: [0.9, 0.38, 0.24] };
if (!(Settings.limitBomb > 0)) Settings.limitBomb = 7; // manches à gagner (MODES.bomb.key)
if (BOMB_DEV) {
  MODES.bomb = { name: _t('Pose de bombe'), btn: _t('Pose de bombe'), sub: _t('Pose de bombe, deux sites à attaquer ou à défendre'), teams: _t('6 contre 6, une seule vie par manche'),
    lim: _t('Manches à gagner'), unit: _t('manches gagnées'), limits: [4, 7, 10, 13], key: 'limitBomb', respawn: 4, botRespawn: 5.5, prot: 2,
    hint: _t('Alpha attaque et pose la bombe sur un site, Bravo la défend. Une seule vie par manche. Le premier camp à la limite de manches l\u0027emporte.') };
  MODE_IDS.push('bomb');
}

/* ---------- Les sites ---------- */
/* Sites par défaut d'une carte qui n'a pas de MAP_DEFS.<id>.bomb : dans la moitié de carte de Bravo, un à gauche et un à droite, à mi-chemin
   entre le centre et sa base, sur des points de passage au sol (spawnField). L'outil des zones affine le résultat. */
function bombDefaults() {
  const mid = spawnMid(SPAWNS[1]), side = Math.sign(mid[1]) || 1, depth = Math.abs(mid[1]) * 0.55;
  const C = spawnField().filter((p) => p[1] * side > 6 && hyp(p[0] - mid[0], p[1] - mid[1]) > 16);
  const xs = C.map((p) => p[0]).sort((a, b) => a - b), mx = xs[xs.length >> 1];
  const best = (L) => L.slice().sort((a, b) => Math.abs(Math.abs(a[1]) - depth) - Math.abs(Math.abs(b[1]) - depth))[0];
  const a = best(C.filter((p) => p[0] < mx)), b = best(C.filter((p) => p[0] >= mx));
  return a && b && a !== b ? [a, b] : [[-12, side * depth], [12, side * depth]];
}
function bombDefs() {
  const d = CURMAP.def && CURMAP.def.bomb;
  return (d && d.length >= 2 ? d : bombDefaults()).slice(0, BOMB.names.length);
}
function bombInit() {
  BOMB.sites = bombDefs().map(([x, z], i) => {
    const id = navNode(x, gy0(x, z), z), y = id >= 0 ? NAV.ny[id] : gy0(x, z);
    const p = { i, name: BOMB.names[i], x, z, y, owner: -1, v: 0, n: [0, 0], contest: false, mmCv: null, mmDone: false }; // (la forme d'un point de domination : domBuild)
    domBuild(p);
    const c = BOMB.col;
    p.ringMat.color.setRGB(c[0] * 0.8, c[1] * 0.8, c[2] * 0.8); p.veilMat.color.setRGB(c[0], c[1], c[2]); p.flagMat.color.setRGB(c[0], c[1], c[2]);
    p.flag.position.y = 2.4; // fanion en haut du mât
    return p;
  });
  // repères à l'écran : comme ceux de la domination (enfants de #hud, devant la lunette)
  const hud = $('hud'), at = $('scope');
  for (const p of BOMB.sites) {
    const el = document.createElement('div'); el.className = 'dpm hot'; el.innerHTML = `<b>${p.name}</b><i></i>`;
    hud.insertBefore(el, at); BOMB.mk.push(el); p.el = el;
  }
}
function bombClear() {
  for (const p of BOMB.sites) {
    if (!p.obj) continue;
    if (p.obj.parent) p.obj.parent.remove(p.obj);
    p.obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
  for (const el of BOMB.mk) el.remove();
  BOMB.sites = []; BOMB.mk = [];
}

/* ---------- Raccords avec le reste du jeu ---------- */
const _bombModeStart = modeStart;
modeStart = function (mode) { const D = _bombModeStart(mode); bombClear(); if (MATCH.mode === 'bomb') bombInit(); return D; };
const _bombModeEnd = modeEnd;
modeEnd = function () { _bombModeEnd(); bombClear(); };
const _bombDomHud = domHud;
domHud = function (dt) { _bombDomHud(dt); bombHud(); };
const _bombDomMinimap = domMinimap;
domMinimap = function (g, scale, yaw) { _bombDomMinimap(g, scale, yaw); bombMinimap(g, scale, yaw); };

/* Image par image : le repère de chaque site à l'écran (lettre et distance) */
function bombHud() {
  for (const p of BOMB.sites) {
    _dv.set(p.x, p.y + 3.4, p.z).project(camera);
    const el = p.el, show = _dv.z < 1 && Math.abs(_dv.x) < 1.1 && Math.abs(_dv.y) < 1.1;
    hudStyle(el, 'opacity', show ? '1' : '0');
    if (!show) continue;
    hudStyle(el, 'transform', `translate(${Math.round((_dv.x * 0.5 + 0.5) * VIEW.w)}px, ${Math.round((-_dv.y * 0.5 + 0.5) * VIEW.h)}px) translate(-50%, -50%)`);
    hudText(el.lastChild, `${Math.round(hyp(p.x - camera.position.x, p.z - camera.position.z))} m`);
  }
}
/* Mini-carte : zone et lettre de chaque site (la lettre dans une petite toile faite une fois, comme domLetter : la dessiner à chaque image coûte cher) */
function bombMinimap(g, scale, yaw) {
  const c = BOMB.col.map((x) => Math.round(x * 255)).join(',');
  for (const p of BOMB.sites) {
    if (!p.mmDone) bombLetter(p, c);
    g.fillStyle = `rgba(${c},0.22)`; g.strokeStyle = `rgba(${c},0.9)`; g.lineWidth = 2;
    g.beginPath(); g.arc(p.x * scale, p.z * scale, BOMB.rad * scale, 0, TAU); g.fill(); g.stroke();
    g.save(); g.translate(p.x * scale, p.z * scale); g.rotate(-yaw);
    const B = DOM_MM.box; g.drawImage(p.mmCv, -B / 2, -B / 2, B, B); g.restore();
  }
}
function bombLetter(p, c) {
  const B = DOM_MM.box, K = DOM_MM.k, cv = p.mmCv || (p.mmCv = document.createElement('canvas'));
  cv.width = cv.height = B * K;
  const x = cv.getContext('2d'); x.setTransform(K, 0, 0, K, 0, 0);
  x.font = '700 15px "Barlow Condensed", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.strokeStyle = 'rgba(0,0,0,0.7)'; x.lineWidth = 3; x.strokeText(p.name, B / 2, B / 2 + 1);
  x.fillStyle = `rgb(${c})`; x.fillText(p.name, B / 2, B / 2 + 1);
  p.mmDone = !(document.fonts && document.fonts.status === 'loading'); // (police pas encore chargée : la lettre sera refaite)
}
