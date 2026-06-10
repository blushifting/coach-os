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
 *  - « A » / « A2 » (lettre seule ± chiffre, programmes guidés GreySkull)
 *    → « Séance A » / « Séance A2 »
 *  - tout le reste (« Push », « Bonus », « Press Day », « Upper A (force) »)
 *    → « Séance Push », « Séance Bonus »… (préfixe simple)
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
