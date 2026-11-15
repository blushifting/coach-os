/**
 * Atelier des visuels (développement seulement, voir `visuels.html`).
 *
 * Pour l'instant : choisir un sujet, le voir bouger, tourner autour, et la
 * « planche » (le même instant sous six angles) pour juger une forme d'un coup
 * d'œil. C'est la base de l'atelier de retouche des poses (étape V-3).
 *
 * Paramètres d'adresse : `?sujet=squat_bb_high&planche=1&lecture=arrivee`.
 */

import { loadExercises } from '@/engine/catalog';
import { angleNormal, corpsPour, dessinerImage } from '../animation';
import { Maillage } from '../maillage';
import { POSES } from '../poses';
import { REPOS } from '../poses/repos';
import { creerRendu } from '../rendu';
import { avancement, mesurerSujet } from '../scene';
import type { PoseExercice } from '../scene';
import { STYLE } from '../style';

const NEUTRE: PoseExercice = { id: 'repos', camera: { tour: 25, hauteur: 8 }, mainFermee: false, cles: [REPOS], materiel: [], valide: false };
const SUJETS: readonly PoseExercice[] = [NEUTRE, ...Object.values(POSES)];
const EXEMPLES: readonly { nom: string; muscles: Readonly<Record<string, number>> }[] = [
  { nom: 'Aucun', muscles: {} },
  { nom: 'Développé', muscles: { pectoraux: 1, triceps: 0.5, deltos_anterieurs: 0.5 } },
  { nom: 'Tirage', muscles: { dos_largeur: 1, biceps: 0.5, dos_epaisseur: 0.5 } },
  { nom: 'Jambes', muscles: { quadriceps: 1, fessiers: 0.5, ischios: 0.5, mollets: 0.5 } },
  { nom: 'Épaules, abdos', muscles: { deltos_lateraux: 1, trapezes_hauts: 0.5, abdos: 1, obliques: 0.5, lombaires: 0.5, adducteurs: 0.5, deltos_posterieurs: 0.5 } },
];
const PLANCHE: readonly { nom: string; tour: number }[] = [
  { nom: 'Face', tour: 0 }, { nom: 'Trois quarts', tour: 40 }, { nom: 'Profil', tour: 90 },
  { nom: 'Trois quarts dos', tour: 140 }, { nom: 'Dos', tour: 180 }, { nom: 'Autre trois quarts', tour: -40 },
];

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const catalogue = new Map(loadExercises().map((e) => [e.id, e]));
const params = new URLSearchParams(location.search);

const etat = {
  sujet: Math.max(0, SUJETS.findIndex((s) => s.id === params.get('sujet'))),
  exemple: Number(params.get('exemple') ?? 1),
  lecture: (params.get('lecture') ?? 'boucle') as 'boucle' | 'depart' | 'arrivee',
  planche: params.get('planche') === '1',
  tour: 0,
  hauteur: 0,
  phase: 0,
};
Object.assign(etat, SUJETS[etat.sujet]!.camera);
if (params.has('tour')) etat.tour = Number(params.get('tour'));
if (params.has('hauteur')) etat.hauteur = Number(params.get('hauteur'));

const toile = $<HTMLCanvasElement>('vue');
const rendu = creerRendu(toile);
const mesh = new Maillage();
let aDessiner = true;

/** Muscles colorés : ceux du catalogue pour un exercice, un exemple au choix pour la pose de repos. */
const coefficients = (s: PoseExercice): Readonly<Record<string, number>> =>
  catalogue.get(s.id)?.muscles ?? EXEMPLES[etat.exemple]!.muscles;

function dessiner(): void {
  if (rendu === null) return;
  const s = SUJETS[etat.sujet]!, corps = corpsPour(s.mainFermee), cadre = mesurerSujet(corps, s);
  const t = etat.lecture === 'depart' ? 0 : etat.lecture === 'arrivee' ? 1 : avancement(etat.phase);
  const grille = $('planche');
  if (etat.planche) {
    // Une seule toile WebGL : chaque vue y est dessinée puis recopiée dans une toile ordinaire.
    for (const [i, vue] of PLANCHE.entries()) {
      dessinerImage(rendu, mesh, corps, cadre, s, coefficients(s), { tour: vue.tour, hauteur: etat.hauteur, t });
      const copie = grille.children[i]!.querySelector('canvas')!;
      copie.width = toile.width;
      copie.height = toile.height;
      copie.getContext('2d')!.drawImage(toile, 0, 0);
    }
  }
  dessinerImage(rendu, mesh, corps, cadre, s, coefficients(s), { tour: etat.tour, hauteur: etat.hauteur, t });
}

function rafraichir(): void {
  const s = SUJETS[etat.sujet]!;
  $<HTMLSelectElement>('sujet').value = String(etat.sujet);
  $<HTMLSelectElement>('exemple').value = String(etat.exemple);
  $('l-exemple').hidden = catalogue.has(s.id);
  for (const l of ['boucle', 'depart', 'arrivee'] as const) $('b-' + l).setAttribute('aria-pressed', String(etat.lecture === l));
  $('b-planche').setAttribute('aria-pressed', String(etat.planche));
  $('planche').hidden = !etat.planche;
  toile.classList.toggle('hors-champ', etat.planche);
  $<HTMLInputElement>('tour').value = String(etat.tour);
  $<HTMLInputElement>('hauteur').value = String(etat.hauteur);
  $('o-tour').textContent = `${etat.tour}°`;
  $('o-hauteur').textContent = `${etat.hauteur}°`;
  aDessiner = true;
}

$('sujet').innerHTML = SUJETS.map((s, i) => `<option value="${i}">${catalogue.get(s.id)?.nom_fr ?? 'Pose de repos'}</option>`).join('');
$('exemple').innerHTML = EXEMPLES.map((e, i) => `<option value="${i}">${e.nom}</option>`).join('');
$('planche').innerHTML = PLANCHE.map((v) => `<figure><canvas></canvas><figcaption>${v.nom}</figcaption></figure>`).join('');
$('sujet').addEventListener('change', (e) => {
  etat.sujet = Number((e.target as HTMLSelectElement).value);
  Object.assign(etat, SUJETS[etat.sujet]!.camera);
  rafraichir();
});
$('exemple').addEventListener('change', (e) => { etat.exemple = Number((e.target as HTMLSelectElement).value); rafraichir(); });
for (const l of ['boucle', 'depart', 'arrivee'] as const) $('b-' + l).addEventListener('click', () => { etat.lecture = l; rafraichir(); });
$('b-planche').addEventListener('click', () => { etat.planche = !etat.planche; rafraichir(); });
for (const id of ['tour', 'hauteur'] as const) {
  $(id).addEventListener('input', (e) => { etat[id] = Number((e.target as HTMLInputElement).value); rafraichir(); });
}

// Glisser sur la figure : tourner autour, un seul degré de liberté.
let prise: { x: number; tour: number } | null = null;
toile.addEventListener('pointerdown', (e) => { prise = { x: e.clientX, tour: etat.tour }; toile.setPointerCapture(e.pointerId); });
toile.addEventListener('pointermove', (e) => {
  if (prise === null) return;
  etat.tour = Math.round(angleNormal(prise.tour - (e.clientX - prise.x) * 0.9));
  rafraichir();
});
toile.addEventListener('pointerup', () => { prise = null; });
toile.addEventListener('pointercancel', () => { prise = null; });

let avant = performance.now();
function image(maintenant: number): void {
  const anime = etat.lecture === 'boucle' && SUJETS[etat.sujet]!.cles.length > 1;
  if (anime) etat.phase = (etat.phase + (maintenant - avant) / STYLE.periode) % 1;
  avant = maintenant;
  if (anime || aDessiner) { dessiner(); aDessiner = false; }
  requestAnimationFrame(image);
}
rafraichir();
requestAnimationFrame(image);
