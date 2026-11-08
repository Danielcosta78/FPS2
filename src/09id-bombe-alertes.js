/* ==========================================================================
   MODE BOMBE : ALERTES, CHRONO, ICÔNE ET SONS (09ib-bombe.js)
   Bombe plantée : une petite alerte rouge (le site et le chrono qui descend jusqu'à l'explosion, minutes et secondes, puis les dixièmes sous 10 s, qui
   clignote) et un son, dans le coin haut gauche, à droite de la mini-carte (en retrait : elle ne gêne pas la vue), et une icône de bombe en haut de
   l'image, dans la direction de la bombe, avec sa distance. Bombe désarmée : la même petite alerte, verte, et un son. Un tic à chaque demi-seconde de
   pose ou de désamorçage, un bip de fin de manche (qui monte si l'équipe du joueur gagne). Tout part de l'état de la manche (BOMB.P, BOMB.phase,
   BOMB.why, BOMB.winner) : les invités en ligne, qui reçoivent cet état de l'hôte (09ie-bombe-reseau.js), voient et entendent donc la même chose.
   Les sons de la pose et du désamorçage sont synthétisés (bombSynth).
   Fichier à part, chargé après 09ib : il enveloppe bombUi, bombHud et bombClear.
   ========================================================================== */
const BOMB_AL = { el: null, lbl: null, tm: null, mk: null, seenP: null, overRound: -1, endRound: -1, until: 0, kind: '', tick: -1, placeAt: 0, mmL: 0, mmT: 0 };
/* L'icône : une petite bombe (corps, mèche, étincelle) */
const BOMB_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align:-3px;margin-right:0" aria-hidden="true"><circle cx="11" cy="14" r="7.5" fill="#1c1f1b" stroke="#e8e2d0" stroke-width="1.6"/>'
  + '<path d="M15.5 8.2 18.2 5.4" stroke="#e8e2d0" stroke-width="1.8" stroke-linecap="round" fill="none"/><circle cx="19.2" cy="4.4" r="1.8" fill="#ffb02e"/><circle cx="8.4" cy="11.6" r="1.8" fill="#ffffff" opacity="0.25"/></svg>';
/* Une petite carte : l'icône, et à côté deux lignes, le texte (bombe plantée, site A, ou bombe désamorcée) et le chrono */
function bombAlertEl() {
  if (BOMB_AL.el && BOMB_AL.el.isConnected !== false) return BOMB_AL.el;
  const el = document.createElement('div'), ic = document.createElement('span'), col = document.createElement('div'), lbl = document.createElement('span'), tm = document.createElement('span');
  el.id = 'bombAl';
  el.setAttribute('style', 'position:fixed;left:150px;top:12px;display:none;align-items:center;gap:6px;padding:3px 9px 3px 6px;border-radius:4px;background:rgba(200,40,30,0.82);'
    + 'pointer-events:none;color:#fff;text-shadow:0 1px 3px #000;font-family:"Barlow Condensed",sans-serif;white-space:nowrap;z-index:30');
  ic.innerHTML = BOMB_ICON;
  col.setAttribute('style', 'display:flex;flex-direction:column;line-height:1.05');
  lbl.setAttribute('style', 'font-size:clamp(10px,1.2vw,12px);font-weight:700;letter-spacing:0.04em');
  tm.setAttribute('style', 'font-size:clamp(15px,2vw,20px);font-weight:700;font-variant-numeric:tabular-nums;color:#fff');
  col.appendChild(lbl); col.appendChild(tm); el.appendChild(ic); el.appendChild(col);
  document.body.appendChild(el);
  BOMB_AL.el = el; BOMB_AL.lbl = lbl; BOMB_AL.tm = tm;
  return el;
}
/* La mini-carte : le plus grand canevas de taille moyenne dans le coin haut gauche (le canevas du rendu 3D, lui, couvre tout l'écran) */
function bombMinimapRect() {
  let best = null;
  for (const c of document.querySelectorAll('canvas')) {
    const r = c.getBoundingClientRect();
    if (r.width < 60 || r.width > 480 || r.height < 60 || r.height > 480 || r.left > innerWidth * 0.3 || r.top > innerHeight * 0.3) continue;
    if (!best || r.width * r.height > best.width * best.height) best = r;
  }
  return best;
}
/* À droite de la mini-carte, en haut au même niveau qu'elle (sans mini-carte, un peu en retrait du coin) ; recalculé deux fois par seconde */
function bombAlertPlace(now) {
  if (now < BOMB_AL.placeAt) return;
  BOMB_AL.placeAt = now + 500;
  const r = bombMinimapRect(), L = r ? Math.round(r.right + 8) : 150, T = r ? Math.round(r.top) : 12;
  if (L !== BOMB_AL.mmL) { BOMB_AL.mmL = L; hudStyle(BOMB_AL.el, 'left', L + 'px'); }
  if (T !== BOMB_AL.mmT) { BOMB_AL.mmT = T; hudStyle(BOMB_AL.el, 'top', T + 'px'); }
}
/* Le son d'une action de la bombe, synthétisé (Web Audio : AU.ctx, sortie d'interface uiOut de 05a-sfx.js) et sans fichier.
   plant : un choc grave, trois bips aigus qui arment, puis un accord qui retombe ; defuse : quatre claquements de relais, puis un carillon
   qui monte. Faux si le son n'est pas prêt (premier geste du joueur pas encore fait). */
function bombSynth(kind) {
  if (!AU || !AU.ready || !AU.ctx) return false;
  const ctx = AU.ctx, out = uiOut(1), t0 = ctx.currentTime + 0.03;
  const tone = (type, f0, f1, t, dur, vol) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  };
  const click = (t, vol) => { // un claquement sec : une très courte salve de bruit
    const n = Math.floor(ctx.sampleRate * 0.025), b = ctx.createBuffer(1, n, ctx.sampleRate), c = b.getChannelData(0);
    for (let i = 0; i < n; i++) c[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; g.gain.value = vol; s.connect(g); g.connect(out); s.start(t);
  };
  if (kind === 'plant') {
    click(t0, 0.9); tone('sine', 150, 48, t0, 0.4, 0.95);
    for (let i = 0; i < 3; i++) tone('square', 1900, 1900, t0 + 0.08 + i * 0.12, 0.08, 0.3);
    tone('sawtooth', 520, 500, t0 + 0.5, 0.45, 0.28); tone('sawtooth', 780, 760, t0 + 0.5, 0.45, 0.2);
  } else {
    for (let i = 0; i < 4; i++) click(t0 + [0, 0.07, 0.15, 0.24][i], 0.7);
    tone('sine', 660, 660, t0 + 0.42, 0.25, 0.5); tone('sine', 990, 990, t0 + 0.55, 0.25, 0.5); tone('sine', 1320, 1320, t0 + 0.68, 0.7, 0.55); tone('triangle', 2640, 2640, t0 + 0.68, 0.5, 0.15);
  }
  return true;
}
/* Le son de la bombe plantée ou désarmée : le son synthétisé et un signal enregistré, qui annonce du côté du joueur (st_capture : bon pour lui,
   st_lost : mauvais) ; sans son synthétisé, les bips d'avant */
function bombAlertSound(kind) {
  try {
    const att = PL.ent.team === BOMB.att, good = kind === 'plant' ? att : !att;
    if (bombSynth(kind)) { sfxAnnounce(null, good ? 'st_capture' : 'st_lost'); return; }
    if (kind === 'plant') { sfxBeep(1500, 1); setTimeout(() => sfxBeep(1500, 1), 230); } else { sfxBeep(900, 1); setTimeout(() => sfxBeep(1400, 1), 180); }
  } catch (e) { /* les sons ne sont pas prêts : l'alerte reste à l'écran */ }
}
/* Fin de manche (hors explosion et désamorçage, qui ont leur son) : deux bips qui montent si l'équipe du joueur gagne, un bip grave sinon */
function bombEndSound(won) {
  try { if (won) { sfxBeep(1100, 1); setTimeout(() => sfxBeep(1500, 1), 140); } else sfxBeep(600, 1); } catch (e) { /* idem */ }
}
/* 7:05 ou, sous 10 s, 7.3 */
function bombFmtFuse(t) { t = Math.max(0, t); return t >= 10 ? Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0') : t.toFixed(1); }
function bombAlertTick() {
  if (!BOMB.ui) return;
  bombAlertEl();
  const P = BOMB.P, now = performance.now();
  if (P && P !== BOMB_AL.seenP) { BOMB_AL.seenP = P; BOMB_AL.kind = 'plant'; bombAlertSound('plant'); }
  if (BOMB.phase === 'over' && BOMB.why === 'defused' && BOMB_AL.overRound !== BOMB.round) { BOMB_AL.overRound = BOMB.round; BOMB_AL.kind = 'defuse'; BOMB_AL.until = now + 4000; bombAlertSound('defuse'); }
  if (BOMB.phase === 'over' && BOMB.winner >= 0 && BOMB_AL.endRound !== BOMB.round) { BOMB_AL.endRound = BOMB.round; if (BOMB.why !== 'defused' && BOMB.why !== 'boom') bombEndSound(BOMB.winner === PL.ent.team); }
  // un tic à chaque demi-seconde de pose ou de désamorçage (celui du joueur de ce poste)
  if (BOMB.progMe && BOMB.prog > 0) {
    const k = Math.floor(BOMB.prog * 2);
    if (k !== BOMB_AL.tick) { BOMB_AL.tick = k; try { sfxClick(null, BOMB.phase === 'planted' ? 1300 : 1800, 0.12); } catch (e) { /* idem */ } }
  } else BOMB_AL.tick = -1;
  const planted = BOMB.phase === 'planted' && P, defused = BOMB_AL.kind === 'defuse' && now < BOMB_AL.until;
  hudStyle(BOMB_AL.el, 'display', planted || defused ? 'flex' : 'none');
  hudStyle(BOMB_AL.tm, 'display', planted ? 'block' : 'none');
  if (planted || defused) bombAlertPlace(now);
  if (planted) {
    hudText(BOMB_AL.lbl, _t('Bombe plantée, site {0}', BOMB.sites[P.site] ? BOMB.sites[P.site].name : '?'));
    hudStyle(BOMB_AL.el, 'background', 'rgba(200,40,30,0.82)');
    hudText(BOMB_AL.tm, bombFmtFuse(P.t));
    hudStyle(BOMB_AL.tm, 'color', P.t < 10 && Math.floor(P.t * 4) % 2 ? '#ffd2cc' : '#ffffff');
  } else if (defused) {
    hudText(BOMB_AL.lbl, _t('Bombe désamorcée'));
    hudStyle(BOMB_AL.el, 'background', 'rgba(60,150,60,0.88)');
  }
}

/* ---------- L'icône de la bombe posée, en haut de l'image (comme les repères des sites, 09ib : bombMarkAt) ---------- */
function bombMarkTick() {
  const P = BOMB.P, show = BOMB.phase === 'planted' && P;
  if (!show) { if (BOMB_AL.mk) hudStyle(BOMB_AL.mk, 'opacity', '0'); return; }
  if (!BOMB_AL.mk) {
    const el = document.createElement('div'); el.className = 'dpm hot'; el.innerHTML = '<b>' + BOMB_ICON.replace('width="16" height="16"', 'width="24" height="24"') + '</b><i></i>';
    $('hud').insertBefore(el, $('scope')); BOMB_AL.mk = el;
  }
  const el = BOMB_AL.mk;
  if (!bombMarkAt(el, P.x, P.y, P.z, 20)) return;
  bombMarkFix(el);
  hudText(el.lastChild, `${Math.round(hyp(P.x - camera.position.x, P.z - camera.position.z))} m`);
}

try { const f = bombUi; bombUi = function () { f(); bombAlertTick(); }; } catch (e) { console.warn('bombe : bombUi', e); }
try { const f = bombHud; bombHud = function () { f(); bombMarkTick(); }; } catch (e) { console.warn('bombe : bombHud', e); }
try {
  const f = bombClear;
  bombClear = function () {
    f();
    for (const k of ['el', 'mk']) if (BOMB_AL[k]) { BOMB_AL[k].remove(); BOMB_AL[k] = null; }
    BOMB_AL.seenP = null; BOMB_AL.overRound = -1; BOMB_AL.endRound = -1; BOMB_AL.kind = ''; BOMB_AL.tick = -1;
  };
} catch (e) { console.warn('bombe : bombClear (alertes)', e); }
