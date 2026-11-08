/* ==========================================================================
   MODE BOMBE
   Alpha attaque d'abord et pose la bombe sur l'un des deux sites (A ou B), Bravo les défend. Une seule vie par manche, le premier camp à la
   limite de manches l'emporte ; les camps changent à la moitié. Ce fichier suit le modèle de la domination (09i-modes.js) : il s'y accroche
   sans réécrire les gros fichiers (modeStart, modeEnd, modeUpdate, domHud, domMinimap, spawnBase, respawnPlayer, killLimitReached, finKicker,
   cdShow, botChasing et pickGoal sont enveloppées plus bas, chacune dans un try : un nom qui changerait ailleurs ne casse pas le chargement du jeu).
   Sites : MAP_DEFS.<id>.bomb [[x, z], [x, z]], sinon bombDefaults ; ils se placent avec l'outil des zones (?outil=zones, 09zn-outil-zones.js).
   Une manche (BOMB.phase) : 'live' (la bombe est au porteur, chrono de manche), 'planted' (la bombe tourne, chrono de mise à feu), 'over'
   (annonce, BOMB.endLen secondes, puis bombNewRound : tout le monde réapparaît et le décompte du départ (09y-decompte.js) rejoue).
   Pose et désamorçage automatiques : il suffit de rester immobile dans la zone (une barre se remplit). Un bot au calme (sans adversaire en vue) qui
   arrive dans la zone s'arrête (bombBotHold) et pose ou désamorce ; ses buts viennent de bombGoal (pickGoal).
   Les autres fichiers du mode : 09ic (vue des équipiers après la mort), 09id (alertes, chrono, icône et sons), 09ie (le jeu en ligne). Le choix de
   l'équipe en solo est dans 09ig.
   ========================================================================== */
const BOMB = {
  rad: DOM.rad, names: ['A', 'B'], sites: [], mk: [], col: [0.9, 0.38, 0.24],
  roundLen: 105, plantT: 4, defuseT: 5, fuse: 40, endLen: 4.5, blast: 24, // secondes, sauf blast (mètres)
  phase: 'off', round: 0, played: 0, att: 0, swapAt: 6, swapped: false, t: 0, endT: 0, target: 0, carrier: null, planter: null, defusers: [], P: null, prog: 0, progMe: false, allow: false,
  why: '', winner: -1, said: 0, sayT: 0, sayTitle: '', sayS: '', sayC: '#fff', ui: null,
};
if (!(Settings.limitBomb > 0)) Settings.limitBomb = 7; // manches à gagner (MODES.bomb.key)
MODES.bomb = { name: _t('Pose de bombe'), btn: _t('Pose de bombe'), sub: _t('Pose de bombe, deux sites à attaquer ou à défendre'), teams: _t('6 contre 6, une seule vie par manche'),
  lim: _t('Manches à gagner'), unit: _t('manches gagnées'), limits: [4, 7, 10, 13], key: 'limitBomb', respawn: 9999, botRespawn: 9999, prot: 2, // (pas de réapparition : tout le monde revient à la manche suivante)
  hint: _t('Alpha attaque et pose la bombe sur un site, Bravo la défend. Une seule vie par manche. Le premier camp à la limite de manches l\u0027emporte.') };
MODE_IDS.push('bomb');

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
  // l'interface des manches : un titre, une ligne d'état et la barre de pose ou de désamorçage
  const ui = document.createElement('div'); ui.id = 'bombUi';
  ui.setAttribute('style', 'position:absolute;left:78%;top:3.5%;transform:translateX(-50%);text-align:center;pointer-events:none;color:#fff;text-shadow:0 1px 4px #000;font-family:"Barlow Condensed",sans-serif;min-width:260px');
  ui.innerHTML = '<div style="font-size:32px;font-weight:700;letter-spacing:0.05em;min-height:1em"></div><div style="font-size:19px;opacity:0.95;min-height:1em"></div>'
    + '<div style="display:none;width:230px;height:9px;margin:8px auto 0;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.35)"><i style="display:block;height:100%;width:100%;transform-origin:left;transform:scaleX(0);background:rgb(229,96,60)"></i></div>';
  hud.insertBefore(ui, at);
  BOMB.ui = ui; BOMB.uiT = ui.children[0]; BOMB.uiS = ui.children[1]; BOMB.uiB = ui.children[2]; BOMB.uiF = ui.children[2].firstChild;
  // les manches
  BOMB.round = 0; BOMB.played = 0; BOMB.said = 0; BOMB.swapped = false;
  bombRoundSetup();
}
function bombClear() {
  for (const p of BOMB.sites) {
    if (!p.obj) continue;
    if (p.obj.parent) p.obj.parent.remove(p.obj);
    p.obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
  for (const el of BOMB.mk) el.remove();
  BOMB.sites = []; BOMB.mk = [];
  bombBombClear();
  if (BOMB.ui) BOMB.ui.remove();
  BOMB.ui = null; BOMB.phase = 'off'; BOMB.carrier = null; BOMB.planter = null; BOMB.defusers = []; BOMB.prog = 0; BOMB.progMe = false;
}

/* ---------- Les manches ---------- */
/* État d'une nouvelle manche (le premier appel : bombInit, avant le déploiement ; les suivants : bombNewRound) */
function bombRoundSetup() {
  BOMB.round++;
  BOMB.swapAt = Math.floor((2 * (MATCH.limit > 0 ? MATCH.limit : Settings.limitBomb) - 1) / 2); // la moitié des manches possibles : après elles, les camps changent (MATCH.limit n'est posé qu'après modeStart)
  BOMB.att = BOMB.played < BOMB.swapAt ? 0 : 1; // l'équipe qui attaque
  BOMB.phase = 'live'; BOMB.t = BOMB.roundLen; BOMB.prog = 0; BOMB.progMe = false; BOMB.carrier = null; BOMB.planter = null; BOMB.defusers = []; BOMB.target = Math.random() < 0.5 ? 0 : 1; BOMB.sayT = 0;
  bombBombClear();
}
/* Le monde de la manche d'avant : grenades, couteaux, fumigènes, bruits */
function bombWorldClear() {
  for (const n of NADES) scene.remove(n.mesh);
  NADES.length = 0; SMOKES.length = 0; soundEvents.length = 0; clearThrowKnives();
}
/* Le joueur de ce poste réapparaît (la réapparition est bloquée en cours de manche : respawnPlayer enveloppée plus bas) */
function bombRespawnMe() { if (KC.active) kcAbort(); KC.pending = null; BOMB.allow = true; respawnPlayer(); BOMB.allow = false; PL.deathT = 0; }
/* Manche suivante : tout le monde réapparaît (en formation, derrière son décompte), les camps changent à la moitié */
function bombNewRound() {
  BOMB.swapped = BOMB.played === BOMB.swapAt;
  bombRoundSetup();
  bombWorldClear();
  OPEN.on = true;
  const lan = MATCH.online && NET.on; // en ligne, seuls les bots de l'hôte (netBot) jouent : les autres restent hors jeu
  for (const e of entities) if (!e.isPlayer && !e.off && !e.isRemote && (!lan || e.netBot)) e.alive = false; // (les survivants ne bloquent pas les places de départ des autres : spawnOpening)
  for (const e of entities) {
    if (e.off || e.isRemote) continue;
    if (e.isPlayer) bombRespawnMe();
    else if (!lan || e.netBot) { spawnEntity(e); e.goal = null; e.path = null; e.holdT = 0; e.bombHold = null; } // (spawnEntity refait déjà ses tactiques : initTactics)
  }
  bombUi();
  cdStart();
}
function bombAlive(t) { let n = 0; for (const e of entities) if (e.alive && !e.off && e.team === t) n++; return n; }
function bombSiteAt(e) { for (const s of BOMB.sites) if (hyp(e.pos.x - s.x, e.pos.z - s.z) < BOMB.rad - 0.4 && Math.abs(e.pos.y - s.y) < DOM.dy + 1) return s; return null; }
/* Le soldat tient-il l'action ? La pose et le désamorçage sont automatiques : le joueur n'a qu'à rester immobile dans la zone (une barre se remplit) ; un bot : en place et sans adversaire en vue */
function bombChannel(e) {
  if (!e.alive) return false;
  if (e.isPlayer) return hyp(e.vel.x, e.vel.z) < 0.6;
  return !e.visible && (e.holdT > 0 || hyp(e.vel.x, e.vel.z) < 0.5); // un bot : au calme (aucun adversaire en vue) et en place
}
/* Un bot en mission : les attaquants avant la pose, les défenseurs après. Il oublie les adversaires perdus de vue (lastSeenT, 07b-tactics.js : sinon il les
   poursuit des secondes durant et ne pense plus à la bombe) ; s'il en voit un, il se bat comme avant. */
function bombFocus(e) { return BOMB.phase === 'live' ? e.team === BOMB.att : BOMB.phase === 'planted' && e.team !== BOMB.att; }
/* Un bot au calme (aucun adversaire en vue) qui roule en liberté : on lui fait tenir la position (holdT), il s'arrête et peut poser ou désamorcer.
   Sans cela, il repartait vers un autre but dès qu'il arrivait près du site (le but d'un défenseur, la bombe, n'est pas un nœud du réseau). */
function bombBotHold(e) { if (e.tactic !== 'roam' || e.visible) return false; e.holdT = Math.max(e.holdT, 0.4); return true; }
/* Les bots qui roulent en liberté refont leur but (la bombe vient d'être posée, ou la manche recommence) */
function bombReplan() { for (const e of entities) if (!e.isPlayer && !e.isRemote && e.alive && e.tactic === 'roam') { e.goal = null; e.path = null; e.holdT = 0; } }
/* La bombe est au porteur : le joueur s'il attaque, sinon un bot au hasard ; s'il meurt, un autre attaquant vivant la prend (pas de bombe à ramasser au sol) */
function bombCarrierTick() {
  const c = BOMB.carrier;
  if (BOMB.phase !== 'live' || (c && c.alive)) return;
  const L = entities.filter((e) => e.alive && !e.off && e.team === BOMB.att);
  const me = PL.ent; BOMB.carrier = L.length ? (me.alive && me.team === BOMB.att ? me : pick(L)) : null; BOMB.prog = 0; BOMB.progMe = false; // le joueur qui attaque a la bombe
  if (BOMB.carrier && BOMB.carrier.isPlayer) bombSay(_t('Vous portez la bombe'), '', '#fff', 2.5);
}
/* Le bot qui va poser : un attaquant vivant (pas le joueur), choisi au hasard ; s'il meurt, un autre prend le relais */
function bombPlanterTick() {
  const c = BOMB.planter;
  if (c && c.alive) return;
  const L = entities.filter((e) => e.alive && !e.off && !e.isPlayer && !e.isRemote && e.team === BOMB.att);
  BOMB.planter = L.length ? pick(L) : null;
  if (BOMB.planter && BOMB.planter.tactic === 'roam') { BOMB.planter.goal = null; BOMB.planter.path = null; BOMB.planter.holdT = 0; }
}
/* Qui pose : un attaquant vivant dans un site qui tient l'action (le joueur d'abord). La bombe n'est pas un objet qu'on ramasse : le porteur
   (BOMB.carrier) ne sert qu'à dire qui l'a, et n'importe quel attaquant peut la poser. */
function bombPlantTick(dt) {
  let by = null, site = null;
  for (const e of entities) {
    if (!e.alive || e.off || e.isRemote || e.team !== BOMB.att || e.onGround === false) continue;
    const s = bombSiteAt(e);
    if (s && (e.isPlayer ? bombChannel(e) : bombBotHold(e))) { by = e; site = s; if (e.isPlayer) break; }
  }
  if (by) { BOMB.prog += dt; BOMB.progMe = !!by.isPlayer; if (BOMB.prog >= BOMB.plantT) bombPlant(site, by); }
  else { BOMB.prog = 0; BOMB.progMe = false; }
}
function bombPlant(s, c) {
  const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.3), new THREE.MeshBasicMaterial({ color: 0x2b2f2a }));
  body.position.y = 0.1; g.add(body);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
  led.position.set(0.14, 0.23, 0); g.add(led);
  g.position.set(c.pos.x, c.pos.y, c.pos.z); mapAdd(g);
  BOMB.P = { site: s.i, x: c.pos.x, y: c.pos.y, z: c.pos.z, t: BOMB.fuse, tick: 0, on: 0, by: c, obj: g, led };
  BOMB.phase = 'planted'; BOMB.prog = 0; BOMB.progMe = false;
  bombSay(_t('La bombe est posée sur le site {0}', s.name), '', '#fff', 3.5);
  sfxClick(null, 1500, 0.35);
  bombReplan();
}
function bombBombClear() {
  const P = BOMB.P;
  if (P && P.obj) { if (P.obj.parent) P.obj.parent.remove(P.obj); P.obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
  BOMB.P = null;
}
/* Bombe posée : le bip (de plus en plus rapide), le voyant, et le désamorçage par un défenseur qui tient la zone */
function bombFuseTick(dt) {
  const P = BOMB.P;
  P.t -= dt; P.tick -= dt; P.on = Math.max(0, P.on - dt);
  if (P.tick <= 0) { P.tick = P.t > 10 ? 1 : P.t > 5 ? 0.5 : 0.2; P.on = 0.1; sfxClick(null, 2300, 0.3); }
  P.led.material.color.setRGB(P.on > 0 ? 1 : 0.15, P.on > 0 ? 0.2 : 0.02, 0.02);
  let by = null;
  for (const e of entities) {
    if (!e.alive || e.off || e.isRemote || e.team === BOMB.att) continue;
    if (hyp(e.pos.x - P.x, e.pos.z - P.z) < 2.6 && Math.abs(e.pos.y - P.y) < 1.6 && (e.isPlayer ? bombChannel(e) : bombBotHold(e) || P.t < 10)) { by = e; if (e.isPlayer) break; } // (sous 10 s, un bot près de la bombe désamorce même sous le feu)
  }
  if (by) { BOMB.prog += dt; BOMB.progMe = !!by.isPlayer; if (BOMB.prog >= BOMB.defuseT) { bombEnd(1 - BOMB.att, 'defused'); return; } }
  else { BOMB.prog = 0; BOMB.progMe = false; }
  if (P.t <= 0) { bombBlow(); bombEnd(BOMB.att, 'boom'); }
}
/* Explosion : le feu et le bruit, et des dégâts qui baissent avec la distance ; l'équipe qui attaque est épargnée. En ligne, chacun blesse ce qu'il
   possède (son joueur, et les bots de l'hôte) : un joueur distant applique le sien chez lui (09ie-bombe-reseau.js), sinon le coup se perdrait. */
function bombBlowFx(P) {
  const pos = new V3(P.x, P.y + 0.3, P.z);
  explosionFx(pos, 1, true);
  for (let i = 0; i < 3; i++) explosionFx(pos.clone().add(new V3(rand(-3, 3), rand(0, 2), rand(-3, 3))), 1, true);
  sfxExplosion(pos); PL.shake = Math.max(PL.shake, 1.2);
}
function bombBlowHurt(P) {
  const lan = MATCH.online && NET.on;
  for (const e of entities) {
    if (!e.alive || e.off || e.team === BOMB.att || (lan && !netIsLocal(e))) continue;
    const d = hyp(e.pos.x - P.x, e.pos.z - P.z), k = 1 - d / BOMB.blast;
    if (k > 0) applyDamage(e, 300 * k, lan && !netIsLocal(P.by) ? e : P.by, _t('Explosion de la bombe'), false, new V3(e.pos.x - P.x, 0.4, e.pos.z - P.z).normalize());
  }
}
function bombBlow() { bombBlowFx(BOMB.P); bombBlowHurt(BOMB.P); }
/* Fin de manche : le point, l'annonce, puis la manche suivante (ou la fin de partie si une équipe a atteint la limite) */
function bombEnd(w, why) {
  if (BOMB.phase === 'over') return;
  BOMB.phase = 'over'; BOMB.endT = BOMB.endLen; BOMB.prog = 0; BOMB.progMe = false; BOMB.why = why; BOMB.winner = w;
  MATCH.score[w]++; BOMB.played++;
  bombEndSay(w, why);
  if (MATCH.score[w] >= MATCH.limit) matchFinish();
}
/* L'annonce de fin de manche (chez tous : en ligne, les invités la rejouent d'après l'état de l'hôte) */
function bombEndSay(w, why) {
  const sub = why === 'elim_def' ? _t('Les défenseurs sont éliminés') : why === 'elim_att' ? _t('Les attaquants sont éliminés') : why === 'boom' ? _t('La bombe a explosé') : why === 'defused' ? _t('La bombe est désamorcée') : _t('Temps écoulé');
  bombSay(_t('{0} gagne la manche', TEAM_NAMES[w]), sub, w === PL.ent.team ? '#8fd16a' : '#ff6a55', BOMB.endLen);
}
/* Le numéro de la manche et le rôle du joueur (chez tous : en ligne aussi, après le décompte) */
function bombSayRound() {
  BOMB.said = BOMB.round;
  bombSay(_t('Manche {0}', BOMB.round), (BOMB.swapped ? _t('Changement de camp') + '. ' : '') + (PL.ent.team === BOMB.att ? _t('Vous attaquez, posez la bombe sur un site') : _t('Vous défendez les deux sites')), '#fff', 4);
  BOMB.swapped = false;
}
function bombUpdate(dt) {
  if (BOMB.phase === 'off') return;
  if (BOMB.sayT > 0) BOMB.sayT -= dt;
  if (BOMB.phase === 'over') {
    BOMB.endT -= dt; MATCH.timeLeft = Math.max(1, BOMB.t);
    if (BOMB.endT <= 0) bombNewRound(); else bombUi();
    return;
  }
  if (BOMB.said !== BOMB.round) { bombSayRound(); bombReplan(); } // première image de la manche (le décompte est fini)
  for (const e of entities) {
    if (e.bombHold && e.goal && e.goal.hold) { e.goal.holdFor = e.bombHold.f; e.goal.look = e.bombHold.l; } // (setPath copie hold et dom seulement : la durée et le regard de la tenue)
    if (!e.isPlayer && !e.isRemote && e.alive && !e.visible && bombFocus(e)) e.lastSeenT = -1e9;
  }
  bombCarrierTick();
  if (BOMB.phase === 'live') bombPlanterTick();
  else if (BOMB.P) { // les désamorceurs changent (l'un est tombé, ou un autre est plus proche) : les nouveaux refont leur but
    const d = bombDefusers();
    if (d.length !== BOMB.defusers.length || d.some((e, i) => e !== BOMB.defusers[i])) { for (const e of d) if (!BOMB.defusers.includes(e) && e.tactic === 'roam') { e.goal = null; e.path = null; e.holdT = 0; } BOMB.defusers = d; }
  }
  const da = bombAlive(1 - BOMB.att), aa = bombAlive(BOMB.att);
  if (BOMB.phase === 'live') {
    BOMB.t -= dt; bombPlantTick(dt);
    if (BOMB.phase === 'live') {
      if (da === 0 && aa > 0) bombEnd(BOMB.att, 'elim_def');
      else if (aa === 0) bombEnd(1 - BOMB.att, 'elim_att');
      else if (BOMB.t <= 0) bombEnd(1 - BOMB.att, 'time');
    }
  } else if (da === 0) bombEnd(BOMB.att, 'elim_def');
  else bombFuseTick(dt);
  MATCH.timeLeft = Math.max(1, BOMB.phase === 'planted' && BOMB.P ? BOMB.P.t : BOMB.t); // le chrono du jeu montre la manche (puis la mise à feu) ; la partie ne finit que par les manches
  bombUi();
}

/* ---------- Interface ---------- */
function bombSay(title, sub, col, secs) { BOMB.sayTitle = title; BOMB.sayS = sub; BOMB.sayC = col; BOMB.sayT = secs; }
function bombStatus() {
  const me = PL.ent, att = me.team === BOMB.att;
  if (!me.alive) return _t('Éliminé, prochaine manche bientôt');
  if (BOMB.phase === 'planted' && BOMB.P) {
    if (att) return _t('Protégez la bombe');
    return hyp(me.pos.x - BOMB.P.x, me.pos.z - BOMB.P.z) < 2.6 ? _t('Restez immobile pour désamorcer') : _t('Désamorcez la bombe avant qu\u0027elle explose');
  }
  if (BOMB.phase !== 'live') return '';
  if (att) return bombSiteAt(me) ? _t('Restez immobile pour poser la bombe') : BOMB.carrier === me ? _t('Vous portez la bombe') : _t('Attaquez et posez la bombe');
  return _t('Défendez les sites A et B');
}
function bombUi() {
  if (!BOMB.ui) return;
  const say = BOMB.sayT > 0, bar = BOMB.progMe && BOMB.prog > 0;
  hudText(BOMB.uiT, say ? BOMB.sayTitle : ''); hudStyle(BOMB.uiT, 'color', BOMB.sayC);
  hudText(BOMB.uiS, bar ? (BOMB.phase === 'planted' ? _t('Désamorçage') : _t('Pose de la bombe')) : say ? BOMB.sayS : bombStatus());
  hudStyle(BOMB.uiB, 'display', bar ? 'block' : 'none');
  if (bar) hudStyle(BOMB.uiF, 'transform', `scaleX(${clamp(BOMB.prog / (BOMB.phase === 'planted' ? BOMB.defuseT : BOMB.plantT), 0, 1).toFixed(3)})`);
}

/* ---------- Les bots ---------- */
/* Un point au sol dans la zone du site (entre r0 et r1 mètres du centre), sur le réseau de navigation */
function bombSpot(p, r0, r1) {
  for (let k = 0; k < 8; k++) {
    const a = rand(0, TAU), r = rand(r0, r1), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r, id = navNode(x, p.y, z);
    if (id >= 0 && NAV.comp[id] === NAV.mainComp && hyp(NAV.nx[id] - x, NAV.nz[id] - z) < 2 && Math.abs(NAV.ny[id] - p.y) < 1.5) return new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id]);
  }
  return new V3(p.x, p.y, p.z);
}
/* Les deux bots défenseurs vivants les plus proches de la bombe : ce sont eux qui vont la désamorcer (si l'un tombe, l'autre continue) */
function bombDefusers() {
  const P = BOMB.P, L = entities.filter((e) => e.alive && !e.off && !e.isPlayer && !e.isRemote && e.team !== BOMB.att);
  L.sort((a, b) => hyp(a.pos.x - P.x, a.pos.z - P.z) - hyp(b.pos.x - P.x, b.pos.z - P.z));
  return L.slice(0, 2);
}
/* Où aller (pickGoal) : le bot poseur au site visé, qu'il tient le temps de poser ; les autres attaquants le rejoignent et y restent ; les défenseurs
   tiennent chacun un site, face à l'arrivée adverse ; la bombe posée, les attaquants la gardent, deux défenseurs vont la désamorcer et les autres se
   rassemblent autour d'elle.
   setPath (07-bots.js) ne recopie du but que hold et dom : la durée (holdFor) et le regard (look) de la tenue sont gardés dans b.bombHold,
   puis remis sur le but du bot par bombUpdate. */
function bombGoal(b, now) {
  const g = bombGoalPick(b);
  b.bombHold = g ? { f: g.holdFor, l: g.look } : null;
  return g;
}
function bombGoalPick(b) {
  const S = BOMB.sites, P = BOMB.P, att = b.team === BOMB.att;
  if (!S.length || BOMB.phase === 'off' || BOMB.phase === 'over') return null;
  let g;
  if (P) {
    const s = S[P.site];
    if (att) { g = bombSpot(s, 3, BOMB.rad + 3); g.hold = true; g.holdFor = rand(5, 9); g.look = { x: s.x + rand(-10, 10), z: s.z + rand(-10, 10) }; }
    else if (bombDefusers().includes(b)) { const id = navNode(P.x, P.y, P.z); g = id >= 0 ? new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id]) : new V3(P.x, P.y, P.z); g.hold = true; g.holdFor = BOMB.defuseT + 2; } // (un nœud du réseau : la bombe n'en est pas un, et le bot ne s'arrêterait jamais à moins de 2 m)
    else { g = bombSpot(s, 2.5, 4.5); g.hold = true; g.holdFor = rand(4, 8); } // les autres défenseurs se rassemblent autour de la bombe (à moins de 2,6 m ils désamorcent aussi)
    return g;
  }
  if (att) {
    const c = BOMB.planter === b, s = c ? S[BOMB.target] : S[Math.random() < 0.9 ? BOMB.target : 1 - BOMB.target];
    g = bombSpot(s, 0.5, c ? 2.5 : BOMB.rad - 1.5); g.hold = true; g.holdFor = c ? BOMB.plantT + 2.5 : rand(7, 12); // (ils restent au site : tout attaquant au calme dans la zone pose)
    return g;
  }
  const s = S[b.id % S.length], side = Math.sign(s.z) || 1;
  g = bombSpot(s, 2, BOMB.rad - 1); g.hold = true; g.holdFor = rand(6, 10); g.look = { x: s.x + rand(-8, 8), z: s.z - side * 20 };
  return g;
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
try { const f = modeUpdate; modeUpdate = function (dt) { f(dt); if (MATCH.mode === 'bomb') bombUpdate(dt); }; } catch (e) { console.warn('bombe : modeUpdate', e); }
// les camps : l'équipe qui attaque apparaît dans la base 0, l'autre dans la base 1 (les sites sont dans la moitié de la base 1)
try { const f = spawnBase; spawnBase = function (t) { return MATCH.mode === 'bomb' ? (t === BOMB.att ? 0 : 1) : f(t); }; } catch (e) { console.warn('bombe : spawnBase', e); }
// une seule vie par manche : le joueur ne réapparaît qu'au début de la manche suivante (bombRespawnMe lève BOMB.allow)
try { const f = respawnPlayer; respawnPlayer = function () { if (MATCH.mode === 'bomb' && !BOMB.allow) return; f(); }; } catch (e) { console.warn('bombe : respawnPlayer', e); }
// la partie se décide par les manches (bombEnd), pas par une élimination
try { const f = killLimitReached; killLimitReached = function () { return MATCH.mode === 'bomb' ? false : f(); }; } catch (e) { console.warn('bombe : killLimitReached', e); }
try { const f = finKicker; finKicker = function () { return MATCH.mode === 'bomb' && finByLimit() ? _t('Limite de manches atteinte') : f(); }; } catch (e) { console.warn('bombe : finKicker', e); }
try { const f = cdShow; cdShow = function (n, first) { f(n, first); if (MATCH.mode === 'bomb') $('cdKick').textContent = _t('La manche commence dans'); }; } catch (e) { console.warn('bombe : cdShow', e); }
// pas de poursuite d'un adversaire perdu de vue (botChasing, 07b-tactics.js) : les bots suivent l'objectif, comme en domination
try { const f = botChasing; botChasing = function (b, now, D) { return MATCH.mode === 'bomb' ? false : f(b, now, D); }; } catch (e) { console.warn('bombe : botChasing', e); }
try { const f = pickGoal; pickGoal = function (b, now) { if (MATCH.mode === 'bomb') { const g = bombGoal(b, now); if (g) return g; } return f(b, now); }; } catch (e) { console.warn('bombe : pickGoal', e); }

/* Un repère à l'écran au-dessus d'un point du monde, relevé de h mètres et borné entre 14 et 19 % de la hauteur de l'écran : en haut de l'image, il ne masque pas
   la vue (la position à l'écran ne donne que la direction). Faux (et caché) si le point est derrière ou hors de l'écran sur les côtés. */
function bombMarkAt(el, x, y, z, h) {
  _dv.set(x, y + h, z).project(camera);
  const show = _dv.z < 1 && Math.abs(_dv.x) < 1.1;
  hudStyle(el, 'opacity', show ? '1' : '0');
  if (!show) return false;
  hudStyle(el, 'transform', `translate(${Math.round((_dv.x * 0.5 + 0.5) * VIEW.w)}px, ${Math.round(clamp(-_dv.y * 0.5 + 0.5, 0.14, 0.19) * VIEW.h)}px) translate(-50%, -50%)`);
  return true;
}
/* Les mètres dans la bulle : la bulle (la feuille de style de la domination, shell.html) laissait le texte décalé ; on la remet à la taille de la bulle de la
   lettre et on centre le texte (une fois, dès que le repère est mis en page) */
function bombMarkFix(el) {
  if (el.bFix) return;
  const b = el.firstChild, i = el.lastChild, r = b && b.getBoundingClientRect ? b.getBoundingClientRect() : null;
  if (!r || r.width < 8) return;
  i.style.cssText += `;display:flex;align-items:center;justify-content:center;text-align:center;padding:0;box-sizing:border-box;line-height:1;width:${r.width}px;height:${r.height}px`;
  el.bFix = true;
}
/* Image par image : le repère de chaque site à l'écran (lettre et distance) */
function bombHud() {
  for (const p of BOMB.sites) {
    if (!bombMarkAt(p.el, p.x, p.y, p.z, 20)) continue;
    bombMarkFix(p.el);
    hudText(p.el.lastChild, `${Math.round(hyp(p.x - camera.position.x, p.z - camera.position.z))} m`);
  }
}
/* Mini-carte : zone et lettre de chaque site (la lettre dans une petite toile faite une fois, comme domLetter : la dessiner à chaque image coûte cher) ; la bombe posée clignote */
function bombMinimap(g, scale, yaw) {
  const c = BOMB.col.map((x) => Math.round(x * 255)).join(',');
  for (const p of BOMB.sites) {
    if (!p.mmDone) bombLetter(p, c);
    g.fillStyle = `rgba(${c},0.22)`; g.strokeStyle = `rgba(${c},0.9)`; g.lineWidth = 2;
    g.beginPath(); g.arc(p.x * scale, p.z * scale, BOMB.rad * scale, 0, TAU); g.fill(); g.stroke();
    g.save(); g.translate(p.x * scale, p.z * scale); g.rotate(-yaw);
    const B = DOM_MM.box; g.drawImage(p.mmCv, -B / 2, -B / 2, B, B); g.restore();
  }
  const P = BOMB.P;
  if (P) { g.fillStyle = P.on > 0 ? 'rgb(255,60,40)' : 'rgb(140,30,20)'; g.beginPath(); g.arc(P.x * scale, P.z * scale, 4, 0, TAU); g.fill(); }
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
