/**
 * Parity-check : compare les outputs du moteur TS aux outputs du moteur Python
 * sur 6 profils synthétiques (cf. recherche/09 §12.2 et §12.3).
 *
 * Tolérance : ±1 kg sur load_kg, ±0.1 RPE sur rpe_target.
 *
 * Usage :
 *   1. Générer les baselines Python : `python scripts/dump_parity_baseline.py`
 *      (depuis OneDrive/Coach OS/prototype/) → JSON dans `tools/parity-baseline/`.
 *   2. Lancer ce script TS : `npm run parity-check`.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { Catalog } from '../src/engine/catalog';
import { generateCyclePlan } from '../src/engine/cycle_planner';
import {
  bootstrapMuscleGoalsFromProfile,
  generateSession,
  startUser,
} from '../src/engine/engine';
import { UL_HELMS, fitGuidedProgram } from '../src/engine/guided_programs';
import {
  Level,
  MuscleObjective,
  MuscleStatus,
  Objective,
  Sex,
  makeMuscleGoal,
  makeProfile,
} from '../src/engine/models';
import type {
  MuscleGoal,
  Profile,
  SessionPlan,
  WeeklyTemplate,
} from '../src/engine/models';

const TOL_KG = 1.0;
const TOL_RPE = 0.1;

const EQUIP_FULL = new Set([
  'bb_oly', 'db', 'bench_flat', 'bench_incl', 'bench_decl', 'rack',
  'pull_bar', 'dip_bar', 'cable_low', 'cable_high', 'cable_double',
  'lat_pulldown', 'seated_row', 'chest_press', 'pec_deck', 'leg_press',
  'hack_squat', 'smith', 'leg_curl_lying', 'leg_curl_seated',
  'leg_extension', 'glute_machine', 'calf_standing', 'calf_seated',
  'lateral_machine', 'preacher', 'back_extension', 'ab_wheel',
  'assisted_pullup', 'reverse_hyper', 'glute_ham',
]);

interface ProfileSpec {
  id: string;
  profile: Profile;
  goals: Record<string, MuscleGoal>;
  guided?: 'ul_helms';
}

function mkP(input: {
  sex: Sex; age: number; level: Level; objective?: Objective;
  sessions: number; bodyweight: number;
}): Profile {
  return makeProfile({
    sex: input.sex,
    age: input.age,
    level: input.level,
    objective: input.objective ?? Objective.HYPERTROPHIE,
    sessions_per_week: input.sessions,
    bodyweight_kg: input.bodyweight,
    available_equip: EQUIP_FULL,
  });
}

function goal(m: string, obj: MuscleObjective, rank: number): MuscleGoal {
  return makeMuscleGoal({
    muscle: m,
    objective: obj,
    status: MuscleStatus.PRIORITAIRE,
    priority_rank: rank,
  });
}

function buildProfiles(): ProfileSpec[] {
  const p1 = mkP({ sex: Sex.HOMME, age: 30, level: Level.DEBUTANT, sessions: 3, bodyweight: 75 });
  const p2 = mkP({ sex: Sex.FEMME, age: 35, level: Level.INTERMEDIAIRE, sessions: 4, bodyweight: 62 });
  const p3 = mkP({ sex: Sex.HOMME, age: 40, level: Level.AVANCE, sessions: 6, bodyweight: 85 });
  const p4 = mkP({ sex: Sex.HOMME, age: 60, level: Level.INTERMEDIAIRE, sessions: 2, bodyweight: 78 });
  const p5 = mkP({ sex: Sex.FEMME, age: 25, level: Level.DEBUTANT, sessions: 3, bodyweight: 58 });
  const p6 = mkP({ sex: Sex.HOMME, age: 28, level: Level.INTERMEDIAIRE, sessions: 4, bodyweight: 80 });

  return [
    {
      id: 'p1', profile: p1,
      goals: bootstrapMuscleGoalsFromProfile(p1, [
        'pectoraux', 'dos_largeur', 'quadriceps', 'ischios', 'biceps',
      ]),
    },
    {
      id: 'p2', profile: p2,
      goals: {
        pectoraux: goal('pectoraux', MuscleObjective.FORCE, 1),
        dos_largeur: goal('dos_largeur', MuscleObjective.FORCE, 2),
        quadriceps: goal('quadriceps', MuscleObjective.HYPERTROPHIE, 3),
        fessiers: goal('fessiers', MuscleObjective.HYPERTROPHIE, 4),
      },
    },
    {
      id: 'p3', profile: p3,
      goals: bootstrapMuscleGoalsFromProfile(p3, [
        'pectoraux', 'dos_largeur', 'dos_epaisseur',
        'quadriceps', 'ischios', 'fessiers',
        'biceps', 'triceps', 'deltos_lateraux',
      ]),
    },
    {
      id: 'p4', profile: p4,
      goals: Object.fromEntries(
        ['pectoraux', 'dos_largeur', 'quadriceps', 'ischios', 'biceps', 'triceps']
          .map((m, i) => [m, goal(m, MuscleObjective.MAINTIEN, i + 1)]),
      ),
    },
    {
      id: 'p5', profile: p5,
      goals: {
        fessiers: goal('fessiers', MuscleObjective.HYPERTROPHIE, 1),
        quadriceps: goal('quadriceps', MuscleObjective.HYPERTROPHIE, 2),
        ischios: goal('ischios', MuscleObjective.HYPERTROPHIE, 3),
        pectoraux: goal('pectoraux', MuscleObjective.MAINTIEN, 4),
        dos_largeur: goal('dos_largeur', MuscleObjective.MAINTIEN, 5),
      },
    },
    { id: 'p6', profile: p6, goals: {}, guided: 'ul_helms' },
  ];
}

interface BaselineFile {
  profile_id: string;
  cycle_plan: WeeklyTemplate;
  session_w1d0: SessionPlan;
}

interface Diff {
  path: string;
  expected: unknown;
  actual: unknown;
}

function compareCyclePlan(a: WeeklyTemplate, b: WeeklyTemplate, prefix: string): Diff[] {
  const diffs: Diff[] = [];
  if (a.cycle_index !== b.cycle_index) {
    diffs.push({ path: `${prefix}.cycle_index`, expected: a.cycle_index, actual: b.cycle_index });
  }
  if (a.rationale !== b.rationale) {
    diffs.push({ path: `${prefix}.rationale`, expected: a.rationale, actual: b.rationale });
  }
  if (a.days.length !== b.days.length) {
    diffs.push({ path: `${prefix}.days.length`, expected: a.days.length, actual: b.days.length });
    return diffs;
  }
  for (let i = 0; i < a.days.length; i++) {
    const da = a.days[i]!;
    const db = b.days[i]!;
    if (da.label !== db.label) {
      diffs.push({ path: `${prefix}.days[${i}].label`, expected: da.label, actual: db.label });
    }
    if (da.exercises.length !== db.exercises.length) {
      diffs.push({
        path: `${prefix}.days[${i}].exercises.length`,
        expected: da.exercises.length, actual: db.exercises.length,
      });
      continue;
    }
    for (let j = 0; j < da.exercises.length; j++) {
      const ea = da.exercises[j]!;
      const eb = db.exercises[j]!;
      if (ea.exercise_id !== eb.exercise_id) {
        diffs.push({
          path: `${prefix}.days[${i}].exercises[${j}].exercise_id`,
          expected: ea.exercise_id, actual: eb.exercise_id,
        });
      }
      if (ea.base_sets !== eb.base_sets) {
        diffs.push({
          path: `${prefix}.days[${i}].exercises[${j}].base_sets`,
          expected: ea.base_sets, actual: eb.base_sets,
        });
      }
      if (JSON.stringify(ea.progression) !== JSON.stringify(eb.progression)) {
        diffs.push({
          path: `${prefix}.days[${i}].exercises[${j}].progression`,
          expected: ea.progression, actual: eb.progression,
        });
      }
    }
  }
  return diffs;
}

function compareSession(a: SessionPlan, b: SessionPlan, prefix: string): Diff[] {
  const diffs: Diff[] = [];
  if (a.label !== b.label) {
    diffs.push({ path: `${prefix}.label`, expected: a.label, actual: b.label });
  }
  if (a.items.length !== b.items.length) {
    diffs.push({
      path: `${prefix}.items.length`, expected: a.items.length, actual: b.items.length,
    });
    return diffs;
  }
  for (let i = 0; i < a.items.length; i++) {
    const ia = a.items[i]!;
    const ib = b.items[i]!;
    if (ia.exercise_id !== ib.exercise_id) {
      diffs.push({
        path: `${prefix}.items[${i}].exercise_id`,
        expected: ia.exercise_id, actual: ib.exercise_id,
      });
      continue;
    }
    if (ia.sets.length !== ib.sets.length) {
      diffs.push({
        path: `${prefix}.items[${i}].sets.length`,
        expected: ia.sets.length, actual: ib.sets.length,
      });
      continue;
    }
    for (let j = 0; j < ia.sets.length; j++) {
      const sa = ia.sets[j]!;
      const sb = ib.sets[j]!;
      if (sa.reps !== sb.reps) {
        diffs.push({
          path: `${prefix}.items[${i}].sets[${j}].reps`,
          expected: sa.reps, actual: sb.reps,
        });
      }
      if (Math.abs(sa.load_kg - sb.load_kg) > TOL_KG) {
        diffs.push({
          path: `${prefix}.items[${i}].sets[${j}].load_kg`,
          expected: sa.load_kg, actual: sb.load_kg,
        });
      }
      if (Math.abs(sa.rpe_target - sb.rpe_target) > TOL_RPE) {
        diffs.push({
          path: `${prefix}.items[${i}].sets[${j}].rpe_target`,
          expected: sa.rpe_target, actual: sb.rpe_target,
        });
      }
    }
  }
  return diffs;
}

function runProfile(spec: ProfileSpec, catalog: Catalog): SessionPlan {
  if (spec.guided === 'ul_helms') {
    const plafonds = {
      squat_bb_low: 100.0, bench_bb: 80.0,
      deadlift_conv: 130.0, bb_row: 70.0,
    };
    const { weekly, blocking } = fitGuidedProgram(
      UL_HELMS, spec.profile, spec.profile.available_equip, plafonds, catalog,
    );
    if (weekly === null) {
      throw new Error(`${spec.id}: fit blocked: ${blocking.join(', ')}`);
    }
    const state = startUser(spec.profile, catalog, {
      muscleGoals: Object.keys(spec.goals).length > 0 ? spec.goals : null,
    });
    state.current_cycle_plan = weekly;
    return generateSession(state, catalog, 0, '2026-01-05');
  }
  const state = startUser(spec.profile, catalog, { muscleGoals: spec.goals });
  state.current_cycle_plan = generateCyclePlan(state, catalog);
  return generateSession(state, catalog, 0, '2026-01-05');
}

function main(): void {
  const baselineDir = resolve(__dirname, 'parity-baseline');
  const catalog = new Catalog();
  const profiles = buildProfiles();

  let totalDiffs = 0;
  console.log('Parity-check : 6 profils, tolérance ±1 kg / ±0.1 RPE\n');
  for (const spec of profiles) {
    const baselinePath = resolve(baselineDir, `${spec.id}.json`);
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8')) as BaselineFile;

    let actualSession: SessionPlan;
    try {
      actualSession = runProfile(spec, catalog);
    } catch (e) {
      console.error(`  ${spec.id} : ERREUR au runtime : ${(e as Error).message}`);
      totalDiffs++;
      continue;
    }
    // On compare le state.current_cycle_plan via re-run, mais on n'a pas le state.
    // On dump-comparait via session_w1d0 + (à part) le cycle_plan : refait ici.
    let cyclePlanActual: WeeklyTemplate;
    if (spec.guided === 'ul_helms') {
      const plafonds = {
        squat_bb_low: 100.0, bench_bb: 80.0,
        deadlift_conv: 130.0, bb_row: 70.0,
      };
      cyclePlanActual = fitGuidedProgram(
        UL_HELMS, spec.profile, spec.profile.available_equip, plafonds, catalog,
      ).weekly!;
    } else {
      const s2 = startUser(spec.profile, catalog, { muscleGoals: spec.goals });
      cyclePlanActual = generateCyclePlan(s2, catalog);
    }

    const planDiffs = compareCyclePlan(baseline.cycle_plan, cyclePlanActual, `${spec.id}.cycle_plan`);
    const sessionDiffs = compareSession(baseline.session_w1d0, actualSession, `${spec.id}.session`);
    const diffs = [...planDiffs, ...sessionDiffs];

    if (diffs.length === 0) {
      console.log(`  ${spec.id} : OK (${cyclePlanActual.days.length} jours, ` +
        `${actualSession.items.length} exos, séance 1)`);
    } else {
      console.log(`  ${spec.id} : ${diffs.length} divergence(s)`);
      for (const d of diffs.slice(0, 10)) {
        console.log(`    - ${d.path}`);
        console.log(`        attendu : ${JSON.stringify(d.expected)}`);
        console.log(`        obtenu  : ${JSON.stringify(d.actual)}`);
      }
      if (diffs.length > 10) console.log(`    ... +${diffs.length - 10} autres`);
      totalDiffs += diffs.length;
    }
  }

  if (totalDiffs > 0) {
    console.log(`\nÉCHEC : ${totalDiffs} divergence(s) au total.`);
    process.exit(1);
  }
  console.log('\nSUCCÈS : 6 profils en parité avec le moteur Python.');
}

main();
