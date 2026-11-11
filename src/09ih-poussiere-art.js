/* ==========================================================================
   ILLUSTRATION DE POUSSIÈRE (menus et écran de chargement)
   Les menus et l'écran de chargement montrent MAP_ART[id] (09e-menus.js), rempli par build.py avec le fichier assets/maps/<id>.webp. Poussière n'en a pas
   encore (l'illustration d'une carte se fait avec tools/dev/illustrations.js, depuis le jeu) : en attendant, elle est dessinée ici, la première fois qu'on
   la demande (un canevas de 1280 × 720, en JPEG), et c'est la rue du milieu vue du sud jusqu'au portail et aux minarets. Dès qu'un vrai fichier
   assets/maps/poussiere.webp existe, build.py le met dans MAP_ART et ce dessin n'est plus utilisé. Chargé après 09e-menus.js, qui déclare MAP_ART.
   ========================================================================== */
/* Le dessin (1280 × 720) : la rue du milieu vue du sud, jusqu'au portail et aux minarets. Une perspective simple (œil à 1,65 m, axe Z) et des
   polygones pleins : façades ocre, fenêtres à volets, pavés, ombres longues, brume. Rien n'est tiré au hasard sans graine (mulberry32). */
function pqArtDraw(ctx, W, H) {
  let s = 20261108;
  const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const F = 880, X0 = W / 2, Y0 = H * 0.46, EYE = 1.65;
  const px = (x, z) => X0 + (F * x) / z, py = (y, z) => Y0 - (F * (y - EYE)) / z;
  const HAZE = [226, 205, 170];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rgb = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
  const fog = (c, z) => mix(c, HAZE, Math.min(0.78, Math.max(0, (z - 6) / 150)));
  const shade = (c, k, cool = 0) => [c[0] * k - cool, c[1] * k - cool * 0.4, c[2] * k + cool * 0.8];
  const poly = (pts, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fill(); };
  const lin = (x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [t, c] of stops) g.addColorStop(t, c); return g; };

  // ciel : bleu profond en haut, sable pâle à l'horizon ; soleil et voile
  ctx.fillStyle = lin(0, 0, 0, Y0 + 20, [[0, 'rgb(46,92,170)'], [0.45, 'rgb(104,152,208)'], [0.8, 'rgb(190,205,214)'], [1, 'rgb(236,220,188)']]); ctx.fillRect(0, 0, W, H);
  let g = ctx.createRadialGradient(W * 0.7, H * 0.2, 0, W * 0.7, H * 0.2, W * 0.5); g.addColorStop(0, 'rgba(255,246,214,0.95)'); g.addColorStop(0.18, 'rgba(255,238,190,0.5)'); g.addColorStop(1, 'rgba(255,230,170,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) { // nuages étirés
    const cx = rnd() * W, cy = H * (0.06 + rnd() * 0.24), w = 160 + rnd() * 320, h = 8 + rnd() * 14;
    poly([[cx - w, cy], [cx - w * 0.5, cy - h], [cx + w * 0.4, cy - h * 0.8], [cx + w, cy], [cx + w * 0.4, cy + h * 0.6], [cx - w * 0.5, cy + h * 0.7]], 'rgba(255,255,255,0.16)');
  }
  // dunes au loin : deux plans brumeux
  for (const [k, base, amp, col] of [[0, Y0 - 6, 18, [214, 190, 150]], [1, Y0 - 1, 10, [206, 176, 136]]]) {
    const pts = [[0, Y0 + 30]]; for (let x = 0; x <= W; x += 40) pts.push([x, base - amp * (0.5 + 0.5 * Math.sin(x * 0.006 + k * 2.1)) - amp * 0.4 * Math.sin(x * 0.017 + k)]); pts.push([W, Y0 + 30]);
    poly(pts, rgb(col, 0.9));
  }
  // quartiers lointains, dôme et minarets (z entre 120 et 170)
  for (let i = 0; i < 26; i++) {
    const z = 120 + rnd() * 50, x = (rnd() * 2 - 1) * 90, w = 6 + rnd() * 12, h = 6 + Math.floor(rnd() * 5) * 3, c = fog(mix([226, 200, 160], [214, 164, 124], rnd()), z);
    poly([[px(x - w / 2, z), py(0, z)], [px(x - w / 2, z), py(h, z)], [px(x + w / 2, z), py(h, z)], [px(x + w / 2, z), py(0, z)]], rgb(c));
  }
  const tower = (x, z, w, h, col) => { // minaret : fût, balcon, tête, pointe
    const c = fog(col, z), c2 = shade(c, 0.86), hw = w / 2;
    poly([[px(x - hw, z), py(0, z)], [px(x - hw, z), py(h, z)], [px(x + hw, z), py(h, z)], [px(x + hw, z), py(0, z)]], rgb(c));
    poly([[px(x + hw * 0.2, z), py(0, z)], [px(x + hw * 0.2, z), py(h, z)], [px(x + hw, z), py(h, z)], [px(x + hw, z), py(0, z)]], rgb(c2));
    poly([[px(x - hw * 1.5, z), py(h * 0.8, z)], [px(x - hw * 1.5, z), py(h * 0.83, z)], [px(x + hw * 1.5, z), py(h * 0.83, z)], [px(x + hw * 1.5, z), py(h * 0.8, z)]], rgb(shade(c, 0.78)));
    poly([[px(x - hw * 0.8, z), py(h, z)], [px(x - hw * 0.8, z), py(h * 1.06, z)], [px(x, z), py(h * 1.16, z)], [px(x + hw * 0.8, z), py(h * 1.06, z)], [px(x + hw * 0.8, z), py(h, z)]], rgb(c));
    poly([[px(x - hw * 0.12, z), py(h * 1.16, z)], [px(x, z), py(h * 1.3, z)], [px(x + hw * 0.12, z), py(h * 1.16, z)]], rgb(shade(c, 0.9)));
  };
  tower(-24, 150, 3.4, 40, [226, 206, 172]); tower(34, 168, 3, 36, [220, 196, 160]); tower(8, 140, 2.6, 28, [230, 212, 180]);
  { const z = 155, x = -52, c = fog([236, 224, 198], z); poly([[px(x - 9, z), py(0, z)], [px(x - 9, z), py(9, z)], [px(x + 9, z), py(9, z)], [px(x + 9, z), py(0, z)]], rgb(c)); // maison à dôme
    const dome = []; for (let a = 0; a <= 12; a++) { const t = (a / 12) * Math.PI; dome.push([px(x - Math.cos(t) * 6, z), py(9 + Math.sin(t) * 5, z)]); } poly(dome, rgb(fog([228, 214, 186], z))); }

  // sol : joints sombres, puis pavés rangée par rangée (du fond vers nous)
  poly([[0, Y0], [W, Y0], [W, H], [0, H]], rgb([168, 138, 102]));
  const shadowEdge = (z) => 1.8 + 0.7 * Math.sin(z * 0.11);
  for (let z = 150; z > 3; ) {
    const dz = 0.42 + z * 0.012, z0 = z - dz, off = ((Math.round(z * 3.1) % 2) * 0.5);
    for (let x = -8.2; x < 8.2; x += 0.56) {
      const xx = x + off * 0.56, lum = 0.86 + rnd() * 0.26, tw = (rnd() - 0.5) * 7, c0 = [202 * lum + tw, 170 * lum, 126 * lum - tw], inShade = xx < shadowEdge(z);
      let c = inShade ? shade(c0, 0.66, 3) : c0; c = fog(c, z);
      const gx = 0.026, gz = dz * 0.1;
      poly([[px(xx + gx, z - gz), py(0, z - gz)], [px(xx + 0.56 - gx, z - gz), py(0, z - gz)], [px(xx + 0.56 - gx, z0 + gz), py(0, z0 + gz)], [px(xx + gx, z0 + gz), py(0, z0 + gz)]], rgb(c));
    }
    z = z0;
  }
  // l'ombre portée des bâtiments de gauche : une bande sombre qui s'étire dans la rue
  { const pts = []; for (let z = 3.2; z <= 150; z *= 1.12) pts.push([px(shadowEdge(z) + 0.2, z), py(0, z)]); for (let z = 150; z >= 3.2; z /= 1.12) pts.push([px(-8.5, z), py(0, z)]); poly(pts, 'rgba(40,36,60,0.1)'); }

  // bâtiments de chaque côté : segments du fond vers nous ; façade latérale, face qui se découvre, fenêtres à volets, auvents, bandeau d'acrotère
  const WALLS = [[214, 176, 128], [228, 198, 152], [200, 152, 112], [234, 218, 192], [196, 134, 98], [222, 188, 150]];
  const segs = { L: [], R: [] };
  for (const side of ['L', 'R']) { let z = 118, prev = 7.6; while (z > 4) { const len = 7 + rnd() * 6, z0 = Math.max(4, z - len), xw = 7 + rnd() * 1.6, h = 7 + Math.floor(rnd() * 4) * 1.6, col = WALLS[Math.floor(rnd() * WALLS.length)]; segs[side].push({ z0, z1: z, xw, h, col, prev }); prev = xw; z = z0; } }
  const facade = (sg, side) => {
    const sgn = side === 'L' ? -1 : 1, lit = side === 'R', k = lit ? 1 : 0.58, cool = lit ? 0 : 10, c = fog(shade(sg.col, k, cool), sg.z1), x = sgn * sg.xw, h = sg.h;
    // la face tournée vers nous qui dépasse du segment plus proche
    if (sg.prev < sg.xw || true) {
      const xa = sgn * Math.min(sg.xw, sg.prev), xb = x;
      if (Math.abs(xa - xb) > 0.01) poly([[px(xa, sg.z0), py(0, sg.z0)], [px(xa, sg.z0), py(h, sg.z0)], [px(xb, sg.z0), py(h, sg.z0)], [px(xb, sg.z0), py(0, sg.z0)]], rgb(fog(shade(sg.col, lit ? 0.84 : 0.5, cool), sg.z0)));
    }
    poly([[px(x, sg.z1), py(0, sg.z1)], [px(x, sg.z1), py(h, sg.z1)], [px(x, sg.z0), py(h, sg.z0)], [px(x, sg.z0), py(0, sg.z0)]], rgb(c)); // la façade
    poly([[px(x, sg.z1), py(h - 0.5, sg.z1)], [px(x, sg.z1), py(h, sg.z1)], [px(x, sg.z0), py(h, sg.z0)], [px(x, sg.z0), py(h - 0.5, sg.z0)]], rgb(shade(c, 0.86))); // acrotère
    poly([[px(x, sg.z1), py(0, sg.z1)], [px(x, sg.z1), py(0.45, sg.z1)], [px(x, sg.z0), py(0.45, sg.z0)], [px(x, sg.z0), py(0, sg.z0)]], rgb(shade(c, 0.78))); // soubassement
    const bay = 3.7;
    for (let zc = sg.z0 + 1.6; zc < sg.z1 - 1.0; zc += bay) {
      const wz0 = zc - 0.7, wz1 = zc + 0.7, shut = rnd() < 0.5 ? [124, 78, 52] : [92, 106, 120];
      for (const [y0, y1] of [[3.1, 4.9], [6.2, 8.0]]) {
        if (y1 > h - 0.7) continue;
        const q = (a, b, z0, z1) => [[px(x, z0), py(a, z0)], [px(x, z0), py(b, z0)], [px(x, z1), py(b, z1)], [px(x, z1), py(a, z1)]];
        poly(q(y0 - 0.12, y1 + 0.12, wz0 - 0.12, wz1 + 0.12), rgb(fog(shade([236, 224, 204], k), zc)));          // encadrement
        poly(q(y0, y1, wz0, wz1), rgb(fog(rnd() < 0.3 ? shade([90, 100, 110], k) : [38, 34, 34], zc)));          // vitre ou ouverture
        if (rnd() < 0.8) poly(q(y0, y1, wz0, wz0 + 0.5), rgb(fog(shade(shut, k), zc)));                            // volet
        if (rnd() < 0.8) poly(q(y0, y1, wz1 - 0.5, wz1), rgb(fog(shade(shut, k), zc)));
      }
      if (rnd() < 0.55) { // rez-de-chaussée : porte ou boutique
        const a = zc - 0.8, b = zc + 0.8, dc = rnd() < 0.5 ? [118, 82, 60] : [64, 92, 112];
        poly([[px(x, a), py(0.45, a)], [px(x, a), py(2.5, a)], [px(x, b), py(2.5, b)], [px(x, b), py(0.45, b)]], rgb(fog(shade(dc, k), zc)));
        if (rnd() < 0.45) { const aw = fog(shade(rnd() < 0.5 ? [196, 60, 50] : [60, 120, 96], k), zc); poly([[px(x, a - 0.2), py(2.9, a - 0.2)], [px(x, b + 0.2), py(2.9, b + 0.2)], [px(x - sgn * 1.1, b + 0.2), py(2.3, b + 0.2)], [px(x - sgn * 1.1, a - 0.2), py(2.3, a - 0.2)]], rgb(aw)); } // auvent
      }
    }
  };
  // fond de rue : le mur du portail (les Portes du milieu), à z = 64
  const GZ = 64;
  for (let i = 0; i < Math.max(segs.L.length, segs.R.length); i++) { // du fond vers nous, côté gauche et droit entrelacés
    for (const side of ['L', 'R']) { const sg = segs[side][i]; if (!sg) continue; if (sg.z0 < GZ && sg.z1 > GZ && !sg.gate) { sg.gate = 1; } }
  }
  const drawGate = () => {
    const z = GZ, c = fog([220, 186, 140], z), hw = 7.4;
    poly([[px(-hw, z), py(0, z)], [px(-hw, z), py(7.5, z)], [px(hw, z), py(7.5, z)], [px(hw, z), py(0, z)]], rgb(c));
    poly([[px(-hw, z), py(7.0, z)], [px(-hw, z), py(7.5, z)], [px(hw, z), py(7.5, z)], [px(hw, z), py(7.0, z)]], rgb(shade(c, 0.82)));
    const arch = []; for (let a = 0; a <= 14; a++) { const t = (a / 14) * Math.PI; arch.push([px(2.8 + Math.cos(t) * 1.6, z), py(2.2 + Math.sin(t) * 1.7, z)]); } arch.unshift([px(4.4, z), py(0, z)]); arch.push([px(1.2, z), py(0, z)]);
    poly(arch, 'rgb(34,28,26)');
    const arch2 = []; for (let a = 0; a <= 14; a++) { const t = (a / 14) * Math.PI; arch2.push([px(2.8 + Math.cos(t) * 1.9, z), py(2.2 + Math.sin(t) * 2.0, z)]); } poly(arch2, rgb(shade(c, 0.7)));
    poly(arch, 'rgb(34,28,26)');
    for (const [x0, x1] of [[-6.5, -4.6], [-2.6, -0.8], [5.0, 6.6]]) poly([[px(x0, z), py(3.4, z)], [px(x0, z), py(5.6, z)], [px(x1, z), py(5.6, z)], [px(x1, z), py(3.4, z)]], rgb(fog([70, 62, 60], z)));
  };
  // ordre de peinture : tout ce qui est plus loin que le portail, le portail, puis ce qui est plus près
  const all = [...segs.L.map((sg) => ({ sg, side: 'L' })), ...segs.R.map((sg) => ({ sg, side: 'R' }))].sort((a, b) => b.sg.z1 - a.sg.z1);
  let gated = false;
  for (const it of all) { if (!gated && it.sg.z1 <= GZ) { drawGate(); gated = true; } facade(it.sg, it.side); }
  if (!gated) drawGate();

  // accessoires : caisses, muret et palmier au milieu de la rue
  const bx = (cx, cz, w, h, d, c) => {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, lit = cx > 0.5 ? 1 : 0.7;
    poly([[px(x0, z0), py(0, z0)], [px(x0, z0), py(h, z0)], [px(x1, z0), py(h, z0)], [px(x1, z0), py(0, z0)]], rgb(fog(shade(c, 0.9 * lit), cz)));
    poly([[px(x0, z0), py(h, z0)], [px(x0, z1), py(h, z1)], [px(x1, z1), py(h, z1)], [px(x1, z0), py(h, z0)]], rgb(fog(shade(c, 1.12 * lit), cz)));
    const sx = cx > 0 ? x0 : x1; poly([[px(sx, z0), py(0, z0)], [px(sx, z0), py(h, z0)], [px(sx, z1), py(h, z1)], [px(sx, z1), py(0, z1)]], rgb(fog(shade(c, 0.66 * lit), cz)));
  };
  bx(-3.4, 52, 6, 1.3, 0.6, [214, 188, 150]); bx(3.6, 36, 3.4, 1.3, 0.6, [214, 188, 150]);                  // murets bas
  bx(4.4, 20, 1.2, 1.2, 1.2, [170, 120, 70]); bx(5.4, 20.4, 1.0, 1.0, 1.0, [160, 112, 66]); bx(4.8, 20.1, 1.0, 1.0, 1.0, [176, 126, 76]);
  bx(-4.8, 14, 1.2, 1.2, 1.2, [158, 112, 66]);
  { const z = 46, x = 9.1, c = fog([112, 82, 56], z); poly([[px(x - 0.2, z), py(0, z)], [px(x - 0.12, z), py(8, z)], [px(x + 0.12, z), py(8, z)], [px(x + 0.2, z), py(0, z)]], rgb(c)); // palmier
    for (let a = 0; a < 9; a++) { const t = (a / 9) * Math.PI * 2, L = 3.4 + (a % 2) * 0.6, ex = x + Math.cos(t) * L, ey = 8.3 - Math.abs(Math.sin(t)) * 1.6 - 0.4; poly([[px(x, z), py(8.1, z)], [px(ex, z - Math.sin(t) * 1.2), py(ey, z)], [px(x + Math.cos(t) * L * 0.55, z), py(8.7, z)]], rgb(fog([66, 104, 62], z))); } }

  // brume : plus dense près de l'horizon ; lumière chaude ; vignette
  ctx.fillStyle = lin(0, Y0 - 120, 0, Y0 + 160, [[0, 'rgba(236,214,176,0)'], [0.45, 'rgba(236,214,176,0.34)'], [1, 'rgba(236,214,176,0)']]); ctx.fillRect(0, Y0 - 120, W, 280);
  ctx.fillStyle = 'rgba(255,196,120,0.07)'; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W / 2, H * 0.52, H * 0.35, W / 2, H * 0.52, W * 0.72); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

try {
  if (typeof MAP_ART === 'object' && !MAP_ART.poussiere) {
    let url = null;
    Object.defineProperty(MAP_ART, 'poussiere', {
      configurable: true, enumerable: true,
      get() {
        if (url === null) {
          try { const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; pqArtDraw(cv.getContext('2d'), 1280, 720); url = cv.toDataURL('image/jpeg', 0.86); } catch (e) { url = ''; console.warn('Poussière : illustration', e); }
        }
        return url || undefined;
      },
    });
  }
} catch (e) { console.warn('Poussière : illustration non déclarée', e); }
