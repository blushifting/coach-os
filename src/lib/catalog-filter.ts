/**
 * Sélecteurs purs pour l'onglet Catalogue (Conv #6b).
 *
 * Source de vérité :
 * - `recherche/10_plan_claude_code.md §3 Conv #6b` — liste filtrable, fuzzy
 *   search, descriptif 1-2 phrases par exo généré depuis `pattern`, `muscles`,
 *   `note` (champ `notes_techniques` côté Python).
 * - `recherche/08_ux_decisions.md §2` — vocabulaire UI : Polyarticulaire pour
 *   `compound`, jamais le mot anglais dans l'UI.
 *
 * Tout est pur : aucune dépendance au store, à la DB ni à React.
 */

import type { Catalog } from '@/engine/catalog';
import { ChargeType, ExType, Pattern } from '@/engine/models';
import type { Exercise } from '@/engine/models';
import { exercisePrimaires } from '@/engine/models';
import { muscleLabel } from './progress';

// =============================================================================
// Labels FR — vocabulaire UI (cf. 08_ux_decisions §2)
// =============================================================================

export const EXTYPE_LABEL_FR: Record<ExType, string> = {
  [ExType.COMPOUND]: 'Polyarticulaire',
  [ExType.ISOLATION]: 'Isolation',
};

export const PATTERN_LABEL_FR: Record<Pattern, string> = {
  [Pattern.SQUAT]: 'Squat',
  [Pattern.HINGE]: 'Charnière de hanche',
  [Pattern.LUNGE]: 'Fente',
  [Pattern.PUSH_H]: 'Poussée horizontale',
  [Pattern.PUSH_V]: 'Poussée verticale',
  [Pattern.PULL_H]: 'Tirage horizontal',
  [Pattern.PULL_V]: 'Tirage vertical',
  [Pattern.ISOLATION]: 'Isolation',
  [Pattern.CORE]: 'Gainage',
};

export const CHARGE_LABEL_FR: Record<ChargeType, string> = {
  [ChargeType.BARBELL]: 'Barre',
  [ChargeType.DUMBBELL]: 'Haltères',
  [ChargeType.MACHINE_STACK]: 'Machine',
  [ChargeType.CABLE]: 'Poulie',
  [ChargeType.BODYWEIGHT]: 'Poids du corps',
  [ChargeType.BODYWEIGHT_LOADED]: 'Lesté',
  [ChargeType.BODYWEIGHT_ASSISTED]: 'Assisté',
};

/** Tags reconnus à afficher dans l'UI. Tags absents = pas de chip. */
export const TAG_LABEL_FR: Record<string, string> = {
  lengthened_bias: 'Étirement',
  pause_3s: 'Pause 3s',
  pause_2s: 'Pause 2s',
  pec_haut: 'Haut des pectoraux',
  pec_bas: 'Bas des pectoraux',
  incline_30: 'Incliné 30°',
  incline_45: 'Incliné 45°',
  decline: 'Décliné',
  long_head_biceps: 'Long chef du biceps',
  long_head_triceps: 'Long chef du triceps',
  hammer_grip: 'Prise marteau',
  wide_grip: 'Prise large',
  close_grip: 'Prise serrée',
  reverse_grip: 'Prise inversée',
  neutral_grip: 'Prise neutre',
  underhand: 'Prise supination',
  unilateral: 'Unilatéral',
  knee_friendly: 'Doux pour les genoux',
  lower_back_friendly: 'Doux pour le dos',
  beginner_friendly: 'Adapté débutant',
  advanced: 'Avancé',
  technique_complex: 'Technique exigeante',
};

export function extypeLabel(t: ExType): string {
  return EXTYPE_LABEL_FR[t] ?? t;
}
export function patternLabel(p: Pattern): string {
  return PATTERN_LABEL_FR[p] ?? p;
}
export function chargeLabel(c: ChargeType): string {
  return CHARGE_LABEL_FR[c] ?? c;
}
export function tagLabel(tag: string): string | null {
  return TAG_LABEL_FR[tag] ?? null;
}

// =============================================================================
// Description courte (1-2 phrases)
// =============================================================================

/**
 * Génère un descriptif court FR de l'exo (1-2 phrases) à partir des champs
 * structurés. Si `ex.note` est non vide, on le préfère (audit manuel sur les
 * exos ambigus). Sinon on construit "{Polyarticulaire/Isolation} {pattern}.
 * Cible {muscles}." en s'appuyant sur les muscles primaires.
 */
export function buildDescription(ex: Exercise): string {
  if (ex.note && ex.note.trim() !== '') {
    return ex.note.trim();
  }
  const typ = extypeLabel(ex.type);
  const pat = patternLabel(ex.pattern).toLowerCase();
  const primaires = exercisePrimaires(ex).map(muscleLabel);
  const cible =
    primaires.length === 0
      ? ''
      : ` Cible ${primaires.length === 1 ? 'le' : 'les'} ${joinFr(
          primaires.map((m) => m.toLowerCase()),
        )}.`;
  return `${typ} — ${pat}.${cible}`.trim();
}

function joinFr(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} et ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

// =============================================================================
// Filtres
// =============================================================================

export interface CatalogFilters {
  /** Requête texte fuzzy (id, nom_fr, synonymes). Trim/lowercase appliqué côté impl. */
  text: string;
  /** Si non vide : ne garder que les exos qui ont **au moins un** muscle primaire dans ce set. */
  muscles: readonly string[];
  /** Si non vide : ne garder que les patterns listés. */
  patterns: readonly Pattern[];
  /** Si non vide : ne garder que les `charge` listés. */
  charges: readonly ChargeType[];
  /** Si non vide : ne garder que les types listés (`compound`/`isolation`). */
  types: readonly ExType[];
  /** Si vrai : ne garder que les exos avec tag `lengthened_bias`. */
  lengthenedBiasOnly: boolean;
}

export const EMPTY_FILTERS: CatalogFilters = Object.freeze({
  text: '',
  muscles: [],
  patterns: [],
  charges: [],
  types: [],
  lengthenedBiasOnly: false,
});

export function hasActiveFilters(f: CatalogFilters): boolean {
  return (
    f.text.trim() !== '' ||
    f.muscles.length > 0 ||
    f.patterns.length > 0 ||
    f.charges.length > 0 ||
    f.types.length > 0 ||
    f.lengthenedBiasOnly
  );
}

/**
 * Applique les filtres et la recherche texte. Si du texte est fourni, le tri
 * est par score fuzzy décroissant ; sinon on garde l'ordre du catalogue
 * (le catalogue est déjà ordonné par "désirable" cf. prototype `catalog.py`).
 *
 * Tous les critères sont AND entre catégories, OR à l'intérieur d'une catégorie.
 */
export function applyFilters(
  catalog: Catalog,
  filters: CatalogFilters,
): Exercise[] {
  const text = filters.text.trim().toLowerCase();
  const muscleSet = new Set(filters.muscles);
  const patternSet = new Set(filters.patterns);
  const chargeSet = new Set(filters.charges);
  const typeSet = new Set(filters.types);

  const matchesStaticFilters = (ex: Exercise): boolean => {
    if (patternSet.size > 0 && !patternSet.has(ex.pattern)) return false;
    if (chargeSet.size > 0 && !chargeSet.has(ex.charge)) return false;
    if (typeSet.size > 0 && !typeSet.has(ex.type)) return false;
    if (filters.lengthenedBiasOnly && !ex.tags.includes('lengthened_bias')) {
      return false;
    }
    if (muscleSet.size > 0) {
      const primaires = exercisePrimaires(ex);
      if (!primaires.some((m) => muscleSet.has(m))) return false;
    }
    return true;
  };

  if (text === '') {
    return catalog.all().filter(matchesStaticFilters);
  }

  // Texte : on score d'abord (sur tout le catalogue) puis on filtre, et on
  // garde l'ordre de pertinence. `search_fuzzy` retourne max 10 par défaut ;
  // ici on veut tout, donc on remplit largement la limite.
  const ranked = catalog.search_fuzzy(text, 10_000);
  return ranked.filter(matchesStaticFilters);
}

// =============================================================================
// Options d'UI : groupes de filtres présentés à l'user
// =============================================================================

/** Patterns à exposer comme chips. CORE n'est pas exposé (très peu d'exos). */
export const FILTER_PATTERNS: readonly Pattern[] = [
  Pattern.SQUAT,
  Pattern.HINGE,
  Pattern.LUNGE,
  Pattern.PUSH_H,
  Pattern.PUSH_V,
  Pattern.PULL_H,
  Pattern.PULL_V,
  Pattern.ISOLATION,
] as const;

/** Charges à exposer comme chips. */
export const FILTER_CHARGES: readonly ChargeType[] = [
  ChargeType.BARBELL,
  ChargeType.DUMBBELL,
  ChargeType.MACHINE_STACK,
  ChargeType.CABLE,
  ChargeType.BODYWEIGHT,
] as const;
