/**
 * Conv #21b — Formulaire de création d'un exo custom par l'utilisateur.
 *
 * Sheet plein écran (sur mobile). L'user remplit un brouillon partiel
 * (`CustomExerciseDraft`), on valide, on détecte d'éventuels doublons, et
 * on persiste via `useEngine.addCustomExercise`.
 *
 * Choix UI pour ce premier jet :
 *  - Muscles via chips cyclables 0 / 0.5 / 1.0 (touché secondaire / primaire).
 *    Tap répété sur le même muscle cycle entre les états.
 *  - Silhouette interactive prévue Conv #23 (refonte visuels catalogue) — pour
 *    cette V1 on reste sur des chips listées pour minimiser le risque de
 *    mauvais tap.
 *  - Équipement : input texte libre comma-separated (l'user tape les ids
 *    qu'il reconnaît du catalog, ou laisse vide pour bw pur). Pas de picker
 *    multi-select pour V1.
 *  - Détection doublon : avant de persister, on cherche un match
 *    `exact-name` (bloquant) ou `similar-profile` (warning confirmable).
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { MUSCLES, SYNERGISTES_SANS_QUOTA } from '@/engine/models';
import { useEngine } from '@/hooks/useEngine';
import { cn } from '@/lib/cn';
import {
  buildExerciseDict,
  CHARGE_OPTIONS,
  EMPTY_DRAFT,
  findDuplicate,
  PATTERN_OPTIONS,
  validateDraft,
  type CustomExerciseDraft,
  type DuplicateMatch,
} from '@/lib/custom-exercise';
import { muscleLabel } from '@/lib/progress';
import { useCoachOsStore } from '@/store';

interface CustomExerciseSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Optionnel : callback appelé après création réussie (avec l'id généré). */
  readonly onCreated?: (exerciseId: string) => void;
}

const COEF_LABELS: Record<string, string> = {
  '0.5': 'secondaire',
  '1': 'principal',
};

/** Liste des muscles affichés dans le picker (15 cibles + deltos antérieurs). */
const PICKER_MUSCLES: readonly string[] = [...MUSCLES, ...SYNERGISTES_SANS_QUOTA];

/**
 * Conv #21b-fix — Liste des équipements connus, groupés par famille. Source :
 * audit du catalogue par défaut (33 équipements). L'user coche les siens ; un
 * champ "Autre" en bas permet d'ajouter des équipements non listés.
 *
 * Notion d'équipement annoncée comme transitoire (à supprimer plus tard) ;
 * on garde une UX simple plutôt qu'un picker élaboré.
 */
const KNOWN_EQUIP: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'bb_oly', label: 'Barre olympique' },
  { id: 'rack', label: 'Rack à squat' },
  { id: 'bench_flat', label: 'Banc plat' },
  { id: 'bench_incl', label: 'Banc incliné' },
  { id: 'bench_decl', label: 'Banc décliné' },
  { id: 'smith', label: 'Smith machine' },
  { id: 't_bar', label: 'Barre en T' },
  { id: 'trap_bar', label: 'Barre Trap (hexagonale)' },
  { id: 'db', label: 'Haltères' },
  { id: 'preacher', label: 'Banc Larry Scott (preacher)' },
  { id: 'cable_double', label: 'Poulie double' },
  { id: 'cable_high', label: 'Poulie haute' },
  { id: 'cable_low', label: 'Poulie basse' },
  { id: 'lat_pulldown', label: 'Tirage poulie haute' },
  { id: 'seated_row', label: 'Tirage horizontal assis' },
  { id: 'chest_press', label: 'Pec press machine' },
  { id: 'pec_deck', label: 'Pec deck' },
  { id: 'lateral_machine', label: 'Machine élévations latérales' },
  { id: 'leg_press', label: 'Presse à cuisses' },
  { id: 'hack_squat', label: 'Hack squat' },
  { id: 'leg_extension', label: 'Leg extension' },
  { id: 'leg_curl_lying', label: 'Leg curl allongé' },
  { id: 'leg_curl_seated', label: 'Leg curl assis' },
  { id: 'glute_machine', label: 'Machine fessiers' },
  { id: 'glute_ham', label: 'Glute-ham raise' },
  { id: 'calf_standing', label: 'Mollets debout' },
  { id: 'calf_seated', label: 'Mollets assis' },
  { id: 'back_extension', label: 'Lombaires (banc romain)' },
  { id: 'reverse_hyper', label: 'Reverse hyper' },
  { id: 'pull_bar', label: 'Barre de traction' },
  { id: 'dip_bar', label: 'Barres parallèles (dips)' },
  { id: 'assisted_pullup', label: 'Machine d\'assistance traction/dips' },
  { id: 'ab_wheel', label: 'Roue abdo' },
];

export function CustomExerciseSheet({
  open,
  onClose,
  onCreated,
}: CustomExerciseSheetProps) {
  const engine = useEngine();
  const catalog = useCoachOsStore((s) => s.catalog);
  const [draft, setDraft] = useState<CustomExerciseDraft>(EMPTY_DRAFT);
  // Conv #21b-fix — équipement géré en 2 entrées : checkboxes pour les
  // équipements connus, input texte pour les "Autres" (séparés par virgule).
  // Le `draft.equip` final fusionne les deux.
  const [equipChecked, setEquipChecked] = useState<Set<string>>(new Set());
  const [equipOther, setEquipOther] = useState('');
  const [confirmDuplicate, setConfirmDuplicate] =
    useState<DuplicateMatch | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Sync `draft.equip` = checkboxes ∪ "autres" (recomposé à chaque changement).
  function syncEquip(checked: ReadonlySet<string>, other: string) {
    const others = other
      .split(/[,;]/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    setDraft((d) => ({ ...d, equip: [...checked, ...others] }));
  }
  function onToggleEquipAndSync(id: string) {
    const next = new Set(equipChecked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEquipChecked(next);
    syncEquip(next, equipOther);
  }
  function onEquipOtherChange(v: string) {
    setEquipOther(v);
    syncEquip(equipChecked, v);
  }

  function resetForm() {
    setDraft(EMPTY_DRAFT);
    setEquipChecked(new Set());
    setEquipOther('');
    setConfirmDuplicate(null);
    setSubmitting(false);
    setServerError(null);
  }

  function close() {
    resetForm();
    onClose();
  }

  const errors = useMemo(() => validateDraft(draft), [draft]);
  const errorsByField = useMemo(() => {
    const out: Record<string, string> = {};
    for (const e of errors) out[e.field] = e.message;
    return out;
  }, [errors]);
  const isValid = errors.length === 0;

  async function trySubmit() {
    if (!isValid || catalog === null) return;
    setServerError(null);
    const dup = findDuplicate(draft, catalog.all());
    if (dup !== null && confirmDuplicate?.exercise.id !== dup.exercise.id) {
      // Première détection — on demande confirmation à l'user.
      setConfirmDuplicate(dup);
      return;
    }
    // Bloquant si exact-name même après "confirm" (on refuse l'ajout, l'user
    // doit changer le nom).
    if (dup !== null && dup.kind === 'exact-name') {
      setServerError(
        `Un exercice nommé "${dup.exercise.nom_fr}" existe déjà — change le nom.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const existingIds = new Set(catalog.all().map((e) => e.id));
      const dict = buildExerciseDict(draft, existingIds);
      await engine.addCustomExercise(dict);
      onCreated?.(dict.id);
      close();
    } catch (e) {
      setServerError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Conv #21b-fix — Tap sur un muscle :
   *  - non sélectionné : ajoute en **principal** s'il n'y a pas encore de
   *    principal dans la liste, sinon en **secondaire**. L'idée : le 1er
   *    muscle tapé est le muscle cible principal, les suivants viennent
   *    "autour". Plus naturel que l'ancien cycle 0 → 0.5 → 1.
   *  - déjà sélectionné : cycle principal → secondaire → retiré, pour
   *    pouvoir promouvoir/démouvoir manuellement si besoin.
   */
  function cycleMuscle(muscle: string) {
    setDraft((d) => {
      const cur = d.muscles[muscle] ?? 0;
      const next = { ...d.muscles };
      if (cur === 0) {
        // Ajout : principal si aucun principal présent, sinon secondaire.
        const hasPrincipal = Object.values(d.muscles).some((c) => c >= 0.99);
        next[muscle] = hasPrincipal ? 0.5 : 1;
      } else if (cur >= 0.99) {
        // Démouvoir : principal → secondaire.
        next[muscle] = 0.5;
      } else {
        // Retirer : secondaire → rien.
        delete next[muscle];
      }
      return { ...d, muscles: next };
    });
  }

  /**
   * Conv #21b-fix — Long-press / bouton "promouvoir" pour passer un
   * secondaire en principal explicitement (et démouvoir l'ancien principal
   * en secondaire pour rester cohérent : un seul principal "intentionnel").
   *
   * On expose ce comportement via un bouton dédié sur les chips, plutôt que
   * d'enfouir dans le cycle tap — sinon impossible d'avoir 2 principaux
   * (cas rare mais valide : un curl marteau touche biceps + brachial).
   */
  function makePrincipal(muscle: string) {
    setDraft((d) => {
      const next = { ...d.muscles, [muscle]: 1 };
      return { ...d, muscles: next };
    });
  }

  if (!open) return null;

  return (
    <Sheet open={open} onClose={close} title="Créer un exercice">
      <div className="max-h-[80dvh] overflow-y-auto pr-1">
        <div className="flex flex-col gap-4">
          <Field label="Nom de l'exercice *" error={errorsByField['nom_fr']}>
            <input
              data-testid="custom-name"
              type="text"
              placeholder="ex: Curl marteau avec rotation"
              value={draft.nom_fr}
              onChange={(e) =>
                setDraft((d) => ({ ...d, nom_fr: e.target.value }))
              }
              className="w-full rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white outline-none focus:border-sang-700/60"
            />
          </Field>

          <Field label="Type de charge *" error={errorsByField['charge']}>
            <select
              data-testid="custom-charge"
              value={draft.charge}
              onChange={(e) =>
                setDraft((d) => ({ ...d, charge: e.target.value }))
              }
              className="w-full rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white outline-none focus:border-sang-700/60"
            >
              {CHARGE_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Type de mouvement *" error={errorsByField['pattern']}>
            <select
              data-testid="custom-pattern"
              value={draft.pattern}
              onChange={(e) =>
                setDraft((d) => ({ ...d, pattern: e.target.value }))
              }
              className="w-full rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white outline-none focus:border-sang-700/60"
            >
              {PATTERN_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Catégorie">
            <div className="flex gap-2">
              {(['compound', 'isolation'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  data-testid={`custom-type-${t}`}
                  onClick={() => setDraft((d) => ({ ...d, type: t }))}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm transition',
                    draft.type === t
                      ? 'border-sang-700 bg-sang-900/30 text-white'
                      : 'border-anthracite-700 bg-anthracite-900 text-anthracite-300',
                  )}
                >
                  {t === 'compound' ? 'Polyarticulaire' : 'Isolation'}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Unilatéral (1 côté à la fois)">
            <button
              type="button"
              data-testid="custom-uni"
              onClick={() => setDraft((d) => ({ ...d, uni: !d.uni }))}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm transition',
                draft.uni
                  ? 'border-sang-700 bg-sang-900/30 text-white'
                  : 'border-anthracite-700 bg-anthracite-900 text-anthracite-300',
              )}
            >
              {draft.uni ? '✓ Unilatéral' : 'Bilatéral'}
            </button>
          </Field>

          <Field
            label="Muscles travaillés *"
            error={errorsByField['muscles']}
            help="1er muscle tapé = principal, les suivants = secondaires. Tap secondaire : retire ; tap principal : passe en secondaire. Bouton ★ pour promouvoir un secondaire en principal."
          >
            <div className="flex flex-wrap gap-1.5">
              {PICKER_MUSCLES.map((m) => {
                const coef = draft.muscles[m] ?? 0;
                const variant =
                  coef >= 0.99 ? 'primary' : coef >= 0.4 ? 'secondary' : 'off';
                return (
                  <div
                    key={m}
                    className={cn(
                      'inline-flex items-stretch overflow-hidden rounded-full border text-xs',
                      variant === 'primary'
                        ? 'border-sang-500 bg-sang-700 text-white'
                        : variant === 'secondary'
                          ? 'border-sang-900 bg-sang-900/40 text-sang-200'
                          : 'border-anthracite-700 bg-anthracite-900 text-anthracite-300',
                    )}
                  >
                    <button
                      type="button"
                      data-testid={`custom-muscle-${m}`}
                      data-coef={coef}
                      onClick={() => cycleMuscle(m)}
                      className="px-2.5 py-1 transition"
                    >
                      {muscleLabel(m)}
                      {variant !== 'off' ? (
                        <span className="ml-1 text-[10px] opacity-70">
                          ({COEF_LABELS[String(coef)] ?? coef})
                        </span>
                      ) : null}
                    </button>
                    {variant === 'secondary' ? (
                      <button
                        type="button"
                        data-testid={`custom-muscle-promote-${m}`}
                        aria-label={`Passer ${muscleLabel(m)} en principal`}
                        onClick={() => makePrincipal(m)}
                        className="border-l border-sang-900 px-1.5 text-[10px] hover:bg-sang-800/40"
                      >
                        ★
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Field>

          <Field
            label="Équipement requis"
            help="Coche tout ce que l'exercice demande à ta salle. Laisse tout décoché pour un exercice au poids du corps. Tu peux ajouter des équipements inconnus dans le champ 'Autre' (séparés par virgule)."
          >
            <div className="flex max-h-44 flex-wrap gap-1 overflow-y-auto rounded-lg border border-anthracite-700 bg-anthracite-900/50 p-2">
              {KNOWN_EQUIP.map((e) => {
                const isChecked = equipChecked.has(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    data-testid={`custom-equip-${e.id}`}
                    data-checked={isChecked ? 'true' : 'false'}
                    onClick={() => onToggleEquipAndSync(e.id)}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] transition',
                      isChecked
                        ? 'border-sang-500 bg-sang-900/40 text-white'
                        : 'border-anthracite-700 bg-anthracite-900 text-anthracite-300 hover:text-white',
                    )}
                  >
                    {e.label}
                  </button>
                );
              })}
            </div>
            <input
              data-testid="custom-equip-other"
              type="text"
              placeholder="Autre (séparé par virgules) — ex : barre ezx, sangles"
              value={equipOther}
              onChange={(e) => onEquipOtherChange(e.target.value)}
              className="mt-2 w-full rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white outline-none focus:border-sang-700/60"
            />
          </Field>

          <Field label="Note (optionnel)">
            <textarea
              data-testid="custom-note"
              rows={2}
              placeholder="Tempo, points de vigilance, variation perso…"
              value={draft.note}
              onChange={(e) =>
                setDraft((d) => ({ ...d, note: e.target.value }))
              }
              className="w-full rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white outline-none focus:border-sang-700/60"
            />
          </Field>

          {confirmDuplicate !== null ? (
            <div
              data-testid="custom-dup-warning"
              className="rounded-lg border border-amber-700/60 bg-amber-900/20 p-3 text-sm text-amber-200"
            >
              <p className="font-semibold">
                Ressemble à : {confirmDuplicate.exercise.nom_fr}
              </p>
              <p className="mt-1 text-xs text-amber-300/80">
                {confirmDuplicate.kind === 'exact-name'
                  ? 'Le nom est déjà pris. Change le nom pour pouvoir créer.'
                  : 'Même mouvement, même charge, mêmes muscles. Si tu as une vraie variation (tempo, pause, prise), continue. Sinon utilise l\'exercice existant.'}
              </p>
            </div>
          ) : null}

          {serverError !== null ? (
            <p
              data-testid="custom-error"
              className="text-sm text-sang-400"
            >
              {serverError}
            </p>
          ) : null}

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={close} fullWidth>
              Annuler
            </Button>
            <Button
              variant="primary"
              fullWidth
              data-testid="custom-submit"
              onClick={() => void trySubmit()}
              disabled={submitting || !isValid}
            >
              {confirmDuplicate !== null &&
              confirmDuplicate.kind === 'similar-profile'
                ? 'Créer quand même'
                : 'Créer cet exercice'}
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function Field({
  label,
  error,
  help,
  children,
}: {
  label: string;
  error?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-anthracite-300">
        {label}
      </span>
      {children}
      {help !== undefined && error === undefined ? (
        <span className="text-[11px] leading-snug text-anthracite-400">
          {help}
        </span>
      ) : null}
      {error !== undefined ? (
        <span className="text-[11px] leading-snug text-sang-400">{error}</span>
      ) : null}
    </div>
  );
}
