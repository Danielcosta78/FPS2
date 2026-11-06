/* ==========================================================================
   MODE BOMBE : ALERTES ET CHRONO DE LA BOMBE (09ib-bombe.js)
   Bombe plantée : une alerte rouge (avec le site) et deux bips, et, tant qu'elle tourne, le chrono qui descend jusqu'à l'explosion (minutes et
   secondes, puis les dixièmes sous 10 s, qui clignote). Bombe désarmée : une alerte verte et deux bips. Tout part de l'état de la manche (BOMB.P,
   BOMB.phase, BOMB.why) : les invités en ligne, qui reçoivent cet état de l'hôte (09ie-bombe-reseau.js), voient donc la même chose. Fichier à part,
   chargé après 09ib : il enveloppe bombUi et bombClear.
   ========================================================================== */
const BOMB_AL = { el: null, pill: null, tm: null, seenP: null, overRound: -1, until: 0, kind: '' };
function bombAlertEl() {
  if (BOMB_AL.el && BOMB_AL.el.isConnected !== false) return BOMB_AL.el;
  const el = document.createElement('div'); el.id = 'bombAl';
  el.setAttribute('style', 'position:absolute;left:50%;top:27%;transform:translateX(-50%);text-align:center;pointer-events:none;color:#fff;text-shadow:0 1px 4px #000;font-family:"Barlow Condensed",sans-serif');
  el.innerHTML = '<div style="display:none;padding:4px 20px;font-size:26px;font-weight:700;letter-spacing:0.06em;border-radius:3px;background:rgba(200,40,30,0.88)"></div>'
    + '<div style="display:none;font-size:60px;font-weight:700;line-height:1.05;margin-top:4px;font-variant-numeric:tabular-nums;color:#ff5a48"></div>';
  BOMB.ui.parentNode.insertBefore(el, BOMB.ui.nextSibling);
  BOMB_AL.el = el; BOMB_AL.pill = el.children[0]; BOMB_AL.tm = el.children[1];
  return el;
}
/* Deux bips : plantée, deux fois le même (grave et insistant) ; désarmée, un bip qui monte */
function bombAlertSound(kind) {
  try {
    if (kind === 'plant') { sfxBeep(1500, 1); setTimeout(() => sfxBeep(1500, 1), 230); } else { sfxBeep(900, 1); setTimeout(() => sfxBeep(1400, 1), 180); }
  } catch (e) { /* les sons ne sont pas prêts : l'alerte reste à l'écran */ }
}
/* 7:05 ou, sous 10 s, 7.3 */
function bombFmtFuse(t) { t = Math.max(0, t); return t >= 10 ? Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0') : t.toFixed(1); }
function bombAlertTick() {
  if (!BOMB.ui) return;
  bombAlertEl();
  const P = BOMB.P, now = performance.now();
  if (P && P !== BOMB_AL.seenP) { BOMB_AL.seenP = P; BOMB_AL.kind = 'plant'; bombAlertSound('plant'); }
  if (BOMB.phase === 'over' && BOMB.why === 'defused' && BOMB_AL.overRound !== BOMB.round) { BOMB_AL.overRound = BOMB.round; BOMB_AL.kind = 'defuse'; BOMB_AL.until = now + 4000; bombAlertSound('defuse'); }
  const planted = BOMB.phase === 'planted' && P, defused = BOMB_AL.kind === 'defuse' && now < BOMB_AL.until;
  hudStyle(BOMB_AL.pill, 'display', planted || defused ? 'block' : 'none');
  hudStyle(BOMB_AL.tm, 'display', planted ? 'block' : 'none');
  if (planted) {
    hudText(BOMB_AL.pill, _t('Bombe plantée, site {0}', BOMB.sites[P.site] ? BOMB.sites[P.site].name : '?'));
    hudStyle(BOMB_AL.pill, 'background', 'rgba(200,40,30,0.88)');
    hudText(BOMB_AL.tm, bombFmtFuse(P.t));
    hudStyle(BOMB_AL.tm, 'color', P.t < 10 && Math.floor(P.t * 4) % 2 ? '#ffffff' : '#ff5a48');
  } else if (defused) {
    hudText(BOMB_AL.pill, _t('Bombe désamorcée'));
    hudStyle(BOMB_AL.pill, 'background', 'rgba(60,150,60,0.9)');
  }
}
try { const f = bombUi; bombUi = function () { f(); bombAlertTick(); }; } catch (e) { console.warn('bombe : bombUi', e); }
try {
  const f = bombClear;
  bombClear = function () { f(); if (BOMB_AL.el) BOMB_AL.el.remove(); BOMB_AL.el = null; BOMB_AL.seenP = null; BOMB_AL.overRound = -1; BOMB_AL.kind = ''; };
} catch (e) { console.warn('bombe : bombClear (alertes)', e); }
