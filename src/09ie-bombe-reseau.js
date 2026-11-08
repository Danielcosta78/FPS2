/* ==========================================================================
   MODE BOMBE EN LIGNE (09ib-bombe.js, 09c-net.js)
   L'hôte décide tout : les manches, la pose, le désamorçage, l'explosion, le score, le changement de camps. Il joint l'état de la manche (bombNetState)
   à chacun de ses envois "ps" ; les invités l'appliquent avant le reste du message (bombNetApply), ce qui rejoue chez eux la nouvelle manche (le
   joueur réapparaît, le décompte repart, cdNetIn suit dans le même message), la bombe posée (avec son chrono), la fin de manche et l'explosion.
   Un invité qui pose ou désamorce (en restant immobile, comme en solo) le demande à l'hôte par un événement ('bpl' ou 'bdf', par netEvent) ; l'hôte vérifie la
   position et l'état de la manche, puis décide. Les dégâts de l'explosion : chacun blesse ce qu'il possède (bombBlowHurt). Le score des manches
   remplace le score de la partie : netUpdate (qui compte les éliminations) est tenue à l'écart.
   Le même fichier, enveloppant des fonctions de 09c-net.js, de 09i-modes.js et de 09ib : chacune dans un try.
   ========================================================================== */
const bombR1 = (v) => Math.round(v * 10) / 10, bombR2 = (v) => Math.round(v * 100) / 100;
function bombLan() { return !!(MATCH.online && NET.on); }

/* ---------- Hôte : l'état à envoyer ---------- */
function bombNetState() {
  const P = BOMB.P;
  return {
    r: BOMB.round, ph: BOMB.phase === 'planted' ? 'p' : BOMB.phase === 'over' ? 'o' : 'l', a: BOMB.att, n: BOMB.played, t: bombR1(BOMB.t), s: [MATCH.score[0], MATCH.score[1]],
    sw: BOMB.swapped ? 1 : 0, y: BOMB.why || '', w: BOMB.winner,
    P: P ? [P.site, bombR2(P.x), bombR2(P.y), bombR2(P.z), bombR1(P.t), P.by && P.by.netId !== undefined ? P.by.netId : P.by && P.by.peer !== undefined ? P.by.peer : -1] : 0,
  };
}
try {
  const f = netBroadcast;
  netBroadcast = function (m, onlyInGame, except) {
    if (m && m.t === 'ps' && m.tl !== undefined && BOMB.phase !== 'off' && NET.role === 'host') m.bm = bombNetState(); // (seul l'envoi de l'hôte porte tl)
    f(m, onlyInGame, except);
  };
} catch (e) { console.warn('bombe : netBroadcast', e); }

/* ---------- Invité : appliquer l'état de l'hôte ---------- */
try {
  const f = netClientMsg;
  netClientMsg = function (m) {
    if (m && m.t === 'ps' && m.bm && BOMB.phase !== 'off' && NET.on && NET.role === 'client') bombNetApply(m.bm); // avant le reste : cdNetIn, dans ce message, suit la nouvelle manche
    f(m);
  };
} catch (e) { console.warn('bombe : netClientMsg', e); }
function bombNetApply(st) {
  if (!st || typeof st !== 'object') return;
  const r = st.r | 0;
  if (r > BOMB.round) bombNetRound(st); else if (r < BOMB.round) return; // (un état d'une manche passée)
  BOMB.att = st.a === 1 ? 1 : 0; BOMB.played = st.n | 0; BOMB.t = clamp(+st.t || 0, 0, 999);
  if (Array.isArray(st.s) && !MATCH.fin) MATCH.score = [st.s[0] | 0, st.s[1] | 0];
  const ph = st.ph === 'p' ? 'planted' : st.ph === 'o' ? 'over' : 'live';
  if (st.P && !BOMB.P && ph !== 'live') bombNetPlant(st.P);
  if (BOMB.P && st.P) BOMB.P.t = +st.P[4] || 0;
  if (ph === 'over') {
    if (BOMB.phase !== 'over') {
      BOMB.phase = 'over'; BOMB.endT = BOMB.endLen; BOMB.prog = 0; BOMB.progMe = false; BOMB.why = String(st.y || ''); BOMB.winner = st.w | 0;
      bombEndSay(BOMB.winner, BOMB.why);
      if (BOMB.why === 'boom' && BOMB.P) { bombBlowFx(BOMB.P); bombBlowHurt(BOMB.P); }
    }
  } else BOMB.phase = ph;
}
/* Nouvelle manche chez l'invité : le monde, le joueur qui réapparaît (en formation), le décompte qui attend celui de l'hôte */
function bombNetRound(st) {
  BOMB.round = st.r | 0; BOMB.swapped = !!st.sw; BOMB.att = st.a === 1 ? 1 : 0; BOMB.played = st.n | 0;
  BOMB.phase = 'live'; BOMB.t = +st.t || BOMB.roundLen; BOMB.prog = 0; BOMB.progMe = false; BOMB.carrier = null; BOMB.sayT = 0; BOMB.why = ''; BOMB.winner = -1; BOMB.askT = -9;
  bombBombClear(); bombWorldClear();
  OPEN.on = true; bombRespawnMe(); bombUi(); cdStart();
}
/* La bombe posée, rejouée chez l'invité : [site, x, y, z, chrono, id du poseur] */
function bombNetPlant(a) {
  const s = BOMB.sites[a[0] | 0]; if (!s) return;
  bombPlant(s, { pos: new V3(+a[1], +a[2], +a[3]) });
  BOMB.P.t = +a[4] || 0;
  BOMB.P.by = (typeof netEntity === 'function' && netEntity(a[5])) || PL.ent;
}
/* Le bip et le voyant de la bombe, chez l'invité (l'hôte les fait dans bombFuseTick) ; le chrono vient de l'hôte, il descend ici entre deux états */
function bombFuseFx(dt) {
  const P = BOMB.P; if (!P) return;
  P.t = Math.max(0, P.t - dt); P.tick -= dt; P.on = Math.max(0, P.on - dt);
  if (P.tick <= 0) { P.tick = P.t > 10 ? 1 : P.t > 5 ? 0.5 : 0.2; P.on = 0.1; sfxClick(null, 2300, 0.3); }
  P.led.material.color.setRGB(P.on > 0 ? 1 : 0.15, P.on > 0 ? 0.2 : 0.02, 0.02);
}
/* Chez l'invité, la manche ne se décide pas : image par image, l'annonce, la bombe qui tourne, et la pose ou le désamorçage du joueur */
function bombClientUpdate(dt) {
  if (BOMB.sayT > 0) BOMB.sayT -= dt;
  if (BOMB.phase !== 'over') {
    if (BOMB.said !== BOMB.round) bombSayRound();
    if (BOMB.phase === 'planted') bombFuseFx(dt);
    bombClientTick(dt);
  }
  bombUi();
}
/* Le joueur de ce poste pose (attaquant, dans un site) ou désamorce (défenseur, près de la bombe) en tenant l'action ; au bout, il le demande à l'hôte */
function bombClientTick(dt) {
  const me = PL.ent, P = BOMB.P; let busy = false;
  if (me.alive && !MATCH.fin) {
    if (BOMB.phase === 'live' && me.team === BOMB.att && me.onGround !== false) {
      const s = bombSiteAt(me);
      if (s && bombChannel(me)) { busy = true; BOMB.prog = Math.min(BOMB.plantT, BOMB.prog + dt); BOMB.progMe = true; if (BOMB.prog >= BOMB.plantT) bombNetAsk('bpl', { s: s.i }); }
    } else if (BOMB.phase === 'planted' && P && me.team !== BOMB.att && hyp(me.pos.x - P.x, me.pos.z - P.z) < 2.6 && Math.abs(me.pos.y - P.y) < 1.6 && bombChannel(me)) {
      busy = true; BOMB.prog = Math.min(BOMB.defuseT, BOMB.prog + dt); BOMB.progMe = true; if (BOMB.prog >= BOMB.defuseT) bombNetAsk('bdf', {});
    }
  }
  if (!busy) { BOMB.prog = 0; BOMB.progMe = false; }
}
/* La demande, au plus une fois toutes les 1,5 s (si l'hôte la refuse, le joueur la refait en restant dans la zone) */
function bombNetAsk(k, extra) {
  if (MATCH.time - BOMB.askT < 1.5) return;
  BOMB.askT = MATCH.time;
  netEvent(Object.assign({ k }, extra), PL.ent);
}
try {
  const f = bombUpdate;
  bombUpdate = function (dt) { if (bombLan() && NET.role === 'client') bombClientUpdate(dt); else f(dt); };
} catch (e) { console.warn('bombe : bombUpdate', e); }

/* ---------- Hôte : les demandes des invités ---------- */
try {
  const f = netEventIn;
  netEventIn = function (e, ev) {
    if (ev && (ev.k === 'bpl' || ev.k === 'bdf')) { if (NET.role === 'host' && BOMB.phase !== 'off') bombNetAsked(e, ev); return; } // (les invités ignorent la demande des autres : l'état de l'hôte leur dit)
    f(e, ev);
  };
} catch (e) { console.warn('bombe : netEventIn', e); }
function bombNetAsked(e, ev) {
  if (!e || !e.alive) return;
  if (ev.k === 'bpl') {
    const s = BOMB.sites[ev.s | 0];
    if (BOMB.phase === 'live' && s && e.team === BOMB.att && hyp(e.pos.x - s.x, e.pos.z - s.z) < BOMB.rad + 1.5) bombPlant(s, e);
  } else if (BOMB.phase === 'planted' && BOMB.P && e.team !== BOMB.att && hyp(e.pos.x - BOMB.P.x, e.pos.z - BOMB.P.z) < 4) bombEnd(1 - BOMB.att, 'defused');
}

/* ---------- Le score et la fin de partie : ceux des manches ---------- */
try { const f = domNetState; domNetState = function () { return BOMB.phase !== 'off' ? undefined : f(); }; } catch (e) { console.warn('bombe : domNetState', e); }
try {
  // netUpdate remplace le score par les éliminations et finit la partie à la limite : on lui laisse une limite hors d'atteinte, puis on rend le score des manches
  const f = netUpdate;
  netUpdate = function (dt) {
    if (BOMB.phase === 'off') { f(dt); return; }
    const sc = MATCH.score.slice(), lim = MATCH.limit;
    MATCH.limit = 1e9;
    try { f(dt); } finally { MATCH.limit = lim; MATCH.score = sc; }
  };
} catch (e) { console.warn('bombe : netUpdate', e); }
