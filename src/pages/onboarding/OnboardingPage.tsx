/**
 * Orchestrateur du wizard d'onboarding (Conv #4b + refonte Conv #22).
 *
 * Routing dynamique selon le mode choisi à l'étape 4 :
 *  - Mode **custom co-construit** (Conv #22) : 7 étapes
 *    1. Profil  2. Muscles  3. Équilibre  4. Programme (+ durée max)
 *    5. Squelette (lecture seule)  6. Variantes (remplissage cases)
 *    7. Récap final
 *  - Mode **programme guidé** : 5 étapes (path legacy intact)
 *    1. Profil  2. Muscles  3. Équilibre  4. Programme  5. Récap
 *
 * En mode `restart`, on skip Step1 dans les deux cas.
 *
 * Barre de progression sobre, sans noms d'étapes (Conv #22 décision UX).
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
  buildOnboardingSkeleton,
  isSkeletonFullyFilled,
} from '@/lib/skeleton-onboarding';
import { generateCyclePlanV2 } from '@/engine/cycle_planner';
import { useCoachOsStore } from '@/store';
import { Step1Profile } from './Step1Profile';
import { Step2Muscles } from './Step2Muscles';
import { Step3Balance } from './Step3Balance';
import { Step4Program } from './Step4Program';
import { Step5Skeleton } from './Step5Skeleton';
import { Step6Variants } from './Step6Variants';
import { Step5Preview } from './Step5Preview';

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

  // Étapes en absolu (1..7 max). En mode guidé on saute 5+6 ; en restart on
  // skip 1. Le "step UI" affiché est calculé dynamiquement.
  const isCustom = draft.programmeId === null;
  const initialStep = isRestart ? 2 : 1;
  const lastStep = isCustom ? 7 : 5;

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

  // Scroll en haut à chaque changement d'étape.
  const mainRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (mainRef.current !== null) mainRef.current.scrollTop = 0;
  }, [step]);

  // Skeleton calculé à la volée à partir de l'étape 5 (custom seulement).
  // tmpState mémorisé pour la finalize.
  const skeletonResult = useMemo(() => {
    if (!isCustom || catalog === null) return null;
    if (step < 5) return null;
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

  // Preview pour le récap final (étape 7 custom / étape 5 guidé). En mode
  // custom : on utilise le skeleton rempli via generateCyclePlanV2. En guidé :
  // path legacy via buildPreviewTemplate.
  const preview = useMemo(() => {
    if (catalog === null) {
      return { template: null, blocking: [] as readonly string[] };
    }
    const isFinalStep = step === lastStep;
    if (!isFinalStep) {
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
        return { template: null, blocking: ['Toutes les cases ne sont pas remplies'] };
      }
      try {
        const template = generateCyclePlanV2(filled, tmpState, catalog);
        return { template, blocking: [] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur preview';
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
      const msg = e instanceof Error ? e.message : 'Erreur preview';
      return { template: null, blocking: [msg] };
    }
  }, [step, lastStep, isCustom, skeleton, tmpState, draft, catalog]);

  const canAdvanceFromStep2 = !isEmptySelection(draft);
  const canAdvanceFromStep6 =
    !isCustom ||
    (skeleton !== null &&
      isSkeletonFullyFilled(
        applyChosenVariantsToSkeleton(skeleton, draft.chosenVariantsPerCell),
      ));

  function patchDraft(patch: Partial<OnboardingDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function goPrev() {
    setError(null);
    if (step === initialStep) return;
    // Custom : 7→6→5→4. Guidé : 5→4. Steps 1-4 communs.
    if (step === 7 && !isCustom) {
      setStep(4);
      return;
    }
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
      // Passage 4 → suivant : reset variantes legacy + chosenVariantsPerCell
      // si on change le mode programme.
      setVariantReplacements([]);
    }
    if (step === 6 && !canAdvanceFromStep6) {
      setError('Termine de choisir tes variantes pour continuer.');
      return;
    }
    if (step >= lastStep) return;
    // Custom : 4→5. Guidé : 4→5 (qui est le récap, lastStep=5).
    if (step === 4 && !isCustom) {
      setStep(5); // lastStep = 5 en guidé → bouton Valider apparait
      return;
    }
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
          // En custom restart, on remplace le plan par celui issu du squelette
          // co-construit. endOfCycle a déjà régénéré via path legacy/V2, mais
          // si l'user a personnalisé ses variantes on doit appliquer ses choix.
          const filled = applyChosenVariantsToSkeleton(
            skeleton,
            draft.chosenVariantsPerCell,
          );
          if (isSkeletonFullyFilled(filled)) {
            // current_cycle_plan a déjà été posé par endOfCycle. On force le
            // remplacement via generateInitialCyclePlanFromSkeleton après un
            // bypass : reset puis re-pose.
            const sCurrent = useCoachOsStore.getState().userState;
            if (sCurrent !== null) {
              sCurrent.current_cycle_plan = null;
              useCoachOsStore.setState({ userState: sCurrent });
              await generateInitialCyclePlanFromSkeleton(filled);
            }
            await persistFavoritesFromSkeleton(filled);
          }
        }
        if (variantReplacements.length > 0) {
          await applyVariantReplacements(variantReplacements);
        }
        navigate('/programme', { replace: true });
        return;
      }

      // Onboarding initial.
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
        if (isSkeletonFullyFilled(filled)) {
          await generateInitialCyclePlanFromSkeleton(filled);
          await persistFavoritesFromSkeleton(filled);
        } else {
          // Fallback : auto-fill (cohérent avec le path V2 standard).
          await generateInitialCyclePlan();
        }
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
      const msg = e instanceof Error ? e.message : 'Erreur inattendue';
      setError(msg);
      setSubmitting(false);
    }
  }

  // Conv #22 — mémorise comme favori l'exo choisi pour chaque pattern dans
  // le squelette (lookup au catalog pour récupérer le pattern de chaque exo).
  async function persistFavoritesFromSkeleton(
    sk: ReturnType<typeof applyChosenVariantsToSkeleton>,
  ) {
    if (catalog === null) return;
    // 1 fav par pattern : le 1er rencontré gagne. Cohérent avec
    // candidatesForCell qui pousse les favoris en tête.
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

  const isLastStep = step === lastStep;

  // Index UI 1-based pour la barre de progression sobre.
  //  - Restart : on a sauté Step1, donc on décale tout d'un cran (step=2 → UI 1).
  //  - Custom = 7 steps absolus, Guidé = 5 steps absolus. lastStep règle ça.
  const stepUiIndex = step - (isRestart ? 1 : 0);
  const totalUi = lastStep - (isRestart ? 1 : 0);

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
        if (isCustom) {
          return <Step5Skeleton skeleton={skeleton} />;
        }
        return (
          <Step5Preview
            template={preview.template}
            blocking={preview.blocking}
            catalog={catalog}
            equipment={draft.equipment}
            replacements={variantReplacements}
            onChangeReplacements={setVariantReplacements}
          />
        );
      case 6:
        return (
          <Step6Variants
            skeleton={skeleton}
            catalog={catalog}
            chosenVariantsPerCell={draft.chosenVariantsPerCell}
            favorites={userState?.favorite_exercise_per_pattern ?? {}}
            onChange={(next) => patchDraft({ chosenVariantsPerCell: next })}
          />
        );
      case 7:
        return (
          <Step5Preview
            template={preview.template}
            blocking={preview.blocking}
            catalog={catalog}
            equipment={draft.equipment}
            replacements={variantReplacements}
            onChangeReplacements={setVariantReplacements}
          />
        );
      default:
        return null;
    }
  }, [step, draft, preview, catalog, variantReplacements, isCustom, skeleton, userState]);

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
                  ? 'Démarrer le nouveau cycle'
                  : 'Valider et continuer'}
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
 * Conv #22 — barre de progression sobre (segments discrets sans noms).
 */
function ProgressBar({
  current,
  total,
}: {
  readonly current: number;
  readonly total: number;
}) {
  return (
    <div
      className="flex flex-1 items-center gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      data-testid="onboarding-progress"
    >
      {Array.from({ length: total }).map((_, i) => {
        const active = i + 1 <= current;
        return (
          <span
            key={i}
            className={
              active
                ? 'h-1.5 flex-1 rounded-full bg-sang-500 transition-colors'
                : 'h-1.5 flex-1 rounded-full bg-anthracite-800 transition-colors'
            }
          />
        );
      })}
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
