/* ==========================================================================
   MODE LIBRE : tout est disponible dès le départ, sans compte et sans XP
   Chargé après tous les autres modules (build.py joint src/*.js dans l'ordre alphabétique) : il remplace les contrôles de
   déblocage de 06r-arsenal.js (armes, accessoires, camouflages, classes personnalisées) et de 06s-defis.js (tenues de défi).
   La progression (XP des armes, niveau, défis) continue d'être comptée, mais elle ne ferme plus rien.
   Pour revenir au jeu d'origine : supprimer ce fichier et relancer python3 build.py.
   ========================================================================== */
weaponLock = () => ''; // armes : jamais verrouillées
attLock = () => ''; // accessoires : tous disponibles
camoLock = () => ''; // camouflages : tous disponibles
arsNextUnlock = () => null; // l'atelier affiche « Tout est débloqué pour cette arme »
CUSTOM_UNLOCK.fill(1); // les cinq emplacements de classe personnalisée, dès le niveau 1 (le niveau du joueur vaut 1 au moins)
{
  // tenues de défi ouvertes ; la tenue unique (owner) reste celle de son compte
  const skinUnlockedBase = skinUnlocked;
  skinUnlocked = (s) => { const K = SKINS[s]; return !!K && (K.owner ? skinUnlockedBase(s) : true); };
}
