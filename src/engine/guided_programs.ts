/**
 * Bloc O — les programmes « tout faits » ont été supprimés.
 *
 * L'onboarding propose désormais uniquement « Sur-mesure » (le moteur
 * construit) et « À la main » (grille vide remplie par l'utilisateur). Ce
 * module ne conserve que des stubs neutres pour les rares call-sites qui
 * référencent encore la liste (ProfilPage, ProgresPage) : la liste est vide et
 * la résolution par id renvoie toujours `null`.
 */

import type { GuidedProgram } from './models';

/** Plus aucun programme tout fait (Bloc O). */
export const ALL_GUIDED_PROGRAMS: readonly GuidedProgram[] = Object.freeze([]);

/** Résolution par id — toujours `null` depuis la suppression des tout-faits. */
export function getGuidedProgram(_programId: string): GuidedProgram | null {
  return null;
}
