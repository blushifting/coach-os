/**
 * Chargement et requêtes sur le catalogue d'exercices.
 * Port 1:1 de prototype/coach_os/catalog.py.
 */

import type { Exercise, ExerciseDict } from './models';
import { E1RMApp, ExType, exerciseFromDict, exercisePrimaires } from './models';
import rawExercises from '../data/exercises.json';

/**
 * Charge tous les exercices depuis le JSON embarqué.
 *
 * Le résultat est mémoïsé pour ne pas re-parser à chaque appel — équivalent du
 * `@lru_cache` Python.
 */
let _cached: readonly Exercise[] | null = null;

export function loadExercises(): readonly Exercise[] {
  if (_cached === null) {
    _cached = (rawExercises as unknown as ExerciseDict[]).map(exerciseFromDict);
  }
  return _cached;
}

/** Reset du cache — utile uniquement en test. */
export function _resetExerciseCache(): void {
  _cached = null;
}

export interface CatalogFilterOptions {
  muscle_primary?: string;
  /** Set d'équipements disponibles. Si fourni, exclut les exos qui requièrent un équipement absent. */
  equip_available?: Set<string>;
  e1rm_apps?: readonly E1RMApp[];
  tags_in?: readonly string[];
  compound_only?: boolean;
  isolation_only?: boolean;
}

/** Wrapper avec index pour requêtes rapides. */
export class Catalog {
  private readonly _all: readonly Exercise[];
  private readonly _by_id: ReadonlyMap<string, Exercise>;
  private readonly _by_subst: ReadonlyMap<string, readonly Exercise[]>;
  private readonly _by_primary_muscle: ReadonlyMap<string, readonly Exercise[]>;

  constructor(exercises?: Iterable<Exercise>) {
    this._all = exercises ? Object.freeze([...exercises]) : loadExercises();

    const byId = new Map<string, Exercise>();
    const bySubst = new Map<string, Exercise[]>();
    const byPrimary = new Map<string, Exercise[]>();

    for (const x of this._all) {
      byId.set(x.id, x);
      const list = bySubst.get(x.subst) ?? [];
      list.push(x);
      bySubst.set(x.subst, list);
      for (const m of exercisePrimaires(x)) {
        const ml = byPrimary.get(m) ?? [];
        ml.push(x);
        byPrimary.set(m, ml);
      }
    }

    this._by_id = byId;
    this._by_subst = bySubst;
    this._by_primary_muscle = byPrimary;
  }

  // --- accès direct ---

  get length(): number {
    return this._all.length;
  }

  [Symbol.iterator](): Iterator<Exercise> {
    return this._all[Symbol.iterator]();
  }

  /** Retourne l'exercice par ID. Lève si inconnu (équivalent KeyError Python). */
  get(exercise_id: string): Exercise {
    const x = this._by_id.get(exercise_id);
    if (!x) throw new Error(`Exercise inconnu : ${exercise_id}`);
    return x;
  }

  /** Vérifie l'existence d'un exo sans lever. */
  has(exercise_id: string): boolean {
    return this._by_id.has(exercise_id);
  }

  all(): readonly Exercise[] {
    return this._all;
  }

  // --- requêtes ---

  /** Tous les exos qui ont `muscle` en primaire (coef ≥ 1.0). */
  for_muscle_primary(muscle: string): Exercise[] {
    return [...(this._by_primary_muscle.get(muscle) ?? [])];
  }

  in_substitution_group(subst: string): Exercise[] {
    return [...(this._by_subst.get(subst) ?? [])];
  }

  /** Filtre combiné. Tous les critères sont AND. */
  filter(opts: CatalogFilterOptions = {}): Exercise[] {
    const candidates = opts.muscle_primary
      ? this.for_muscle_primary(opts.muscle_primary)
      : [...this._all];

    const out: Exercise[] = [];
    for (const x of candidates) {
      if (opts.compound_only && x.type !== ExType.COMPOUND) continue;
      if (opts.isolation_only && x.type !== ExType.ISOLATION) continue;
      if (opts.e1rm_apps && !opts.e1rm_apps.includes(x.e1RM_app)) continue;
      if (opts.equip_available !== undefined) {
        // bodyweight pur : pas d'équipement requis
        if (x.equip.length > 0) {
          let ok = true;
          for (const e of x.equip) {
            if (!opts.equip_available.has(e)) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
        }
      }
      if (opts.tags_in && !opts.tags_in.some((t) => x.tags.includes(t))) continue;
      out.push(x);
    }
    return out;
  }

  /** Recherche très simple par sous-chaîne (ID, nom_fr, synonymes). */
  search_fuzzy(query: string, limit = 10): Exercise[] {
    const q = query.toLowerCase().trim();
    const scored: Array<[number, Exercise]> = [];
    for (const x of this._all) {
      let score = 0;
      const idLower = x.id.toLowerCase();
      if (q === idLower) score += 100;
      else if (idLower.includes(q)) score += 50;
      if (x.nom_fr.toLowerCase().includes(q)) score += 30;
      for (const s of x.synonymes) {
        if (s.toLowerCase().includes(q)) {
          score += 20;
          break;
        }
      }
      if (score > 0) scored.push([score, x]);
    }
    scored.sort(([a], [b]) => b - a);
    return scored.slice(0, limit).map(([, x]) => x);
  }
}
