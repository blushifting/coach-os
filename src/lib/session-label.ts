/**
 * Nom affiché d'une séance.
 *
 * Convention (Bloc K, Conv #36) : le mot « Séance » appartient à l'**UI**
 * (étiquette de section, en-tête, mot de liaison dans une phrase), PAS au nom.
 * Le nom affiché est donc « A — Full Body », « B — Lower », « Push »… — jamais
 * « Séance A — Full Body ».
 *
 * Transformation **à l'affichage uniquement** : les labels stockés (cycle_plan,
 * feedbacks, démo Alex) gardent leur format moteur (« Full Body A », « Push »,
 * « Workout A2 »…). Avantages : s'applique immédiatement aux plans existants,
 * aucune migration de données, pas de parité Python à maintenir.
 *
 * Règles :
 *  - « Full Body A » (préfixe + lettre A-F finale) → « A — Full Body ».
 *    Depuis Conv #28, `renumberSessionLabels` lettre TOUTES les séances custom
 *    avec une lettre globale unique (« Upper A / Lower B / Focus E ») ; ce cas
 *    couvre donc tous les plans custom.
 *  - tout le reste (« Push », « A2 », labels d'auteur guidés) → tel quel.
 */

const TRAILING_LETTER = /^(.+\S) ([A-F])$/;

export function formatSessionLabel(label: string): string {
  const trimmed = label.trim();
  const m = TRAILING_LETTER.exec(trimmed);
  if (m !== null) {
    return `${m[2]} — ${m[1]}`;
  }
  return trimmed;
}

/**
 * Nom affiché d'une séance / d'un jour de cycle.
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
