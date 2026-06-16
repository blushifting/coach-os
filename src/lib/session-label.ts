/**
 * Conv #28 — préfixe « Séance A/B/C » partout dans l'UI.
 *
 * Transformation **à l'affichage uniquement** : les labels stockés
 * (cycle_plan, feedbacks, démo Alex) gardent leur format moteur
 * (« Full Body A », « Push », « Workout A2 »…). Avantages : s'applique
 * immédiatement aux plans existants, aucune migration de données, pas de
 * parité Python à maintenir.
 *
 * Règles :
 *  - « Full Body A » (préfixe + lettre A-F finale) → « Séance A — Full Body »
 *    Depuis Conv #28, `renumberSessionLabels` lettre TOUTES les séances
 *    custom avec une lettre globale unique (« Upper A / Lower B / Focus E ») ;
 *    ce cas couvre donc tous les plans custom.
 *  - « A » / « A2 » (lettre seule ± chiffre, programmes guidés GreySkull)
 *    → « Séance A » / « Séance A2 »
 *  - tout le reste (labels d'auteur guidés : « Press Day »,
 *    « Upper A (force) ») → « Séance Press Day »… (préfixe simple)
 */

const TRAILING_LETTER = /^(.+\S) ([A-F])$/;
const LETTER_ONLY = /^[A-F]\d*$/;

export function formatSessionLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed === '') return trimmed;
  const m = TRAILING_LETTER.exec(trimmed);
  if (m !== null) {
    return `Séance ${m[2]} — ${m[1]}`;
  }
  if (LETTER_ONLY.test(trimmed)) {
    return `Séance ${trimmed}`;
  }
  return `Séance ${trimmed}`;
}

/**
 * Variante courte pour les espaces contraints (boutons de slots, chips) :
 * même format, sans le mot « Séance ».
 *  - « Full Body A » → « A — Full Body »
 *  - « Push » → « Push »
 */
export function formatSessionLabelShort(label: string): string {
  const trimmed = label.trim();
  const m = TRAILING_LETTER.exec(trimmed);
  if (m !== null) {
    return `${m[2]} — ${m[1]}`;
  }
  return trimmed;
}

/**
 * Bloc G (Conv #32) — nom affiché d'une séance / d'un jour de cycle.
 *
 * Le `custom_name` choisi par l'utilisateur prime sur le label moteur. Sinon on
 * retombe sur la transformation d'affichage habituelle. L'identité de rotation
 * (A/B/C) reste portée par `label` : on ne l'altère jamais ici.
 */
export function sessionDisplayName(s: {
  readonly custom_name?: string | null;
  readonly label: string;
}): string {
  const c = s.custom_name?.trim();
  return c !== undefined && c.length > 0 ? c : formatSessionLabel(s.label);
}

/** Variante courte (sans le mot « Séance ») — cf. `formatSessionLabelShort`. */
export function sessionDisplayNameShort(s: {
  readonly custom_name?: string | null;
  readonly label: string;
}): string {
  const c = s.custom_name?.trim();
  return c !== undefined && c.length > 0 ? c : formatSessionLabelShort(s.label);
}
