/**
 * Orchestrateur du wizard d'onboarding (refonte Conv #28).
 *
 * Flow unifié 4 étapes pour les deux modes :
 *   1. Profil (sexe / âge / poids)
 *   2. Muscles + objectif par muscle (pinceau) — l'ancienne étape Équilibre
 *      R1-R4 est remplacée par une popin au passage à l'étape suivante :
 *      « Ajouter ces muscles » (défaut) / « Continuer sans » (refusable).
 *   3. Programme (nb séances + durée max + préférence équipement +
 *      sur-mesure mis en avant / programmes guidés en tableau)
 *   4. Récap : programme déjà construit (custom = squelette V2 auto-fill
 *      basé sur la préférence ; guidé = fitGuidedProgram). L'user peut
 *      swap des exos via la VariantPickerSheet existante.
 *
 * En mode `restart`, on saute Step1 (3 étapes affichées dans le stepper).
 *
 * Stepper numéroté à étapes nommées (Conv #28).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/Button';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { ALL_GUIDED_PROGRAMS } from '@/engine/guided_programs';
import { SuggestedAction } from '@/engine/models';
import {
  addFavoriteForPattern,
  applyVariantReplacements,
  bootstrap,
  endOfCycle,
  generateInitialCyclePlan,
  generateInitialCyclePlanFromSkeleton,
  startUser,
  updateProfile,
} from '@/hooks/useEngine';
import { enterDemoMode } from '@/lib/demo';
import { resetDemoDismissals } from '@/components/DemoMode';
import {
  buildMuscleGoals,
  buildProfile,
  computeBalanceSuggestions,
  deriveGlobalObjective,
  draftFromUserState,
  isEmptySelection,
  makeInitialDraft,
  type OnboardingDraft,
} from '@/lib/onboarding-state';
import {
  buildPreviewTemplate,
  type VariantReplacement,
} from '@/lib/onboarding-preview';
import {
  applyChosenVariantsToSkeleton,
  autoFillSkeletonDefaults,
  buildOnboardingSkeleton,
  chosenVariantsFromSkeleton,
  isSkeletonFullyFilled,
} from '@/lib/skeleton-onboarding';
import { useCoachOsStore } from '@/store';
import type { MuscleGoal } from '@/engine/models';
import { explainSuggestion, muscleLabel } from '@/lib/balance-reasons';
import { Step1Profile } from './Step1Profile';
import { Step2Muscles } from './Step2Muscles';
import { Step4Program } from './Step4Program';
import { Step5Preview } from './Step5Preview';

const LAST_STEP = 4;

/** Étapes nommées du stepper (Conv #28). Index = step - 1. */
const STEP_LABELS = ['Profil', 'Muscles', 'Programme', 'Récap'] as const;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const catalog = useCoachOsStore((s) => s.catalog);
  const userState = useCoachOsStore((s) => s.userState);
  const [search] = useSearchParams();
  const isRestart = search.get('restart') === '1' && userState !== null;

  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    isRestart && userState !== null
      ? draftFromUserState(userState)
      : makeInitialDraft(),
  );

  const initialStep = isRestart ? 2 : 1;
  const isCustom = draft.programmeId === null;

  const [step, setStep] = useState<number>(initialStep);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [variantReplacements, setVariantReplacements] = useState<
    ReadonlyArray<VariantReplacement>
  >([]);
  // Conv #28 — popin d'équilibre R1-R4 au « Suivant » de l'étape 2.
  // `balancePopin` = suggestions affichées ; `declinedBalanceKey` mémorise la
  // sélection pour laquelle l'user a refusé (pas de re-popin tant qu'elle ne
  // change pas).
  const [balancePopin, setBalancePopin] = useState<readonly MuscleGoal[] | null>(
    null,
  );
  const [declinedBalanceKey, setDeclinedBalanceKey] = useState<string | null>(
    null,
  );

  useEffect(() => {
    void bootstrap();
  }, []);

  const mainRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (mainRef.current !== null) mainRef.current.scrollTop = 0;
  }, [step]);

  // Conv #22.2 — Squelette + chosenVariants auto-fillés au passage en
  // Step5 (récap) en mode custom. Le récap montre directement le résultat ;
  // l'user modifie via VariantPickerSheet du Step5Preview.
  const skeletonResult = useMemo(() => {
    if (!isCustom || catalog === null) return null;
    if (step < LAST_STEP) return null;
    try {
      const globalObjective = deriveGlobalObjective(draft);
      const profile = buildProfile(draft, globalObjective);
      const suggestions = computeBalanceSuggestions(
        draft.priorities,
        draft.maintenance,
      );
      const muscleGoals = buildMuscleGoals(draft, suggestions);
      return buildOnboardingSkeleton(
        profile,
        muscleGoals,
        draft.durationCategory,
        catalog,
      );
    } catch {
      return null;
    }
  }, [isCustom, catalog, step, draft]);

  const skeleton = skeletonResult?.skeleton ?? null;
  const tmpState = skeletonResult?.tmpState ?? null;

  // Auto-fill du squelette dès qu'on a un skeleton + catalog.
  // Utilise la préférence équipement du draft pour orienter le 1er pick.
  useEffect(() => {
    if (skeleton === null || catalog === null) return;
    if (Object.keys(draft.chosenVariantsPerCell).length > 0) return;
    const seeded = autoFillSkeletonDefaults(
      skeleton,
      catalog,
      userState?.favorite_exercise_per_pattern ?? {},
      draft.equipmentPreference,
    );
    const filled = chosenVariantsFromSkeleton(seeded);
    if (Object.keys(filled).length > 0) {
      setDraft((d) => ({ ...d, chosenVariantsPerCell: filled }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skeleton, catalog]);

  const preview = useMemo(() => {
    if (catalog === null) {
      return { template: null, blocking: [] as readonly string[] };
    }
    if (step < LAST_STEP) {
      return { template: null, blocking: [] as readonly string[] };
    }
    if (isCustom) {
      if (skeleton === null || tmpState === null) {
        return { template: null, blocking: ['Squelette indisponible'] };
      }
      const filled = applyChosenVariantsToSkeleton(
        skeleton,
        draft.chosenVariantsPerCell,
      );
      if (!isSkeletonFullyFilled(filled)) {
        // Auto-fill silencieux si jamais quelques cases sont vides
        // (cas pathologique : changement de prios en arrière puis retour).
        const seeded = autoFillSkeletonDefaults(
          filled,
          catalog,
          userState?.favorite_exercise_per_pattern ?? {},
          draft.equipmentPreference,
        );
        try {
          const template = generateCyclePlanV2(seeded, tmpState, catalog);
          return { template, blocking: [] };
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Impossible de générer l\'aperçu.';
          return { template: null, blocking: [msg] };
        }
      }
      try {
        const template = generateCyclePlanV2(filled, tmpState, catalog);
        return { template, blocking: [] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Impossible de générer l\'aperçu.';
        return { template: null, blocking: [msg] };
      }
    }
    // Mode guidé legacy.
    try {
      const guided =
        draft.programmeId !== null
          ? (ALL_GUIDED_PROGRAMS.find((p) => p.id === draft.programmeId) ?? null)
          : null;
      const objectiveOverride = guided?.objectifs_principaux[0];
      const globalObjective = deriveGlobalObjective(draft, objectiveOverride);
      const profile = buildProfile(draft, globalObjective);
      const suggestions = computeBalanceSuggestions(
        draft.priorities,
        draft.maintenance,
      );
      const muscleGoals = buildMuscleGoals(draft, suggestions);
      return buildPreviewTemplate(profile, muscleGoals, draft.programmeId, catalog);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Impossible de générer l\'aperçu.';
      return { template: null, blocking: [msg] };
    }
  }, [step, isCustom, skeleton, tmpState, draft, catalog, userState]);

  // Conv #22 — Invalide chosenVariantsPerCell dès que la grille du
  // squelette change (prios, accepted suggestions, sessions, durée,
  // préférence équipement, programmeId).
  const inputsKey = useMemo(
    () =>
      JSON.stringify({
        prios: draft.priorities.map((p) => `${p.muscle}:${p.objective}`),
        maintenance: [...draft.maintenance].sort(),
        sessions: draft.sessionsPerWeek,
        duration: draft.durationCategory,
        equipPref: draft.equipmentPreference,
        programme: draft.programmeId,
      }),
    [
      draft.priorities,
      draft.maintenance,
      draft.sessionsPerWeek,
      draft.durationCategory,
      draft.equipmentPreference,
      draft.programmeId,
    ],
  );
  const prevInputsKey = useRef(inputsKey);
  useEffect(() => {
    if (prevInputsKey.current !== inputsKey) {
      prevInputsKey.current = inputsKey;
      if (Object.keys(draft.chosenVariantsPerCell).length > 0) {
        setDraft((d) => ({ ...d, chosenVariantsPerCell: {} }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputsKey]);

  const canAdvanceFromStep2 = !isEmptySelection(draft);

  function patchDraft(patch: Partial<OnboardingDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function goPrev() {
    setError(null);
    if (step === initialStep) return;
    setStep((s) => s - 1);
  }

  // Clé de la sélection muscles courante — sert à ne pas re-proposer la
  // popin d'équilibre tant que l'user n'a rien changé après un refus.
  const balanceKey = useMemo(
    () =>
      JSON.stringify({
        prios: draft.priorities.map((p) => `${p.muscle}:${p.objective}`),
        maintenance: [...draft.maintenance].sort(),
      }),
    [draft.priorities, draft.maintenance],
  );

  function goNext() {
    setError(null);
    if (step === 2 && !canAdvanceFromStep2) {
      setError(
        'Sélectionne au moins un muscle à développer (Hypertrophie, Force ou Endurance), ou utilise la sélection par défaut.',
      );
      return;
    }
    // Conv #28 — popin d'équilibre : si R1-R4 détecte des trous et que
    // l'user n'a pas déjà refusé pour cette sélection exacte, on propose
    // d'ajouter les muscles manquants en maintien avant d'avancer.
    if (step === 2 && declinedBalanceKey !== balanceKey) {
      const suggestions = computeBalanceSuggestions(
        draft.priorities,
        draft.maintenance,
      );
      if (suggestions.length > 0) {
        setBalancePopin(suggestions);
        return;
      }
    }
    advance();
  }

  function advance() {
    if (step === 3) {
      setVariantReplacements([]);
    }
    if (step >= LAST_STEP) return;
    setStep((s) => s + 1);
  }

  function acceptBalanceSuggestions() {
    if (balancePopin === null) return;
    const maintenance = new Set(draft.maintenance);
    for (const sg of balancePopin) maintenance.add(sg.muscle);
    setDraft((d) => ({ ...d, maintenance }));
    setBalancePopin(null);
    advance();
  }

  function declineBalanceSuggestions() {
    setDeclinedBalanceKey(balanceKey);
    setBalancePopin(null);
    advance();
  }

  function handleCancelRestart() {
    if (!isRestart) return;
    setConfirmCancel(true);
  }
  function confirmCancelRestart() {
    setConfirmCancel(false);
    navigate('/profil', { replace: true });
  }

  async function finalize() {
    setError(null);
    if (isEmptySelection(draft)) {
      setError('Sélectionne au moins un muscle.');
      setStep(2);
      return;
    }
    setSubmitting(true);
    try {
      const guided =
        draft.programmeId !== null
          ? (ALL_GUIDED_PROGRAMS.find((p) => p.id === draft.programmeId) ?? null)
          : null;
      const objectiveOverride = guided?.objectifs_principaux[0];
      const globalObjective = deriveGlobalObjective(draft, objectiveOverride);
      const profile = buildProfile(draft, globalObjective);
      const suggestions = computeBalanceSuggestions(
        draft.priorities,
        draft.maintenance,
      );
      const muscleGoals = buildMuscleGoals(draft, suggestions);

      if (isRestart && userState !== null) {
        await updateProfile(profile);
        const action =
          draft.programmeId !== userState.active_guided_program_id
            ? SuggestedAction.CHANGER_PROGRAMME
            : SuggestedAction.AJUSTER_OBJECTIFS;
        await endOfCycle({
          action,
          nextProgrammeId: draft.programmeId,
          newMuscleGoals: muscleGoals,
        });
        if (isCustom && skeleton !== null) {
          const filled = applyChosenVariantsToSkeleton(
            skeleton,
            draft.chosenVariantsPerCell,
          );
          const fullyFilled = isSkeletonFullyFilled(filled)
            ? filled
            : autoFillSkeletonDefaults(
                filled,
                catalog!,
                userState.favorite_exercise_per_pattern ?? {},
                draft.equipmentPreference,
              );
          const sCurrent = useCoachOsStore.getState().userState;
          if (sCurrent !== null) {
            sCurrent.current_cycle_plan = null;
            useCoachOsStore.setState({ userState: sCurrent });
            await generateInitialCyclePlanFromSkeleton(fullyFilled);
          }
          await persistFavoritesFromSkeleton(fullyFilled);
        }
        if (variantReplacements.length > 0) {
          await applyVariantReplacements(variantReplacements);
        }
        navigate('/programme', { replace: true });
        return;
      }

      await startUser({
        profile,
        muscleGoals,
        applyBalance: false,
        programmeId: draft.programmeId,
      });
      if (isCustom && skeleton !== null) {
        const filled = applyChosenVariantsToSkeleton(
          skeleton,
          draft.chosenVariantsPerCell,
        );
        const fullyFilled = isSkeletonFullyFilled(filled)
          ? filled
          : autoFillSkeletonDefaults(
              filled,
              catalog!,
              {},
              draft.equipmentPreference,
            );
        await generateInitialCyclePlanFromSkeleton(fullyFilled);
        await persistFavoritesFromSkeleton(fullyFilled);
      } else {
        await generateInitialCyclePlan();
      }
      if (variantReplacements.length > 0) {
        await applyVariantReplacements(variantReplacements);
      }
      navigate('/programme', { replace: true });
      try {
        if (localStorage.getItem('coach-os.skip-auto-demo') !== '1') {
          resetDemoDismissals();
          void enterDemoMode().catch(() => {});
        }
      } catch {
        /* LS indispo */
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Quelque chose s\'est mal passé. Réessaie.';
      setError(msg);
      setSubmitting(false);
    }
  }

  async function persistFavoritesFromSkeleton(
    sk: ReturnType<typeof applyChosenVariantsToSkeleton>,
  ) {
    if (catalog === null) return;
    const seen = new Set<string>();
    for (const day of sk.days) {
      for (const cell of day.cells) {
        if (cell.chosen_exercise_id === null) continue;
        if (seen.has(cell.pattern)) continue;
        seen.add(cell.pattern);
        try {
          await addFavoriteForPattern(cell.pattern, cell.chosen_exercise_id);
        } catch {
          /* best-effort */
        }
      }
    }
  }

  const isLastStep = step === LAST_STEP;
  // Stepper : en restart on saute Step1, donc 3 étapes affichées.
  const stepperLabels = isRestart ? STEP_LABELS.slice(1) : STEP_LABELS;
  const stepperCurrent = step - (isRestart ? 2 : 1); // index 0-based

  const stepContent = useMemo(() => {
    switch (step) {
      case 1:
        return <Step1Profile draft={draft} onChange={patchDraft} />;
      case 2:
        return <Step2Muscles draft={draft} onChange={patchDraft} />;
      case 3:
        return <Step4Program draft={draft} onChange={patchDraft} />;
      case 4:
        return (
          <Step5Preview
            template={preview.template}
            blocking={preview.blocking}
            catalog={catalog}
            equipment={draft.equipment}
            replacements={variantReplacements}
            onChangeReplacements={setVariantReplacements}
            gymBrand={draft.gymBrand}
          />
        );
      default:
        return null;
    }
  }, [step, draft, preview, catalog, variantReplacements]);

  return (
    <div
      className="flex h-full flex-1 flex-col bg-anthracite-950"
      data-testid="onboarding-page"
      data-step={step}
      data-restart={isRestart ? '1' : '0'}
    >
      <header
        className="flex items-center gap-3 border-b border-anthracite-800 pl-12 pr-3 py-3"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <StepperBar labels={stepperLabels} current={stepperCurrent} />
        {isRestart && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancelRestart}
            disabled={submitting}
            data-testid="btn-cancel-restart"
          >
            Annuler
          </Button>
        )}
      </header>

      <main ref={mainRef} className="flex-1 overflow-y-auto pb-32">
        {stepContent}
      </main>

      {error ? (
        <div
          role="alert"
          data-testid="onboarding-error"
          className="mx-4 mb-2 rounded-xl border border-sang-700 bg-sang-900/30 px-3 py-2 text-sm text-sang-500"
        >
          {error}
        </div>
      ) : null}

      <footer
        className="border-t border-anthracite-800 bg-anthracite-950 p-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
      >
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={goPrev}
            disabled={step === initialStep || submitting}
            data-testid="btn-prev"
          >
            <ChevronLeft />
            Précédent
          </Button>
          {isLastStep ? (
            <Button
              variant="primary"
              onClick={finalize}
              disabled={submitting || preview.template === null}
              fullWidth
              data-testid="btn-finish"
            >
              {submitting
                ? isRestart
                  ? 'Redémarrage…'
                  : 'Création…'
                : isRestart
                  ? 'Démarrer le nouveau Cycle'
                  : 'Démarrer mon programme'}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={goNext}
              disabled={submitting}
              fullWidth
              data-testid="btn-next"
            >
              Suivant
              <ChevronRight />
            </Button>
          )}
        </div>
      </footer>

      {confirmCancel && (
        <CancelRestartDialog
          onConfirm={confirmCancelRestart}
          onCancel={() => setConfirmCancel(false)}
        />
      )}

      {balancePopin !== null && (
        <BalanceDialog
          suggestions={balancePopin}
          priorities={draft.priorities}
          onAccept={acceptBalanceSuggestions}
          onDecline={declineBalanceSuggestions}
        />
      )}
    </div>
  );
}

/**
 * Conv #28 — stepper numéroté à étapes nommées (remplace la barre continue).
 */
function StepperBar({
  labels,
  current,
}: {
  readonly labels: readonly string[];
  readonly current: number;
}) {
  return (
    <ol
      className="flex flex-1 items-center gap-1"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={labels.length}
      aria-valuenow={current + 1}
      data-testid="onboarding-progress"
    >
      {labels.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-1">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
              <span
                aria-hidden="true"
                className={cnStep(
                  'flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums transition',
                  done && 'border-sang-600 bg-sang-600 text-white',
                  active && 'border-sang-500 bg-sang-900/40 text-white',
                  !done && !active && 'border-anthracite-600 text-anthracite-400',
                )}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={cnStep(
                  'max-w-full truncate text-[9px] leading-none',
                  active ? 'text-white' : 'text-anthracite-400',
                )}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <span
                aria-hidden="true"
                className={cnStep(
                  'mb-3 h-px w-3 shrink-0',
                  i < current ? 'bg-sang-600' : 'bg-anthracite-700',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Mini-helper local : concatène les classes truthy (évite d'importer cn). */
function cnStep(...classes: ReadonlyArray<string | false>): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Conv #28 — popin d'équilibre R1-R4 (remplace l'ancienne étape 3).
 * Le choix par défaut suggéré = ajouter les muscles en maintien ;
 * « Continuer sans » reste possible (refusable).
 */
function BalanceDialog({
  suggestions,
  priorities,
  onAccept,
  onDecline,
}: {
  readonly suggestions: readonly MuscleGoal[];
  readonly priorities: OnboardingDraft['priorities'];
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Équilibre musculaire"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      data-testid="balance-dialog"
    >
      <div className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-anthracite-700 bg-anthracite-900 p-5">
        <h3 className="text-lg font-semibold text-white">
          Un peu d'équilibre ?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-anthracite-300">
          Avec ta sélection, ces muscles resteraient sans volume. Kotsh te
          conseille de les garder en{' '}
          <strong className="text-white">maintien</strong> (un peu de volume
          pour ne pas perdre) — un déséquilibre prolongé augmente le risque de
          blessure et de mauvaise posture.
        </p>
        <ul className="mt-3 flex flex-col gap-2" data-testid="balance-suggestions">
          {suggestions.map((sg) => {
            const reason = explainSuggestion(sg.muscle, priorities);
            return (
              <li
                key={sg.muscle}
                data-testid={`balance-suggestion-${sg.muscle}`}
                className="rounded-xl border border-anthracite-700 bg-anthracite-950/60 px-3 py-2"
              >
                <span className="text-sm font-medium text-white">
                  {muscleLabel(sg.muscle)}
                </span>
                <p className="mt-0.5 text-xs text-anthracite-300">{reason.text}</p>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            variant="primary"
            fullWidth
            onClick={onAccept}
            data-testid="balance-accept"
          >
            Ajouter ces muscles
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={onDecline}
            data-testid="balance-decline"
          >
            Continuer sans
          </Button>
        </div>
      </div>
    </div>
  );
}

function CancelRestartDialog({
  onConfirm,
  onCancel,
}: {
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Annuler la modification ?"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={onCancel}
      data-testid="cancel-restart-dialog"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-anthracite-700 bg-anthracite-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white">Abandonner la modification ?</h3>
        <p className="mt-2 text-sm leading-relaxed text-anthracite-300">
          Tes choix ne seront pas enregistrés. Ton cycle en cours reste actif
          tel quel.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" fullWidth onClick={onCancel} data-testid="cancel-restart-no">
            Continuer la modification
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={onConfirm}
            data-testid="cancel-restart-yes"
          >
            Abandonner
          </Button>
        </div>
      </div>
    </div>
  );
}

// Conv #22.2 — Import direct (au lieu de require()) pour le preview.
import { generateCyclePlanV2 } from '@/engine/cycle_planner';
