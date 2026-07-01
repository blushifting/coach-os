/**
 * Script JETABLE d'inspection : génère un programme via le vrai chemin
 * d'onboarding (préréglage par défaut) et imprime le squelette + le plan +
 * la distribution de volume par muscle. Pour audit de l'algo de remplissage.
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/inspect-generation.mts
 */

import { Catalog } from '../src/engine/catalog';
import { startUser } from '../src/engine/engine';
import { buildSkeleton } from '../src/engine/skeleton_builder';
import { autoGenerateCyclePlanV3 } from '../src/engine/cycle_planner';
import {
  DurationCategory,
  ExType,
  MuscleStatus,
  exercisePrimaires,
} from '../src/engine/models';
import { effectiveCycleTargetVolume } from '../src/engine/volume';
import {
  makeInitialDraft,
  buildProfile,
  buildMuscleGoals,
  computeBalanceSuggestions,
  deriveGlobalObjective,
  PRESET_DEFAULT_PRIORITIES,
  PRESET_DEFAULT_MAINTENANCE,
  type OnboardingDraft,
} from '../src/lib/onboarding-state';

const catalog = new Catalog();

function buildState(sessionsPerWeek: number) {
  const draft: OnboardingDraft = {
    ...makeInitialDraft(),
    priorities: [...PRESET_DEFAULT_PRIORITIES],
    maintenance: PRESET_DEFAULT_MAINTENANCE,
    sessionsPerWeek,
    durationCategory: DurationCategory.MEDIUM,
  };
  const suggestions = computeBalanceSuggestions(draft.priorities, draft.maintenance);
  const profile = buildProfile(draft, deriveGlobalObjective(draft));
  const muscleGoals = buildMuscleGoals(draft, suggestions);
  const state = startUser(profile, catalog, { muscleGoals, applyBalance: false });
  return state;
}

function statusTag(state: ReturnType<typeof buildState>, muscle: string): string {
  const g = state.muscle_goals[muscle];
  if (!g) return '—';
  if (g.status === MuscleStatus.PRIORITAIRE) return `PRIO(${g.objective})`;
  if (g.status === MuscleStatus.SUGGERE) return 'maintien';
  return 'non_couvert';
}

function run(sessionsPerWeek: number) {
  console.log('\n' + '='.repeat(78));
  console.log(`  ${sessionsPerWeek} SÉANCES / SEMAINE — préréglage par défaut, durée MEDIUM`);
  console.log('='.repeat(78));

  const state = buildState(sessionsPerWeek);

  // --- 1. Squelette (cases avant remplissage) ---
  const skeleton = buildSkeleton(state, DurationCategory.MEDIUM);
  console.log(`\nSPLIT CHOISI : ${skeleton.split_name}`);
  console.log('\n--- SQUELETTE (cases pattern × muscle) ---');
  skeleton.days.forEach((d) => {
    const cells = d.cells
      .map((c) => `${c.primary_muscle}/${c.pattern}[${c.role_hint === 'compound' ? 'C' : 'i'}]`)
      .join(', ');
    console.log(`  ${d.split_label.padEnd(9)} (${d.cells.length}) : ${cells || '(vide)'}`);
  });
  if (skeleton.warnings.length) {
    console.log('\n  ⚠ warnings squelette :');
    skeleton.warnings.forEach((w) => console.log('   - ' + w.replace(/\n/g, ' ')));
  }

  // --- 2. Plan final (exos + séries) ---
  const plan = autoGenerateCyclePlanV3(state, catalog, DurationCategory.MEDIUM);
  console.log('\n--- PLAN FINAL (exos + séries semaine 1) ---');
  const weekly: Record<string, number> = {};
  plan.days.forEach((d) => {
    console.log(`\n  ▸ ${d.label}`);
    d.exercises.forEach((pe) => {
      const ex = catalog.get(pe.exercise_id);
      const prim = exercisePrimaires(ex).join('+');
      const t = ex.type === ExType.COMPOUND ? 'C' : 'i';
      console.log(`      ${String(pe.base_sets).padStart(2)}×  ${pe.exercise_id.padEnd(26)} [${t}] → ${prim}`);
      for (const [m, coef] of Object.entries(ex.muscles)) {
        weekly[m] = (weekly[m] ?? 0) + pe.base_sets * coef;
      }
    });
  });

  // --- 3. Volume hebdo par muscle vs cible ---
  console.log('\n--- VOLUME HEBDO PAR MUSCLE (séries pondérées) vs cible ---');
  const muscles = Object.keys(state.muscle_goals);
  muscles
    .map((m) => ({ m, got: weekly[m] ?? 0, tgt: effectiveCycleTargetVolume(state, m) }))
    .sort((a, b) => b.got - a.got)
    .forEach(({ m, got, tgt }) => {
      const flag = tgt > 0 && got < tgt - 0.5 ? ' ⟵ SOUS cible' : tgt === 0 && got > 3 ? ' ⟵ incident élevé (non prio)' : '';
      console.log(
        `  ${m.padEnd(20)} ${statusTag(state, m).padEnd(16)} réalisé ${got.toFixed(1).padStart(5)}  | cible ${tgt.toFixed(1).padStart(5)}${flag}`,
      );
    });
}

run(3);
run(4);
