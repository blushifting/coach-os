/**
 * Orchestrateur du wizard d'onboarding (Conv #4b).
 *
 * - 4 étapes (Profil / Muscles / Équilibre / Programme).
 * - Navigation Précédent / Suivant avec garde-fous (étape 2 : ≥ 1 muscle).
 * - À la finalisation : `useEngine.startUser` (applyBalance=false puisqu'on a
 *   déjà arbitré les SUGGERE dans l'étape 3) puis navigation vers `/programme`.
 *   Calibration : depuis le retrait de la Séance 0 (Conv #12), les plafonds
 *   sont bootstrap heuristiquement à la 1re séance et raffinés via RPE.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/Button';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { StepIndicator } from '@/components/StepIndicator';
import { ALL_GUIDED_PROGRAMS } from '@/engine/guided_programs';
import { SuggestedAction } from '@/engine/models';
import {
  applyVariantReplacements,
  bootstrap,
  endOfCycle,
  generateInitialCyclePlan,
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
import { useCoachOsStore } from '@/store';
import { Step1Profile } from './Step1Profile';
import { Step2Muscles } from './Step2Muscles';
import { Step3Balance } from './Step3Balance';
import { Step4Program } from './Step4Program';
import { Step5Preview } from './Step5Preview';

const STEP_LABELS_FULL = ['Profil', 'Muscles', 'Équilibre', 'Programme', 'Aperçu'] as const;
/**
 * Conv #18 — en mode `restart`, on saute Step1 (Profil = cosmétique). Les
 * 4 étapes restantes sont renumérotées 1..4 pour l'affichage utilisateur.
 */
const STEP_LABELS_RESTART = ['Muscles', 'Équilibre', 'Programme', 'Aperçu'] as const;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const catalog = useCoachOsStore((s) => s.catalog);
  const userState = useCoachOsStore((s) => s.userState);
  const [search] = useSearchParams();
  // Conv #18 — mode "partial restart" : l'user vient de Profil pour modifier
  // priorités / programme. On skip Step1, on initialise le draft depuis
  // userState, et au finalize on appelle endOfCycle au lieu de startUser.
  const isRestart = search.get('restart') === '1' && userState !== null;
  const initialStep = isRestart ? 2 : 1;
  const stepLabels = isRestart ? STEP_LABELS_RESTART : STEP_LABELS_FULL;
  const totalSteps = stepLabels.length;
  const stepOffset = isRestart ? 1 : 0; // step actuel - offset = numéro UI

  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    isRestart && userState !== null ? draftFromUserState(userState) : makeInitialDraft(),
  );
  const [step, setStep] = useState<number>(initialStep);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Conv #11b — variantes choisies dans le Step5 (en mémoire jusqu'au finalize).
  const [variantReplacements, setVariantReplacements] = useState<
    ReadonlyArray<VariantReplacement>
  >([]);

  // Bootstrap idempotent du store/catalog au mount (utile si on entre direct
  // sur /onboarding sans avoir traversé d'autre page).
  useEffect(() => {
    void bootstrap();
  }, []);

  // Conv #17b — scroll en haut du conteneur scrollable à chaque changement
  // d'étape. Sans ça, on hérite du scroll précédent (ex : si on a scrollé
  // bas en Step2, Step3 démarre à mi-page).
  const mainRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (mainRef.current !== null) {
      mainRef.current.scrollTop = 0;
    }
  }, [step]);

  // Conv #11b — preview calculée à la volée quand on entre dans Step5. Sans
  // toucher au store (tout reste en mémoire jusqu'au finalize).
  const preview = useMemo(() => {
    if (step !== 5 || catalog === null) {
      return { template: null, blocking: [] as readonly string[] };
    }
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
  }, [step, draft, catalog]);

  // Garde-fou étape 2 : valider seulement si au moins 1 muscle.
  const canAdvanceFromStep2 = !isEmptySelection(draft);

  function patchDraft(patch: Partial<OnboardingDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function goPrev() {
    setError(null);
    if (step > initialStep) setStep((s) => s - 1);
  }

  function goNext() {
    setError(null);
    if (step === 2 && !canAdvanceFromStep2) {
      setError('Sélectionne au moins un muscle ou utilise le préset par défaut.');
      return;
    }
    if (step === 2) {
      // Au passage 2 → 3 : pré-cocher toutes les suggestions R1-R4 par défaut.
      // En mode restart, on garde les acceptedSuggestions existantes du draft
      // (l'user a déjà ses choix d'équilibre, pas besoin de tout re-cocher).
      if (!isRestart) {
        const suggestions = computeBalanceSuggestions(draft.priorities);
        setDraft((d) => ({
          ...d,
          acceptedSuggestions: new Set(suggestions.map((s) => s.muscle)),
        }));
      }
    }
    if (step === 4) {
      // Au passage 4 → 5 : on remet à zéro les variantes (changement de programme
      // ⇒ les slots ne correspondent plus aux indices précédents).
      setVariantReplacements([]);
    }
    if (step < 5) setStep((s) => s + 1);
  }

  /**
   * Conv #18 — Annulation du restart : ramène l'user sur /profil sans
   * toucher à la DB. Confirmation si le draft a divergé du userState
   * (l'user a fait des modifs qu'il s'apprête à perdre).
   */
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
        // Conv #18 — partial restart : on a déjà un userState. On
        // 1) met à jour le profile (sessions/sem peut avoir changé en Step4 +
        //    objective global a pu basculer si le programme guidé l'impose),
        // 2) appelle endOfCycle qui archive le cycle en cours, pose les
        //    nouveaux goals, le nouveau programmeId, et régénère le plan.
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
        if (variantReplacements.length > 0) {
          await applyVariantReplacements(variantReplacements);
        }
        // Pas de relance de démo, pas de WelcomeOverlay : on retourne juste
        // au programme avec le nouveau cycle posé.
        navigate('/programme', { replace: true });
        return;
      }

      // Onboarding initial (premier passage)
      await startUser({
        profile,
        muscleGoals,
        applyBalance: false,
        programmeId: draft.programmeId,
      });
      // Conv #11b : génère le cycle plan pour pouvoir appliquer les variantes
      // choisies en Step5 avant de router vers /programme.
      await generateInitialCyclePlan();
      if (variantReplacements.length > 0) {
        await applyVariantReplacements(variantReplacements);
      }
      navigate('/programme', { replace: true });
      // Conv #15-7 — auto-lance la visite guidée Alex immédiatement après
      // l'onboarding. La welcome overlay apparaît dans DemoModeProvider dès
      // que `demoMode` passe à true. Best-effort : si l'asset alex.json
      // fail (e2e, offline au 1er lancement), l'utilisateur reste sur le
      // WelcomeBanner normal. Le flag LS `coach-os.skip-auto-demo` désactive
      // ce comportement (utilisé par les helpers e2e).
      try {
        if (localStorage.getItem('coach-os.skip-auto-demo') !== '1') {
          // Conv #16 — force le reset des dismissals pour garantir que la
          // welcome overlay s'affiche au 1er lancement post-onboarding,
          // même si l'utilisateur a déjà vu la démo via Profil > Aide
          // précédemment (cas reset app).
          resetDemoDismissals();
          void enterDemoMode().catch(() => {
            /* la démo est facultative */
          });
        }
      } catch {
        /* LS indispo (private mode iOS, etc.) — pas de démo auto */
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inattendue';
      setError(msg);
      setSubmitting(false);
    }
  }

  const isLastStep = step === 5;
  const stepUiIndex = step - stepOffset;
  // Conv #20 — label "Étape N · X" calculé à partir de l'index UI (1..4 en
  // restart, 1..5 en initial) plutôt que hardcodé dans chaque Step (qui
  // affichait toujours "Étape 2..5" en restart).
  const stepLabelUi = `Étape ${stepUiIndex} · ${stepLabels[stepUiIndex - 1]}`;

  const stepContent = useMemo(() => {
    switch (step) {
      case 1:
        return <Step1Profile draft={draft} onChange={patchDraft} stepLabel={stepLabelUi} />;
      case 2:
        return <Step2Muscles draft={draft} onChange={patchDraft} stepLabel={stepLabelUi} />;
      case 3:
        return <Step3Balance draft={draft} onChange={patchDraft} stepLabel={stepLabelUi} />;
      case 4:
        return <Step4Program draft={draft} onChange={patchDraft} stepLabel={stepLabelUi} />;
      case 5:
        return (
          <Step5Preview
            template={preview.template}
            blocking={preview.blocking}
            catalog={catalog}
            equipment={draft.equipment}
            replacements={variantReplacements}
            onChangeReplacements={setVariantReplacements}
            stepLabel={stepLabelUi}
          />
        );
      default:
        return null;
    }
  }, [step, draft, preview, catalog, variantReplacements, stepLabelUi]);

  return (
    <div
      className="flex h-full flex-1 flex-col bg-anthracite-950"
      data-testid="onboarding-page"
      data-step={step}
      data-restart={isRestart ? '1' : '0'}
    >
      <header
        className="flex items-center gap-1 border-b border-anthracite-800 pl-12 pr-2"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Conv #20 — wrapper flex-1 + min-w-0 pour que le StepIndicator
            occupe toute la largeur restante (auparavant content-sized = bars
            tassées sur ~120 px). Le pl-12 reste pour libérer le watermark K. */}
        <div className="min-w-0 flex-1">
          <StepIndicator current={stepUiIndex} total={totalSteps} labels={stepLabels} />
        </div>
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

function CancelRestartDialog({
  onConfirm,
  onCancel,
}: {
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  // Petit confirm inline pour ne pas dépendre du Dialog global qui charge des
  // styles destructeurs ; on garde le visuel cohérent avec le wizard.
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
