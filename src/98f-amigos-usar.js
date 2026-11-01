/* ==========================================================================
   AMIGOS x PÚBLICAS + TEXTOS « USAR »
   0) Ecrã Jogar : « Entre amis » e « Parties publiques » levavam ao mesmo sítio (ecrã Multijoueur) : passam a ser um só cartão,
      « En ligne » / « Online ». Lá dentro : Jogar com amigos (sala privada, só com código), Criar partida pública, Entrar com código.
   1) Multijogador (sem servidor de jogo) : « Jogar com amigos » cria uma sala PRIVADA (não aparece na lista, só entra quem tem o código) ;
      « Criar partida pública » cria uma sala pública (aparece na lista de salas públicas, qualquer um entra com um toque).
      Dentro da sala deixa de haver o botão Privado/Público : o tipo vem da forma como a sala foi criada.
   2) Armas, camuflagens, classes e tenues já estão todas liberadas (98-livre.js) : os textos que diziam « desbloquear » passam a dizer « usar ».
   Carregado depois de todos os outros módulos (ordem alfabética de build.py).
   Para voltar ao jogo anterior : apagar este ficheiro e deixar o build correr de novo.
   ========================================================================== */
{
  // ----- 2) textos : [francês, inglês] -----
  const TXT = {
    'Tout est débloqué pour cette arme': ['Tout est prêt à utiliser pour cette arme', 'Everything is ready to use for this weapon'],
    "Les camouflages se débloquent avec le niveau de l'arme.": ['Tous les camouflages sont prêts à utiliser.', 'All camos are ready to use.'],
    ', tous débloqués.': [', tous prêts à utiliser.', ', all ready to use.'],
    'Débloqué : {0}': ['À utiliser : {0}', 'Ready to use: {0}'],
    'Relevez leurs défis pour les débloquer': ["Choisissez-en une pour l'utiliser", 'Pick one to use it'],
    'Seul, entre amis ou en ligne': ['Solo ou en ligne', 'Solo or online'],
    'Jouer entre amis': ['Jouer entre amis', 'Play with friends'],
    "Salon privé : on n'entre qu'avec le code": ["Salon privé : on n'entre qu'avec le code", 'Private room: you need the code to join'],
    'Créer une partie publique': ['Créer une partie publique', 'Create a public match'],
    'Visible dans la liste, tout le monde peut la rejoindre': ['Visible dans la liste, tout le monde peut la rejoindre', 'Listed publicly, anyone can join'],
    'Rejoindre avec un code': ['Rejoindre avec un code', 'Join with a code'],
    'Le code donné par un ami': ['Le code donné par un ami', 'The code a friend gave you'],
  };
  const tBase = _t;
  _t = (fr, ...a) => {
    const r = Object.prototype.hasOwnProperty.call(TXT, fr) ? TXT[fr] : null;
    if (!r) return tBase(fr, ...a);
    const s = LANG === 'en' ? r[1] : r[0];
    return a.length ? s.replace(/\{(\d+)\}/g, (m, i) => (+i < a.length ? String(a[+i]) : m)) : s;
  };
  // texto fixo do menu principal e do ecrã Jogar (shell.html), já traduzido no arranque : refeito aqui
  for (const el of document.querySelectorAll('.mbtn[data-go="skins"] span')) {
    el.textContent = LANG === 'en' ? 'Ten outfits, all ready to use' : 'Dix tenues, toutes prêtes à utiliser';
  }
  const mmPlay = document.getElementById('mmPlay'); if (mmPlay) mmPlay.textContent = _t('Seul, entre amis ou en ligne');
  const playSub = document.querySelector('#scr-play .shead p');
  if (playSub) playSub.textContent = LANG === 'en' ? 'Solo against bots, or online' : 'Seul contre des bots ou en ligne';

  // ----- 0) ecrã Jogar : Solo + um só cartão « En ligne / Online » -----
  playRender = () => {
    const el = $('playGrid'); if (!el) return;
    const en = LANG === 'en';
    const cards = [
      ['solo', _t('Solo'), _t("Vous contre des bots, sans connexion. Pour s'entraîner.")],
      ['public', en ? 'Online' : 'En ligne', en ? 'Play with friends in a private room (code needed), or join public matches.' : 'Jouez avec vos amis dans un salon privé (avec code) ou rejoignez des parties publiques.'],
    ];
    el.innerHTML = cards.map(([k, b, s]) => `<button class="play-card" type="button" data-play="${k}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PLAY_ICON[k]}"/></svg><b>${b}</b><span>${s}</span></button>`).join('');
  };

  // ----- 1) amigos (privado, com código) x partidas públicas -----
  const homeBase = NET_PAGES.home;
  NET_PAGES.home = (o) => {
    const pg = homeBase(o);
    if (!pg || !pg.rows || SRV.list) return pg;
    const i = pg.rows.findIndex((r) => r && r.key === 'create');
    if (i < 0) return pg;
    const pub = pg.rows[i];
    pub.label = _t('Créer une partie publique');
    pub.sub = _t('Visible dans la liste, tout le monde peut la rejoindre');
    pub.run = () => netHost({ pub: 1 });
    pg.rows.splice(i, 0, { k: 'btn', key: 'friends', label: _t('Jouer entre amis'), sub: _t("Salon privé : on n'entre qu'avec le code"), run: () => netHost({ pub: 0 }), disabled: pub.disabled });
    const j = pg.rows.findIndex((r) => r && r.key === 'join');
    if (j >= 0) { pg.rows[j].label = _t('Rejoindre avec un code'); pg.rows[j].sub = _t('Le code donné par un ami'); }
    return pg;
  };
  // sem o botão Privado/Público dentro da sala (98d-publico.js ligava-o) : o tipo é o da criação
  const cfgBase = netMatchCfg;
  netMatchCfg = () => { const c = cfgBase(); if (!netViaServer()) c.pubOk = false; return c; };
}
