/**
 * Bloc G (Conv #32) — Séance custom assistée (hors-programme).
 *
 * Une séance custom est une séance **hors-rotation** A/B/C que l'utilisateur
 * compose à la volée. On part d'un *preset* = un simple paquet de muscles nommé
 * (Pecs, Dos, …) qu'on donne au **même moteur de sélection que le programme**
 * (`candidatesForMuscle`), **favoris d'abord**. Le preset « Vide » part d'une
 * feuille blanche.
 *
 * Science : le rendement par muscle décroît au-delà de ~8 séries dans une même
 * séance. On plafonne donc le volume par muscle/séance et on **répartit sur
 * plusieurs exos/angles** plutôt que d'empiler les séries sur un seul mouvement.
 */

import type { Catalog } from '@/engine/catalog';
import type {
  DayTemplate,
  Exercise,
  SessionFeedback,
  SessionPlan,
  UserState,
} from '@/engine/models';
import { candidatesForMuscle, orderSession } from '@/engine/selection';

export interface SessionPreset {
  readonly id: string;
  readonly label: string;
  /** Muscles primaires visés (clés catalogue). Vide pour le preset « Vide ». */
  readonly muscles: readonly string[];
}

/**
 * Presets = paquets de muscles, pas des listes d'exos figées. Le builder les
 * passe au moteur de sélection. L'ordre des muscles compte (le 1er sert de
 * muscle prioritaire pour `orderSession`).
 */
export const SESSION_PRESETS: readonly SessionPreset[] = [
  { id: 'pecs', label: 'Pecs', muscles: ['pectoraux'] },
  { id: 'dos', label: 'Dos', muscles: ['dos_largeur', 'dos_epaisseur'] },
  {
    id: 'jambes',
    label: 'Jambes',
    muscles: ['quadriceps', 'ischios', 'fessiers', 'mollets'],
  },
  {
    id: 'epaules',
    label: 'Épaules',
    muscles: ['deltos_lateraux', 'deltos_anterieurs', 'deltos_posterieurs'],
  },
  { id: 'bras', label: 'Bras', muscles: ['biceps', 'triceps'] },
  {
    id: 'full',
    label: 'Full body',
    muscles: ['quadriceps', 'pectoraux', 'dos_largeur', 'ischios'],
  },
  { id: 'vide', label: 'Ma séance', muscles: [] },
];

export function presetById(id: string): SessionPreset | null {
  return SESSION_PRESETS.find((p) => p.id === id) ?? null;
}

/** Plafond de séries pour un même muscle dans UNE séance (cf. en-tête). */
export const PER_MUSCLE_SESSION_CAP = 8;
const DEFAULT_SETS_PER_EXO = 3;

/**
 * Tri stable « favoris d'abord » (G4) : les exos favoris remontent en tête,
 * l'ordre interne de chaque groupe est préservé. S'applique par-dessus
 * n'importe quelle liste déjà triée par pertinence (ex. `candidatesForMuscle`).
 */
export function favoritesFirst<T extends { readonly id: string }>(
  exos: readonly T[],
  favoriteIds: ReadonlySet<string>,
): T[] {
  if (favoriteIds.size === 0) return [...exos];
  const fav: T[] = [];
  const rest: T[] = [];
  for (const e of exos) {
    if (favoriteIds.has(e.id)) fav.push(e);
    else rest.push(e);
  }
  return [...fav, ...rest];
}

export interface CustomSlot {
  readonly exerciseId: string;
  readonly nSets: number;
}

/**
 * Compose la base d'une séance custom à partir d'un preset.
 *
 * Pour chaque muscle visé : candidats (favoris d'abord), on prend 1 à 2 exos
 * (2 quand le preset cible ≤ 2 muscles, pour répartir le volume), avec un
 * nombre de séries plafonné par `PER_MUSCLE_SESSION_CAP`. Anti-doublon
 * inter-muscles. Renvoie les slots ordonnés « séance » (`orderSession`, muscle
 * prioritaire = 1er muscle du preset). Preset vide → aucun slot.
 */
export function buildCustomSessionSlots(
  preset: SessionPreset,
  state: UserState,
  catalog: Catalog,
): CustomSlot[] {
  if (preset.muscles.length === 0) return [];
  const favoriteIds = new Set(state.favorite_exercise_ids ?? []);
  const used = new Set<string>();
  const chosen: { ex: Exercise; nSets: number }[] = [];
  // Moins de muscles ⟹ on étale sur plus d'exos par muscle.
  const exosPerMuscle = preset.muscles.length <= 2 ? 2 : 1;

  for (const muscle of preset.muscles) {
    const cands = favoritesFirst(
      candidatesForMuscle(catalog, muscle, state.profile, { excludeIds: used }),
      favoriteIds,
    );
    const picked = cands.slice(0, exosPerMuscle);
    if (picked.length === 0) continue;
    // Répartit le plafond muscle/séance sur les exos retenus (min 2 séries).
    const budget = Math.min(PER_MUSCLE_SESSION_CAP, DEFAULT_SETS_PER_EXO * picked.length);
    const per = Math.max(2, Math.floor(budget / picked.length));
    for (const ex of picked) {
      chosen.push({ ex, nSets: per });
      used.add(ex.id);
    }
  }
  if (chosen.length === 0) return [];

  const ordered = orderSession(
    chosen.map((c) => c.ex),
    preset.muscles[0] ?? null,
  );
  const setsById = new Map(chosen.map((c) => [c.ex.id, c.nSets]));
  return ordered.map((ex) => ({ exerciseId: ex.id, nSets: setsById.get(ex.id)! }));
}

/**
 * Bloc G (Conv #32) — progression par défaut d'un exo ajouté manuellement à un
 * jour de cycle (G3). On calque la longueur de la progression d'un exo voisin
 * du jour (sinon 5 semaines), base = `nSets`, dernière semaine = déload léger
 * (~60 %). `generateSession` lit `progression[weekIdx]` pour le nb de séries.
 */
export function defaultProgressionForDay(
  day: DayTemplate | undefined,
  nSets: number,
): number[] {
  const sibling = day?.exercises[0]?.progression;
  const len = sibling !== undefined && sibling.length > 0 ? sibling.length : 5;
  const out = Array.from({ length: len }, () => nSets);
  out[len - 1] = Math.max(1, Math.round(nSets * 0.6));
  return out;
}

/**
 * Ensemble des muscles primaires (coef ≥ 1) travaillés un jour donné — séances
 * faites (feedbacks) + séances planifiées non faites. Sert à avertir, sans
 * bloquer, quand une séance custom retape un muscle entraîné la veille.
 */
export function musclesTrainedOn(
  date: string,
  feedbacks: readonly { readonly feedback: SessionFeedback }[],
  plannedSessions: readonly {
    readonly seance_date: string;
    readonly status: string;
    readonly plan: SessionPlan;
  }[],
  musclesOf: Readonly<Record<string, Readonly<Record<string, number>>>>,
): Set<string> {
  const out = new Set<string>();
  const addExo = (exerciseId: string) => {
    for (const [m, c] of Object.entries(musclesOf[exerciseId] ?? {})) {
      if (c >= 1) out.add(m);
    }
  };
  for (const f of feedbacks) {
    if (f.feedback.seance_date !== date) continue;
    for (const s of f.feedback.sets) addExo(s.exercise_id);
  }
  for (const s of plannedSessions) {
    if (s.seance_date !== date || s.status !== 'planned') continue;
    for (const it of s.plan.items) addExo(it.exercise_id);
  }
  return out;
}
