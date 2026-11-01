/* ==========================================================================
   PROFIL LOCAL : sans compte, le profil vit dans le navigateur (localStorage, clé rf_perfil)
   Chargé après tous les autres modules (ordre alphabétique de build.py). Quand les comptes sont indisponibles (ACCT.state 'off'),
   il remplace le message « comptes indisponibles » de l'écran Profil et la puce du menu principal par un profil gardé sur
   l'appareil : nom d'affichage modifiable, niveau et XP (ARS.px), armes favorites (ARS.k), statistiques et dernières parties,
   comptées à la fin de chaque partie (arsLocalXp). La progression des armes et les classes restent dans cod_arsenal (06r-arsenal.js).
   Pour revenir au jeu d'origine : supprimer ce fichier et relancer python3 build.py.
   ========================================================================== */
const PERFIL_KEY = 'rf_perfil';
const PERFIL = { name: '', st: { matches: 0, wins: 0, losses: 0, draws: 0, kills: 0, deaths: 0, assists: 0, headshots: 0, shots: 0, hits: 0, seconds: 0, bestStreak: 0 }, recent: [] };
const perfilT = (fr, en) => (LANG === 'fr' ? fr : en); // texte du profil local : français et anglais
const perfilName = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
function perfilLoad() {
  let s = null; try { s = JSON.parse(localStorage.getItem(PERFIL_KEY) || 'null'); } catch (e) { /* ignoré */ }
  if (!s || typeof s !== 'object') return;
  PERFIL.name = perfilName(s.name);
  if (s.st && typeof s.st === 'object') for (const k in PERFIL.st) { const v = +s.st[k]; if (Number.isFinite(v) && v > 0) PERFIL.st[k] = Math.min(1e9, Math.floor(v)); }
  if (Array.isArray(s.recent)) PERFIL.recent = s.recent.filter((m) => m && typeof m === 'object').slice(0, 10).map((m) => ({ map: String(m.map), mode: String(m.mode), result: String(m.result), online: !!m.online, kills: Math.max(0, m.kills | 0), deaths: Math.max(0, m.deaths | 0), xp: Math.max(0, m.xp | 0), played_at: String(m.played_at) }));
}
function perfilSave() { try { localStorage.setItem(PERFIL_KEY, JSON.stringify(PERFIL)); } catch (e) { /* stockage indisponible : le profil reste valable pour la session */ } }
perfilLoad();

/* Une partie terminée sans compte : statistiques et historique (appelé juste après arsLocalXp, qui n'a pas compté les parties de moins de 30 s) */
function perfilRecord(result) {
  const g = ARS.gain; if (!g || ACCT.user) return;
  const me = PL.ent, S = PERFIL.st, k = me.kills | 0, shots = PL.shots | 0, dur = Math.max(0, Math.floor(MATCH.time - ARS.t0));
  S.matches++; if (result === 'win') S.wins++; else if (result === 'draw') S.draws++; else S.losses++;
  S.kills += k; S.deaths += me.deaths | 0; S.assists += me.assists | 0;
  S.headshots += Math.min(PL.hsKills || 0, k); S.shots += shots; S.hits += Math.min(PL.hits | 0, shots); S.seconds += dur;
  S.bestStreak = Math.max(S.bestStreak, Math.min(PL.bestStreak || 0, k));
  PERFIL.recent.unshift({ map: CURMAP.id, mode: MATCH.mode || 'tdm', result, online: !!MATCH.online, kills: k, deaths: me.deaths | 0, xp: g.xp, played_at: new Date().toISOString() });
  PERFIL.recent.length = Math.min(PERFIL.recent.length, 10);
  perfilSave();
}

/* Le joueur local, au format que lit acctAvatar (09j-compte.js) */
function perfilUser() { return { username: PERFIL.name || 'player', displayName: PERFIL.name || perfilT('Joueur', 'Player'), avatar: 0 }; }
/* Nom d'affichage en ligne : celui du profil */
function perfilNet() { const nm = $('netName'); if (nm && !ACCT.user && PERFIL.name) { nm.value = PERFIL.name; nm.dispatchEvent(new Event('change')); } }

/* Puce du menu principal : avatar, nom et niveau locaux */
function perfilChip() {
  const chip = $('acctChip'); if (!chip || ACCT.user) return;
  const lv = levelOfXp(ARS.px), u = perfilUser();
  chip.classList.remove('out');
  $('acctAv').innerHTML = acctAvatar(u, lv);
  $('acctName').textContent = u.displayName;
  $('acctSub').textContent = perfilT('Niveau ' + lv + ' \u00b7 voir mon profil', 'Level ' + lv + ' \u00b7 view my profile');
  chip.setAttribute('aria-label', perfilT('Profil de ' + u.displayName + ', niveau ' + lv, 'Profile of ' + u.displayName + ', level ' + lv));
}

/* Écran Profil */
function perfilRender() {
  const body = $('acBody'), sub = $('acSub'); if (!body) return;
  const scr = $('scr-profile'); if (scr) scr.classList.remove('ac-coding');
  sub.textContent = perfilT('Profil sur cet appareil', 'Profile on this device');
  const u = perfilUser(), lvl = levelOfXp(ARS.px), a = pxpForLevel(lvl), b = lvl < 100 ? pxpForLevel(lvl + 1) : 0;
  const into = Math.max(0, Math.floor(ARS.px) - a), need = b ? b - a : 0;
  const top = Object.keys(ARS.k).filter((id) => WEAPONS[id] && ARS.k[id] > 0).sort((x, y) => ARS.k[y] - ARS.k[x]).slice(0, 3);
  const weapons = top.length
    ? `<dl class="ac-more">${top.map((id) => `<div><dt>${esc(WEAPONS[id].name)}</dt><dd>${fmtNum(ARS.k[id])} ${perfilT('éliminations', 'kills')} \u00b7 ${perfilT('niveau', 'level')} ${wLevel(id)}</dd></div>`).join('')}</dl>`
    : `<p class="hint">${perfilT("Aucune élimination enregistrée pour l'instant.", 'No kills recorded yet.')}</p>`;
  const games = acctGamesHtml(PERFIL.recent, true) || `<p class="hint">${perfilT("Jouez une partie de 30 secondes ou plus pour la voir ici.", 'Play a match of 30 seconds or more to see it here.')}</p>`;
  body.innerHTML = `<div class="ac-cols">
    <div class="ac-main">
      <div class="card ac-top">
        <div class="ac-avbtn"><span class="acct-av" id="perfilAv">${acctAvatar(u, lvl)}</span></div>
        <div class="ac-id"><h3 id="perfilTitle">${esc(u.displayName)}</h3><p>${perfilT('Niveau', 'Level')} ${lvl}</p>
          <div class="ac-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${need}" aria-valuenow="${into}"><i style="transform:scaleX(${need ? (into / need).toFixed(3) : 1})"></i></div>
          <div class="ac-xp">${need ? `${fmtNum(into)} / ${fmtNum(need)} XP ${perfilT('avant le niveau', 'to level')} ${lvl + 1}` : perfilT('Niveau maximal', 'Max level')} \u00b7 ${fmtNum(Math.floor(ARS.px))} XP ${perfilT('en tout', 'total')}</div></div>
      </div>
      ${acctStatsHtml(PERFIL.st, true)}
      <div class="card"><h3 class="lbl">${perfilT('Armes favorites', 'Favorite weapons')}</h3>${weapons}</div>
      <div class="card ac-games"><h3 class="lbl">${perfilT('Dernières parties', 'Recent games')}</h3>${games}</div>
    </div>
    <div class="card ac-side"><h3 class="lbl">${perfilT('Profil', 'Profile')}</h3>
      <form id="perfilName" class="ac-field"><label for="perfilNameIn">${perfilT("Nom d'affichage (16 caractères au plus)", 'Display name (16 characters max)')}</label>
        <div class="row"><input id="perfilNameIn" name="n" maxlength="16" value="${esc(PERFIL.name)}" autocomplete="off" spellcheck="false"><button class="btn" type="submit">${perfilT('Enregistrer', 'Save')}</button></div>
        <p class="ac-err ok" id="perfilMsg" role="status"></p></form>
      <p class="hint">${perfilT("Pas besoin de compte : le profil, la progression des armes, les classes et les réglages sont gardés dans ce navigateur. Vider les données du site les efface.", 'No account needed: your profile, weapon progress, classes and settings are kept in this browser. Clearing site data erases them.')}</p>
    </div></div>`;
  $('perfilName').addEventListener('submit', (e) => {
    e.preventDefault();
    PERFIL.name = perfilName($('perfilNameIn').value); perfilSave();
    const nu = perfilUser();
    $('perfilTitle').textContent = nu.displayName; $('perfilAv').innerHTML = acctAvatar(nu, lvl); $('perfilNameIn').value = PERFIL.name;
    perfilChip(); perfilNet();
    $('perfilMsg').textContent = perfilT('Enregistré sur cet appareil.', 'Saved on this device.');
    sfxUi('click');
  });
}

/* Branchement : sans compte (ACCT.state 'off'), l'écran Profil et la puce montrent le profil local ; avec un serveur de comptes, rien ne change */
{
  const acctRenderBase = acctRender, acctChipBase = acctChip, arsLocalXpBase = arsLocalXp;
  acctRender = () => { if (ACCT.state === 'off') perfilRender(); else acctRenderBase(); };
  acctChip = () => { acctChipBase(); if (ACCT.state === 'off') perfilChip(); };
  arsLocalXp = (result) => { arsLocalXpBase(result); try { perfilRecord(result); } catch (e) { /* ignoré */ } };
}
