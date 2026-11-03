/* ==========================================================================
   SALONS PUBLICS SANS SERVEUR : la liste des salons de l'écran Multijoueur
   Les parties restent en pair à pair (PeerJS, 09c-net.js). Seule la liste passe par un canal public du relais itty.ws, avec la
   bibliothèque multiplayer.js (98c-multiplayer.js). Un hôte dont le salon est public s'y annonce (code, carte, mode, joueurs, phase)
   toutes les 4 s et à chaque changement ; l'écran Multijoueur y écoute et montre une rangée par salon, qu'un clic rejoint.
   Une annonce qui n'est pas renouvelée pendant 14 s disparaît de la liste. Public ou privé : réglage du salon (public par défaut).
   Avec un serveur de jeu (netViaServer), rien ne change : sa liste fait foi.
   Pour revenir au jeu d'origine : supprimer 98c et 98d, et retirer wss://itty.ws de la CSP de build.py.
   ========================================================================== */

const PUBLICO = { mp: null, on: false, since: 0, salas: new Map(), anun: false, anunT: 0, dirty: false, sig: '' };
const PUBLICO_TTL = 14000, PUBLICO_MAX = 60;
const publicoT = (fr, en) => (LANG === 'fr' ? fr : en); // textes de la liste : français et anglais

function publicoMp() {
  if (PUBLICO.mp) return PUBLICO.mp;
  if (typeof Multiplayer !== 'function') return null;
  const mp = new Multiplayer({ game: 'riposte', version: NET_PROTO }); // une autre version du jeu ne voit pas ces salons
  mp.on('sala', (m) => publicoIn(m));
  mp.on('fecha', (m) => { if (PUBLICO.salas.delete(m.uid)) publicoChanged(); });
  mp.on('leave', (p) => { if (PUBLICO.salas.delete(p.uid)) publicoChanged(); });
  mp.on('join', (p) => { if (PUBLICO.anun) publicoAnunciar(p.uid); }); // le nouveau venu reçoit tout de suite l'annonce, sans attendre la suivante
  mp.on('status', () => publicoChanged());
  PUBLICO.mp = mp;
  return mp;
}

/* Annonce reçue d'un autre joueur : forme vérifiée (code, version, mode, carte), une seule par joueur, 60 salons au plus */
function publicoIn(m) {
  const d = m && m.data; if (!d || typeof d !== 'object' || !m.uid) return;
  if (!/^[A-Z0-9]{5}$/.test(String(d.c)) || d.v !== NET_PROTO || !hasKey(MODES, d.o) || !MAPS.some((x) => x.id === d.m && x.ok)) return;
  if (!PUBLICO.salas.has(m.uid) && PUBLICO.salas.size >= PUBLICO_MAX) return;
  PUBLICO.salas.set(m.uid, { c: String(d.c), n: netClean(d.n), m: d.m, o: d.o, j: clamp(d.j | 0, 1, NET_MAX), x: NET_MAX, p: d.p === 'playing' || d.p === 'loading' ? d.p : 'lobby', at: performance.now() });
  publicoChanged();
}

/* Mon salon : annoncé à tous (to absent) ou à un seul joueur */
function publicoAnunciar(to) {
  const mp = PUBLICO.mp; if (!mp || !mp.status.connected) return;
  mp.send('sala', { c: NET.code, n: NET.nick, m: NET.cfg.map, o: NET.cfg.mode, j: NET.players.size, p: NET.phase, v: NET_PROTO }, to, true);
}
function publicoFechar() { const mp = PUBLICO.mp; if (mp && mp.status.connected) mp.send('fecha', {}, undefined, true); }
/* Botão « Actualiser » : esvazia a lista e volta a ligar o canal ; o publicoTick reabre-o em menos de 1 s e os anfitriões respondem logo (evento 'join') */
function publicoRefresh() {
  try {
    const mp = PUBLICO.mp; if (!mp) return;
    PUBLICO.salas.clear(); PUBLICO.since = performance.now();
    mp.disconnect(); PUBLICO.on = false;
    publicoChanged();
  } catch (e) { /* ignorado */ }
}

const publicoHost = () => NET.role === 'host' && NET.joined && !!NET.cfg.pub && !NET.srv && !SRV.on && !netViaServer(); // salon public d'un hôte
const publicoBrowse = () => UI.screen === 'multi' && !netInLobby() && !netViaServer(); // accueil de l'écran Multijoueur

/* Une fois par seconde : ouvre le canal quand il sert (hôte public, ou liste affichée), le ferme sinon ; annonce, oublie les annonces périmées */
function publicoTick() {
  try {
    const host = publicoHost(), want = host || publicoBrowse(), now = performance.now();
    if (want && !PUBLICO.on) {
      const mp = publicoMp(); if (!mp) return;
      PUBLICO.on = true; PUBLICO.since = now;
      mp.join('lobby', NET.nick || 'Soldat');
    } else if (!want && PUBLICO.on) {
      if (PUBLICO.anun) publicoFechar();
      PUBLICO.on = false; PUBLICO.anun = false; PUBLICO.salas.clear(); PUBLICO.mp.disconnect(); publicoChanged();
      return;
    }
    if (!PUBLICO.on) return;
    let gone = false;
    for (const [k, s] of PUBLICO.salas) if (now - s.at > PUBLICO_TTL) { PUBLICO.salas.delete(k); gone = true; }
    const up = PUBLICO.mp.status.connected;
    if (host && up) {
      if (!PUBLICO.anun || PUBLICO.dirty || now - PUBLICO.anunT > 4000) { publicoAnunciar(); PUBLICO.anun = true; PUBLICO.anunT = now; PUBLICO.dirty = false; }
    } else if (!host && PUBLICO.anun) { if (up) publicoFechar(); PUBLICO.anun = false; }
    if (gone) publicoChanged();
  } catch (e) { /* la liste est un confort : une erreur ne gêne ni le salon ni la partie */ }
}

/* Affichage : l'accueil se redessine seulement quand la liste, le nombre de joueurs ou l'état de la connexion changent */
function publicoChanged() {
  const mp = PUBLICO.mp, up = !!mp && mp.status.connected;
  const sig = [...PUBLICO.salas.values()].map((s) => s.c + s.j + s.p + s.m + s.o + s.n).sort().join('|') + '/' + (up ? mp.status.online : -1) + (PUBLICO.on ? 1 : 0);
  if (sig === PUBLICO.sig) return;
  PUBLICO.sig = sig; netPubRender();
}

/* Branchement sur le jeu : la scène de l'accueil, l'annonce à chaque changement du salon, le choix public/privé, public par défaut */
{
  const stageBase = netPubStage, syncBase = netPubSync, hostBase = netHost, cfgBase = netMatchCfg, initBase = netInit;
  netPubStage = () => {
    if (netViaServer()) return stageBase();
    const mp = PUBLICO.mp, up = !!mp && mp.status.connected, rows = [{ k: 'pick', key: 'refresh', label: publicoT('Actualiser', 'Refresh'), sub: publicoT('Chercher les salons à nouveau', 'Search for rooms again'), value: '', art: '', pick: () => { sfxUi('click'); publicoRefresh(); } }];
    for (const s of [...PUBLICO.salas.values()].sort((a, b) => b.j - a.j)) {
      const m = mapById(s.m);
      rows.push({ k: 'pick', key: s.c, label: m.name, sub: [MODES[s.o].btn, s.p === 'lobby' ? publicoT('Salon', 'Lobby') : publicoT('En partie', 'In game'), publicoT('Hôte : ', 'Host: ') + s.n].join(' \u00b7 '),
        value: s.j + '/' + s.x, art: (m.ok && MAP_ART[m.id]) || '', disabled: s.j >= s.x || NET.role !== 'off', pick: () => { sfxUi('click'); netJoinLobby(s.c); } });
    }
    if (!rows.length) {
      const late = PUBLICO.on && performance.now() - PUBLICO.since > 8000;
      rows.push({ k: 'note', text: up ? publicoT('Aucun salon public pour le moment. Créez le vôtre, il apparaîtra ici.', 'No public room yet. Create yours and it will show up here.')
        : late ? publicoT('Liste des salons indisponible pour le moment.', 'Room list unavailable right now.') : publicoT('Connexion à la liste...', 'Connecting to the list...') });
    }
    const online = up ? `<span>${esc(publicoT(mp.status.online + ' joueur(s) en ligne', mp.status.online + ' online'))}</span>` : '';
    return { head: `<b>${esc(publicoT('Salons publics', 'Public rooms'))}</b>${online}`, cols: [{ rows }] };
  };
  netPubSync = () => { syncBase(); PUBLICO.dirty = true; };
  netHost = (o) => {
    const was = NET.role; hostBase(o);
    if (was === 'off' && NET.role === 'host' && !NET.srv && !netViaServer()) NET.cfg.pub = o && o.pub ? 1 : 0; // sans serveur de jeu, le salon est public si l'hôte le veut
  };
  netMatchCfg = () => { const c = cfgBase(); c.pubOk = c.pubOk || !netViaServer(); return c; }; // la rangée « public ou privé » des paramètres de partie
  netInit = () => { initBase(); try { if (localStorage.getItem('cod_salon_pub') === null) NETP.vis = 1; } catch (e) { /* stockage indisponible */ } };
}
setInterval(publicoTick, 1000);
addEventListener('pagehide', () => { try { if (PUBLICO.mp) PUBLICO.mp.disconnect(); } catch (e) { /* déjà fermé */ } });
