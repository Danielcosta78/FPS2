/* ==========================================================================
   CHOIX DE L'ÉQUIPE EN SOLO (contre les bots)
   Les paramètres de partie du Solo proposent Alpha ou Bravo (Settings.soloTeam) pour les modes par équipes (match par équipes, domination, bombe) :
   le joueur et ses cinq bots forment l'équipe choisie, les six autres bots l'équipe d'en face. En bombe, Alpha attaque d'abord et Bravo défend d'abord.
   Au lancement, startMatch (09-game.js) remet le joueur dans l'équipe 0 et ne touche pas aux bots : au premier spawnEntity de la partie, teamPickApply
   met le joueur dans l'équipe choisie et fait suivre les bots (le camp d'origine de chacun est gardé dans baseTeam : une partie suivante repart de là).
   Le HUD, le tableau des scores et les tenues suivent déjà l'équipe du joueur (en ligne, on peut jouer Bravo). Enveloppe matchRows, soloStage, modeStart
   et spawnEntity, chacune dans un try.
   ========================================================================== */
if (Settings.soloTeam !== 1) Settings.soloTeam = 0;
const TEAMPICK = { pending: false };
/* Le joueur et les bots dans leurs équipes : le choix du Solo hors ligne, en match à mort le camp d'origine (personne n'est allié) */
function teamPickApply() {
  if (MATCH.online) return;
  const pick = MATCH.mode !== 'ffa' && Settings.soloTeam === 1 ? 1 : 0;
  PL.ent.team = pick;
  for (const e of entities) {
    if (e.isPlayer) continue;
    if (e.baseTeam === undefined) e.baseTeam = e.team;
    e.team = pick ? 1 - e.baseTeam : e.baseTeam;
  }
}
try { const f = modeStart; modeStart = function (mode) { TEAMPICK.pending = true; return f(mode); }; } catch (e) { console.warn('camp : modeStart', e); }
try { const f = spawnEntity; spawnEntity = function (e) { if (TEAMPICK.pending) { TEAMPICK.pending = false; teamPickApply(); } return f(e); }; } catch (e) { console.warn('camp : spawnEntity', e); }
/* La rangée du choix, avant la limite de la partie (seulement hors ligne et hors match à mort) */
try {
  const f = matchRows;
  matchRows = function (o) {
    const rows = f(o);
    if (!o.online && o.mode !== 'ffa') {
      const i = rows.findIndex((r) => r.key === 'limit');
      rows.splice(i < 0 ? rows.length : i, 0, { k: 'seg', full: true, key: 'team', label: _t('Équipe à jouer'), items: [[0, TEAM_NAMES[0]], [1, TEAM_NAMES[1]]],
        get: () => (Settings.soloTeam === 1 ? 1 : 0), set: (v) => { Settings.soloTeam = v === 1 ? 1 : 0; saveSettings(); }, disabled: !o.edit });
    }
    return rows;
  };
} catch (e) { console.warn('camp : matchRows', e); }
/* Le plateau du Solo : mon équipe à gauche (vous et vos bots), l'équipe d'en face à droite ; les noms des bots suivent leur camp d'origine, seuls les titres changent */
try {
  const f = soloStage;
  soloStage = function () {
    const s = f();
    if (Settings.mode !== 'ffa' && Settings.soloTeam === 1 && s.cols.length === 2) { s.cols[0].head = esc(TEAM_NAMES[1]); s.cols[1].head = esc(TEAM_NAMES[0]); }
    return s;
  };
} catch (e) { console.warn('camp : soloStage', e); }
