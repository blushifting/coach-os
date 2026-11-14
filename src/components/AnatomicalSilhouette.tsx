/**
 * Silhouette anatomique double (face + dos) — Conv #8b.
 *
 * Polygones musculaires dérivés du projet open-source
 * `react-body-highlighter` (https://github.com/giavinh79/react-body-highlighter,
 * MIT © 2020 GV79). Les coordonnées sont en pourcentage du viewBox 100×196 par
 * silhouette (face = 0-100, dos = 110-210 sur l'axe X global).
 *
 * Adaptation Coach OS :
 *  - Mapping FR → groupes RBH (cf. CO_TO_FACE / CO_TO_BACK).
 *  - Conv #65 — redécoupage du dos (cf. bloc BACK_POLYS pour le détail des
 *    coupes). Les 3 muscles dorsaux suivis ne tombaient pas sur les bons
 *    polygones ; on recoupe les formes RBH d'origine au lieu d'en ajouter.
 *  - Conv #67 — refonte de la patte graphique. Les coordonnées ne sont PLUS
 *    celles de l'asset RBH : elles ont été re-générées hors-ligne par un
 *    pipeline de transformations validé visuellement, puis figées ici
 *    (aucun calcul à l'exécution hormis l'arrondi, cf. roundedPath) :
 *      1. symétrisation exacte (côté gauche = référence, droit = miroir) ;
 *      2. enflage des pecs (+6,5 % vers le sternum — qui faisait 2× la
 *         largeur des autres coutures —, +15,6 % vers le bas, abdos et
 *         obliques raccourcis d'autant par le haut) et des quadriceps
 *         (+11 % en bloc par jambe vers le bassin, ancrage genou + bord
 *         externe ; le droit fémoral remonte en plus vers l'aine) pour
 *         combler le vide du bassin ;
 *      3. alignement face/dos : le dos (jadis scalé ×0,9775 au rendu — scale
 *         retiré, il est intégré aux coordonnées) a reçu un remap vertical
 *         par morceaux (coude 79,9→73,1, centre du genou 156,2→148,4,
 *         épaules et chevilles fixes), un écartement progressif des jambes
 *         (0 au pli fessier → 3 à la cheville) et un rapprochement des bras
 *         (0 à l'aisselle → 1,5 au coude), afin que les deux vues décrivent
 *         la même personne ;
 *      4. égalisation des interstices : toute paire de polygones sous 1,7
 *         unité a été écartée itérativement jusqu'à 1,7 (l'asset descendait
 *         à 0,78, et le n° 3 avait collé le grand dorsal au triceps) ; les
 *         creux larges volontaires (pli du coude, entrejambe, fourche basse
 *         des quadriceps) sont conservés.
 *  - Dump 2.4, étape 6 — épaule de face coupée en antérieurs / latéraux,
 *    adducteurs rendus (face et dos), toucher au plus proche (`muscleAtPoint`).
 *  - Rendu en <path> aux angles arrondis (rayon 3) au lieu de <polygon>,
 *    pour adoucir le côté anguleux sans déplacer aucun sommet.
 *  - Statut par muscle (off / low / ok / high / highlight / synergist) →
 *    classe Tailwind via `TONE_FILL`.
 *  - Zones neutres (tête, genoux, avant-bras) : gris constant.
 *
 * Composant utilisé par :
 *  - `pages/progres/CoverageView` (face + dos, h-48)
 *  - `pages/catalogue/MiniSilhouette` (face uniquement, h-20, mini cards)
 */

import type { MouseEvent } from 'react';
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
 * Palette de coloration selon le contexte d'usage :
 *  - `legacy` (défaut) — coloration "anatomique" multi-teinte historique,
 *     utilisée par le Catalogue (mini silhouette + détail exo). Distingue
 *     primaire / synergiste avec deux teintes de sang. Inchangée.
 *  - `volume` — mono-teinte sang pour la vue Progrès → Volume. La couleur
 *     graduée signale uniquement la position relative au volume cible
 *     (sang-900 travaillé → sang-600 dans la cible → sang-400 volume élevé).
 *  - `priority` — palette amber/or pour la sélection des muscles
 *     prioritaires en onboarding. Top 3 "brille" en amber-400, autres en
 *     amber-700.
 *  - `objective` — onboarding Step2 « pinceau » : une teinte par
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
   * Silhouette cliquable. Callback appelé avec le `muscle_id`
   * Coach OS quand l'utilisateur tape sur une zone musculaire mappée.
   * Si absent, la silhouette reste purement présentationnelle (aria-hidden).
   */
  readonly onMuscleClick?: (muscle: string) => void;
  /** Muscle actuellement sélectionné (souligné d'un liseré). */
  readonly selectedMuscle?: string | null;
  /** Palette de coloration (défaut `legacy`). */
  readonly palette?: SilhouettePalette;
}

// Bumpé d'un cran pour mieux ressortir du fond Card
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

// Vue Volume (Progrès) : mono-teinte sang. Le
// contraste fait tout le travail (pas de stroke effect ni d'animation).
//   travaillé hors de la bonne zone → sang-900 (sombre, peu présent)
//   dans la cible (repère → 20)     → sang-600 (couleur marque pleine)
//   volume élevé (au-delà de 20)    → sang-400 (clair vif)
// Correspondance des statuts : `statusToSilhouette`.
const TONE_FILL_VOLUME: Record<SilhouetteStatus, string> = {
  off: 'fill-anthracite-500',
  low: 'fill-sang-900',
  ok: 'fill-sang-600',
  high: 'fill-sang-400',
  highlight: 'fill-sang-600',
  synergist: 'fill-sang-900',
};

// Onboarding Step2 (sélection muscles prioritaires) : famille amber.
// Top 3 = highlight (amber-400, brille), rank 4+ = ok (amber-700, plus discret).
const TONE_FILL_PRIORITY: Record<SilhouetteStatus, string> = {
  off: 'fill-anthracite-500',
  low: 'fill-amber-700',
  ok: 'fill-amber-700',
  high: 'fill-amber-400',
  highlight: 'fill-amber-400',
  synergist: 'fill-amber-700',
};

// Onboarding Step2 pinceau : une teinte par objectif (cf. doc du
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
// Polygones FACE (dérivés de react-body-highlighter — anteriorData, coordonnées
// re-bakées Conv #67, cf. en-tête). viewBox local 0 0 100 196.
// Dump 2.4, étape 6 (maquette `Kotsh/maquettes/etape6_jambes.html`) :
//  - Épaule : la pointe basse de l'ancien `neck` (descendue jusqu'à la
//    clavicule, là où est l'avant de l'épaule) passe aux antérieurs ; l'ancien
//    `front_deltoids` est coupé en deux, antérieurs dedans, latéraux dehors,
//    la coupe placée pour que les deux zones aient la même surface.
//  - Cuisse : la figure d'origine avait une zone « intérieur de cuisse »
//    (nommée `abductors` par la bibliothèque, à tort), supprimée en conv #67 et
//    absorbée par le fuseau intérieur du quadriceps. On la rend aux adducteurs,
//    agrandie pour le doigt (creux de l'aine → mi-cuisse), coupe oblique comme
//    le couturier ; le quadriceps garde la « goutte » du vaste interne.
// Coutures de 1,7 conservées. Formes définies à droite puis mises en miroir.
// =============================================================================

const FACE_POLYS = {
  head: [
    '42.45 2.86 40 11.84 42.04 19.59 46.12 23.27 50 25.31 53.88 23.27 57.96 19.59 60 11.84 57.55 2.86 50 0',
  ],
  trapezius: [
    '51.43 39.18 51.02 33.88 55.51 24.49 58.78 30.2 62.2 33.6 60.5 39.4',
    '48.57 39.18 48.98 33.88 44.49 24.49 41.22 30.2 37.8 33.6 39.5 39.4',
  ],
  chest: [
    '61.94 42.04 51.08 42.04 50.93 57.14 58.31 60.22 68.47 57.61 70.16 47.23',
    '29.84 47.23 31.53 57.61 41.69 60.22 49.23 57.14 48.92 42.04 38.06 42.04',
  ],
  anterior_deltoids: [
    '63.67 35.1 69.76 37.14 71.9 37.14 73.4 48.61 71.86 47.35 70.82 44.84 62.04 39.59',
    '36.33 35.1 30.24 37.14 28.1 37.14 26.6 48.61 28.14 47.35 29.18 44.84 37.96 39.59',
  ],
  lateral_deltoids: [
    '73.6 37.14 75.51 37.14 79.59 40.82 80 47.76 78.81 53.02 75.1 49.99',
    '26.4 37.14 24.49 37.14 20.41 40.82 20 47.76 21.19 53.02 24.9 49.99',
  ],
  biceps: [
    '16.73 68.16 17.95 71.39 22.41 65.88 28.98 53.88 27.99 49.67 20.41 55.92',
    '79.59 55.92 72.01 49.67 71.02 53.88 77.59 65.88 82.05 71.39 83.27 68.16',
  ],
  triceps: [
    '77.1 73.06 70.2 60.82 70.38 56.21 77.55 69.39',
    '22.45 69.39 29.62 56.21 29.8 60.82 22.9 73.06',
  ],
  obliques: [
    '60.85 83.67 60.82 65.17 59.25 61.73 67.76 59.61 68.98 65.17 66.94 72.94 66.12 78.86',
    '33.88 78.86 33.06 72.94 31.02 65.17 32.24 59.61 40.75 61.73 39.18 65.17 39.15 83.67',
  ],
  abs: [
    '58.78 66.6 59.14 79.79 59.18 92.21 55.51 103.85 51.84 107.35 51.43 85.61 51.02 69.31 51.43 59.61 56.3 61.22',
    '43.7 61.23 48.57 59.61 48.98 69.31 48.57 85.61 48.16 107.35 44.49 103.85 40.82 92.21 40.86 79.79 41.22 66.6',
  ],
  quadriceps: [
    '35.68 94.05 38.3 104.37 38.14 125.82 35.23 136.21 31.6 131.28 29.79 117.37 28.43 107.95 29.79 96.29 32.96 89.56',
    '39.34 127.86 36.59 137.93 37.54 146.53 41.85 145.99 44.03 136.5',
    '33.42 137.56 26.6 145.62 25.71 135.76 25.71 125.45 27.07 111.09 29.79 132.18',
    '67.04 89.56 70.21 96.29 71.57 107.95 70.21 117.37 68.4 131.28 64.77 136.21 61.86 125.82 61.7 104.37 64.32 94.05',
    '60.66 127.86 63.41 137.93 62.46 146.53 58.15 145.99 55.97 136.5',
    '70.21 132.18 72.93 111.09 74.29 125.45 74.29 135.76 73.4 145.62 66.58 137.56',
  ],
  adductors: [
    '40.3 97.5 39.93 101.39 40.41 123.96 39.99 125.5 44.61 134 45.19 131.48 47.1 123.96 44.8 108.6 42.4 103.5',
    '59.7 97.5 60.07 101.39 59.59 123.96 60.01 125.5 55.39 134 54.81 131.48 52.9 123.96 55.2 108.6 57.6 103.5',
  ],
  knees: [
    '33.88 140 34.69 143.27 35.51 147.35 36.33 151.02 35.1 156.69 29.8 156.73 27.35 152.65 27.35 147.35 30.2 144.08',
    '69.8 144.08 72.65 147.35 72.65 152.65 70.2 156.73 64.9 156.69 63.67 151.02 64.49 147.35 65.31 143.27 66.12 140',
  ],
  calves: [
    '79.18 195.51 77.96 188.16 79.18 167.76 77.55 161.63 75.1 157.55 73.88 154.29 71.84 160.41 72.24 164.9 75.1 194.69',
    '24.9 194.69 27.76 164.9 28.16 160.41 26.12 154.29 24.9 157.55 22.45 161.63 20.82 167.76 22.04 188.16 20.82 195.51',
    '69.8 158.78 70.2 164.08 71.01 169.8 71.43 175.51 71.84 180.41 72.65 187.76 73.06 194.69 69.39 187.35 67.76 182.04 64.9 176.73 64.9 172.24 64.08 166.94 64.08 162.45 64.49 158.37',
    '35.51 158.37 35.92 162.45 35.92 166.94 35.1 172.24 35.1 176.73 32.24 182.04 30.61 187.35 26.94 194.69 27.35 187.76 28.16 180.41 28.57 175.51 28.99 169.8 29.8 164.08 30.2 158.78',
  ],
  forearm: [
    '6.12 88.57 10.2 75.1 14.69 70.2 16.33 74.29 18.36 73.04 3.91 97.2 0 100',
    '100 100 96.09 97.2 81.64 73.04 83.67 74.29 85.31 70.2 89.8 75.1 93.88 88.57',
    '95.07 98.82 78.96 71.86 78.37 77.14 81.22 84.08 86.53 90.61 93.06 101.22',
    '6.94 101.22 13.47 90.61 18.78 84.08 21.63 77.14 21.04 71.86 4.93 98.82',
  ],
} as const;

// =============================================================================
// Polygones DOS (dérivés de react-body-highlighter — posteriorData, coordonnées
// re-bakées Conv #67 : alignement sur la face — remap vertical, écartement des
// jambes, rapprochement des bras — intégré, plus symétrisation et égalisation
// des coutures, cf. en-tête. Le scale ×0,9775 appliqué jadis au rendu est
// intégré aux coordonnées. Le DÉCOUPAGE reste celui de la Conv #65 ci-dessous ;
// seules les valeurs numériques citées ne sont plus littérales.)
// =============================================================================

const BACK_POLYS = {
  head: [
    '50 0 45.96 0.83 40.85 5.41 40.43 12.48 45.11 19.51 54.89 19.51 59.57 12.48 59.15 5.41 54.04 0.83',
  ],
  // ---------------------------------------------------------------------------
  // Redécoupage du dos.
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
  // Coutures des nouvelles coupes calées sur les coutures de l'asset
  // (≈ 1,75 ; toutes égalisées à 1,7 en Conv #67). Formes définies sur la
  // moitié gauche puis mises en miroir (x → 100−x).
  // ---------------------------------------------------------------------------
  trapezius_upper: [
    '44.68 21.21 47.66 21.22 47.23 36.56 35.46 38.84 31.06 35.78 39.15 32.44 43.83 26.62',
    '56.17 26.62 60.85 32.44 68.94 35.78 64.54 38.84 52.77 36.56 52.34 21.22 55.32 21.21',
  ],
  back_deltoids: [
    '29.36 36.19 22.98 38.27 17.45 43.26 18.01 51.83 24.26 48.25 27.07 45.29',
    '72.93 45.29 75.74 48.25 81.99 51.83 82.55 43.26 77.02 38.27 70.64 36.19',
  ],
  // Trapèze moyen + inférieur, rhomboïdes dessous, et région scapulaire
  // au-dessus de l'aisselle : un seul bloc par côté.
  upper_back: [
    '47.23 38.32 47.87 63.04 38.3 51.99 28.09 47.84 31.05 37.86 35.32 40.81',
    '64.68 40.81 68.95 37.86 71.91 47.84 61.7 51.99 52.13 63.04 52.77 38.32',
  ],
  // Grand dorsal : apex à l'aisselle, aile qui s'évase vers la taille.
  lats: [
    '28.49 49.91 28.51 54.08 34.04 73.63 47.23 69.46 47.23 64.89 37.4 53.73',
    '62.6 53.73 52.77 64.89 52.77 69.46 65.96 73.63 71.49 54.08 71.51 49.91',
  ],
  triceps: [
    '26.79 49.36 17.87 53.8 15.97 66.12 18.01 72.26 22.36 59.76 26.8 53.8',
    '73.2 53.8 77.64 59.76 81.99 72.26 84.03 66.12 82.13 53.8 73.21 49.36',
    '27.29 55.99 28.05 63.28 24.48 68.33 20.73 69.62 23.68 61.14',
    '76.32 61.14 79.27 69.62 75.52 68.33 71.95 63.28 72.71 55.99',
  ],
  lower_back: [
    '47.66 71.13 34.47 75.29 35.32 81.53 49.07 99.83 46.81 81.11',
    '53.19 81.11 50.77 99.83 64.68 81.53 65.53 75.29 52.34 71.13',
  ],
  forearm: [
    '83.07 74.29 86.23 80.16 94.89 96.63 98.5 98.94 91.69 85.55 89.56 75.29 85.03 68.69',
    '14.97 68.69 10.44 75.29 8.31 85.55 1.5 98.94 5.11 96.63 13.77 80.16 16.93 74.29',
    '93.27 97.22 91.69 101.17 89.14 95.37 77.65 75.74 76.29 70.42 79.7 71.55',
    '20.3 71.55 23.71 70.42 22.35 75.74 10.86 95.37 8.31 101.17 6.73 97.22',
  ],
  gluteal: [
    '44.68 97.33 30.21 104.91 29.79 113.57 31.82 119.59 47.23 115.58 49.07 110.32',
    '50.77 110.32 52.77 115.58 68.18 119.59 70.21 113.57 69.79 104.91 55.32 97.33',
  ],
  // Intérieur de la cuisse vu de dos (grand adducteur, gracile) : nommé
  // `adductor` par la bibliothèque d'origine. Rattaché aux fessiers jusqu'à
  // l'étape 6 du dump 2.4.
  adductor: [
    '48.09 117.18 44.88 117.95 41.28 119.34 45.11 135.22 48.51 128 48.94 122.59',
    '51.06 122.59 51.49 128 54.89 135.22 58.72 119.34 55.12 117.95 51.91 117.18',
  ],
  hamstring: [
    '28.92 116.46 31.06 122.59 36.69 120.08 35.03 127.64 32.84 140.27 27 147.13 27.61 137.39 26.84 132.7 27.23 124.4',
    '72.77 124.4 73.16 132.7 72.39 137.39 73 147.13 67.16 140.27 64.97 127.64 63.31 120.08 68.94 122.59 71.08 116.46',
    '38.77 119.54 43.01 136.66 37.84 156.62 34.32 142.43 36.76 127.65',
    '63.24 127.65 65.68 142.43 62.16 156.62 56.99 136.66 61.23 119.54',
  ],
  knees: [
    '32.72 143.03 28.62 147.85 31.04 156.12 34.85 151.65',
    '65.15 151.65 68.96 156.12 71.38 147.85 67.28 143.03',
  ],
  // Mollets : les 2 polygones SOLEUS de l'original RBH (talons, hors viewBox)
  // restent exclus ; le soleus est représenté par les CALVES principaux.
  calves: [
    '26.85 149.14 25.92 157.11 21.93 171.57 20.92 187.03 22.57 192.01 25.6 187.52 26.82 172.02 29.2 161.57 29.33 156.62',
    '34.88 154.62 32.72 157.61 30.7 162.64 28.48 172.58 27.42 186.04 31.04 195.5 35.84 184.53 36.54 159.11',
    '63.46 159.11 64.16 184.53 68.96 195.5 72.57 186.04 71.39 172.6 69.22 162.65 67.28 157.61 65.12 154.62',
    '70.67 156.62 70.73 161.6 73.04 172.05 74.4 187.52 77.43 192.01 79.08 187.03 78.07 171.57 74.08 157.11 73.15 149.14',
  ],
} as const;

// =============================================================================
// Mapping Coach OS → groupes RBH
// =============================================================================

/** Muscles Coach OS visibles côté face, et les groupes RBH qui les représentent. */
const CO_TO_FACE: Record<string, readonly string[]> = {
  pectoraux: FACE_POLYS.chest,
  trapezes_hauts: FACE_POLYS.trapezius,
  deltos_anterieurs: FACE_POLYS.anterior_deltoids,
  // Les latéraux ne sont dessinés que de face (choix d'Azur, étape 6) : de dos,
  // l'épaule reste entière aux postérieurs pour garder une zone assez grande.
  deltos_lateraux: FACE_POLYS.lateral_deltoids,
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
  adducteurs: FACE_POLYS.adductors,
  mollets: FACE_POLYS.calves,
};

/** Muscles Coach OS visibles côté dos. */
const CO_TO_BACK: Record<string, readonly string[]> = {
  // Fibres descendantes seules, cohérent avec CO_TO_FACE qui mappe
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
  fessiers: BACK_POLYS.gluteal,
  adducteurs: BACK_POLYS.adductor,
  ischios: BACK_POLYS.hamstring,
  mollets: BACK_POLYS.calves,
};

// =============================================================================
// Arrondi des angles
// =============================================================================

// Rayon d'arrondi des sommets (unités du viewBox), validé
// visuellement parmi 0-4.
const CORNER_RADIUS = 3;

/**
 * Convertit une liste de points `<polygon>` en `d` de `<path>` aux angles
 * arrondis : chaque sommet devient une courbe de Bézier quadratique dont les
 * ancres sont posées à CORNER_RADIUS le long des deux arêtes adjacentes
 * (plafonné à la demi-arête, donc deux sommets voisins ne se croisent
 * jamais). Les milieux d'arêtes restent rectilignes : aucun sommet ne bouge,
 * les coutures entre muscles sont préservées. Mémoïsé — les données sont
 * statiques, chaque polygone n'est converti qu'une fois.
 */
const pathCache = new Map<string, string>();

function roundedPath(points: string): string {
  const cached = pathCache.get(points);
  if (cached !== undefined) return cached;
  const nums = points.trim().split(/\s+/).map(Number);
  const pts: [number, number][] = [];
  for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  const n = pts.length;
  const fmt = (p: readonly [number, number]) =>
    `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  const entries: [number, number][] = [];
  const exits: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const v = pts[i];
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const dPrev = Math.hypot(v[0] - prev[0], v[1] - prev[1]) || 1;
    const dNext = Math.hypot(v[0] - next[0], v[1] - next[1]) || 1;
    const rPrev = Math.min(CORNER_RADIUS, dPrev / 2);
    const rNext = Math.min(CORNER_RADIUS, dNext / 2);
    entries.push([
      v[0] + ((prev[0] - v[0]) * rPrev) / dPrev,
      v[1] + ((prev[1] - v[1]) * rPrev) / dPrev,
    ]);
    exits.push([
      v[0] + ((next[0] - v[0]) * rNext) / dNext,
      v[1] + ((next[1] - v[1]) * rNext) / dNext,
    ]);
  }
  let d = `M ${fmt(entries[0])}`;
  for (let i = 0; i < n; i++) {
    d += ` Q ${fmt(pts[i])} ${fmt(exits[i])} L ${fmt(entries[(i + 1) % n])}`;
  }
  d += ' Z';
  pathCache.set(points, d);
  return d;
}

// =============================================================================
// Composant
// =============================================================================

const FACE_NEUTRALS = [FACE_POLYS.head, FACE_POLYS.knees, FACE_POLYS.forearm];
const BACK_NEUTRALS = [BACK_POLYS.head, BACK_POLYS.knees, BACK_POLYS.forearm];

// =============================================================================
// Toucher au plus proche
// =============================================================================

/**
 * Marge de toucher, en unités du viewBox (≈ 1,1 px par
 * unité à la taille `h-56`). Les zones de la silhouette font 5 à 12 px de
 * large, loin des 44 px conseillés pour un doigt : un toucher qui tombe à côté
 * d'un muscle le choisit quand même s'il est à moins de cette distance. Entre
 * deux muscles, le plus proche gagne, donc deux zones ne se disputent jamais
 * un toucher.
 */
export const TAP_MARGIN = 5;

type Point = readonly [number, number];

const pointsCache = new Map<string, Point[]>();

function parsePoints(points: string): Point[] {
  const cached = pointsCache.get(points);
  if (cached !== undefined) return cached;
  const nums = points.trim().split(/\s+/).map(Number);
  const pts: Point[] = [];
  for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  pointsCache.set(points, pts);
  return pts;
}

function isInside(x: number, y: number, pts: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToEdges(x: number, y: number, pts: readonly Point[]): number {
  let min = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j];
    const [bx, by] = pts[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    min = Math.min(min, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return min;
}

/**
 * Muscle choisi par un toucher au point (x, y), dans le repère d'une vue
 * (0-100 × 0-196). Sur un muscle : ce muscle. Sur une zone neutre (tête,
 * genoux, avant-bras) : rien. À côté : le muscle le plus proche, s'il est à
 * moins de `margin`. Sinon : rien.
 */
export function muscleAtPoint(
  x: number,
  y: number,
  polys: Readonly<Record<string, readonly string[]>>,
  neutrals: readonly (readonly string[])[],
  margin: number = TAP_MARGIN,
): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const [muscle, group] of Object.entries(polys)) {
    for (const p of group) {
      const pts = parsePoints(p);
      if (isInside(x, y, pts)) return muscle;
      const d = distanceToEdges(x, y, pts);
      if (d < bestDistance) {
        bestDistance = d;
        best = muscle;
      }
    }
  }
  for (const group of neutrals) {
    for (const p of group) if (isInside(x, y, parsePoints(p))) return null;
  }
  return bestDistance <= margin ? best : null;
}

/** Muscle visé par un toucher sur une vue donnée (exporté pour les tests). */
export function muscleAtPointOnSide(
  side: 'face' | 'back',
  x: number,
  y: number,
): string | null {
  return side === 'face'
    ? muscleAtPoint(x, y, CO_TO_FACE, FACE_NEUTRALS)
    : muscleAtPoint(x, y, CO_TO_BACK, BACK_NEUTRALS);
}

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

  // Toucher tombé hors de tout muscle (un toucher sur un muscle est pris par
  // son `<g>` et ne remonte pas jusqu'ici) : on choisit le plus proche.
  function handleMissedTap(e: MouseEvent<SVGSVGElement>) {
    if (onMuscleClick === undefined) return;
    const ctm = e.currentTarget.getScreenCTM();
    if (ctm === null) return;
    const local = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    let side: 'face' | 'back' = resolvedView === 'back' ? 'back' : 'face';
    let x = local.x;
    if (resolvedView === 'both' && x >= 105) {
      side = 'back';
      x -= 110;
    }
    const muscle = muscleAtPointOnSide(side, x, local.y);
    if (muscle !== null) onMuscleClick(muscle);
  }

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
      onClick={interactive ? handleMissedTap : undefined}
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
        <g transform="translate(110 0)">
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
        <SilhouetteSide
          polys={CO_TO_BACK}
          neutrals={BACK_NEUTRALS}
          highlights={highlights}
          onMuscleClick={onMuscleClick}
          selectedMuscle={selectedMuscle}
          toneFill={toneFill}
        />
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
          <path
            key={`neutral-${gi}-${pi}`}
            d={roundedPath(points)}
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
              <path
                key={i}
                d={roundedPath(p)}
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

/**
 * Tout ce qui est fait est montré :
 *   - pas travaillé → éteint ;
 *   - travaillé mais pas dans la bonne zone (sous le repère, ou sans objectif)
 *     → rouge sombre ;
 *   - dans la bonne zone (du repère à la zone haute) → rouge plein ;
 *   - volume élevé (au-delà de 20 séries) → rouge vif.
 */
export function statusToSilhouette(s: CoverageStatus): SilhouetteStatus {
  switch (s) {
    case 'sous_repere':
    case 'sans_objectif':
      return 'low';
    case 'ok':
      return 'ok';
    case 'eleve':
      return 'high';
    case 'non_travaille':
      return 'off';
  }
}
