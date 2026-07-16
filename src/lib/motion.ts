/**
 * Primitives de mouvement partagées (Conv #66).
 *
 * ⚠️ Garde-fou central : une animation pilotée en JS (compteur, barre dont la
 * largeur est calculée) ne passe PAS par le variant `motion-safe:` de Tailwind,
 * qui n'agit que sur des classes CSS. Tout code JS qui anime doit donc
 * interroger `prefersReducedMotion()` lui-même — d'où cette fonction partagée
 * plutôt qu'un `matchMedia` recopié à chaque appel.
 *
 * Les durées vivent ici pour rester réglables d'un seul endroit : le budget de
 * mouvement de l'app est une décision de design, pas une constante locale à un
 * composant.
 */

/** Vrai si l'utilisateur a demandé « réduire les mouvements » (OS ou navigateur). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Budget de mouvement de l'app, en millisecondes.
 *
 * Deux régimes, décidés Conv #66 :
 * - Écrans d'action (séance) : rien ne dépasse `action`. L'app s'utilise entre
 *   deux séries, une animation qui fait attendre est un défaut.
 * - Écrans de lecture (bilans) : `fill` est permis, on regarde le chiffre bouger.
 */
export const MOTION = {
  /** Remplissage d'une barre / d'un anneau sur un écran de lecture. */
  fill: 700,
  /** Réaction sur un écran d'action (flash, pop, retour au tap). */
  action: 380,
  /** Flash de fond attirant l'œil sur un changement (validation, recalibrage). */
  flash: 600,
  /** Remplissage d'un anneau de progression (`ProgressRing`). */
  ring: 360,
  /**
   * Tracé d'une courbe (`animate-draw-line`).
   * ⚠️ Doit rester synchrone avec la durée de `draw-line` dans `tailwind.config.ts` :
   * les éléments qui se posent APRÈS le tracé (points, segment en cours) s'en
   * servent comme délai.
   */
  draw: 900,
  /** Décalage entre deux éléments consécutifs d'une cascade. */
  stagger: 50,
  /** Décalage entre deux cartes d'une même page. */
  staggerCard: 80,
} as const;

/**
 * Inverse de l'easing `ease-out` de Tailwind, pour retrouver l'INSTANT auquel
 * une transition CSS atteint une fraction `f` de sa course.
 *
 * Sert au repère V_min du bilan : on veut flasher au moment où la barre franchit
 * le seuil, pas à la fin de son remplissage.
 *
 * Approximation assumée : on inverse `easeOutCubic` alors que Tailwind applique
 * `cubic-bezier(0, 0, 0.2, 1)`. Les deux courbes diffèrent de quelques
 * millisecondes sur 700 — invisible pour un flash décoratif, et bien moins de
 * code qu'un solveur de Bézier.
 */
export function easeOutProgressAt(fraction: number): number {
  const f = Math.max(0, Math.min(1, fraction));
  return 1 - Math.cbrt(1 - f);
}
