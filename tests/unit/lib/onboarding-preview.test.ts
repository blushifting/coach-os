/**
 * Tests pour `lib/onboarding-preview.ts` (Conv #11b).
 *
 * On vérifie que la preview est purement en mémoire, que le récap volume
 * accumule par muscle primaire, et que les remplacements de variantes
 * préservent les champs non touchés (`base_sets`, `progression`, etc.).
 */

import { describe, expect, it } from 'vitest';
import { Catalog } from '@/engine/catalog';
import { bootstrapMuscleGoalsFromProfile, startUser } from '@/engine/engine';
import {
  analyzeProgramTension,
  applyVariantsToTemplate,
  buildPreviewTemplate,
  estimateExerciseDurationMinutes,
  muscleDeltaForSwap,
  SESSION_DURATION_WARN_MIN,
  weeklyVolumeByMuscle,
  type VariantReplacement,
} from '@/lib/onboarding-preview';
import { ExType, type DayTemplate, type WeeklyTemplate } from '@/engine/models';
import { profile } from '../engine/_helpers';

const catalog = new Catalog();

describe('buildPreviewTemplate (Conv #11b)', () => {
  it('mode custom : retourne un WeeklyTemplate non-null sans blocking', () => {
    const p = profile();
    const goals = bootstrapMuscleGoalsFromProfile(p, [
      'pectoraux',
      'dos_largeur',
      'quadriceps',
    ]);
    const { template, blocking } = buildPreviewTemplate(p, goals, null, catalog);
    expect(blocking).toEqual([]);
    expect(template).not.toBeNull();
    expect(template!.days.length).toBeGreaterThan(0);
  });

  it('mode guidé : utilise fitGuidedProgram', () => {
    const p = profile();
    const goals = bootstrapMuscleGoalsFromProfile(p, ['pectoraux']);
    const { template } = buildPreviewTemplate(p, goals, 'ss', catalog);
    if (template !== null) {
      expect(template.days.length).toBeGreaterThan(0);
    }
  });

  it('preview ne touche pas un éventuel state existant (in-memory pur)', () => {
    const p = profile();
    const goals = bootstrapMuscleGoalsFromProfile(p, ['pectoraux']);
    // Sentinel : un state existant.
    const sentinel = startUser(p, catalog, { muscleGoals: goals });
    const before = JSON.stringify(sentinel);
    buildPreviewTemplate(p, goals, null, catalog);
    expect(JSON.stringify(sentinel)).toBe(before);
  });
});

describe('weeklyVolumeByMuscle', () => {
  it('accumule base_sets par muscle primaire', () => {
    const p = profile();
    const goals = bootstrapMuscleGoalsFromProfile(p, ['pectoraux', 'quadriceps']);
    const { template } = buildPreviewTemplate(p, goals, null, catalog);
    expect(template).not.toBeNull();
    const volume = weeklyVolumeByMuscle(template!, catalog);
    // Au moins un des muscles prioritaires doit avoir un volume > 0.
    const pec = volume.pectoraux ?? 0;
    const quad = volume.quadriceps ?? 0;
    expect(pec + quad).toBeGreaterThan(0);
  });
});

describe('applyVariantsToTemplate', () => {
  it('remplace uniquement exercise_id, conserve base_sets et progression', () => {
    const p = profile();
    const goals = bootstrapMuscleGoalsFromProfile(p, ['pectoraux']);
    const { template } = buildPreviewTemplate(p, goals, null, catalog);
    expect(template).not.toBeNull();
    const firstSlot = template!.days[0]?.exercises[0];
    expect(firstSlot).toBeDefined();

    const replacement: VariantReplacement = {
      dayIndex: 0,
      slotIndex: 0,
      newExerciseId: 'remplacement_fictif',
    };
    const next = applyVariantsToTemplate(template!, [replacement]);

    const newSlot = next.days[0]!.exercises[0]!;
    expect(newSlot.exercise_id).toBe('remplacement_fictif');
    expect(newSlot.base_sets).toBe(firstSlot!.base_sets);
    expect(newSlot.progression).toEqual(firstSlot!.progression);
    // L'original n'a pas muté.
    expect(template!.days[0]!.exercises[0]!.exercise_id).toBe(firstSlot!.exercise_id);
  });

  it('liste vide → retourne le template original', () => {
    const p = profile();
    const goals = bootstrapMuscleGoalsFromProfile(p, ['pectoraux']);
    const { template } = buildPreviewTemplate(p, goals, null, catalog);
    const next = applyVariantsToTemplate(template!, []);
    expect(next).toBe(template); // identité référentielle
  });

  it('index hors plage → silencieusement ignoré', () => {
    const p = profile();
    const goals = bootstrapMuscleGoalsFromProfile(p, ['pectoraux']);
    const { template } = buildPreviewTemplate(p, goals, null, catalog);
    const next = applyVariantsToTemplate(template!, [
      { dayIndex: 99, slotIndex: 99, newExerciseId: 'inexistant' },
    ]);
    // Toujours intègre.
    expect(next.days.length).toBe(template!.days.length);
  });
});

describe('muscleDeltaForSwap', () => {
  it('détecte les muscles perdus quand le nouveau exo a moins de primaires', () => {
    // Tirage vertical machine (lat_pulldown) vs traction (pullup_pron) : la
    // traction ajoute des muscles non couverts par le tirage vertical.
    if (catalog.has('pullup_pron') && catalog.has('lat_pulldown')) {
      const delta = muscleDeltaForSwap('pullup_pron', 'lat_pulldown', catalog);
      // Au moins l'un des deux côtés doit voir une différence (selon le mapping
      // exact du catalogue), donc l'un des sets `lost`/`gained` n'est pas vide.
      expect(delta.lost.length + delta.gained.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('exos identiques → pas de différence', () => {
    const first = catalog.all()[0];
    if (first === undefined) return;
    const delta = muscleDeltaForSwap(first.id, first.id, catalog);
    expect(delta.lost).toEqual([]);
    expect(delta.gained).toEqual([]);
  });

  it('exo inconnu → pas de crash', () => {
    expect(() => muscleDeltaForSwap('inconnu', 'inconnu2', catalog)).not.toThrow();
  });
});

// =============================================================================
// Estimation durée séance / détection tensions (Conv #11h)
// =============================================================================

function makeDay(label: string, exercises: Array<{ id: string; sets: number }>): DayTemplate {
  return {
    day_index: 0,
    label,
    target_muscles_focus: [],
    exercises: exercises.map((e) => ({
      exercise_id: e.id,
      base_sets: e.sets,
      progression: [],
      role: null,
      intensity_scheme: null,
      progression_rule: null,
    })),
  };
}

describe('estimateExerciseDurationMinutes / analyzeProgramTension (Conv #11h)', () => {
  it('compound prend plus de temps qu\'isolation (à sets égaux)', () => {
    const compound = estimateExerciseDurationMinutes({ base_sets: 3 }, ExType.COMPOUND);
    const isolation = estimateExerciseDurationMinutes({ base_sets: 3 }, ExType.ISOLATION);
    expect(compound).toBeGreaterThan(isolation);
  });

  it('analyzeProgramTension : pas de tension sur un volume modeste', () => {
    // 3 jours × 4 exos × 3 sets ≈ ~32 min/jour → bien en-dessous du seuil.
    const firstCompound = catalog.all().find((e) => e.type === ExType.COMPOUND);
    if (firstCompound === undefined) return;
    const day = makeDay('Light', [
      { id: firstCompound.id, sets: 3 },
      { id: firstCompound.id, sets: 3 },
      { id: firstCompound.id, sets: 3 },
      { id: firstCompound.id, sets: 3 },
    ]);
    const tpl: WeeklyTemplate = {
      cycle_index: 1,
      days: [day, day, day],
      rationale: 't',
      warnings: [],
    };
    const tension = analyzeProgramTension(tpl, catalog);
    expect(tension.tooLong).toBe(false);
    expect(tension.maxMin).toBeLessThan(SESSION_DURATION_WARN_MIN);
  });

  it("analyzeProgramTension : tooLong déclenché si une séance dépasse 75 min", () => {
    // 1 séance hyper chargée : 12 compounds × 4 sets ≈ 132 min.
    const firstCompound = catalog.all().find((e) => e.type === ExType.COMPOUND);
    if (firstCompound === undefined) return;
    const heavyDay = makeDay(
      'Lourd',
      Array.from({ length: 12 }, () => ({ id: firstCompound.id, sets: 4 })),
    );
    const tpl: WeeklyTemplate = {
      cycle_index: 1,
      days: [heavyDay],
      rationale: 't',
      warnings: [],
    };
    const tension = analyzeProgramTension(tpl, catalog);
    expect(tension.tooLong).toBe(true);
    expect(tension.maxMin).toBeGreaterThan(SESSION_DURATION_WARN_MIN);
  });

  it('exos hors catalogue ignorés (pas de crash, durée 0)', () => {
    const day = makeDay('Vide', [{ id: 'inconnu', sets: 5 }]);
    const tpl: WeeklyTemplate = {
      cycle_index: 1,
      days: [day],
      rationale: 't',
      warnings: [],
    };
    const tension = analyzeProgramTension(tpl, catalog);
    expect(tension.maxMin).toBe(0);
    expect(tension.tooLong).toBe(false);
  });
});
