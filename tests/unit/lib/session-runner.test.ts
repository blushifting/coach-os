/**
 * Tests purs sur `src/lib/session-runner.ts`.
 */

import { describe, expect, it } from 'vitest';
import {
  buildSessionFeedback,
  computeLiveE1rmFromEntries,
  computeSessionSummary,
  computeSessionVolume,
  countDoneSets,
  countPlannedSets,
  initEntries,
  lastCheckedSetTooEasy,
  listDayCandidates,
  propagateLoadToUpcomingSets,
  recalibrateUpcomingSets,
  suggestNextLoadAfterTooEasy,
  updateSetEntry,
  type SessionEntries,
} from '@/lib/session-runner';
import type { SessionFeedback, SessionPlan, UserState } from '@/engine/models';
import { MuscleObjective, MuscleStatus } from '@/engine/models';
import type { FeedbackRow } from '@/db/schema';
import type { RecordFeedbackResult } from '@/engine/engine';
import { Catalog } from '@/engine/catalog';

// =============================================================================
// Fixtures
// =============================================================================

function makePlan(): SessionPlan {
  return {
    seance_date: '2026-05-13',
    week_in_cycle: 1,
    cycle_index: 1,
    rpe_target: 8,
    label: 'Push',
    items: [
      {
        exercise_id: 'bench_press',
        sets: [
          { exercise_id: 'bench_press', reps: 5, load_kg: 80, rpe_target: 8, rest_s: 180 },
          { exercise_id: 'bench_press', reps: 5, load_kg: 80, rpe_target: 8, rest_s: 180 },
        ],
      },
      {
        exercise_id: 'shoulder_press',
        sets: [
          { exercise_id: 'shoulder_press', reps: 8, load_kg: 40, rpe_target: 8, rest_s: 120 },
        ],
      },
    ],
  };
}

function makeFeedbackRow(
  label: string,
  cycleIndex: number,
  weekInCycle: number,
  sets: Array<{ exercise_id: string; reps_done: number; load_kg: number }>,
): FeedbackRow {
  return {
    seance_date: '2026-05-01',
    cycle_index: cycleIndex,
    week_in_cycle: weekInCycle,
    session_id: null,
    feedback: {
      seance_date: '2026-05-01',
      week_in_cycle: weekInCycle,
      cycle_index: cycleIndex,
      rpe_target: 8,
      label,
      sets: sets.map((s) => ({ ...s, rpe_perceived: 8 })),
    },
    created_at: '2026-05-01',
  };
}

// =============================================================================
// État local
// =============================================================================

describe('initEntries', () => {
  it('mode normal : reps cibles pré-remplies, charge prescrite, réserve 4+ par défaut', () => {
    const entries = initEntries(makePlan());
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveLength(2);
    expect(entries[1]).toHaveLength(1);
    // Bloc I : rpe présélectionné à 6 (« 4+ », DEFAULT_RPE) — plus de null.
    expect(entries[0]![0]).toEqual({ reps: 5, load_kg: 80, rpe: 6, done: false });
  });

  it('mode calibration : reps vides pour les exos non calibrés', () => {
    const entries = initEntries(makePlan(), {
      calibrationExoIds: new Set(['bench_press']),
    });
    // bench_press en calibration → reps null (mais réserve 4+ comme partout)
    expect(entries[0]![0]).toEqual({ reps: null, load_kg: 80, rpe: 6, done: false });
    // shoulder_press en mode normal → reps pré-remplies
    expect(entries[1]![0]).toEqual({ reps: 8, load_kg: 40, rpe: 6, done: false });
  });
});

describe('updateSetEntry', () => {
  it('mute uniquement la case ciblée, retourne une nouvelle matrice', () => {
    const e0 = initEntries(makePlan());
    const e1 = updateSetEntry(e0, 0, 1, { reps: 6, done: true });
    expect(e1[0]![1]).toEqual({ reps: 6, load_kg: 80, rpe: 6, done: true });
    expect(e1[0]![0]).toEqual(e0[0]![0]);
    expect(e1[1]).toEqual(e0[1]);
    expect(e1).not.toBe(e0);
  });

  it('1.17 (D9) — éditer la charge coupe le pilotage algo (loadAuto=false)', () => {
    const e0: SessionEntries = [
      [{ reps: 8, load_kg: 60, rpe: null, done: false, loadAuto: true }],
    ];
    const e1 = updateSetEntry(e0, 0, 0, { load_kg: 65 });
    expect(e1[0]![0]!.load_kg).toBe(65);
    expect(e1[0]![0]!.loadAuto).toBe(false);
  });
});

describe('countDoneSets / countPlannedSets', () => {
  it('compte correctement', () => {
    const e0 = initEntries(makePlan());
    expect(countPlannedSets(e0)).toBe(3);
    expect(countDoneSets(e0)).toBe(0);
    let e = updateSetEntry(e0, 0, 0, { done: true });
    e = updateSetEntry(e, 1, 0, { done: true });
    expect(countDoneSets(e)).toBe(2);
  });
});

// =============================================================================
// buildSessionFeedback
// =============================================================================

describe('buildSessionFeedback', () => {
  it('null si aucun set marqué done', () => {
    const e = initEntries(makePlan());
    expect(buildSessionFeedback(makePlan(), e)).toBeNull();
  });

  it('retient uniquement les sets done avec reps > 0 ET rpe renseigné', () => {
    let e = initEntries(makePlan());
    // Conv #16 : rpe doit être renseigné explicitement par l'user — on simule.
    e = updateSetEntry(e, 0, 0, { done: true, rpe: 8 });
    e = updateSetEntry(e, 0, 1, { done: true, reps: 0, rpe: 8 }); // skip (reps=0)
    e = updateSetEntry(e, 1, 0, { done: true, reps: 8, load_kg: 42, rpe: 9 });
    const fb = buildSessionFeedback(makePlan(), e);
    expect(fb).not.toBeNull();
    expect(fb!.sets).toHaveLength(2);
    expect(fb!.sets[0]).toMatchObject({ exercise_id: 'bench_press', reps_done: 5, load_kg: 80 });
    expect(fb!.sets[1]).toMatchObject({ exercise_id: 'shoulder_press', reps_done: 8, load_kg: 42, rpe_perceived: 9 });
  });

  it('reporte les métadonnées du plan', () => {
    let e = initEntries(makePlan());
    e = updateSetEntry(e, 0, 0, { done: true, rpe: 8 });
    const fb = buildSessionFeedback(makePlan(), e)!;
    expect(fb.seance_date).toBe('2026-05-13');
    expect(fb.cycle_index).toBe(1);
    expect(fb.week_in_cycle).toBe(1);
    expect(fb.label).toBe('Push');
    expect(fb.rpe_target).toBe(8);
  });

  // Conv #11e — input vidé par l'user (reps ou load_kg === null) ne doit
  // pas remonter comme un faux 0.
  it('skip un set done si reps === null', () => {
    let e = initEntries(makePlan());
    e = updateSetEntry(e, 0, 0, { done: true, reps: null, rpe: 8 });
    e = updateSetEntry(e, 1, 0, { done: true, reps: 8, rpe: 8 });
    const fb = buildSessionFeedback(makePlan(), e);
    expect(fb).not.toBeNull();
    expect(fb!.sets).toHaveLength(1);
    expect(fb!.sets[0]!.exercise_id).toBe('shoulder_press');
  });

  it('skip un set done si load_kg === null', () => {
    let e = initEntries(makePlan());
    e = updateSetEntry(e, 0, 0, { done: true, load_kg: null, rpe: 8 });
    e = updateSetEntry(e, 1, 0, { done: true, rpe: 8 });
    const fb = buildSessionFeedback(makePlan(), e);
    expect(fb).not.toBeNull();
    expect(fb!.sets).toHaveLength(1);
    expect(fb!.sets[0]!.exercise_id).toBe('shoulder_press');
  });

  // Conv #16 — rpe null = série non comptée pour le feedback (au même titre
  // que reps null), car l'effort est obligatoire pour calculer le plafond.
  // Bloc I : le défaut est désormais 6 (« 4+ »), donc on vide explicitement le
  // rpe pour vérifier que le skip-sur-null fonctionne toujours.
  it('skip un set done si rpe === null', () => {
    let e = initEntries(makePlan());
    e = updateSetEntry(e, 0, 0, { done: true, rpe: null });
    e = updateSetEntry(e, 1, 0, { done: true, rpe: 8 });
    const fb = buildSessionFeedback(makePlan(), e);
    expect(fb).not.toBeNull();
    expect(fb!.sets).toHaveLength(1);
    expect(fb!.sets[0]!.exercise_id).toBe('shoulder_press');
  });

  it('accepte load_kg === 0 (poids du corps)', () => {
    let e = initEntries(makePlan());
    e = updateSetEntry(e, 0, 0, { done: true, load_kg: 0, reps: 8, rpe: 8 });
    const fb = buildSessionFeedback(makePlan(), e);
    expect(fb).not.toBeNull();
    expect(fb!.sets).toHaveLength(1);
    expect(fb!.sets[0]!.load_kg).toBe(0);
  });
});

// =============================================================================
// computeSessionVolume / computeSessionSummary
// =============================================================================

// 'a'/'b'/'bench_press'/'shoulder_press'/'squat'/'curl' n'existent pas dans le
// catalog réel (`catalog`, déclaré plus bas dans ce fichier, cf. Calibration
// intra-séance) → fallback load_kg brut (identité), résultats inchangés par
// la charge totale (Chantier C) sauf mention contraire.
describe('computeSessionVolume', () => {
  it('Σ reps × load', () => {
    const fb: SessionFeedback = {
      seance_date: '2026-05-13',
      week_in_cycle: 1,
      cycle_index: 1,
      rpe_target: 8,
      label: 'Push',
      sets: [
        { exercise_id: 'a', reps_done: 5, load_kg: 80, rpe_perceived: 8 },
        { exercise_id: 'a', reps_done: 5, load_kg: 80, rpe_perceived: 8 },
        { exercise_id: 'b', reps_done: 8, load_kg: 40, rpe_perceived: 8 },
      ],
    };
    expect(computeSessionVolume(fb, catalog, 80)).toBe(5 * 80 + 5 * 80 + 8 * 40); // 1120
  });

  // Chantier C (plan 11) — exo bodyweight_loaded réel du catalog : le volume
  // doit inclure le poids du corps, pas seulement le lest.
  it('bodyweight_loaded : volume en charge totale (lest + poids du corps)', () => {
    const fb: SessionFeedback = {
      seance_date: '2026-05-13',
      week_in_cycle: 1,
      cycle_index: 1,
      rpe_target: 8,
      label: 'Pull',
      sets: [{ exercise_id: 'pullup', reps_done: 5, load_kg: 10, rpe_perceived: 8 }],
    };
    expect(computeSessionVolume(fb, catalog, 80)).toBe(5 * (10 + 80));
  });
});

describe('computeSessionSummary', () => {
  const fb: SessionFeedback = {
    seance_date: '2026-05-13',
    week_in_cycle: 2,
    cycle_index: 1,
    rpe_target: 8,
    label: 'Push',
    sets: [{ exercise_id: 'bench_press', reps_done: 5, load_kg: 80, rpe_perceived: 8 }],
  };
  // bench_press n'existe pas dans le catalog réel → muscleVolume vide, mais
  // setsCount / exerciseCount / plafondChanges restent testables.
  const emptyState = {
    volume_min: {},
    volume_max: {},
    muscle_goals: {},
  } as unknown as UserState;

  it('#13 — séries effectuées + exos distincts', () => {
    const r = computeSessionSummary(fb, {}, [], catalog, emptyState);
    expect(r.setsCount).toBe(1);
    expect(r.exerciseCount).toBe(1);
  });

  it('#13 — volume par muscle : contribution du jour + total hebdo vs cible', () => {
    const exo = 'leg_press_45';
    const muscles = catalog.get(exo).muscles;
    const primary = Object.keys(muscles)[0]!;
    const coef = muscles[primary]!;
    const state = {
      volume_min: { [primary]: 8 },
      volume_max: { [primary]: 14 },
      muscle_goals: {
        [primary]: {
          objective: MuscleObjective.HYPERTROPHIE,
          status: MuscleStatus.PRIORITAIRE,
          priority_rank: 1,
        },
      },
    } as unknown as UserState;
    const today: SessionFeedback = {
      seance_date: '2026-05-13',
      week_in_cycle: 2,
      cycle_index: 1,
      rpe_target: 8,
      label: 'Legs',
      sets: [
        { exercise_id: exo, reps_done: 8, load_kg: 100, rpe_perceived: 8 },
        { exercise_id: exo, reps_done: 8, load_kg: 100, rpe_perceived: 8 },
      ],
    };
    // Antérieure la MÊME semaine de programme → comptée dans le total hebdo.
    const priorSameWeek = makeFeedbackRow('Legs', 1, 2, [
      { exercise_id: exo, reps_done: 8, load_kg: 90 },
    ]);
    // Antérieure une AUTRE semaine → exclue du total hebdo.
    const priorOtherWeek = makeFeedbackRow('Legs', 1, 1, [
      { exercise_id: exo, reps_done: 8, load_kg: 90 },
    ]);
    const r = computeSessionSummary(
      today,
      {},
      [priorSameWeek, priorOtherWeek],
      catalog,
      state,
    );
    const row = r.muscleVolume.find((m) => m.muscle === primary)!;
    expect(row).toBeDefined();
    expect(row.sessionSets).toBeCloseTo(2 * coef, 5);
    expect(row.weekTotal).toBeCloseTo(3 * coef, 5);
  });

  it('plafondChanges : distingue 1re calibration, hausse, baisse, plat', () => {
    const summary: RecordFeedbackResult = {
      bench_press: { old: 80, next: 82, definitive: true }, // hausse
      shoulder_press: { old: 40, next: 39, definitive: true }, // baisse
      squat: { old: 100, next: 100, definitive: true }, // plat
      pullup: { old: 60, next: 70, definitive: true }, // 1re calibration
    };
    const calibrated = new Set(['bench_press', 'shoulder_press', 'squat']);
    const r = computeSessionSummary(fb, summary, [], catalog, emptyState, calibrated);
    expect(r.plafondChanges).toHaveLength(4);
    const byId = new Map(r.plafondChanges.map((c) => [c.exerciseId, c]));
    expect(byId.get('pullup')!.oldE).toBeNull();
    expect(byId.get('pullup')!.newE).toBe(70);
    expect(byId.get('pullup')!.deltaKg).toBeNull();
    expect(byId.get('bench_press')!.oldE).toBe(80);
    expect(byId.get('bench_press')!.deltaKg).toBeCloseTo(2, 2);
    expect(byId.get('shoulder_press')!.deltaKg).toBeCloseTo(-1, 2);
    expect(byId.get('squat')!.deltaKg).toBe(0);
    // Tri : 1re calibration en tête.
    expect(r.plafondChanges[0]!.exerciseId).toBe('pullup');
  });
});

// =============================================================================
// listDayCandidates
// =============================================================================

describe('listDayCandidates', () => {
  it('compte par label sur la semaine en cours du cycle en cours', () => {
    const plan = { days: [{ label: 'Push' }, { label: 'Pull' }, { label: 'Legs' }] };
    const fbs = [
      makeFeedbackRow('Push', 1, 2, []),
      makeFeedbackRow('Pull', 1, 2, []),
      makeFeedbackRow('Push', 1, 1, []), // autre sem, exclu
      makeFeedbackRow('Push', 2, 2, []), // autre cycle, exclu
    ];
    const out = listDayCandidates(plan, fbs, 1, 2);
    expect(out).toEqual([
      { dayIndex: 0, label: 'Push', doneCountThisWeek: 1 },
      { dayIndex: 1, label: 'Pull', doneCountThisWeek: 1 },
      { dayIndex: 2, label: 'Legs', doneCountThisWeek: 0 },
    ]);
  });
});

// =============================================================================
// Calibration intra-séance (Conv #16)
// =============================================================================

const catalog = new Catalog();

function makeCalibPlan(): SessionPlan {
  return {
    seance_date: '2026-05-13',
    week_in_cycle: 1,
    cycle_index: 1,
    rpe_target: 7,
    label: 'Legs',
    items: [
      {
        exercise_id: 'leg_press_45',
        sets: [
          { exercise_id: 'leg_press_45', reps: 8, load_kg: 50, rpe_target: 7, rest_s: 120 },
          { exercise_id: 'leg_press_45', reps: 8, load_kg: 50, rpe_target: 7, rest_s: 120 },
          { exercise_id: 'leg_press_45', reps: 8, load_kg: 50, rpe_target: 7, rest_s: 120 },
        ],
      },
    ],
  };
}

describe('computeLiveE1rmFromEntries', () => {
  const exo = catalog.get('leg_press_45');

  it('null si aucune série cochée', () => {
    expect(computeLiveE1rmFromEntries(exo, 75, [])).toBeNull();
  });

  it('null si la série cochée a rpe = null', () => {
    const entries = [{ reps: 8, load_kg: 80, rpe: null, done: true }];
    expect(computeLiveE1rmFromEntries(exo, 75, entries)).toBeNull();
  });

  it('informativeOnly : null si la série est trop facile (4+)', () => {
    // 15 reps RPE 5 (réserve 5+) → trop facile → exclu du plafond « appris ».
    const entries = [{ reps: 15, load_kg: 50, rpe: 5, done: true }];
    expect(
      computeLiveE1rmFromEntries(exo, 75, entries, { informativeOnly: true }),
    ).toBeNull();
  });

  it('Bloc R — par défaut, une série haute-rep/facile compte (Epley étendu)', () => {
    // Même série : sans le filtre informatif, elle produit un e1RM (sert au
    // recalibrage intra-séance, y compris depuis une série lourde en 4+).
    const entries = [{ reps: 15, load_kg: 50, rpe: 5, done: true }];
    expect(computeLiveE1rmFromEntries(exo, 75, entries)).not.toBeNull();
  });

  it('moyenne pondérée de 2 séries fiables — pas un simple max', () => {
    const entries = [
      { reps: 12, load_kg: 80, rpe: 7, done: true }, // e1rm ≈ 120
      { reps: 10, load_kg: 80, rpe: 7.5, done: true }, // e1rm ≈ 113.3
      { reps: 8, load_kg: 50, rpe: 7, done: false }, // pas done → ignoré
    ];
    const r = computeLiveE1rmFromEntries(exo, 75, entries);
    expect(r).not.toBeNull();
    // Moyenne pondérée → entre les deux observés, pas le max.
    expect(r!).toBeGreaterThan(113);
    expect(r!).toBeLessThan(120);
  });
});

describe('lastCheckedSetTooEasy', () => {
  it('null si la dernière cochée a un vrai effort (RPE > 4+)', () => {
    const entries = [{ reps: 8, load_kg: 80, rpe: 8, done: true }];
    expect(lastCheckedSetTooEasy(entries)).toBeNull();
  });

  it('retourne la série si la dernière cochée est en 4+ (RPE ≤ plancher)', () => {
    const entries = [{ reps: 15, load_kg: 50, rpe: 5, done: true }];
    expect(lastCheckedSetTooEasy(entries)).toEqual({
      reps: 15,
      load_kg: 50,
      rpe: 5,
    });
  });

  it('ignore les séries non cochées avant', () => {
    const entries = [
      { reps: 8, load_kg: 80, rpe: 8, done: false },
      { reps: 15, load_kg: 50, rpe: 5, done: true },
    ];
    expect(lastCheckedSetTooEasy(entries)).not.toBeNull();
  });
});

describe('suggestNextLoadAfterTooEasy', () => {
  it('propose une charge plus haute quand la série a été trop facile', () => {
    const exo = catalog.get('leg_press_45');
    const r = suggestNextLoadAfterTooEasy({
      exercise: exo,
      bodyweightKg: 75,
      reps: 15,
      rpe: 5,
      load_kg: 50,
    });
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(50);
  });
});

describe('recalibrateUpcomingSets (chantier E — dérivation directe du e1RM live)', () => {
  it('série lourde en calibration → re-dérive les charges suivantes vers le HAUT', () => {
    const plan = makeCalibPlan();
    // Bootstrap prescrit 50 kg. L'user fait série 1 à 80 kg × 10 RPE 7 → e1RM
    // live ≈ 115 → charge cible (8 reps RPE 7) nettement > 50.
    const entries: SessionEntries = [
      [
        { reps: 10, load_kg: 80, rpe: 7, done: true },
        { reps: null, load_kg: 50, rpe: null, done: false },
        { reps: null, load_kg: 50, rpe: null, done: false },
      ],
    ];
    const next = recalibrateUpcomingSets({
      entries,
      plan,
      catalog,
      bodyweightKg: 75,
      itemIdx: 0,
    });
    expect(next[0]![1]!.load_kg).toBeGreaterThan(50);
    expect(next[0]![2]!.load_kg).toBeGreaterThan(50);
    // reps pré-remplies avec la cible programme (8) + charge posée par l'algo.
    expect(next[0]![1]!.reps).toBe(8);
    expect(next[0]![2]!.reps).toBe(8);
    expect(next[0]![1]!.loadAuto).toBe(true);
  });

  it('série plus légère que le bootstrap → re-dérive vers le BAS (fix #6, plus de gel)', () => {
    const plan = makeCalibPlan();
    // Bootstrap prescrit 50 kg, trop optimiste. L'user peine à 30 kg × 8 RPE 8
    // → e1RM live ≈ 40 → charge cible (8 reps RPE 7) < 50. L'ancien ratio
    // pouvait rester ≈ 1 et ne rien bouger ; ici ça descend systématiquement.
    const entries: SessionEntries = [
      [
        { reps: 8, load_kg: 30, rpe: 8, done: true },
        { reps: null, load_kg: 50, rpe: null, done: false },
      ],
    ];
    const next = recalibrateUpcomingSets({
      entries,
      plan,
      catalog,
      bodyweightKg: 75,
      itemIdx: 0,
    });
    expect(next[0]![1]!.load_kg).toBeLessThan(50);
    expect(next[0]![1]!.load_kg).toBeGreaterThan(0);
    expect(next[0]![1]!.loadAuto).toBe(true);
  });

  it("ne touche pas aux séries où l'user a déjà modifié la charge", () => {
    const plan = makeCalibPlan();
    const entries: SessionEntries = [
      [
        { reps: 10, load_kg: 80, rpe: 7, done: true },
        { reps: null, load_kg: 100, rpe: null, done: false }, // user déjà touché
        { reps: null, load_kg: 50, rpe: null, done: false },
      ],
    ];
    const next = recalibrateUpcomingSets({
      entries,
      plan,
      catalog,
      bodyweightKg: 75,
      itemIdx: 0,
    });
    expect(next[0]![1]!.load_kg).toBe(100); // respecté
    expect(next[0]![2]!.load_kg).toBeGreaterThan(50); // ajusté
  });

  it('série pile sur la cible (8 reps RPE 7 à 50 kg) → redonne la même charge', () => {
    const plan = makeCalibPlan();
    const entries: SessionEntries = [
      [
        // e1RM live d'une série pile à la cible → charge re-dérivée = prescription.
        { reps: 8, load_kg: 50, rpe: 7, done: true },
        { reps: null, load_kg: 50, rpe: null, done: false },
      ],
    ];
    const next = recalibrateUpcomingSets({
      entries,
      plan,
      catalog,
      bodyweightKg: 75,
      itemIdx: 0,
    });
    expect(next[0]![1]!.load_kg).toBe(50);
    // Pré-remplissage des reps reste actif même si la charge est inchangée.
    expect(next[0]![1]!.reps).toBe(8);
  });

  it('re-pilote une série déjà posée par l’algo (loadAuto) depuis le e1RM live', () => {
    const plan = makeCalibPlan();
    // Série 2 déjà posée par un précédent recalibrage : charge 60 ≠ prescription
    // (50) mais `loadAuto: true`. Une nouvelle mesure fiable la RE-dérive (pas
    // figée comme « touchée user »).
    const entries: SessionEntries = [
      [
        { reps: 10, load_kg: 80, rpe: 7, done: true },
        { reps: 8, load_kg: 60, rpe: null, done: false, loadAuto: true },
      ],
    ];
    const next = recalibrateUpcomingSets({
      entries,
      plan,
      catalog,
      bodyweightKg: 75,
      itemIdx: 0,
    });
    expect(next[0]![1]!.load_kg).toBeGreaterThan(60);
    expect(next[0]![1]!.loadAuto).toBe(true);
  });
});

// =============================================================================
// Report de charge hors calibration (Bloc S, Conv #45)
// =============================================================================

describe('propagateLoadToUpcomingSets', () => {
  it('reporte une charge MODIFIÉE sur les séries suivantes encore prescrites', () => {
    const plan = makePlan(); // bench_press : 2 séries à 80 kg
    const entries: SessionEntries = [
      [
        { reps: 5, load_kg: 85, rpe: 8, done: true }, // validée, 80 → 85
        { reps: 5, load_kg: 80, rpe: 6, done: false }, // encore la prescription
      ],
      [{ reps: 8, load_kg: 40, rpe: 6, done: false }],
    ];
    const next = propagateLoadToUpcomingSets({ entries, plan, itemIdx: 0, fromSetIdx: 0 });
    expect(next[0]![1]!.load_kg).toBe(85);
    expect(next[0]![1]!.loadAuto).toBe(true);
    // L'autre exo n'est jamais touché (même référence).
    expect(next[1]).toBe(entries[1]);
  });

  it('reporte sur TOUTES les séries suivantes prescrites (multi-séries)', () => {
    const plan = makeCalibPlan(); // leg_press_45 : 3 séries à 50 kg
    const entries: SessionEntries = [
      [
        { reps: 8, load_kg: 55, rpe: 7, done: true }, // 50 → 55
        { reps: 8, load_kg: 50, rpe: 6, done: false },
        { reps: 8, load_kg: 50, rpe: 6, done: false },
      ],
    ];
    const next = propagateLoadToUpcomingSets({ entries, plan, itemIdx: 0, fromSetIdx: 0 });
    expect(next[0]![1]!.load_kg).toBe(55);
    expect(next[0]![2]!.load_kg).toBe(55);
  });

  it('no-op si la charge validée vaut encore la prescription (référence inchangée)', () => {
    const plan = makePlan();
    const entries: SessionEntries = [
      [
        { reps: 5, load_kg: 80, rpe: 8, done: true }, // = prescription
        { reps: 5, load_kg: 80, rpe: 6, done: false },
      ],
    ];
    const next = propagateLoadToUpcomingSets({ entries, plan, itemIdx: 0, fromSetIdx: 0 });
    expect(next).toBe(entries);
  });

  it("préserve une série suivante ajustée à la main par l'user", () => {
    const plan = makePlan();
    const entries: SessionEntries = [
      [
        { reps: 5, load_kg: 85, rpe: 8, done: true }, // 80 → 85
        { reps: 5, load_kg: 90, rpe: 6, done: false, loadAuto: false }, // bumpée main
      ],
    ];
    const next = propagateLoadToUpcomingSets({ entries, plan, itemIdx: 0, fromSetIdx: 0 });
    expect(next[0]![1]!.load_kg).toBe(90); // respectée
  });

  it('ignore les séries déjà cochées', () => {
    const plan = makePlan();
    const entries: SessionEntries = [
      [
        { reps: 5, load_kg: 85, rpe: 8, done: true }, // 80 → 85
        { reps: 5, load_kg: 80, rpe: 8, done: true }, // déjà cochée
      ],
    ];
    const next = propagateLoadToUpcomingSets({ entries, plan, itemIdx: 0, fromSetIdx: 0 });
    expect(next[0]![1]!.load_kg).toBe(80); // intacte (done)
  });
});
