/**
 * Phrases d'explication FR pour les suggestions R1-R4 (étape 3 onboarding).
 *
 * À partir du `muscle` suggéré et des PRIORITAIRE en entrée, on retrouve la
 * règle déclenchante (R1/R2/R3/R4 — cf. `engine/balance.ts`) et on en déduit
 * une phrase courte expliquant pourquoi le muscle a été ajouté.
 *
 * Sources : 04 §3.1, 09 §4.2.
 */

import type { MuscleObjective } from '@/engine/models';
import {
  CORE_MUSCLES,
  PULL_MUSCLES,
  PUSH_MUSCLES,
  R4_TRIGGERS,
} from '@/engine/balance';

import type { RankedPriority } from './onboarding-state';

const PUSH_SET: ReadonlySet<string> = new Set(PUSH_MUSCLES);
const PULL_SET: ReadonlySet<string> = new Set(PULL_MUSCLES);
const CORE_SET: ReadonlySet<string> = new Set(CORE_MUSCLES);
const R4_SET: ReadonlySet<string> = new Set(R4_TRIGGERS);

export type BalanceRule = 'R1' | 'R2' | 'R3' | 'R4';

export interface BalanceReason {
  readonly rule: BalanceRule;
  readonly text: string;
}

const MUSCLE_LABEL_FR: Record<string, string> = {
  pectoraux: 'les pectoraux',
  dos_largeur: 'le dos en largeur',
  dos_epaisseur: 'le dos en épaisseur',
  trapezes_hauts: 'les trapèzes',
  quadriceps: 'les quadriceps',
  ischios: 'les ischio-jambiers',
  fessiers: 'les fessiers',
  mollets: 'les mollets',
  deltos_lateraux: 'les deltoïdes latéraux',
  deltos_posterieurs: 'les deltoïdes postérieurs',
  biceps: 'les biceps',
  triceps: 'les triceps',
  abdos: 'les abdominaux',
  obliques: 'les obliques',
  lombaires: 'les lombaires',
};

export function muscleLabel(muscle: string): string {
  return MUSCLE_LABEL_FR[muscle] ?? muscle;
}

function priorityMuscles(priorities: readonly RankedPriority[]): Set<string> {
  return new Set(priorities.map((p) => p.muscle));
}

/**
 * Identifie la règle déclenchante pour une suggestion.
 *
 * Convention (cohérente avec `balance.ts:applyBalanceRules`, ordre R1→R2→R3→R4) :
 *  - R3 (gainage) : `abdos` ou `lombaires` → toujours R3.
 *  - R1 (push:pull) : muscle dans PUSH et au moins un PULL en PRIORITAIRE → R1
 *                     (et symétrique).
 *  - R2 (quadri↔ischios) : `ischios` ou `quadriceps`, avec l'antagoniste en
 *                          PRIORITAIRE → R2.
 *  - R4 (rear delts) : `deltos_posterieurs` avec au moins un trigger R4
 *                      (pectoraux/deltos_lateraux/triceps) en PRIORITAIRE → R4.
 *  - Fallback : R1 (par défaut, ne devrait pas arriver pour les muscles
 *               effectivement produits par `applyBalanceRules`).
 */
export function explainSuggestion(
  muscle: string,
  priorities: readonly RankedPriority[],
): BalanceReason {
  const prios = priorityMuscles(priorities);

  if (CORE_SET.has(muscle)) {
    return {
      rule: 'R3',
      text: 'Gainage minimum (abdos + lombaires) pour protéger ton dos sous charge.',
    };
  }

  if (muscle === 'ischios' && prios.has('quadriceps')) {
    return {
      rule: 'R2',
      text: 'Ischio-jambiers pour équilibrer tes quadriceps (préviens les claquages).',
    };
  }
  if (muscle === 'quadriceps' && prios.has('ischios')) {
    return {
      rule: 'R2',
      text: 'Quadriceps pour équilibrer tes ischios (équilibre antagoniste).',
    };
  }

  if (muscle === 'deltos_posterieurs') {
    const hasR4Trigger = [...prios].some((m) => R4_SET.has(m));
    if (hasR4Trigger) {
      return {
        rule: 'R4',
        text: 'Deltoïdes postérieurs pour équilibrer la posture si tu travailles les pectoraux ou les deltos latéraux.',
      };
    }
  }

  if (PUSH_SET.has(muscle)) {
    const hasPullPrio = [...prios].some((m) => PULL_SET.has(m));
    if (hasPullPrio) {
      return {
        rule: 'R1',
        text: 'Équilibre push/pull : tu cibles le dos, on ajoute du push pour la posture.',
      };
    }
  }
  if (PULL_SET.has(muscle)) {
    const hasPushPrio = [...prios].some((m) => PUSH_SET.has(m));
    if (hasPushPrio) {
      return {
        rule: 'R1',
        text: 'Équilibre push/pull : tu cibles les pectoraux/épaules, on ajoute du tirage pour la posture.',
      };
    }
  }

  return {
    rule: 'R1',
    text: 'Suggéré par les règles d\'équilibre musculaire.',
  };
}

export function objectiveLabel(obj: MuscleObjective): string {
  switch (obj) {
    case 'force':
      return 'Force';
    case 'hypertrophie':
      return 'Hypertrophie';
    case 'endurance':
      return 'Endurance';
    case 'maintien':
      return 'Maintien';
    default:
      return obj;
  }
}
