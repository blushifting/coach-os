/**
 * Helpers pour la sélection de variantes/remplaçants d'un exercice.
 *
 * Historique : ce module a porté les helpers de Séance 0 (calibration 1RM)
 * jusqu'à Conv #12 ; depuis le retrait de la Séance 0 (calibration transparente
 * intra-séance), il ne reste plus que `alternativeVariantsFor`, utilisé par :
 *   - `pages/onboarding/Step5Preview.tsx` (picker de variantes en preview),
 *   - `pages/seance/ExerciseDetailSheet.tsx` (remplacement d'exo en séance).
 */

import type { Catalog } from '@/engine/catalog';
import { type Exercise, exercisePrimaires } from '@/engine/models';

export interface AlternativesOptions {
  /**
   * Si `true`, élargit la recherche à **tout exo partageant au moins un muscle
   * primaire** avec l'exo courant (pattern/équipement potentiellement différents).
   * Si `false` (défaut), comportement historique : exos du même
   * `groupe_substitution` uniquement.
   */
  readonly expand?: boolean;
}

/**
 * Renvoie les remplaçants candidats pour `exerciseId`, filtrés par équipement
 * de l'user, **excluant** l'exo courant. Vide = pas d'alternative dispo.
 *
 * Mode strict (`expand=false`, défaut) : même `subst` (variantes proches).
 * Mode élargi (`expand=true`) : tout exo qui partage ≥1 muscle primaire.
 */
export function alternativeVariantsFor(
  exerciseId: string,
  equipment: ReadonlySet<string>,
  catalog: Catalog,
  options: AlternativesOptions = {},
): Exercise[] {
  if (!catalog.has(exerciseId)) return [];
  const ex = catalog.get(exerciseId);

  const candidates: Exercise[] = options.expand
    ? collectByPrimaryMuscle(ex, catalog)
    : catalog.in_substitution_group(ex.subst);

  return candidates.filter((x) => {
    if (x.id === exerciseId) return false;
    if (x.equip.length === 0) return true;
    for (const e of x.equip) {
      if (!equipment.has(e)) return false;
    }
    return true;
  });
}

function collectByPrimaryMuscle(ex: Exercise, catalog: Catalog): Exercise[] {
  const primaires = exercisePrimaires(ex);
  if (primaires.length === 0) return [];
  const seen = new Set<string>();
  const out: Exercise[] = [];
  for (const m of primaires) {
    for (const cand of catalog.for_muscle_primary(m)) {
      if (seen.has(cand.id)) continue;
      seen.add(cand.id);
      out.push(cand);
    }
  }
  return out;
}
