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

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { StepIndicator } from '@/components/StepIndicator';
import { ALL_GUIDED_PROGRAMS } from '@/engine/guided_programs';
import {
  applyVariantReplacements,
  bootstrap,
  generateInitialCyclePlan,
  startUser,
} from '@/hooks/useEngine';
import {
  buildMuscleGoals,
  buildProfile,
  computeBalanceSuggestions,
  deriveGlobalObjective,
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

const STEP_LABELS = ['Profil', 'Muscles', 'Équilibre', 'Programme', 'Aperçu'] as const;
const TOTAL_STEPS = STEP_LABELS.length;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const catalog = useCoachOsStore((s) => s.catalog);
  const [draft, setDraft] = useState<OnboardingDraft>(makeInitialDraft);
  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Conv #11b — variantes choisies dans le Step5 (en mémoire jusqu'au finalize).
  const [variantReplacements, setVariantReplacements] = useState<
    ReadonlyArray<VariantReplacement>
  >([]);

  // Bootstrap idempotent du store/catalog au mount (utile si on entre direct
  // sur /onboarding sans avoir traversé d'autre page).
  useEffect(() => {
    void bootstrap();
  }, []);

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
    if (step > 1) setStep((s) => s - 1);
  }

  function goNext() {
    setError(null);
    if (step === 2 && !canAdvanceFromStep2) {
      setError('Sélectionne au moins un muscle ou utilise le préset par défaut.');
      return;
    }
    if (step === 2) {
      // Au passage 2 → 3 : pré-cocher toutes les suggestions R1-R4 par défaut.
      const suggestions = computeBalanceSuggestions(draft.priorities);
      setDraft((d) => ({
        ...d,
        acceptedSuggestions: new Set(suggestions.map((s) => s.muscle)),
      }));
    }
    if (step === 4) {
      // Au passage 4 → 5 : on remet à zéro les variantes (changement de programme
      // ⇒ les slots ne correspondent plus aux indices précédents).
      setVariantReplacements([]);
    }
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inattendue';
      setError(msg);
      setSubmitting(false);
    }
  }

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
          />
        );
      default:
        return null;
    }
  }, [step, draft, preview, catalog, variantReplacements]);

  const isLastStep = step === TOTAL_STEPS;

  return (
    <div
      className="flex h-full flex-1 flex-col bg-anthracite-950"
      data-testid="onboarding-page"
      data-step={step}
    >
      <header
        className="border-b border-anthracite-800 pl-12"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <StepIndicator current={step} total={TOTAL_STEPS} labels={STEP_LABELS} />
      </header>

      <main className="flex-1 overflow-y-auto pb-32">{stepContent}</main>

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
            disabled={step === 1 || submitting}
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
              {submitting ? 'Création…' : 'Valider et continuer'}
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
    </div>
  );
}
