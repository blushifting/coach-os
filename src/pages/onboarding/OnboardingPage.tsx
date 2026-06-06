/**
 * Orchestrateur du wizard d'onboarding (refonte Conv #22.2).
 *
 * Flow unifié 5 étapes pour les deux modes :
 *   1. Profil (sexe / âge / poids)
 *   2. Muscles prioritaires + ranking
 *   3. Équilibre R1-R4 (suggestions pré-cochées)
 *   4. Programme (nb séances + durée max + préférence équipement +
 *      choix custom / programme guidé)
 *   5. Récap : programme déjà construit (custom = squelette V2 auto-fill
 *      basé sur la préférence ; guidé = fitGuidedProgram). L'user peut
 *      swap des exos via la VariantPickerSheet existante.
 *
 * En mode `restart`, on saute Step1 (4 étapes restantes affichées comme
 * 1/4..4/4 dans la barre).
 *
 * Barre de progression continue, longueur fixe.
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
import { Step1Profile } from './Step1Profile';
import { Step2Muscles } from './Step2Muscles';
import { Step3Balance } from './Step3Balance';
import { Step4Program } from './Step4Program';
import { Step5Preview } from './Step5Preview';

const LAST_STEP = 5;

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
      const suggestions = computeBalanceSuggestions(draft.priorities);
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
      const suggestions = computeBalanceSuggestions(draft.priorities);
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
        accepted: [...draft.acceptedSuggestions].sort(),
        sessions: draft.sessionsPerWeek,
        duration: draft.durationCategory,
        equipPref: draft.equipmentPreference,
        programme: draft.programmeId,
      }),
    [
      draft.priorities,
      draft.acceptedSuggestions,
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

  function goNext() {
    setError(null);
    if (step === 2 && !canAdvanceFromStep2) {
      setError('Sélectionne au moins un muscle ou utilise le préset par défaut.');
      return;
    }
    if (step === 2) {
      if (!isRestart) {
        const suggestions = computeBalanceSuggestions(draft.priorities);
        setDraft((d) => ({
          ...d,
          acceptedSuggestions: new Set(suggestions.map((s) => s.muscle)),
        }));
      }
    }
    if (step === 4) {
      setVariantReplacements([]);
    }
    if (step >= LAST_STEP) return;
    setStep((s) => s + 1);
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
      const suggestions = computeBalanceSuggestions(draft.priorities);
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
  // Barre de progression : même longueur pour les deux modes. En restart
  // on saute Step1 donc on décale d'un cran.
  const stepUiIndex = step - (isRestart ? 1 : 0);
  const totalUi = LAST_STEP - (isRestart ? 1 : 0);

  const stepContent = useMemo(() => {
    switch (step) {
      case 1:
        return <Step1Profile draft={draft} onChange={patchDraft} />;
      case 2:
        return <Step2Muscles draft={draft} onChange={patchDraft} />;
      case 3:
        return <Step3Balance draft={draft} onChange={patchDraft} />;
      case 4:
        return <Step4Program draft={draft} onChange={patchDraft} />;
      case 5:
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
        <ProgressBar current={stepUiIndex} total={totalUi} />
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
    </div>
  );
}

/**
 * Conv #22 — barre de progression continue, longueur fixe.
 */
function ProgressBar({
  current,
  total,
}: {
  readonly current: number;
  readonly total: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
  return (
    <div
      className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-anthracite-800"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      data-testid="onboarding-progress"
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-sang-500 transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
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
