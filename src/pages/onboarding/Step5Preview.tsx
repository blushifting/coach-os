/**
 * Étape 5 de l'onboarding : aperçu du programme + personnalisation des variantes
 * (Conv #11b).
 *
 * À ce stade :
 * - L'utilisateur a choisi profil + muscles + équilibre + programme (Step 1–4).
 * - On a généré en mémoire la `WeeklyTemplate` (via `buildPreviewTemplate`).
 * - Aucune écriture en DB pour l'instant.
 *
 * Le but : laisser l'utilisateur voir le contenu de chaque séance et swap des
 * exos par des variantes qui matchent son équipement / ses préférences. Les
 * swaps sont conservés dans `variantReplacements` (état remonté à
 * `OnboardingPage`) et appliqués à la fin de l'onboarding.
 *
 * Transparence :
 * - (a) Panneau "Volume hebdo par muscle" — chiffres bruts, pas d'algo expliqué.
 * - (b) Panneau dépliable "Comment ça marche" — court rappel RPE/autorégulation.
 *
 * Si un swap change le profil musculaire primaire (ex : traction → tirage
 * vertical perd les biceps), on affiche un avertissement non-bloquant.
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import type { Catalog } from '@/engine/catalog';
import { exercisePrimaires, type WeeklyTemplate } from '@/engine/models';
import {
  analyzeProgramTension,
  applyVariantsToTemplate,
  estimateDayDurationMinutes,
  muscleDeltaForSwap,
  SESSION_DURATION_WARN_MIN,
  weeklyVolumeByMuscle,
  type ProgramTension,
  type VariantReplacement,
} from '@/lib/onboarding-preview';
import { alternativeVariantsFor } from '@/lib/calibration';
import { cn } from '@/lib/cn';
import { muscleLabel } from '@/lib/progress';
import { PatternIcon } from '@/pages/seance/PatternIcon';
import { VariantPickerSheet } from '@/pages/seance-0/VariantPickerSheet';

interface Step5Props {
  readonly template: WeeklyTemplate | null;
  readonly blocking: readonly string[];
  readonly catalog: Catalog | null;
  readonly equipment: ReadonlySet<string>;
  readonly replacements: ReadonlyArray<VariantReplacement>;
  readonly onChangeReplacements: (next: ReadonlyArray<VariantReplacement>) => void;
}

interface SlotPickerState {
  readonly dayIndex: number;
  readonly slotIndex: number;
  readonly currentExerciseId: string;
}

export function Step5Preview({
  template,
  blocking,
  catalog,
  equipment,
  replacements,
  onChangeReplacements,
}: Step5Props) {
  const [picker, setPicker] = useState<SlotPickerState | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [pedagogyOpen, setPedagogyOpen] = useState(false);

  // Le plan effectivement affiché (avec variantes appliquées).
  const effectiveTemplate = useMemo<WeeklyTemplate | null>(() => {
    if (template === null) return null;
    return applyVariantsToTemplate(template, replacements);
  }, [template, replacements]);

  // Récap volume hebdo par muscle primaire — calculé sur le plan effectif.
  const volumeByMuscle = useMemo<Record<string, number>>(() => {
    if (effectiveTemplate === null || catalog === null) return {};
    return weeklyVolumeByMuscle(effectiveTemplate, catalog);
  }, [effectiveTemplate, catalog]);

  // Conv #11h — durée estimée par séance + détection de tension (séance >
  // 75 min). Sert à proposer des arbitrages transparents si le programme
  // est trop chargé pour le nb de séances choisi.
  const tension = useMemo<ProgramTension | null>(() => {
    if (effectiveTemplate === null || catalog === null) return null;
    return analyzeProgramTension(effectiveTemplate, catalog);
  }, [effectiveTemplate, catalog]);

  // Alternatives proposées pour le slot ouvert dans le picker.
  const pickerAlternatives = useMemo(() => {
    if (picker === null || catalog === null) return [];
    return alternativeVariantsFor(picker.currentExerciseId, equipment, catalog, {
      expand: expanded,
    });
  }, [picker, catalog, equipment, expanded]);

  if (blocking.length > 0) {
    return (
      <div className="flex flex-col gap-3 p-4" data-testid="step5-blocking">
        <h1 className="text-xl font-semibold text-white">Programme indisponible</h1>
        <p className="text-sm text-anthracite-300">
          Ton équipement ne permet pas ce programme guidé :
        </p>
        <Card className="border-sang-700/60 bg-sang-900/20">
          <ul className="flex flex-col gap-1 text-sm text-sang-500">
            {blocking.map((b, i) => (
              <li key={i}>• {b}</li>
            ))}
          </ul>
        </Card>
        <p className="text-xs text-anthracite-300">
          Reviens à l'étape précédente pour choisir un programme custom ou un
          autre programme guidé.
        </p>
      </div>
    );
  }

  if (effectiveTemplate === null || catalog === null) {
    return (
      <div className="p-4" data-testid="step5-loading">
        <p className="text-sm text-anthracite-300">Génération du programme…</p>
      </div>
    );
  }

  function openPicker(dayIndex: number, slotIndex: number, currentExerciseId: string) {
    setPicker({ dayIndex, slotIndex, currentExerciseId });
  }

  function handlePick(newExerciseId: string) {
    if (picker === null) return;
    const next: VariantReplacement[] = replacements.filter(
      (r) => !(r.dayIndex === picker.dayIndex && r.slotIndex === picker.slotIndex),
    );
    // Si l'utilisateur re-sélectionne l'exo d'origine, on retire son override.
    const originalId =
      template?.days[picker.dayIndex]?.exercises[picker.slotIndex]?.exercise_id ?? null;
    if (originalId !== null && newExerciseId !== originalId) {
      next.push({
        dayIndex: picker.dayIndex,
        slotIndex: picker.slotIndex,
        newExerciseId,
      });
    }
    onChangeReplacements(next);
    setPicker(null);
  }

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="step5-preview">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-sang-400">
          Étape 5 · Aperçu
        </span>
        <h1 className="font-display text-3xl leading-tight tracking-wide text-white">
          Ton programme
        </h1>
      </header>
      <p className="text-sm text-anthracite-300">
        Voici les séances générées. Tu peux changer chaque exo par une variante
        adaptée à tes préférences ou à ton équipement. Tu pourras toujours
        modifier ponctuellement pendant une séance.
      </p>

      <VolumeRecap volumeByMuscle={volumeByMuscle} />

      {tension !== null && <TensionPanel tension={tension} />}

      <PedagogyPanel open={pedagogyOpen} onToggle={() => setPedagogyOpen((v) => !v)} />

      <div className="flex flex-col gap-3">
        {effectiveTemplate.days.map((day, di) => {
          const dayMin = catalog === null ? 0 : estimateDayDurationMinutes(day, catalog);
          return (
          <Card key={di} className="flex flex-col gap-2" data-testid={`day-card-${di}`}>
            <header className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-white">{day.label}</h2>
              <span
                className="text-[11px] text-anthracite-300"
                data-testid={`day-duration-${di}`}
              >
                {day.exercises.length} exos · ~{Math.round(dayMin)} min
              </span>
            </header>
            {day.target_muscles_focus.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {day.target_muscles_focus.map((m) => (
                  <span
                    key={m}
                    className="rounded bg-anthracite-700 px-2 py-0.5 text-[10px] text-anthracite-100"
                  >
                    {muscleLabel(m)}
                  </span>
                ))}
              </div>
            )}
            <ul className="flex flex-col gap-2">
              {day.exercises.map((planned, pi) => {
                const original = template?.days[di]?.exercises[pi]?.exercise_id ?? null;
                const swapped = original !== null && original !== planned.exercise_id;
                let exNomFr = planned.exercise_id;
                let pattern: import('@/engine/models').Pattern | null = null;
                let primaires: readonly string[] = [];
                try {
                  const ex = catalog!.get(planned.exercise_id);
                  exNomFr = ex.nom_fr;
                  pattern = ex.pattern;
                  primaires = exercisePrimaires(ex);
                } catch {
                  /* exo inconnu — on garde l'id brut */
                }
                const delta =
                  swapped && original !== null
                    ? muscleDeltaForSwap(original, planned.exercise_id, catalog!)
                    : null;
                return (
                  <li
                    key={`${di}-${pi}-${planned.exercise_id}`}
                    data-testid={`slot-${di}-${pi}`}
                    data-swapped={swapped ? 'true' : 'false'}
                  >
                    <div className="flex items-center gap-2 rounded-lg border border-anthracite-700 bg-anthracite-900 p-2">
                      {pattern !== null && <PatternIcon pattern={pattern} size="sm" />}
                      <div className="flex flex-1 flex-col">
                        <span className="text-sm font-medium text-white">
                          {exNomFr}
                          {swapped && (
                            <span className="ml-1 text-[10px] uppercase tracking-wide text-sang-400">
                              · modifié
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-anthracite-300">
                          {planned.base_sets} séries ·{' '}
                          {primaires.length > 0
                            ? primaires.map(muscleLabel).join(', ')
                            : '—'}
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openPicker(di, pi, planned.exercise_id)}
                        data-testid={`btn-variants-${di}-${pi}`}
                      >
                        Variantes
                      </Button>
                    </div>
                    {delta !== null && delta.lost.length > 0 && (
                      <div
                        className="mt-1 rounded-lg border border-amber-700/50 bg-amber-900/20 px-2 py-1 text-[11px] text-amber-300"
                        data-testid={`delta-warning-${di}-${pi}`}
                      >
                        ⚠ Le nouveau choix ne stimule plus :{' '}
                        <span className="font-medium">
                          {delta.lost.map(muscleLabel).join(', ')}
                        </span>
                        . Tu peux ajuster un autre exo sur ce muscle si tu veux
                        compenser.
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
          );
        })}
      </div>

      {replacements.length > 0 && (
        <p className="text-xs text-anthracite-300" data-testid="step5-replacements-count">
          {replacements.length} variante{replacements.length > 1 ? 's' : ''} appliquée
          {replacements.length > 1 ? 's' : ''}.
        </p>
      )}

      {picker !== null && (
        <VariantPickerSheet
          open={picker !== null}
          currentExerciseId={picker.currentExerciseId}
          alternatives={pickerAlternatives}
          expanded={expanded}
          onToggleExpand={() => setExpanded((v) => !v)}
          onPick={handlePick}
          onClose={() => setPicker(null)}
          title="Choisir une variante"
        />
      )}
    </div>
  );
}

// =============================================================================
// Sous-composants
// =============================================================================

function TensionPanel({ tension }: { readonly tension: ProgramTension }) {
  // Pas d'affichage si tout va bien (durée moyenne et max raisonnables).
  // On affiche un récap durée en encart bleu/neutre, et un bandeau sang
  // d'arbitrage uniquement si tooLong.
  const avg = Math.round(tension.avgMin);
  const max = Math.round(tension.maxMin);
  return (
    <Card
      data-testid="tension-panel"
      className={cn(
        'flex flex-col gap-2',
        tension.tooLong && 'border-sang-700/50 bg-sang-900/15',
      )}
    >
      <header className="flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-anthracite-300">
          Durée estimée par séance
        </span>
        <span
          className="font-display text-lg tabular-nums text-white"
          data-testid="tension-avg"
        >
          ~{avg} min
        </span>
      </header>
      {tension.tooLong ? (
        <>
          <p className="text-xs leading-relaxed text-sang-200">
            Au moins une séance dépasse {SESSION_DURATION_WARN_MIN} min
            (max ~{max} min). Tu peux la garder telle quelle, mais voici les
            leviers si tu veux raccourcir :
          </p>
          <ul className="ml-4 flex list-disc flex-col gap-1 text-xs leading-relaxed text-anthracite-100">
            <li>
              <span className="font-medium text-white">Plus de séances</span> par
              semaine (étale le volume — retour à l'étape 1).
            </li>
            <li>
              <span className="font-medium text-white">Moins de muscles cibles</span>{' '}
              (focus sur l'essentiel — retour à l'étape 2).
            </li>
            <li>
              <span className="font-medium text-white">Programme custom</span> au
              lieu d'un guidé full body (retour à l'étape 4).
            </li>
            <li>
              Accepter des <span className="font-medium text-white">séances plus
              longues</span> et continuer comme prévu.
            </li>
          </ul>
        </>
      ) : (
        <p className="text-xs leading-relaxed text-anthracite-300">
          Tient en {max} min max sur la séance la plus chargée. Aligné avec
          ton nombre de séances par semaine.
        </p>
      )}
    </Card>
  );
}

function VolumeRecap({ volumeByMuscle }: { readonly volumeByMuscle: Record<string, number> }) {
  const entries = Object.entries(volumeByMuscle)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <Card className="flex flex-col gap-2" data-testid="volume-recap">
      <header className="text-xs uppercase tracking-wide text-anthracite-300">
        Volume hebdo par muscle (semaine 1)
      </header>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-anthracite-100">
        {entries.map(([muscle, n]) => (
          <li key={muscle} className="flex justify-between">
            <span>{muscleLabel(muscle)}</span>
            <span className="tabular-nums text-anthracite-300">{n} séries</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PedagogyPanel({
  open,
  onToggle,
}: {
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <Card className="flex flex-col gap-2" data-testid="pedagogy-panel">
      <button
        type="button"
        onClick={onToggle}
        data-testid="btn-pedagogy-toggle"
        className="flex items-center justify-between text-left text-xs uppercase tracking-wide text-anthracite-300 hover:text-white"
      >
        <span>Comment ça marche ?</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 text-xs leading-relaxed text-anthracite-100">
          <p>
            Chaque séance cible plusieurs muscles avec un nombre de séries calculé
            pour rester dans une zone de progression efficace (ni trop peu, ni
            trop). À chaque série, tu indiques l'effort perçu (sur 10) et l'app
            ajuste les charges et le volume pour la suite.
          </p>
          <p>
            Le programme tourne sur 5 semaines : 4 d'intensification (+1 série
            par exo par semaine, plafonné) puis 1 semaine de décharge plus
            légère.
          </p>
          <p>
            Tu peux à tout moment remplacer un exo pendant une séance (si la
            machine est prise, par exemple). L'app reportera ce qui n'a pas été
            fait sur les autres séances de la semaine si possible.
          </p>
        </div>
      )}
    </Card>
  );
}
