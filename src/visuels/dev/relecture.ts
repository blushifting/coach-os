/**
 * Planche de relecture des poses (`relecture.html`), page de développement :
 * toutes les animations d'une famille côte à côte. Azur y marque chaque
 * exercice « Bon » (la pose passe à `valide: true`, le fichier est réécrit),
 * ou l'ouvre dans l'atelier pour le retoucher.
 *
 * Une seule toile WebGL : chaque animation y est dessinée puis recopiée dans
 * une toile ordinaire (les navigateurs limitent le nombre de toiles WebGL).
 * Seules les cases visibles sont dessinées.
 *
 * Adresse : `?lot=<n>`, `?t=0.5` (image fixe à cet instant),
 * `?sujet=<id>&planche=1` (un exercice sous quatre angles, au départ, au
 * milieu et à l'arrivée : pour relire une pose de près ; `&instants=0,0.3`
 * et `&tours=0,180` pour d'autres instants et angles), `?taille=<px>`
 * (largeur minimale d'une case, 260 par défaut), `?muscles=a,b` (colorer ces
 * muscles plutôt que ceux du catalogue).
 */

import { loadExercises } from '@/engine/catalog';
import { angleNormal, corpsPour, dessinerImage } from '../animation';
import type { Cadre } from '../camera';
import { fichierPose } from '../edition';
import { Maillage } from '../maillage';
import { POSES } from '../poses';
import { creerRendu } from '../rendu';
import { avancement, mesurerSujet, periodeDe } from '../scene';
import type { PoseExercice } from '../scene';

/** Les familles de V-5, dans l'ordre où elles sont posées. Un exercice sans pose n'est pas montré. */
const LOTS: readonly { nom: string; ids: readonly string[] }[] = [
  {
    nom: 'Debout, poids libres : haut du corps',
    ids: [
      'db_lateral_raise', 'db_front_raise', 'rear_delt_db_fly', 'ohp_bb_standing', 'upright_row_db',
      'bb_shrug', 'db_shrug', 'bb_row', 't_bar_row', 'bb_curl', 'db_curl_alt', 'hammer_curl',
      'overhead_db_extension', 'kickback_db', 'db_side_bend',
    ],
  },
  {
    nom: 'Debout, poids libres : bas du corps',
    ids: [
      'squat_bb_high', 'front_squat', 'goblet_squat', 'deadlift_conv', 'deadlift_trap_bar', 'rdl_bb', 'rdl_db',
      'single_leg_rdl', 'good_morning', 'walking_lunge', 'reverse_lunge', 'step_up', 'bulgarian_split', 'calf_db_single',
    ],
  },
  {
    nom: 'Poids du corps : appuis et suspensions',
    ids: ['pushup', 'pushup_loaded', 'dips_chest', 'dips_triceps', 'pullup', 'inverted_row', 'hanging_leg_raise', 'ab_wheel_rollout'],
  },
  {
    nom: 'Au sol : abdos et bas du corps',
    ids: [
      'crunch_floor', 'sit_up', 'reverse_crunch', 'bicycle_crunch', 'oblique_crunch', 'russian_twist', 'lying_leg_raise',
      'dead_bug', 'glute_bridge_bw', 'glute_bridge', 'bodyweight_squat', 'sissy_squat',
    ],
  },
];

const NB = ' ';
const catalogue = new Map(loadExercises().map((e) => [e.id, e]));
const nomDe = (id: string): string => catalogue.get(id)?.nom_fr ?? id;
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const source = $<HTMLCanvasElement>('source');
const rendu = creerRendu(source);
const mesh = new Maillage();
const params = new URLSearchParams(location.search);

const lot = Math.min(LOTS.length - 1, Math.max(0, Number(params.get('lot') ?? 0) || 0));
const sujetSeul = params.get('sujet');
const planche = sujetSeul !== null && POSES[sujetSeul] !== undefined && params.get('planche') === '1';
// Temps écoulé (ms) : chaque exercice en tire sa phase, selon la durée de son cycle.
let enMouvement = params.get('t') === null, tourneSeul = false, temps = 0, avant = performance.now();
const tFixe = Number(params.get('t') ?? 1);
// `?muscles=pectoraux,deltos_posterieurs` : colore ces muscles-là au lieu de ceux du catalogue (pour relire une forme).
const musclesForces = params.get('muscles') === null ? null : Object.fromEntries(params.get('muscles')!.split(',').map((m) => [m, 1]));

interface Case {
  readonly sujet: PoseExercice;
  tour: number;
  readonly t: number | null;
  readonly toile: HTMLCanvasElement;
  readonly figure: HTMLElement;
  visible: boolean;
}

function nouvelle(sujet: PoseExercice, tour: number, t: number | null, titre: string, avecActions: boolean): Case {
  const c: Case = { sujet, tour, t, toile: document.createElement('canvas'), figure: document.createElement('figure'), visible: false };
  const legende = document.createElement('figcaption');
  legende.append(titre, Object.assign(document.createElement('small'), { textContent: sujet.id }));
  if (avecActions) legende.append(actions(sujet));
  c.figure.append(c.toile, legende);
  let prise: { x: number; tour: number } | null = null;
  c.toile.addEventListener('pointerdown', (ev) => { prise = { x: ev.clientX, tour: c.tour }; c.toile.setPointerCapture(ev.pointerId); });
  c.toile.addEventListener('pointermove', (ev) => { if (prise !== null) c.tour = angleNormal(prise.tour - (ev.clientX - prise.x) * 0.9); });
  c.toile.addEventListener('pointerup', () => { prise = null; });
  return c;
}

function actions(sujet: PoseExercice): HTMLElement {
  const bloc = Object.assign(document.createElement('div'), { className: 'actions' });
  const bon = Object.assign(document.createElement('button'), { className: 'bon', textContent: 'Bon' });
  bon.setAttribute('aria-pressed', String(sujet.valide));
  bon.title = sujet.valide ? 'Validée : cliquer pour la remettre à relire' : 'Valider cette pose';
  bon.addEventListener('click', () => void basculer(sujet, bon));
  const atelier = Object.assign(document.createElement('a'), {
    className: 'bouton', textContent: 'Retoucher', href: `${import.meta.env.BASE_URL}visuels.html?sujet=${sujet.id}`,
  });
  const loupe = Object.assign(document.createElement('a'), {
    className: 'bouton', textContent: 'De près', href: `?lot=${lot}&sujet=${sujet.id}&planche=1`,
  });
  bloc.append(bon, atelier, loupe);
  return bloc;
}

/** Valide la pose (ou la remet à relire) : le fichier de l'exercice est réécrit. */
async function basculer(sujet: PoseExercice, bouton: HTMLButtonElement): Promise<void> {
  bouton.disabled = true;
  const fichiers = [{ nom: `${sujet.id}.ts`, contenu: fichierPose({ ...sujet, valide: !sujet.valide }, nomDe(sujet.id)) }];
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}__atelier/enregistrer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fichiers }),
    });
    if (!r.ok) throw new Error(await r.text());
    // Le serveur de développement recharge la page, qui relit le fichier.
    $('message').textContent = `${nomDe(sujet.id)}${NB}: ${sujet.valide ? 'remise à relire' : 'validée'}.`;
  } catch (e) {
    bouton.disabled = false;
    $('message').textContent = `Échec de l'enregistrement${NB}: ${e instanceof Error ? e.message : String(e)}`;
  }
}

const cases: Case[] = [];
if (planche) {
  const s = POSES[sujetSeul]!;
  // `?instants=0,0.3` et `?tours=0,180` (écarts à l'angle par défaut) remplacent les valeurs ordinaires.
  const liste = (nom: string): number[] | null => (params.get(nom) === null ? null : params.get(nom)!.split(',').map(Number));
  const nomInstant = (t: number): string => (t === 0 ? 'Départ' : t === 1 ? 'Arrivée' : t === 0.5 ? 'Milieu' : `t = ${t}`);
  for (const t of liste('instants') ?? [0, 0.5, 1]) {
    for (const d of liste('tours') ?? [0, 90, 180, 270]) cases.push(nouvelle(s, angleNormal(s.camera.tour + d), t, `${nomInstant(t)}, +${d}°`, false));
  }
  $('aide').textContent = `${nomDe(s.id)} : sous quatre angles, au départ, au milieu et à l'arrivée.`;
} else {
  const ids = LOTS[lot]!.ids.filter((id) => POSES[id] !== undefined);
  ids.forEach((id, i) => cases.push(nouvelle(POSES[id]!, POSES[id]!.camera.tour, null, `${i + 1}. ${nomDe(id)}`, true)));
  const valides = ids.filter((id) => POSES[id]!.valide).length;
  $('aide').textContent = `${ids.length} exercices posés sur ${LOTS[lot]!.ids.length}, dont ${valides} validés. `
    + 'Glisser sur une figure pour la faire tourner. « Bon » valide la pose (le fichier est réécrit) ; '
    + 'une remarque se dicte dans la conversation.';
}

const observateur = new IntersectionObserver((entrees) => {
  for (const en of entrees) {
    const c = cases.find((x) => x.figure === en.target);
    if (c !== undefined) c.visible = en.isIntersecting;
  }
});
for (const c of cases) observateur.observe(c.figure);
$('grille').replaceChildren(...cases.map((c) => c.figure));
const taille = Number(params.get('taille') ?? 0);
if (taille > 0) {
  $('grille').style.gridTemplateColumns = `repeat(auto-fill, minmax(${taille}px, 1fr))`;
  source.style.width = source.style.height = `${Math.max(420, taille)}px`;
}

$('lots').replaceChildren(...LOTS.map((l, i) => {
  const a = Object.assign(document.createElement('a'), { className: 'bouton', textContent: l.nom, href: `?lot=${i}` });
  if (i === lot && !planche) a.style.borderColor = '#6c727c';
  return a;
}));

const cadres = new Map<PoseExercice, Cadre>();
function cadreDe(s: PoseExercice): Cadre {
  let c = cadres.get(s);
  if (c === undefined) cadres.set(s, (c = mesurerSujet(corpsPour(s.mainFermee), s)));
  return c;
}

function image(maintenant: number): void {
  if (rendu === null) return;
  const dt = maintenant - avant;
  avant = maintenant;
  if (enMouvement) temps += dt;
  for (const c of cases) {
    if (!c.visible) continue;
    if (tourneSeul) c.tour = angleNormal(c.tour + dt * 0.02);
    const s = c.sujet;
    dessinerImage(rendu, mesh, corpsPour(s.mainFermee), cadreDe(s), s, musclesForces ?? catalogue.get(s.id)?.muscles ?? {}, {
      tour: c.tour, hauteur: s.camera.hauteur, t: c.t ?? (params.get('t') !== null ? tFixe : avancement(temps / periodeDe(s))),
    });
    c.toile.width = source.width;
    c.toile.height = source.height;
    c.toile.getContext('2d')!.drawImage(source, 0, 0);
  }
  requestAnimationFrame(image);
}

$('b-lecture').addEventListener('click', (ev) => {
  enMouvement = !enMouvement;
  (ev.target as HTMLElement).setAttribute('aria-pressed', String(enMouvement));
});
$('b-tour').addEventListener('click', (ev) => {
  tourneSeul = !tourneSeul;
  (ev.target as HTMLElement).setAttribute('aria-pressed', String(tourneSeul));
});
requestAnimationFrame(image);
