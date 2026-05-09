/**
 * Miroir TS de prototype/tests/test_balance.py.
 * Couvre R1 (Push:Pull), R2 (Quadri↔Ischios), R3 (Core), R4 (Rear delts).
 */

import { describe, expect, it } from 'vitest';

import {
  applyBalanceRules,
  PUSH_MUSCLES,
  PULL_MUSCLES,
  UPPER_BODY,
  LOWER_BODY,
} from '@/engine/balance';
import {
  MuscleObjective,
  MuscleStatus,
  type MuscleGoal,
} from '@/engine/models';

// =============================================================================
// Helpers
// =============================================================================

function prio(
  muscle: string,
  objective: MuscleObjective = MuscleObjective.HYPERTROPHIE,
  rank = 1,
): MuscleGoal {
  return { muscle, objective, status: MuscleStatus.PRIORITAIRE, priority_rank: rank };
}

function suggested(muscle: string): MuscleGoal {
  return {
    muscle,
    objective: MuscleObjective.MAINTIEN,
    status: MuscleStatus.SUGGERE,
    priority_rank: 99,
  };
}

function nonCouvert(muscle: string): MuscleGoal {
  return {
    muscle,
    objective: MuscleObjective.MAINTIEN,
    status: MuscleStatus.NON_COUVERT,
    priority_rank: 99,
  };
}

function suggestedMuscles(result: MuscleGoal[]): Set<string> {
  return new Set(result.map((g) => g.muscle));
}

function allInMaintien(result: MuscleGoal[]): boolean {
  return result.every(
    (g) =>
      g.objective === MuscleObjective.MAINTIEN &&
      g.status === MuscleStatus.SUGGERE &&
      g.priority_rank === 99,
  );
}

function diff<T>(a: Set<T>, b: ReadonlySet<T> | Set<T>): Set<T> {
  const out = new Set<T>();
  for (const x of a) if (!b.has(x)) out.add(x);
  return out;
}

function inter<T>(a: Set<T>, b: ReadonlySet<T> | Set<T>): Set<T> {
  const out = new Set<T>();
  for (const x of a) if (b.has(x)) out.add(x);
  return out;
}

const PUSH_SET = new Set<string>(PUSH_MUSCLES);
const PULL_SET = new Set<string>(PULL_MUSCLES);
const LOWER_SET = new Set<string>(LOWER_BODY);

// =============================================================================
// 1. Constantes muscles
// =============================================================================

describe('constantes muscles', () => {
  it('Push et Pull sont disjoints', () => {
    for (const m of PUSH_MUSCLES) expect(PULL_SET.has(m)).toBe(false);
  });

  it('Upper et Lower sont disjoints', () => {
    for (const m of UPPER_BODY) expect(LOWER_SET.has(m)).toBe(false);
  });

  it('Push + Pull couvrent pec, dos_largeur, dos_epaisseur', () => {
    const pushPull = new Set<string>([...PUSH_MUSCLES, ...PULL_MUSCLES]);
    for (const m of ['pectoraux', 'dos_largeur', 'dos_epaisseur']) {
      expect(pushPull.has(m)).toBe(true);
    }
  });
});

// =============================================================================
// 2. Cas de base : aucun muscle prioritaire
// =============================================================================

describe('cas de base', () => {
  it('aucun muscle → R3 ajoute abdos + lombaires (et c\'est tout)', () => {
    const result = applyBalanceRules({});
    const m = suggestedMuscles(result);
    expect(m.has('abdos')).toBe(true);
    expect(m.has('lombaires')).toBe(true);
    expect(allInMaintien(result)).toBe(true);
  });
});

// =============================================================================
// 3. R1 — Push/Pull
// =============================================================================

describe('R1 — Push/Pull', () => {
  it('pec seul (push) → R1 ajoute du pull', () => {
    const result = applyBalanceRules({ pectoraux: prio('pectoraux') });
    const m = suggestedMuscles(result);
    expect([...PULL_MUSCLES].some((x) => m.has(x))).toBe(true);
  });

  it('dos_largeur seul (pull) → R1 ajoute du push', () => {
    const result = applyBalanceRules({ dos_largeur: prio('dos_largeur') });
    const m = suggestedMuscles(result);
    expect([...PUSH_MUSCLES].some((x) => m.has(x))).toBe(true);
  });

  it('pec + dos_largeur équilibrés → pas de compensation R1', () => {
    const result = applyBalanceRules({
      pectoraux: prio('pectoraux', MuscleObjective.HYPERTROPHIE, 1),
      dos_largeur: prio('dos_largeur', MuscleObjective.HYPERTROPHIE, 2),
    });
    const m = suggestedMuscles(result);
    const pushAdded = inter(m, PUSH_SET);
    const pullAdded = diff(inter(m, PULL_SET), new Set(['deltos_posterieurs']));
    expect(pushAdded.size).toBe(0);
    expect(pullAdded.size).toBe(0);
  });
});

// =============================================================================
// 4. R2 — Quadriceps ↔ Ischios
// =============================================================================

describe('R2 — Quadri ↔ Ischios', () => {
  it('quadri prioritaire → ischios suggéré', () => {
    const m = suggestedMuscles(applyBalanceRules({ quadriceps: prio('quadriceps') }));
    expect(m.has('ischios')).toBe(true);
  });

  it('ischios prioritaire → quadri suggéré', () => {
    const m = suggestedMuscles(applyBalanceRules({ ischios: prio('ischios') }));
    expect(m.has('quadriceps')).toBe(true);
  });

  it('quad + ischios déjà prioritaires → pas de doublon', () => {
    const m = suggestedMuscles(
      applyBalanceRules({
        quadriceps: prio('quadriceps', MuscleObjective.HYPERTROPHIE, 1),
        ischios: prio('ischios', MuscleObjective.HYPERTROPHIE, 2),
      }),
    );
    expect(m.has('quadriceps')).toBe(false);
    expect(m.has('ischios')).toBe(false);
  });
});

// =============================================================================
// 5. R3 — Core systématique
// =============================================================================

describe('R3 — Core', () => {
  it('abdos + lombaires systématiquement ajoutés', () => {
    const m = suggestedMuscles(applyBalanceRules({ pectoraux: prio('pectoraux') }));
    expect(m.has('abdos')).toBe(true);
    expect(m.has('lombaires')).toBe(true);
  });

  it('opt-out abdos NON_COUVERT respecté', () => {
    const m = suggestedMuscles(
      applyBalanceRules({
        pectoraux: prio('pectoraux'),
        abdos: nonCouvert('abdos'),
      }),
    );
    expect(m.has('abdos')).toBe(false);
    expect(m.has('lombaires')).toBe(true);
  });

  it('abdos déjà prioritaire → pas de re-suggestion', () => {
    const m = suggestedMuscles(
      applyBalanceRules({
        pectoraux: prio('pectoraux'),
        abdos: prio('abdos', MuscleObjective.HYPERTROPHIE, 2),
      }),
    );
    expect(m.has('abdos')).toBe(false);
  });
});

// =============================================================================
// 6. R4 — Rear delts
// =============================================================================

describe('R4 — Rear delts', () => {
  it('pec → deltos_posterieurs', () => {
    const m = suggestedMuscles(applyBalanceRules({ pectoraux: prio('pectoraux') }));
    expect(m.has('deltos_posterieurs')).toBe(true);
  });

  it('deltos_lateraux → deltos_posterieurs', () => {
    const m = suggestedMuscles(
      applyBalanceRules({ deltos_lateraux: prio('deltos_lateraux') }),
    );
    expect(m.has('deltos_posterieurs')).toBe(true);
  });

  it('triceps → deltos_posterieurs', () => {
    const m = suggestedMuscles(applyBalanceRules({ triceps: prio('triceps') }));
    expect(m.has('deltos_posterieurs')).toBe(true);
  });

  it('rear delts déjà présent → pas de doublon', () => {
    const result = applyBalanceRules({
      pectoraux: prio('pectoraux'),
      deltos_posterieurs: suggested('deltos_posterieurs'),
    });
    const count = result.filter((g) => g.muscle === 'deltos_posterieurs').length;
    expect(count).toBe(0);
  });

  it('pull seul (dos_epaisseur) ne déclenche pas R4 spécifiquement', () => {
    const result = applyBalanceRules({ dos_epaisseur: prio('dos_epaisseur') });
    expect(allInMaintien(result)).toBe(true);
  });
});

// =============================================================================
// 7. Cas combinés
// =============================================================================

describe('cas combinés', () => {
  it('pec rank 1 → R1 + R3 + R4 toutes appliquées', () => {
    const m = suggestedMuscles(
      applyBalanceRules({ pectoraux: prio('pectoraux', MuscleObjective.HYPERTROPHIE, 1) }),
    );
    expect(m.has('abdos')).toBe(true);
    expect(m.has('lombaires')).toBe(true);
    expect(m.has('deltos_posterieurs')).toBe(true);
    expect([...PULL_MUSCLES].some((x) => m.has(x))).toBe(true);
  });

  it('pas de doublons dans la liste finale', () => {
    const result = applyBalanceRules({
      pectoraux: prio('pectoraux', MuscleObjective.HYPERTROPHIE, 1),
      triceps: prio('triceps', MuscleObjective.HYPERTROPHIE, 2),
    });
    const muscles = result.map((g) => g.muscle);
    expect(muscles.length).toBe(new Set(muscles).size);
  });

  it('tous les goals retournés sont MAINTIEN/SUGGERE/rank=99', () => {
    const result = applyBalanceRules({
      pectoraux: prio('pectoraux', MuscleObjective.HYPERTROPHIE, 1),
      quadriceps: prio('quadriceps', MuscleObjective.HYPERTROPHIE, 2),
    });
    expect(allInMaintien(result)).toBe(true);
  });

  it('n\'inclut pas les goals déjà présents', () => {
    const m = suggestedMuscles(
      applyBalanceRules({
        pectoraux: prio('pectoraux'),
        dos_largeur: prio('dos_largeur'),
      }),
    );
    expect(m.has('pectoraux')).toBe(false);
    expect(m.has('dos_largeur')).toBe(false);
  });
});
