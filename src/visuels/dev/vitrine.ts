/**
 * Vitrine du matériel (`vitrine.html`), page de développement : chaque pièce
 * de matériel avec un mannequin, pour juger le rendu. Les poses sont des
 * ébauches qui donnent l'échelle (voir `vitrine-scenes.ts`).
 *
 * Une seule toile WebGL : chaque scène y est dessinée puis recopiée dans une
 * toile ordinaire (les navigateurs limitent le nombre de toiles WebGL). Seules
 * les cases visibles sont dessinées.
 *
 * Adresse : `?famille=bas`, `?t=0.5` (image fixe à cet
 * instant), `?seule=<n>&tour=<degrés>` (une scène, grande, sous un angle).
 */

import { loadExercises } from '@/engine/catalog';
import { angleNormal, corpsPour, dessinerImage } from '../animation';
import type { Cadre } from '../camera';
import { Maillage } from '../maillage';
import { creerRendu } from '../rendu';
import { avancement, mesurerSujet } from '../scene';
import { STYLE } from '../style';
import { FAMILLES, SCENES } from './vitrine-scenes';
import type { Famille } from './vitrine-scenes';

const catalogue = new Map(loadExercises().map((e) => [e.id, e]));
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const source = $<HTMLCanvasElement>('source');
const rendu = creerRendu(source);
const mesh = new Maillage();
const params = new URLSearchParams(location.search);

let famille: Famille = (FAMILLES.find((f) => f.id === params.get('famille'))?.id) ?? 'libres';
let enMouvement = params.get('t') === null, tourneSeul = false, phase = 0, avant = performance.now();
const tFixe = Number(params.get('t') ?? 1);
const seule = params.get('seule') === null ? null : Number(params.get('seule'));
// `?seule=<n>&planche=1` : cette scène sous quatre angles, au départ et à l'arrivée (pour la relecture d'une pièce).
const planche = seule !== null && params.get('planche') === '1';

const nouvel = (i: number, tour: number, t: number | null, titre: string) => ({
  scene: SCENES[i]!, i, tour, t, titre,
  toile: document.createElement('canvas'),
  figure: document.createElement('figure'),
  visible: false,
});
const etats = planche
  ? [0, 1].flatMap((t) => [0, 90, 180, 270].map((d) => nouvel(seule, angleNormal(SCENES[seule]!.sujet.camera.tour + d), t, `${t === 0 ? 'Départ' : 'Arrivée'}, +${d}°`)))
  : SCENES.map((scene, i) => nouvel(i, seule === i && params.get('tour') !== null ? Number(params.get('tour')) : scene.sujet.camera.tour, null, `${i}. ${scene.nom}`));

const cadres = new Map<number, Cadre>();
function cadreDe(i: number): Cadre {
  const s = SCENES[i]!.sujet;
  let c = cadres.get(i);
  if (c === undefined) cadres.set(i, (c = mesurerSujet(corpsPour(s.mainFermee), s)));
  return c;
}

const observateur = new IntersectionObserver((entrees) => {
  for (const en of entrees) {
    const e = etats.find((x) => x.figure === en.target);
    if (e !== undefined) e.visible = en.isIntersecting;
  }
});
for (const e of etats) {
  const legende = document.createElement('figcaption');
  legende.append(e.titre, Object.assign(document.createElement('small'), { textContent: e.scene.materiel }));
  e.figure.append(e.toile, legende);
  observateur.observe(e.figure);
  let prise: { x: number; tour: number } | null = null;
  e.toile.addEventListener('pointerdown', (ev) => { prise = { x: ev.clientX, tour: e.tour }; e.toile.setPointerCapture(ev.pointerId); });
  e.toile.addEventListener('pointermove', (ev) => { if (prise !== null) e.tour = angleNormal(prise.tour - (ev.clientX - prise.x) * 0.9); });
  e.toile.addEventListener('pointerup', () => { prise = null; });
}

function afficher(): void {
  const choisies = etats.filter((e) => (seule === null ? e.scene.famille === famille : e.i === seule));
  $('grille').replaceChildren(...choisies.map((e) => e.figure));
  $('grille').style.gridTemplateColumns = seule === null || planche ? '' : 'minmax(0, 640px)';
  for (const b of $('familles').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.famille === famille));
}

function image(maintenant: number): void {
  if (rendu === null) return;
  const dt = maintenant - avant;
  avant = maintenant;
  if (enMouvement) phase = (phase + dt / STYLE.periode) % 1;
  const t = params.get('t') !== null ? tFixe : avancement(phase);
  for (const e of etats) {
    if (!e.visible || !e.figure.isConnected) continue;
    if (tourneSeul) e.tour = angleNormal(e.tour + dt * 0.02);
    const s = e.scene.sujet;
    dessinerImage(rendu, mesh, corpsPour(s.mainFermee), cadreDe(e.i), s, catalogue.get(s.id)?.muscles ?? {}, {
      tour: e.tour, hauteur: s.camera.hauteur, t: e.t ?? t,
    });
    e.toile.width = source.width;
    e.toile.height = source.height;
    e.toile.getContext('2d')!.drawImage(source, 0, 0);
  }
  requestAnimationFrame(image);
}

$('familles').replaceChildren(...FAMILLES.map((f) => {
  const b = Object.assign(document.createElement('button'), { textContent: f.nom });
  b.dataset.famille = f.id;
  b.addEventListener('click', () => { famille = f.id; afficher(); });
  return b;
}));
$('b-lecture').addEventListener('click', (ev) => {
  enMouvement = !enMouvement;
  (ev.target as HTMLElement).setAttribute('aria-pressed', String(enMouvement));
});
$('b-tour').addEventListener('click', (ev) => {
  tourneSeul = !tourneSeul;
  (ev.target as HTMLElement).setAttribute('aria-pressed', String(tourneSeul));
});
afficher();
requestAnimationFrame(image);
