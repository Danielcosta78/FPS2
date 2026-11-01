/* ==========================================================================
   NETTOYAGE : cache de l'accueil les liens « Confidentialité et conditions » et « Code source » et la ligne de crédit,
   et retire la phrase « Relais de secours : ... » du diagnostic de connexion de l'hôte.
   Les éléments sont cachés, pas supprimés : le jeu les retrouve par leur identifiant au démarrage (addEventListener) et plante s'ils manquent.
   Chargé après tous les autres modules (ordre alphabétique de build.py). Les textes sont cherchés en français et en anglais.
   Pour revenir au jeu d'origine : supprimer ce fichier et relancer python3 build.py.
   ========================================================================== */
{
  const verdictBase = netdVerdict;
  netdVerdict = () => verdictBase().replace(/\s*(?:Backup relay|Relais de secours)\s*:[^.]*\.?/i, '').trim();
}
/* Un élément est caché quand tout son texte est l'un de ces libellés (le pied de page, qui en contient plusieurs, reste) */
const LIMPEZA = [
  { tags: 'a, button, span, small, li, p', re: /^(?:privacy|confidentialit)[^\n]{0,30}$/i },
  { tags: 'a, button, span, small, li, p', re: /^(?:source code|code source)$/i },
  { tags: 'a, span, small, li, p, div', re: /^vibe[^\n]{0,60}claude code[^\n]{0,40}bendbs\.?$/i },
];
function limpezaMenu() {
  for (const L of LIMPEZA) {
    for (const el of document.body.querySelectorAll(L.tags)) {
      if (!el.dataset.limpo && L.re.test((el.textContent || '').replace(/\s+/g, ' ').trim())) { el.dataset.limpo = '1'; el.style.setProperty('display', 'none', 'important'); }
    }
  }
}
limpezaMenu();
{ let n = 0; const t = setInterval(() => { limpezaMenu(); if (++n >= 10) clearInterval(t); }, 1000); } // le pied de page peut être construit un peu plus tard
