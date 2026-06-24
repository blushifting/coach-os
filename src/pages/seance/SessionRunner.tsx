import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChargeMechanicNote } from '@/components/ChargeMechanicNote';
import { Dialog } from '@/components/Dialog';
import { ProgressRing } from '@/components/ProgressRing';
import { cn } from '@/lib/cn';
import { triggerHaptic } from '@/lib/haptics';
import type { Catalog } from '@/engine/catalog';
import { ChargeType, type SessionPlan } from '@/engine/models';
import { useEngine } from '@/hooks/useEngine';
import { useCoachOsStore } from '@/store';
import { useDemoMode, useGymBrand } from '@/store/selectors';
import { displayExerciseName } from '@/lib/catalog-filter';
import { sessionDisplayName } from '@/lib/session-label';
import {
  countDoneSets,
  countPlannedSets,
  formatRest,
  propagateLoadToUpcomingSets,
  recalibrateUpcomingSets,
  type SessionEntries,
  type SetEntry,
  updateSetEntry,
} from '@/lib/session-runner';
import { e1rmConfidenceFor } from '@/lib/calibration-status';
import { bootstrapE1rmIfMissing } from '@/engine/engine';
import { ChargeBadge } from '@/pages/catalogue/ChargeBadge';
import { AddExerciseSheet } from './AddExerciseSheet';
import { CalibrationBanner } from './CalibrationBanner';
import { ExerciseDetailSheet } from './ExerciseDetailSheet';
import { SetInput } from './SetInput';

/**
 * Une série est "comptable pour live e1rm" si elle peut être incluse dans le
 * calcul `computeLiveE1rmFromEntries` (= recalibrage intra-séance). Bloc R —
 * plus de filtre de fiabilité : toute série cochée valide (done + reps>0 +
 * load_kg + rpe) compte, y compris une série lourde faite en réserve (4+),
 * pour que le recalibrage propage la charge (fix du gel de calibration).
 */
function isCountableForLiveE1rm(s: SetEntry | undefined): boolean {
  if (!s) return false;
  if (!s.done) return false;
  if (s.reps === null || s.reps <= 0) return false;
  if (s.load_kg === null) return false;
  if (s.rpe === null) return false;
  return true;
}

interface SessionRunnerProps {
  readonly plan: SessionPlan;
  readonly catalog: Catalog | null;
  readonly entries: SessionEntries;
  readonly onEntriesChange: (next: SessionEntries) => void;
  readonly onFinish: () => void;
  readonly finishing: boolean;
}

/**
 * Écran "État B" — séance en cours. Affiche les exos planifiés, saisie set
 * par set, indicateur de progression. Bouton "Terminer la séance".
 */
export function SessionRunner({
  plan,
  catalog,
  entries,
  onEntriesChange,
  onFinish,
  finishing,
}: SessionRunnerProps) {
  const engine = useEngine();
  const navigate = useNavigate();
  const userState = useCoachOsStore((s) => s.userState);
  const demoActive = useDemoMode();
  const brand = useGymBrand();
  const snapshots = useCoachOsStore((s) => s.history.e1rmSnapshots);
  const [detail, setDetail] = useState<{ exerciseId: string; itemIndex: number } | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // Conv #21b — ajout/retrait d'exo en cours de séance.
  const [addOpen, setAddOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  // Bloc F (Conv #31) — proposition d'ajout aux favoris à la 3ᵉ utilisation
  // (ajout ad-hoc ou variante). Contient l'exercise_id à proposer, ou null.
  const [suggestFav, setSuggestFav] = useState<string | null>(null);
  // 1.16 — repli (collapse) des cartes d'exo. Par défaut un exo se replie tout
  // seul quand toutes ses séries sont faites. Bloc I (Conv #34) — l'override
  // manuel (chevron) est clé par `exercise_id` et vit dans le store
  // (`currentSessionCollapsed`) pour survivre à la navigation : `true` = replié
  // manuellement (même avant la fin), `false` = gardé ouvert (même terminé),
  // absent = comportement auto.
  const collapsedOverrides = useCoachOsStore((s) => s.currentSessionCollapsed);
  const setCurrentSessionCollapsed = useCoachOsStore(
    (s) => s.setCurrentSessionCollapsed,
  );
  const sessionId = useCoachOsStore.getState().currentSessionId;
  const done = countDoneSets(entries);
  const total = countPlannedSets(entries);
  const incomplete = done < total;

  // Conv #15 vague 3 — annulation : supprime la session de la DB (vs skip
  // qui la marque `status='skipped'`). La case calendrier redevient libre.
  async function handleCancel() {
    setConfirmCancel(false);
    if (sessionId === null) return;
    setCancelling(true);
    try {
      await engine.cancelPlannedSession(sessionId);
      navigate('/programme');
    } finally {
      setCancelling(false);
    }
  }

  // Conv #12b — confidence dérivée pour chaque exo, calculée 1× par cycle de
  // render à partir des snapshots datés. Le banner s'affiche au-dessus du
  // bloc des séries pour les exos `not_calibrated` ou `stale`.
  const confidenceByExo = useMemo(() => {
    const today = new Date();
    const e1rm = userState?.e1rm ?? {};
    const out: Record<string, ReturnType<typeof e1rmConfidenceFor>> = {};
    for (const item of plan.items) {
      // Bloc R — modèle unifié : confidence pilotée par les snapshots datés pour
      // TOUS les exos (plus de cas spécial `e1RM_app`).
      out[item.exercise_id] = e1rmConfidenceFor(
        item.exercise_id,
        e1rm,
        snapshots,
        today,
      );
    }
    return out;
  }, [plan.items, userState?.e1rm, snapshots]);
  const bodyweight = userState?.profile.bodyweight_kg ?? 75;

  // Conv #15 vague 2/3 — snapshot des e1RM au mount du runner (figé pour
  // toute la séance). Sert de baseline pour `recalibrateUpcomingSets`.
  // Inclut le bootstrap heuristique des exos non encore calibrés (pour
  // un fresh user post-onboarding, `state.e1rm` est vide — sans bootstrap
  // le ratio serait toujours undefined et le recalibrage no-op). Le
  // remount à chaque sessionId (key dans SeancePage) rafraîchit ce snapshot.
  const e1rmInitialRef = useRef<Record<string, number> | null>(null);
  if (e1rmInitialRef.current === null && userState !== null && catalog !== null) {
    const snap: Record<string, number> = { ...userState.e1rm };
    for (const item of plan.items) {
      if (snap[item.exercise_id] === undefined && catalog.has(item.exercise_id)) {
        snap[item.exercise_id] = bootstrapE1rmIfMissing(
          userState,
          catalog.get(item.exercise_id),
        );
      }
    }
    e1rmInitialRef.current = snap;
  }

  // Wrap onEntriesChange : à chaque fois qu'une série devient "fiable pour
  // calibration" (cf. `isCountableForLiveE1rm`), on déclenche le recalibrage
  // **uniquement pour les exos en mode calibration** (`confidence !==
  // 'measured'`, Conv #16). Pour les exos déjà calibrés, on laisse les charges
  // prescrites intactes en cours de séance — l'algo fin de séance s'occupera
  // de la mise à jour stable du plafond.
  //
  // Conv #19 — Le trigger ne dépend plus de la seule transition `done`. Le
  // workflow réel est : reps+kg → cocher (done=true) → RPE après coche. Si
  // on déclenchait sur done false→true uniquement, on rateait la mesure car
  // `liveE1rm` est null sans rpe. Désormais on déclenche dès qu'une série
  // passe à "comptable pour e1rm" (done + reps + load + rpe ; cf.
  // `isCountableForLiveE1rm`, plus de filtre n_equiv depuis Bloc R).
  const handleEntriesChange = useCallback(
    (next: SessionEntries) => {
      if (catalog === null) {
        onEntriesChange(next);
        return;
      }
      let triggeredIdx = -1;
      let triggeredSetIdx = -1;
      for (let i = 0; i < next.length && triggeredIdx < 0; i++) {
        const newRow = next[i] ?? [];
        const oldRow = entries[i] ?? [];
        for (let j = 0; j < newRow.length; j++) {
          const ne = newRow[j];
          const oe = oldRow[j];
          if (!ne || !oe) continue;
          // Cas 1 : transition done=false→true avec reps valides — déclenche
          // le pré-remplissage des reps sur les séries non-cochées (UX).
          const newDone =
            ne.done && !oe.done && ne.reps !== null && ne.reps > 0;
          // Cas 2 : la série vient de devenir fiable pour le live e1rm
          // (typiquement : l'user a coché puis renseigné le rpe). Déclenche
          // le recalibrage des charges. Sans ce 2e cas (Conv #19), le rpe
          // saisi après la coche ne propageait jamais aux sets suivants.
          const newReliable =
            isCountableForLiveE1rm(ne) && !isCountableForLiveE1rm(oe);
          if (newDone || newReliable) {
            triggeredIdx = i;
            triggeredSetIdx = j;
            break;
          }
        }
      }
      if (triggeredIdx >= 0 && e1rmInitialRef.current !== null) {
        const exId = plan.items[triggeredIdx]?.exercise_id;
        const isCalibrating =
          exId !== undefined &&
          (confidenceByExo[exId] ?? 'measured') !== 'measured';
        if (isCalibrating) {
          next = recalibrateUpcomingSets({
            entries: next,
            plan,
            catalog,
            bodyweightKg: bodyweight,
            e1rmInitial: e1rmInitialRef.current,
            itemIdx: triggeredIdx,
          });
        } else {
          // Bloc S (Conv #45) — exo déjà calibré : on ne recalibre pas en
          // séance, mais on reporte une charge MODIFIÉE par l'user sur les
          // séries suivantes (no-op si elle vaut encore la prescription).
          next = propagateLoadToUpcomingSets({
            entries: next,
            plan,
            itemIdx: triggeredIdx,
            fromSetIdx: triggeredSetIdx,
          });
        }
      }
      // 1.17 — compléter toutes les séries d'un exo force le repli, MÊME si
      // l'user l'avait déplié manuellement avant la fin (override `false`).
      // On efface l'override sur la transition « pas-tout-fait → tout-fait » :
      // `collapsed` retombe alors sur le comportement auto (= replié). Un clic
      // ultérieur sur le chevron repose un override et permet de rouvrir.
      // Bloc I — override clé par `exercise_id`, lu/écrit dans le store.
      const prevCollapsed = useCoachOsStore.getState().currentSessionCollapsed;
      let nextCollapsed: Record<string, boolean> | null = null;
      for (let i = 0; i < next.length; i++) {
        const exoId = plan.items[i]?.exercise_id;
        if (exoId === undefined || prevCollapsed[exoId] === undefined) continue;
        const newRow = next[i] ?? [];
        const oldRow = entries[i] ?? [];
        const newAllDone = newRow.length > 0 && newRow.every((s) => s.done);
        const oldAllDone = oldRow.length > 0 && oldRow.every((s) => s.done);
        if (newAllDone && !oldAllDone) {
          nextCollapsed ??= { ...prevCollapsed };
          delete nextCollapsed[exoId];
        }
      }
      if (nextCollapsed !== null) setCurrentSessionCollapsed(nextCollapsed);
      onEntriesChange(next);
    },
    [
      catalog,
      entries,
      plan,
      bodyweight,
      onEntriesChange,
      confidenceByExo,
      setCurrentSessionCollapsed,
    ],
  );

  return (
    <div className="flex flex-col gap-3" data-testid="session-runner">
      <Card accent data-testid="session-progress" className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-sang-400/90">
            Séance
          </span>
          {/* Bloc K (Conv #36) — le nom de séance ne se modifie plus ici (crayon
              retiré) : programme → éditeur de cycle, custom → champ de création. */}
          <span className="font-display text-2xl leading-none tracking-wide text-white">
            {sessionDisplayName(plan)}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-anthracite-300">
            Cycle {plan.cycle_index} · S{plan.week_in_cycle}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {/* Conv #18 — `whitespace-nowrap` + shrink-0 sur le wrapper pour que
              "Séries 12/12" reste sur une ligne quand X a 2 chiffres. */}
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-anthracite-300">
              Séries
            </span>
            <span className="whitespace-nowrap font-display text-3xl leading-none tabular-nums text-white">
              <span className="text-sang-400">{done}</span>
              <span className="text-anthracite-400"> / {total}</span>
            </span>
          </div>
          <ProgressRing
            value={done}
            total={total}
            size={44}
            strokeWidth={4}
            data-testid="session-ring"
          />
        </div>
      </Card>

      <ul className="flex flex-col gap-3">
        {plan.items.map((item, i) => {
          const ex = safeGet(catalog, item.exercise_id);
          const entrySets = entries[i] ?? [];
          const doneCount = entrySets.filter((s) => s.done).length;
          const chargeType = ex?.charge;
          // 1.16 — exo entièrement validé → repli auto ; un choix manuel
          // (chevron) prime sur l'auto. 1.16.2 : repli possible avant la fin.
          const allDone = entrySets.length > 0 && doneCount === entrySets.length;
          const collapsed = collapsedOverrides[item.exercise_id] ?? allDone;
          // Conv #20 — l'exo est en mode "Poids du corps seulement" si l'user
          // a posé `pdc_only: true` dans son EquipmentOverride. SetInput
          // adapte alors le rendu de la charge (badge "Poids du corps"
          // figé) et la prescription elle-même arrive avec load_kg=0.
          const pdcOnly =
            ex !== null &&
            userState !== null &&
            userState.equipment_overrides[ex.id]?.pdc_only === true &&
            (ex.charge === ChargeType.BODYWEIGHT_LOADED ||
              ex.charge === ChargeType.BODYWEIGHT_ASSISTED);
          return (
            <li key={`${item.exercise_id}-${i}`}>
              <Card
                className="flex flex-col gap-2"
                data-testid={`exo-card-${i}`}
                data-exercise-id={item.exercise_id}
              >
                <header className="flex items-center gap-2">
                  {ex !== null && <ChargeBadge charge={ex.charge} size={24} />}
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-semibold text-white">
                      {ex ? displayExerciseName(ex, brand ?? undefined) : item.exercise_id}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-anthracite-300">
                      {/* 1.16 — exo terminé : coche verte + « fait » (la couleur
                          ne porte jamais l'info seule : icône + libellé). */}
                      {allDone && (
                        <svg
                          viewBox="0 0 24 24"
                          width="13"
                          height="13"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-green-500"
                          aria-hidden="true"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      <span
                        className={cn(
                          'font-display tabular-nums tracking-wide',
                          allDone
                            ? 'text-green-500'
                            : doneCount > 0
                              ? 'text-anthracite-100'
                              : 'text-anthracite-200',
                        )}
                      >
                        {doneCount}/{entrySets.length}
                      </span>{' '}
                      {allDone
                        ? 'séries · fait'
                        : `séries — repos ${formatRest(item.sets[0]?.rest_s ?? 0)}`}
                    </span>
                  </div>
                  {/* Conv #24 (D10) — picto info en vrai SVG centré. Avant : la
                      lettre « i » nue, non centrée dans le cercle (pas de flex),
                      se collait en haut-gauche → rendu « bugué ». */}
                  <button
                    type="button"
                    aria-label={`Détail ${ex ? displayExerciseName(ex, brand ?? undefined) : item.exercise_id}`}
                    data-testid={`btn-detail-${i}`}
                    onClick={() => setDetail({ exerciseId: item.exercise_id, itemIndex: i })}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-anthracite-700 text-anthracite-300 transition hover:bg-anthracite-600 hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 11v5" />
                      <path d="M12 7.5h.01" />
                    </svg>
                  </button>
                  {/* Conv #21b — bouton "retirer cet exo de la séance".
                      Confirmation systématique (Conv #21b-fix) : tap rapide
                      facile, on protège l'user d'un retrait accidentel.
                      Conv #24 (D10) — croix SVG centrée (même correctif). */}
                  <button
                    type="button"
                    aria-label={`Retirer ${ex ? displayExerciseName(ex, brand ?? undefined) : item.exercise_id} de la séance`}
                    data-testid={`btn-remove-${i}`}
                    disabled={demoActive || finishing}
                    onClick={() => setConfirmRemove(i)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-anthracite-700 text-anthracite-300 transition hover:bg-sang-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <line x1="6" y1="6" x2="18" y2="18" />
                      <line x1="18" y1="6" x2="6" y2="18" />
                    </svg>
                  </button>
                  {/* 1.16.2 — chevron replier/déplier TOUJOURS présent (on peut
                      replier un exo avant la fin). Bouton distinct = pas de clic
                      imbriqué. Toggle le choix manuel sur l'état courant. */}
                  <button
                    type="button"
                    aria-label={collapsed ? 'Déplier l’exercice' : 'Replier l’exercice'}
                    aria-expanded={!collapsed}
                    data-testid={`btn-collapse-${i}`}
                    onClick={() =>
                      setCurrentSessionCollapsed({
                        ...collapsedOverrides,
                        [item.exercise_id]: !collapsed,
                      })
                    }
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-anthracite-700 text-anthracite-300 transition hover:bg-anthracite-600 hover:text-white"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className={cn('transition-transform duration-300', collapsed ? '' : 'rotate-180')}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </header>

                {/* 1.16.2 — corps repliable avec micro-animation : grid-rows
                    0fr↔1fr + overflow-hidden donne un slide de hauteur fluide.
                    Toujours monté (les séries faites restent en état) ; la
                    transition passe par motion-safe (reduced-motion = instantané). */}
                <div
                  className={cn(
                    'grid motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out',
                    collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
                  )}
                  aria-hidden={collapsed}
                >
                  <div className="flex min-h-0 flex-col gap-1.5 overflow-hidden">
                    {ex !== null ? (
                      <CalibrationBanner
                        exercise={ex}
                        bodyweightKg={bodyweight}
                        confidence={confidenceByExo[item.exercise_id] ?? 'measured'}
                        entries={entrySets}
                      />
                    ) : null}

                    {/* Bloc F (Conv #31) — clarifie les charges contre-intuitives
                        (assisté = poids retiré, lesté = poids ajouté) là où on
                        règle la charge. Rien pour les charges normales. */}
                    {ex !== null && <ChargeMechanicNote charge={ex.charge} />}

                    <div className="flex flex-col gap-1.5">
                      {entrySets.map((entry, j) => (
                        <SetInput
                          key={j}
                          index={j}
                          entry={entry}
                          chargeType={chargeType}
                          pdcOnly={pdcOnly}
                          unilateral={ex?.uni ?? false}
                          onChange={(patch) =>
                            handleEntriesChange(updateSetEntry(entries, i, j, patch))
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {/* Conv #21b — ajout d'un exo bonus / substitut en cours de séance.
          Placé entre la liste et le bouton "Terminer" pour rester visible
          mais ne pas concurrencer le tap principal. Désactivé en démo et
          pendant qu'une finalisation est en vol. */}
      <Button
        variant="ghost"
        size="md"
        fullWidth
        onClick={() => setAddOpen(true)}
        disabled={demoActive || finishing}
        data-testid="btn-add-exercise"
      >
        + Ajouter un exercice
      </Button>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={() => setConfirmFinish(true)}
        disabled={finishing || done === 0 || demoActive}
        data-testid="btn-finish-session"
      >
        {finishing ? 'Enregistrement…' : 'Terminer la séance'}
      </Button>

      <Dialog
        open={confirmFinish}
        title="Terminer la séance ?"
        description={
          incomplete ? (
            <>
              Tu as coché <strong>{done}/{total}</strong> séries. Une fois
              terminée, tu ne pourras plus modifier la séance — les séries non
              cochées comptent comme non faites. Kotsh rattrapera ce volume
              manquant plus tard.
            </>
          ) : (
            <>
              Toutes les séries sont cochées. La séance sera enregistrée et
              tes Plafonds seront mis à jour.
            </>
          )
        }
        confirmLabel="Terminer"
        cancelLabel="Continuer la séance"
        onConfirm={() => {
          setConfirmFinish(false);
          triggerHaptic('session-done');
          onFinish();
        }}
        onCancel={() => setConfirmFinish(false)}
      />

      {/* Conv #15 vague 3 — annuler : retire complètement la séance, comme
          si elle n'avait pas été programmée. */}
      <Button
        variant="ghost"
        size="md"
        fullWidth
        onClick={() => setConfirmCancel(true)}
        disabled={finishing || cancelling || demoActive}
        data-testid="btn-cancel-session"
      >
        {cancelling ? 'Annulation…' : 'Annuler la séance'}
      </Button>

      <Dialog
        open={confirmCancel}
        title="Annuler la séance ?"
        description={
          <>
            La séance sera retirée du calendrier comme si elle n'avait jamais
            été programmée. Les séries que tu as validées ne seront pas
            enregistrées.
          </>
        }
        confirmLabel="Annuler la séance"
        cancelLabel="Continuer"
        destructive
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />

      <ExerciseDetailSheet
        open={detail !== null}
        exerciseId={detail?.exerciseId ?? null}
        catalog={catalog}
        onClose={() => setDetail(null)}
        onReplace={
          detail === null
            ? undefined
            : async (newExId) => {
                await engine.replaceSessionExercise({
                  itemIndex: detail.itemIndex,
                  newExerciseId: newExId,
                });
                if (engine.shouldSuggestFavorite(newExId)) setSuggestFav(newExId);
              }
        }
      />

      {/* Conv #21b — Sheet de sélection d'un exo à ajouter à la séance. */}
      <AddExerciseSheet
        open={addOpen}
        catalog={catalog}
        existingExerciseIds={
          new Set(plan.items.map((it) => it.exercise_id))
        }
        onClose={() => setAddOpen(false)}
        onAdded={(id) => {
          if (engine.shouldSuggestFavorite(id)) setSuggestFav(id);
        }}
      />

      {/* Bloc F (Conv #31) — proposer l'ajout aux favoris à la 3ᵉ utilisation. */}
      <Dialog
        open={suggestFav !== null}
        title="Ajouter aux favoris ?"
        description={(() => {
          if (suggestFav === null) return null;
          const ex = safeGet(catalog, suggestFav);
          const name = ex ? displayExerciseName(ex, brand ?? undefined) : suggestFav;
          return (
            <>
              Tu utilises souvent <strong>{name}</strong>. En favori, tu le
              retrouves en tête du Catalogue.
            </>
          );
        })()}
        confirmLabel="Ajouter aux favoris"
        cancelLabel="Non merci"
        onConfirm={() => {
          const id = suggestFav;
          setSuggestFav(null);
          if (id !== null) void engine.toggleFavorite(id);
        }}
        onCancel={() => setSuggestFav(null)}
      />

      {/* Conv #21b — Confirmation systématique avant retrait d'un exo. Texte
          adapté selon qu'il y a des sets cochés ou non. */}
      <Dialog
        open={confirmRemove !== null}
        title="Retirer cet exercice ?"
        description={(() => {
          if (confirmRemove === null) return null;
          const rowDone =
            (entries[confirmRemove] ?? []).filter((s) => s.done).length;
          if (rowDone > 0) {
            return (
              <>
                Tu as déjà coché <strong>{rowDone}</strong> série(s) sur cet
                exercice. Le retirer effacera ces saisies — elles ne seront
                pas enregistrées.
              </>
            );
          }
          return (
            <>L'exercice sera retiré de la séance en cours. Tu peux le
            rajouter via "+ Ajouter un exercice" si tu changes d'avis.</>
          );
        })()}
        confirmLabel="Retirer"
        cancelLabel="Annuler"
        destructive
        onConfirm={() => {
          const idx = confirmRemove;
          setConfirmRemove(null);
          if (idx !== null) {
            void engine.removeExerciseFromCurrentSession(idx);
          }
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}

function safeGet(catalog: Catalog | null, exerciseId: string) {
  if (catalog === null) return null;
  try {
    return catalog.get(exerciseId);
  } catch {
    return null;
  }
}
