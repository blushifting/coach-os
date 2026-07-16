/**
 * Silhouette anatomique double (face + dos) — Conv #8b.
 *
 * Polygones musculaires extraits du projet open-source
 * `react-body-highlighter` (https://github.com/giavinh79/react-body-highlighter,
 * MIT © 2020 GV79). Les coordonnées sont en pourcentage du viewBox 100×220 par
 * silhouette (face = 0-100, dos = 110-210 sur l'axe X global).
 *
 * Adaptation Coach OS :
 *  - Mapping FR → groupes RBH (cf. CO_TO_FACE / CO_TO_BACK).
 *  - Conv #65 — redécoupage du dos (cf. bloc BACK_POLYS pour le détail des
 *    coupes). Les 3 muscles dorsaux suivis ne tombaient pas sur les bons
 *    polygones ; on recoupe les formes RBH d'origine au lieu d'en ajouter.
 *  - Statut par muscle (off / low / ok / high / highlight / synergist) →
 *    classe Tailwind via `TONE_FILL`.
 *  - Zones neutres (tête, genoux, avant-bras) : gris constant.
 *
 * Composant utilisé par :
 *  - `pages/progres/CoverageView` (face + dos, h-48)
 *  - `pages/catalogue/MiniSilhouette` (face uniquement, h-20, mini cards)
 */

import { cn } from '@/lib/cn';
import type { CoverageStatus } from '@/lib/progress';

export type SilhouetteStatus =
  | 'off'
  | 'low'
  | 'ok'
  | 'high'
  | 'highlight'
  | 'synergist';

/**
 * Conv #20 — palette de coloration selon le contexte d'usage :
 *  - `legacy` (défaut) — coloration "anatomique" multi-teinte historique,
 *     utilisée par le Catalogue (mini silhouette + détail exo). Distingue
 *     primaire / synergiste avec deux teintes de sang. Inchangée.
 *  - `volume` — mono-teinte sang pour la vue Progrès → Volume. La couleur
 *     graduée signale uniquement la position relative au volume cible
 *     (sang-900 sous V_min → sang-600 cible → sang-400 au-dessus).
 *  - `priority` — palette amber/or pour la sélection des muscles
 *     prioritaires en onboarding. Top 3 "brille" en amber-400, autres en
 *     amber-700.
 *  - `objective` (Conv #28) — onboarding Step2 « pinceau » : une teinte par
 *     objectif. Mapping statut→objectif : `highlight`=Hypertrophie (or),
 *     `high`=Force (sang), `low`=Endurance (cyan), `ok`=Maintien (orange
 *     sombre). Rampe chaude = intensité de charge décroissante (sang > or >
 *     orange sombre) ; le cyan, seule teinte froide, marque la rupture
 *     qualitative de l'endurance (charges légères, longues séries).
 */
export type SilhouettePalette = 'legacy' | 'volume' | 'priority' | 'objective';

export interface AnatomicalSilhouetteProps {
  /** Mapping `muscle_id` Coach OS → statut. Muscle absent = `off`. */
  readonly highlights?: Readonly<Record<string, SilhouetteStatus>>;
  /** Largeur CSS (hauteur déduite de l'aspect ratio). */
  readonly className?: string;
  /**
   * Vue affichée :
   *  - `'both'` (défaut) : face + dos côte à côte (Couverture).
   *  - `'face'` / `'back'` : une seule vue forcée.
   *  - `'auto'` : une seule vue, choisie automatiquement selon `highlights`
   *    (score primaire + synergiste ; la vue qui met le plus en valeur gagne).
   */
  readonly view?: 'both' | 'face' | 'back' | 'auto';
  /** id pour data-testid (debug + tests). */
  readonly testId?: string;
  /**
   * Conv #17 — silhouette cliquable. Callback appelé avec le `muscle_id`
   * Coach OS quand l'utilisateur tape sur une zone musculaire mappée.
   * Si absent, la silhouette reste purement présentationnelle (aria-hidden).
   */
  readonly onMuscleClick?: (muscle: string) => void;
  /** Muscle actuellement sélectionné (souligné d'un liseré). */
  readonly selectedMuscle?: string | null;
  /** Conv #20 — palette de coloration (défaut `legacy`). */
  readonly palette?: SilhouettePalette;
}

// Conv #18 — bumpé d'un cran pour mieux ressortir du fond Card
// (anthracite-900 = #14161a). Les muscles non coloriés étaient à -700
// (#262a30) → quasi-invisibles. Passés à -500 (#454a52) : la silhouette
// reste lisible même quand aucun statut n'est posé. Le neutral (zones
// tête/cou/genoux) reste un cran en dessous pour la hiérarchie.
const TONE_FILL_LEGACY: Record<SilhouetteStatus, string> = {
  off: 'fill-anthracite-500',
  low: 'fill-sang-800',
  ok: 'fill-emerald-700',
  high: 'fill-amber-700',
  highlight: 'fill-sang-700',
  synergist: 'fill-sang-900',
};

// Conv #20 — Vue Volume (Progrès) : mono-teinte sang qui exprime la position
// relative au cible V_min/V_max. Le contraste fait tout le travail (pas de
// stroke effect ni d'animation).
//   sous V_min  → sang-900 (sombre, peu présent)
//   dans cible  → sang-600 (couleur marque pleine — "santé")
//   au-dessus   → sang-400 (clair vif, ressort visuellement = junk volume)
const TONE_FILL_VOLUME: Record<SilhouetteStatus, string> = {
  off: 'fill-anthracite-500',
  low: 'fill-sang-900',
  ok: 'fill-sang-600',
  high: 'fill-sang-400',
  highlight: 'fill-sang-600',
  synergist: 'fill-sang-900',
};

// Conv #20 — Onboarding Step2 (sélection muscles prioritaires) : famille amber.
// Top 3 = highlight (amber-400, brille), rank 4+ = ok (amber-700, plus discret).
const TONE_FILL_PRIORITY: Record<SilhouetteStatus, string> = {
  off: 'fill-anthracite-500',
  low: 'fill-amber-700',
  ok: 'fill-amber-700',
  high: 'fill-amber-400',
  highlight: 'fill-amber-400',
  synergist: 'fill-amber-700',
};

// Conv #28 — Onboarding Step2 pinceau : une teinte par objectif (cf. doc du
// type SilhouettePalette). `synergist` inutilisé dans ce contexte.
const TONE_FILL_OBJECTIVE: Record<SilhouetteStatus, string> = {
  off: 'fill-anthracite-500',
  low: 'fill-cyan-500',
  ok: 'fill-amber-700',
  high: 'fill-sang-500',
  highlight: 'fill-amber-400',
  synergist: 'fill-anthracite-500',
};

const PALETTES: Record<SilhouettePalette, Record<SilhouetteStatus, string>> = {
  legacy: TONE_FILL_LEGACY,
  volume: TONE_FILL_VOLUME,
  priority: TONE_FILL_PRIORITY,
  objective: TONE_FILL_OBJECTIVE,
};

const NEUTRAL_FILL = 'fill-anthracite-600';
const STROKE = 'stroke-anthracite-400';

// =============================================================================
// Polygones FACE (extraits de react-body-highlighter — anteriorData)
// viewBox local 0 0 100 220
// =============================================================================

const FACE_POLYS = {
  // Conv #19 — head symétrisé sur x=50 (asset RBH d'origine était asymétrique
  // en 3/4 vue, ce qui est étrange sur une silhouette frontale stylisée).
  head: [
    '42.4489796 2.85714286 40 11.8367347 42.0408163 19.5918367 46.122449 23.2653061 50 25.3061224 53.877551 23.2653061 57.9591837 19.5918367 60 11.8367347 57.5510204 2.85714286 50 0',
  ],
  neck: [
    '55.5102041 23.6734694 50.6122449 33.4693878 50.6122449 39.1836735 61.6326531 40 70.6122449 44.8979592 69.3877551 36.7346939 63.2653061 35.1020408 58.3673469 30.6122449',
    '28.9795918 44.8979592 30.2040816 37.1428571 36.3265306 35.1020408 41.2244898 30.2040816 44.4897959 24.4897959 48.9795918 33.877551 48.5714286 39.1836735 37.9591837 39.5918367',
  ],
  chest: [
    '51.8367347 41.6326531 51.0204082 55.1020408 57.9591837 57.9591837 67.755102 55.5102041 70.6122449 47.3469388 62.0408163 41.6326531',
    '29.7959184 46.5306122 31.4285714 55.5102041 40.8163265 57.9591837 48.1632653 55.1020408 47.755102 42.0408163 37.5510204 42.0408163',
  ],
  front_deltoids: [
    '78.3673469 53.0612245 79.5918367 47.755102 79.1836735 41.2244898 75.9183673 37.9591837 71.0204082 36.3265306 72.244898 42.8571429 71.4285714 47.3469388',
    '28.1632653 47.3469388 21.2244898 53.0612245 20 47.755102 20.4081633 40.8163265 24.4897959 37.1428571 28.5714286 37.1428571 26.9387755 43.2653061',
  ],
  biceps: [
    '16.7346939 68.1632653 17.9591837 71.4285714 22.8571429 66.122449 28.9795918 53.877551 27.755102 49.3877551 20.4081633 55.9183673',
    '71.4285714 49.3877551 70.2040816 54.6938776 76.3265306 66.122449 81.6326531 71.8367347 82.8571429 68.9795918 78.7755102 55.5102041',
  ],
  triceps: [
    '69.3877551 55.5102041 69.3877551 61.6326531 75.9183673 72.6530612 77.5510204 70.2040816 75.5102041 67.3469388',
    '22.4489796 69.3877551 29.7959184 55.5102041 29.7959184 60.8163265 22.8571429 73.0612245',
  ],
  obliques: [
    '68.5714286 63.2653061 67.3469388 57.1428571 58.7755102 59.5918367 60 64.0816327 60.4081633 83.2653061 65.7142857 78.7755102 66.5306122 69.7959184',
    '33.877551 78.3673469 33.0612245 71.8367347 31.0204082 63.2653061 32.244898 57.1428571 40.8163265 59.1836735 39.1836735 63.2653061 39.1836735 83.6734694',
  ],
  abs: [
    '56.3265306 59.1836735 57.9591837 64.0816327 58.3673469 77.9591837 58.3673469 92.6530612 56.3265306 98.3673469 55.1020408 104.081633 51.4285714 107.755102 51.0204082 84.4897959 50.6122449 67.3469388 51.0204082 57.1428571',
    '43.6734694 58.7755102 48.5714286 57.1428571 48.9795918 67.3469388 48.5714286 84.4897959 48.1632653 107.346939 44.4897959 103.673469 40.8163265 91.4285714 40.8163265 78.3673469 41.2244898 64.4897959',
  ],
  abductors: [
    '52.6530612 110.204082 54.2857143 124.897959 60 110.204082 62.0408163 100 64.8979592 94.2857143 60 92.6530612 56.7346939 104.489796',
    '47.755102 110.612245 44.8979592 125.306122 42.0408163 115.918367 40.4081633 113.061224 39.5918367 107.346939 37.9591837 102.44898 34.6938776 93.877551 39.5918367 92.244898 41.6326531 99.1836735 43.6734694 105.306122',
  ],
  quadriceps: [
    '34.6938776 98.7755102 37.1428571 108.163265 37.1428571 127.755102 34.2857143 137.142857 31.0204082 132.653061 29.3877551 120 28.1632653 111.428571 29.3877551 100.816327 32.244898 94.6938776',
    '63.2653061 105.714286 64.4897959 100 66.9387755 94.6938776 70.2040816 101.22449 71.0204082 111.836735 68.1632653 133.061224 65.3061224 137.55102 62.4489796 128.571429 62.0408163 111.428571',
    '38.7755102 129.387755 38.3673469 112.244898 41.2244898 118.367347 44.4897959 129.387755 42.8571429 135.102041 40 146.122449 36.3265306 146.530612 35.5102041 140',
    '59.5918367 145.714286 55.5102041 128.979592 60.8163265 113.877551 61.2244898 130.204082 64.0816327 139.591837 62.8571429 146.530612',
    '32.6530612 138.367347 26.5306122 145.714286 25.7142857 136.734694 25.7142857 127.346939 26.9387755 114.285714 29.3877551 133.469388',
    '71.8367347 113.061224 73.877551 124.081633 73.877551 140.408163 72.6530612 145.714286 66.5306122 138.367347 70.2040816 133.469388',
  ],
  knees: [
    '33.877551 140 34.6938776 143.265306 35.5102041 147.346939 36.3265306 151.020408 35.1020408 156.734694 29.7959184 156.734694 27.3469388 152.653061 27.3469388 147.346939 30.2040816 144.081633',
    '65.7142857 140 72.244898 147.755102 72.244898 152.244898 69.7959184 157.142857 64.8979592 156.734694 62.8571429 151.020408',
  ],
  calves: [
    '71.4285714 160.408163 73.4693878 153.469388 76.7346939 161.22449 79.5918367 167.755102 78.3673469 187.755102 79.5918367 195.510204 74.6938776 195.510204',
    '24.8979592 194.693878 27.755102 164.897959 28.1632653 160.408163 26.122449 154.285714 24.8979592 157.55102 22.4489796 161.632653 20.8163265 167.755102 22.0408163 188.163265 20.8163265 195.510204',
    '72.6530612 195.102041 69.7959184 159.183673 65.3061224 158.367347 64.0816327 162.44898 64.0816327 165.306122 65.7142857 177.142857',
    '35.5102041 158.367347 35.9183673 162.44898 35.9183673 166.938776 35.1020408 172.244898 35.1020408 176.734694 32.244898 182.040816 30.6122449 187.346939 26.9387755 194.693878 27.3469388 187.755102 28.1632653 180.408163 28.5714286 175.510204 28.9795918 169.795918 29.7959184 164.081633 30.2040816 158.77551',
  ],
  forearm: [
    '6.12244898 88.5714286 10.2040816 75.1020408 14.6938776 70.2040816 16.3265306 74.2857143 19.1836735 73.4693878 4.48979592 97.5510204 0 100',
    '84.4897959 69.7959184 83.2653061 73.4693878 80 73.0612245 95.1020408 98.3673469 100 100.408163 93.4693878 89.3877551 89.7959184 76.3265306',
    '77.5510204 72.244898 77.5510204 77.5510204 80.4081633 84.0816327 85.3061224 89.7959184 92.244898 101.22449 94.6938776 99.5918367',
    '6.93877551 101.22449 13.4693878 90.6122449 18.7755102 84.0816327 21.6326531 77.1428571 21.2244898 71.8367347 4.89795918 98.7755102',
  ],
} as const;

// =============================================================================
// Polygones DOS (extraits de react-body-highlighter — posteriorData)
// =============================================================================

const BACK_POLYS = {
  // Conv #19 — head symétrisé sur x=50 (asset RBH d'origine était asymétrique).
  head: [
    '50 0 45.96 0.85 40.85 5.53 40.43 12.77 45.11 20 54.89 20 59.57 12.77 59.15 5.53 54.04 0.85',
  ],
  // ---------------------------------------------------------------------------
  // Conv #65 — redécoupage du dos.
  //
  // Constat : les polygones RBH ne tombaient sur AUCUN des 3 muscles dorsaux
  // suivis.
  //  - `trapezius` descend du cou à y=65 (milieu du dos) = le trapèze ENTIER,
  //    alors que `trapezes_hauts` ne désigne que les fibres descendantes
  //    (cou → clavicule/acromion).
  //  - `upper_back` est la bande latérale épaule → taille : c'est le territoire
  //    du grand dorsal, pas des rhomboïdes. Ces derniers sont médiaux et
  //    PROFONDS (sous le trapèze), donc sous l'ancienne zone `trapezius`.
  //  - `dos_largeur` était rendu par 2 petits polygones custom coincés sur le
  //    flanc : le plus gros muscle du dos avait la plus petite tache.
  //
  // Correction : on recoupe les formes RBH d'origine, sans inventer de sommet
  // (les deux coupes relient des sommets existants de l'asset).
  //  - Coupe 1 — `trapezius` scindé le long de C7 (47,23 ; 38,30) → sommet
  //    (35,32 ; 40,85) → acromion. Le haut reste `trapezes_hauts` ; le bas
  //    (fibres moyennes + inférieures, rhomboïdes dessous) rejoint le bloc
  //    `upper_back`. Passer par (35,32 ; 40,85) plutôt que de tirer une droite
  //    rachis→acromion évite une longue barre horizontale en travers du dos et
  //    rend au trapèze sa pente naturelle vers l'épaule.
  //  - Coupe 2 — `upper_back` scindé sur la diagonale aisselle (28,09 ; 48,94)
  //    → (38,30 ; 53,19). Au-dessus = scapula (infra-épineux / petit rond) :
  //    reste dans `upper_back`. En dessous = aile du grand dorsal → `lats`.
  //    La diagonale suit les fibres hautes du dorsal, quasi horizontales, qui
  //    remontent vers l'aisselle : son apex tombe enfin sur l'insertion réelle
  //    (sillon intertuberculaire de l'humérus).
  //  - `lower_back` inchangé. Une variante prolongeant le dorsal jusqu'à la
  //    crête iliaque (origine réelle via le fascia thoraco-lombaire) a été
  //    écartée : elle écrase le V lombaire, et à ce niveau le dorsal est
  //    aponévrotique, pas charnu.
  //
  // Coutures des nouvelles coupes = 1,8 unité, calées sur les coutures
  // existantes de l'asset (mesurées à 1,75). Formes définies sur la moitié
  // gauche puis mises en miroir (x → 100−x), ce qui corrige au passage
  // l'asymétrie du trapèze RBH (cf. Conv #19 pour la tête et les triceps).
  // ---------------------------------------------------------------------------
  trapezius_upper: [
    '44.68 21.70 47.66 21.70 47.23 37.40 35.32 39.95 31.06 36.60 39.15 33.19 43.83 27.23',
    '55.32 21.70 52.34 21.70 52.77 37.40 64.68 39.95 68.94 36.60 60.85 33.19 56.17 27.23',
  ],
  back_deltoids: [
    '29.3617021 37.0212766 22.9787234 39.1489362 17.4468085 44.2553191 18.2978723 53.6170213 24.2553191 49.3617021 27.2340426 46.3829787',
    '71.0638298 37.0212766 78.2978723 39.5744681 82.5531915 44.6808511 81.7021277 53.6170213 74.893617 48.9361702 72.3404255 45.106383',
  ],
  // Trapèze moyen + inférieur, rhomboïdes dessous, et région scapulaire
  // au-dessus de l'aisselle : un seul bloc par côté.
  upper_back: [
    '47.23 39.20 47.66 64.68 38.30 53.19 28.09 48.94 31.06 38.72 35.32 41.75',
    '52.77 39.20 52.34 64.68 61.70 53.19 71.91 48.94 68.94 38.72 64.68 41.75',
  ],
  // Grand dorsal : apex à l'aisselle, aile qui s'évase vers la taille.
  lats: [
    '28.23 51.06 28.51 55.32 34.04 75.32 47.23 71.06 47.23 66.38 37.40 54.97',
    '71.77 51.06 71.49 55.32 65.96 75.32 52.77 71.06 52.77 66.38 62.60 54.97',
  ],
  // Conv #19 — triceps droits symétrisés sur les gauches (asset RBH d'origine
  // était légèrement asymétrique, ce qui faisait que les lats droits — miroir
  // parfait des gauches — touchaient le bras alors que les gauches non).
  triceps: [
    '26.8085106 49.787234 17.8723404 55.7446809 14.4680851 72.3404255 16.5957447 81.7021277 21.7021277 63.8297872 26.8085106 55.7446809',
    '73.1914894 49.787234 82.1276596 55.7446809 85.5319149 72.3404255 83.4042553 81.7021277 78.2978723 63.8297872 73.1914894 55.7446809',
    '26.8085106 58.2978723 26.8085106 68.5106383 22.9787234 75.3191489 19.1489362 77.4468085 22.5531915 65.5319149',
    '73.1914894 58.2978723 73.1914894 68.5106383 77.0212766 75.3191489 80.8510638 77.4468085 77.4468085 65.5319149',
  ],
  lower_back: [
    '47.6595745 72.7659574 34.4680851 77.0212766 35.3191489 83.4042553 49.3617021 102.12766 46.8085106 82.9787234',
    '52.3404255 72.7659574 65.5319149 77.0212766 64.6808511 83.4042553 50.6382979 102.12766 53.1914894 83.8297872',
  ],
  forearm: [
    '86.3829787 75.7446809 91.0638298 83.4042553 93.1914894 94.0425532 100 106.382979 96.1702128 104.255319 88.0851064 89.3617021 84.2553191 83.8297872',
    '13.6170213 75.7446809 8.93617021 83.8297872 6.80851064 93.6170213 0 106.382979 3.82978723 104.255319 12.3404255 88.5106383 15.7446809 82.9787234',
    '81.2765957 79.5744681 77.4468085 77.8723404 79.1489362 84.6808511 91.0638298 103.829787 93.1914894 108.93617 94.4680851 104.680851',
    '18.7234043 79.5744681 22.1276596 77.8723404 20.8510638 84.2553191 9.36170213 102.978723 6.80851064 108.510638 5.10638298 104.680851',
  ],
  gluteal: [
    '44.6808511 99.5744681 30.212766 108.510638 29.787234 118.723404 31.4893617 125.957447 47.2340426 121.276596 49.3617021 114.893617',
    '55.3191489 99.1489362 51.0638298 114.468085 52.3404255 120.851064 68.0851064 125.957447 69.787234 119.148936 69.3617021 108.510638',
  ],
  abductor: [
    '48.0851064 122.978723 44.6808511 122.978723 41.2765957 125.531915 45.106383 144.255319 48.5106383 135.744681 48.9361702 129.361702',
    '51.9148936 122.553191 55.7446809 123.404255 59.1489362 125.957447 54.893617 144.255319 51.9148936 136.170213 51.0638298 129.361702',
  ],
  hamstring: [
    '28.9361702 122.12766 31.0638298 129.361702 36.5957447 125.957447 35.3191489 135.319149 34.4680851 150.212766 29.3617021 158.297872 28.9361702 146.808511 27.6595745 141.276596 27.2340426 131.489362',
    '71.4893617 121.702128 69.3617021 128.93617 63.8297872 125.957447 65.5319149 136.595745 66.3829787 150.212766 71.0638298 158.297872 71.4893617 147.659574 72.7659574 142.12766 73.6170213 131.914894',
    '38.7234043 125.531915 44.2553191 145.957447 40.4255319 166.808511 36.1702128 152.765957 37.0212766 135.319149',
    '61.7021277 125.531915 63.4042553 136.170213 64.2553191 153.191489 60 166.808511 56.1702128 146.382979',
  ],
  knees: [
    '34.4680851 153.191489 31.0638298 159.148936 33.6170213 166.382979 37.4468085 162.553191',
    '66.3829787 153.617021 62.9787234 162.978723 66.8085106 166.382979 69.3617021 159.148936',
  ],
  // Mollets : on retire les 2 polygones SOLEUS (talons, y=195-220 dans
  // l'original RBH) qui débordaient hors du viewBox aligné face/dos.
  // Le soleus reste représenté par les polygones CALVES principaux.
  calves: [
    '29.3617021 160.425532 28.5106383 167.234043 24.6808511 179.574468 23.8297872 192.765957 25.5319149 197.021277 28.5106383 193.191489 29.787234 180 31.9148936 171.06383 31.9148936 166.808511',
    '37.4468085 165.106383 35.3191489 167.659574 33.1914894 171.914894 31.0638298 180.425532 30.212766 191.914894 34.0425532 200 38.7234043 190.638298 39.1489362 168.93617',
    '62.9787234 165.106383 61.2765957 168.510638 61.7021277 190.638298 66.3829787 199.574468 70.6382979 191.914894 68.9361702 179.574468 66.8085106 170.212766',
    '70.6382979 160.425532 72.3404255 168.510638 75.7446809 179.148936 76.5957447 192.765957 74.4680851 196.595745 72.3404255 193.617021 70.6382979 179.574468 68.0851064 168.085106',
  ],
} as const;

// =============================================================================
// Mapping Coach OS → groupes RBH
// =============================================================================

/** Muscles Coach OS visibles côté face, et les groupes RBH qui les représentent. */
const CO_TO_FACE: Record<string, readonly string[]> = {
  pectoraux: FACE_POLYS.chest,
  trapezes_hauts: FACE_POLYS.neck,
  // FRONT_DELTOIDS représente l'épaule de face — couvre les deltos antérieurs
  // ET latéraux (ils se chevauchent visuellement de face).
  // Conv #17b — ordre : deltos_anterieurs **puis** deltos_lateraux pour que
  // le `<g>` cliquable de deltos_lateraux soit rendu en dernier (donc gagne
  // le click). Important parce que deltos_anterieurs n'est pas un muscle
  // suivi (`SYNERGISTES_SANS_QUOTA`) → cliquer doit cibler le muscle suivi
  // (lateraux). La coloration est sans dommage : si l'un des deux a un
  // status ≠ off et l'autre off, le `<g>` rendu en dernier gagne ; donc
  // un exo qui n'active que deltos_anterieurs apparaîtra atténué à juste
  // titre (mais le helpTopic `deltoides` explique cette logique).
  deltos_anterieurs: FACE_POLYS.front_deltoids,
  deltos_lateraux: FACE_POLYS.front_deltoids,
  biceps: FACE_POLYS.biceps,
  triceps: FACE_POLYS.triceps,
  abdos: FACE_POLYS.abs,
  obliques: FACE_POLYS.obliques,
  // Note : `fessiers` est volontairement absent ici. Le glute est visible
  // côté dos uniquement (cf. CO_TO_BACK.fessiers) → `pickBestSide` bascule
  // automatiquement vers la vue dos pour les exos qui ciblent les fessiers
  // (ex : kickback poulie, hip thrust). Avant Conv #10c', les fessiers
  // étaient aussi mappés sur `FACE_POLYS.abductors` → égalité face/dos →
  // pickBestSide retournait `face` par défaut → mauvaise vue.
  quadriceps: FACE_POLYS.quadriceps,
  mollets: FACE_POLYS.calves,
};

/** Muscles Coach OS visibles côté dos. */
const CO_TO_BACK: Record<string, readonly string[]> = {
  // Conv #65 — fibres descendantes seules, cohérent avec CO_TO_FACE qui mappe
  // déjà `trapezes_hauts` sur la pente cou-épaule (les fibres descendantes
  // s'insèrent sur le tiers latéral de la clavicule, donc visibles de face).
  // Avant le redécoupage les deux vues se contredisaient : trapèze entier de
  // dos, fibres descendantes seules de face.
  trapezes_hauts: BACK_POLYS.trapezius_upper,
  dos_epaisseur: BACK_POLYS.upper_back,
  dos_largeur: BACK_POLYS.lats,
  deltos_posterieurs: BACK_POLYS.back_deltoids,
  triceps: BACK_POLYS.triceps,
  lombaires: BACK_POLYS.lower_back,
  // Fessiers couvrent gluteal + abductor postérieur.
  fessiers: [...BACK_POLYS.gluteal, ...BACK_POLYS.abductor],
  ischios: BACK_POLYS.hamstring,
  mollets: BACK_POLYS.calves,
};

// =============================================================================
// Composant
// =============================================================================

// Conv #65 — `neck` retiré : il est mappé sur `trapezes_hauts` (CO_TO_FACE) et
// les muscles sont rendus après les neutres, donc la version colorée gagnait
// toujours. L'entrée était morte et contredisait le commentaire d'en-tête.
const FACE_NEUTRALS = [FACE_POLYS.head, FACE_POLYS.knees, FACE_POLYS.forearm];
const BACK_NEUTRALS = [BACK_POLYS.head, BACK_POLYS.knees, BACK_POLYS.forearm];

/**
 * Choisit la vue la plus représentative selon les muscles highlightés.
 * Pondération : primaire = 3, synergiste = 1. La vue qui obtient le score
 * le plus élevé est sélectionnée ; en cas d'égalité, on garde la face.
 */
export function pickBestSide(
  highlights: Readonly<Record<string, SilhouetteStatus>> | undefined,
): 'face' | 'back' {
  if (!highlights) return 'face';
  let faceScore = 0;
  let backScore = 0;
  for (const [muscle, status] of Object.entries(highlights)) {
    const w = status === 'highlight' ? 3 : status === 'synergist' ? 1 : 0;
    if (w === 0) continue;
    if (muscle in CO_TO_FACE) faceScore += w;
    if (muscle in CO_TO_BACK) backScore += w;
  }
  return backScore > faceScore ? 'back' : 'face';
}

export function AnatomicalSilhouette({
  highlights,
  className,
  view = 'both',
  testId,
  onMuscleClick,
  selectedMuscle = null,
  palette = 'legacy',
}: AnatomicalSilhouetteProps) {
  const resolvedView: 'both' | 'face' | 'back' =
    view === 'auto' ? pickBestSide(highlights) : view;
  const viewBox = resolvedView === 'both' ? '0 0 210 196' : '0 0 100 196';
  const interactive = onMuscleClick !== undefined;
  const toneFill = PALETTES[palette];

  // Le dataset upstream (RBH) a une face qui s'étend de y=0 à 195.5 et un
  // dos de y=0 à 200 — différence de proportions entre les deux dessins
  // d'origine. On applique un scale Y au dos pour aligner sa hauteur totale
  // (et donc la position des chevilles, genoux, bassin) à la face.
  const BACK_SCALE_Y = 195.5 / 200;
  const backTransform = `scale(1 ${BACK_SCALE_Y})`;

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden={interactive ? undefined : 'true'}
      role={interactive ? 'group' : undefined}
      aria-label={interactive ? 'Silhouette anatomique (cliquable)' : undefined}
      data-testid={testId ?? 'anatomical-silhouette'}
      data-side={resolvedView}
      className={cn('block', STROKE, className)}
      strokeWidth="0.3"
    >
      {resolvedView !== 'back' && (
        <SilhouetteSide
          polys={CO_TO_FACE}
          neutrals={FACE_NEUTRALS}
          highlights={highlights}
          onMuscleClick={onMuscleClick}
          selectedMuscle={selectedMuscle}
          toneFill={toneFill}
        />
      )}
      {resolvedView === 'both' && (
        <g transform={`translate(110 0) ${backTransform}`}>
          <SilhouetteSide
            polys={CO_TO_BACK}
            neutrals={BACK_NEUTRALS}
            highlights={highlights}
            onMuscleClick={onMuscleClick}
            selectedMuscle={selectedMuscle}
            toneFill={toneFill}
          />
        </g>
      )}
      {resolvedView === 'back' && (
        <g transform={backTransform}>
          <SilhouetteSide
            polys={CO_TO_BACK}
            neutrals={BACK_NEUTRALS}
            highlights={highlights}
            onMuscleClick={onMuscleClick}
            selectedMuscle={selectedMuscle}
            toneFill={toneFill}
          />
        </g>
      )}
    </svg>
  );
}

interface SilhouetteSideProps {
  readonly polys: Record<string, readonly string[]>;
  readonly neutrals: readonly (readonly string[])[];
  readonly highlights: Readonly<Record<string, SilhouetteStatus>> | undefined;
  readonly onMuscleClick?: (muscle: string) => void;
  readonly selectedMuscle?: string | null;
  readonly toneFill: Record<SilhouetteStatus, string>;
}

function SilhouetteSide({
  polys,
  neutrals,
  highlights,
  onMuscleClick,
  selectedMuscle,
  toneFill,
}: SilhouetteSideProps) {
  return (
    <g>
      {/* Zones neutres (tête, cou, genoux, avant-bras) — gris constant */}
      {neutrals.map((group, gi) =>
        group.map((points, pi) => (
          <polygon
            key={`neutral-${gi}-${pi}`}
            points={points}
            className={NEUTRAL_FILL}
          />
        )),
      )}
      {/* Muscles Coach OS — fill selon highlight. Conv #17 : si onMuscleClick
          fourni, chaque groupe devient cliquable (cursor + handler) et le
          muscle sélectionné reçoit un liseré gold pour le repérage visuel
          en parallèle d'un éventuel scrollIntoView côté parent. */}
      {Object.entries(polys).map(([muscle, points]) => {
        const status = highlights?.[muscle] ?? 'off';
        const fill = toneFill[status];
        const clickable = onMuscleClick !== undefined;
        const isSelected = selectedMuscle === muscle;
        return (
          <g
            key={muscle}
            data-muscle={muscle}
            data-status={status}
            data-selected={isSelected ? 'true' : undefined}
            onClick={
              clickable
                ? (e) => {
                    e.stopPropagation();
                    onMuscleClick(muscle);
                  }
                : undefined
            }
            style={clickable ? { cursor: 'pointer' } : undefined}
          >
            {points.map((p, i) => (
              <polygon
                key={i}
                points={p}
                className={cn(
                  fill,
                  isSelected && 'stroke-amber-300',
                )}
                strokeWidth={isSelected ? 0.9 : undefined}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}

// =============================================================================
// Helpers d'intégration
// =============================================================================

export function statusToSilhouette(s: CoverageStatus): SilhouetteStatus {
  switch (s) {
    case 'sous_min':
      return 'low';
    case 'ok':
      return 'ok';
    case 'depassement':
      return 'high';
    case 'non_travaille':
    case 'hors_scope':
      return 'off';
  }
}
