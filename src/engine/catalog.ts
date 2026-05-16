/**
 * Chargement et requêtes sur le catalogue d'exercices.
 * Port 1:1 de prototype/coach_os/catalog.py.
 */

import type { Exercise, ExerciseDict } from './models';
import { E1RMApp, ExType, exerciseFromDict, exercisePrimaires } from './models';
import rawExercises from '../data/exercises.json';
import { EXERCISE_SYNONYMES } from '../data/exercise-synonymes';

/**
 * Charge tous les exercices depuis le JSON embarqué.
 *
 * Le résultat est mémoïsé pour ne pas re-parser à chaque appel — équivalent du
 * `@lru_cache` Python.
 *
 * Les synonymes du JSON (vides pour la quasi-totalité des entrées) sont
 * complétés par `EXERCISE_SYNONYMES` (cf. `data/exercise-synonymes.ts`).
 * Origine : Azur cherchait "DC", "bench press", "SDT", … sans les trouver
 * (Conv #10d). On enrichit ici plutôt que dans le JSON pour ne pas dupliquer
 * la table entre `src/data/` et `prototype/data/` ; la parité Python reste
 * triviale puisque la recherche fuzzy est UI-only.
 */
let _cached: readonly Exercise[] | null = null;

export function loadExercises(): readonly Exercise[] {
  if (_cached === null) {
    _cached = (rawExercises as unknown as ExerciseDict[])
      .map(exerciseFromDict)
      .map((ex) => {
        const extra = EXERCISE_SYNONYMES[ex.id];
        if (extra === undefined || extra.length === 0) return ex;
        // Merge sans doublons (case-insensitive). On garde les synonymes du
        // JSON d'abord (1 seul aujourd'hui, mais c'est la source de vérité),
        // puis on ajoute les aliases manquants.
        const seen = new Set(ex.synonymes.map((s) => s.toLowerCase()));
        const merged = [...ex.synonymes];
        for (const s of extra) {
          const key = s.toLowerCase();
          if (!seen.has(key)) {
            merged.push(s);
            seen.add(key);
          }
        }
        return { ...ex, synonymes: merged };
      });
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

  /**
   * Recherche très simple par sous-chaîne (ID, nom_fr, synonymes).
   *
   * Normalisation : minuscules + fold accents (`développé` matche `developpe`).
   * Multi-tokens : la requête est splittée sur les espaces, on ne garde que
   * les exos dont **tous** les tokens matchent au moins un champ. Le score
   * agrège les matches (100 ID exact, 50 ID substring, 30 nom, 20 synonyme).
   */
  search_fuzzy(query: string, limit = 10): Exercise[] {
    const q = foldText(query);
    if (q === '') return [];
    const tokens = q.split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length === 0) return [];

    const scored: Array<[number, Exercise]> = [];
    for (const x of this._all) {
      const idFolded = foldText(x.id);
      const nomFolded = foldText(x.nom_fr);
      const synFolded = x.synonymes.map(foldText);

      let total = 0;
      let allMatched = true;
      for (const tok of tokens) {
        let tokScore = 0;
        if (tok === idFolded) tokScore = 100;
        else if (idFolded.includes(tok)) tokScore = 50;
        if (nomFolded.includes(tok)) tokScore = Math.max(tokScore, 30);
        for (const s of synFolded) {
          if (s.includes(tok)) {
            tokScore = Math.max(tokScore, 20);
            break;
          }
        }
        if (tokScore === 0) {
          allMatched = false;
          break;
        }
        total += tokScore;
      }
      if (allMatched && total > 0) scored.push([total, x]);
    }
    scored.sort(([a], [b]) => b - a);
    return scored.slice(0, limit).map(([, x]) => x);
  }
}

/** Minuscules + fold des accents (`é` → `e`). */
function foldText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}
