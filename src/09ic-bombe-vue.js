/* ==========================================================================
   MODE BOMBE : VUE DES ÉQUIPIERS (09ib-bombe.js)
   Une seule vie par manche : mort, on ne réapparaît qu'à la manche suivante. Après la relecture de la mort (killcam), la caméra suit un équipier
   vivant à la troisième personne, derrière lui (le décor la rapproche s'il gêne). Clic, Espace, Entrée ou F : l'équipier suivant. Sans équipier
   vivant, la vue reste sur le corps (updateDeadPlayer, 08-player.js). Fichier à part, chargé après 09ib : il enveloppe updateDeadPlayer, kcSkip,
   bombStatus, bombNewRound et bombClear, chacune dans un try (ou en fonction de 09ib).
   ========================================================================== */
BOMB.spec = null; BOMB.specShown = false;
/* La vue des équipiers est active : mort pendant la manche, relecture finie (ou jamais lancée), un instant après la mort */
function bombSpecOn() {
  return MATCH.mode === 'bomb' && BOMB.phase !== 'off' && MATCH.state === 'playing' && !PL.ent.alive && !KC.active && !KC.pending && PL.deathT > 1.2 && !MATCH.finalPending;
}
/* L'équipier suivi : le même tant qu'il vit ; step : 1 pour passer au suivant */
function bombSpecPick(step) {
  const L = entities.filter((e) => e !== PL.ent && e.alive && !e.off && allied(e, PL.ent));
  if (!L.length) { BOMB.spec = null; return null; }
  const i = L.indexOf(BOMB.spec);
  BOMB.spec = L[i < 0 ? 0 : (i + step + L.length) % L.length];
  return BOMB.spec;
}
/* La caméra, derrière l'épaule de l'équipier (3,4 m, un peu en hauteur), regardant sa tête ; le décor la rapproche */
function bombSpecCam() {
  let t = BOMB.spec;
  if (!t || !t.alive) t = bombSpecPick(0);
  if (!t) return false;
  const hy = t.pos.y + 1.55, nx = Math.sin(t.yaw), nz = Math.cos(t.yaw), nl = Math.sqrt(nx * nx + 0.1225 + nz * nz);
  const dx = nx / nl, dy = 0.35 / nl, dz = nz / nl, h = rayWorld(t.pos.x, hy, t.pos.z, dx, dy, dz, 3.8), d = h ? Math.max(0.5, h.t - 0.35) : 3.4;
  camera.position.set(t.pos.x + dx * d, hy + dy * d, t.pos.z + dz * d);
  const ex = t.pos.x - camera.position.x, ez = t.pos.z - camera.position.z, ey = hy - camera.position.y;
  camera.rotation.set(Math.atan2(ey, hyp(ex, ez)), Math.atan2(-ex, -ez), 0);
  return true;
}
try {
  const f = updateDeadPlayer;
  updateDeadPlayer = function (dt) {
    if (bombSpecOn() && bombSpecCam()) {
      PL.deathT += dt; VM.holder.visible = false; vmClearHeld(); if (PL.ent.model) PL.ent.model.root.visible = false;
      if (!BOMB.specShown) { BOMB.specShown = true; hideDeathScreen(); }
      return;
    }
    BOMB.specShown = false; f(dt);
  };
} catch (e) { console.warn('bombe : updateDeadPlayer', e); }
// mort en pleine manche : Espace, Entrée, F ou le clic passent à l'équipier suivant ; ils ne font plus réapparaître (respawnPlayer est bloquée)
try {
  const f = kcSkip;
  kcSkip = function () {
    if (MATCH.mode === 'bomb' && BOMB.phase !== 'off' && !KC.active && !PL.ent.alive && MATCH.state === 'playing') { if (bombSpecOn()) bombSpecPick(1); return; }
    f();
  };
} catch (e) { console.warn('bombe : kcSkip', e); }
try { const f = bombStatus; bombStatus = function () { return !PL.ent.alive && bombSpecOn() && BOMB.spec ? _t('Vous regardez {0}, clic pour changer', BOMB.spec.name) : f(); }; } catch (e) { console.warn('bombe : bombStatus', e); }
try { const f = bombNewRound; bombNewRound = function () { BOMB.spec = null; BOMB.specShown = false; f(); }; } catch (e) { console.warn('bombe : bombNewRound', e); }
try { const f = bombClear; bombClear = function () { BOMB.spec = null; BOMB.specShown = false; f(); }; } catch (e) { console.warn('bombe : bombClear', e); }
