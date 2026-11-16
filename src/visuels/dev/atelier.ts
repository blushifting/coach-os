/**
 * Atelier des visuels (développement seulement, voir `visuels.html`).
 *
 * Régler une pose sans écrire de code : un curseur par articulation pour
 * chaque pose clé, angles ou cible pour chaque membre, matériel, angle de vue
 * par défaut, lecture et curseur de temps. « Enregistrer » écrit le fichier de
 * l'exercice et le registre (`src/visuels/poses/`) par le serveur de
 * développement (greffon `atelierVisuels` de `vite.config.ts`).
 *
 * Les modifications non enregistrées sont gardées dans l'onglet
 * (`sessionStorage`) : elles survivent au rechargement que provoque un
 * enregistrement.
 *
 * Paramètres d'adresse : `?sujet=squat_bb_high&planche=1`, `?exemple=2&tour=165`.
 */

import { photosFor } from '@/data/exercise-photos';
import { loadExercises } from '@/engine/catalog';
import { angleNormal, corpsPour, dessinerImage } from '../animation';
import { brasEnAngles, brasEnCible, egal, fichierPose, fichierRegistre, jambeEnAngles, jambeEnCible } from '../edition';
import type { Cote } from '../edition';
import { ebaucher, piedsAuSol, piedsImmobiles } from '../ebauche';
import type { PointDetecte } from '../ebauche';
import { V } from '../maths';
import { Maillage } from '../maillage';
import type { Piece } from '../materiel';
import { POSES } from '../poses';
import { REPOS } from '../poses/repos';
import { creerRendu } from '../rendu';
import { avancement, mesurerSujet } from '../scene';
import type { PoseExercice } from '../scene';
import { LIMITES, REPERES_CENTRAUX, REPERES_PAIRS, miroirBras, miroirJambe, resoudre } from '../squelette';
import type { Pose } from '../squelette';
import { STYLE } from '../style';

const NB = ' ';

// -----------------------------------------------------------------------------
// Données
// -----------------------------------------------------------------------------
const catalogue = new Map(loadExercises().map((e) => [e.id, e]));
/**
 * Mode création (`?creer=1`), celui de Claude : créer une pose, l'ébaucher
 * depuis les photos. Sans lui, on ne règle que les poses qui existent déjà.
 */
const CREATION = new URLSearchParams(location.search).get('creer') === '1';
const nomDe = (id: string): string => catalogue.get(id)?.nom_fr ?? 'Pose de repos';

const NEUTRE: PoseExercice = { id: 'repos', camera: { tour: 25, hauteur: 8 }, mainFermee: false, cles: [REPOS], materiel: [], valide: false };
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
const TOUS_REPERES: readonly string[] = [...REPERES_CENTRAUX, ...REPERES_PAIRS.flatMap((r) => [r + 'G', r + 'D'])];

/** Un sujet dans l'atelier : la pose en cours de réglage, et ce qu'on sait d'elle. */
interface Sujet {
  pose: PoseExercice;
  /** Pas encore de fichier. */
  nouveau: boolean;
  /** Diffère du fichier. */
  modifie: boolean;
}

const CLE_BROUILLONS = 'kotsh-atelier-brouillons', CLE_INTERFACE = 'kotsh-atelier-interface';
const lireStockage = <T>(cle: string): T | null => {
  try {
    const v = sessionStorage.getItem(cle);
    return v === null ? null : (JSON.parse(v) as T);
  } catch {
    return null;
  }
};
const ecrireStockage = (cle: string, v: unknown): void => {
  try {
    sessionStorage.setItem(cle, JSON.stringify(v));
  } catch {
    // Stockage indisponible : on perd seulement le confort du brouillon.
  }
};

const sujets = new Map<string, Sujet>([['repos', { pose: NEUTRE, nouveau: false, modifie: false }]]);
for (const p of Object.values(POSES)) sujets.set(p.id, { pose: p, nouveau: false, modifie: false });
for (const [id, b] of Object.entries(lireStockage<Record<string, Sujet>>(CLE_BROUILLONS) ?? {})) {
  const nouveau = !(id in POSES);
  if (id !== 'repos' && catalogue.has(id) && (CREATION || !nouveau)) sujets.set(id, { ...b, nouveau, modifie: true });
}
const sauverBrouillons = (): void => {
  ecrireStockage(CLE_BROUILLONS, Object.fromEntries([...sujets].filter(([, s]) => s.modifie)));
};

// -----------------------------------------------------------------------------
// État de l'interface
// -----------------------------------------------------------------------------
type Lecture = 'boucle' | 'pause';
interface Interface {
  sujet: string;
  cle: number;
  lecture: Lecture;
  t: number;
  tour: number;
  hauteur: number;
  planche: boolean;
  exemple: number;
  /** Bras et jambes réglés ensemble, le droit en miroir du gauche. */
  symBras: boolean;
  symJambe: boolean;
  coteBras: Cote;
  coteJambe: Cote;
  fermes: string[];
}
const params = new URLSearchParams(location.search);
const garde = lireStockage<Partial<Interface>>(CLE_INTERFACE) ?? {};
const ui: Interface = {
  sujet: 'repos', cle: 0, lecture: 'boucle', t: 0, tour: 25, hauteur: 8, planche: false, exemple: 1,
  symBras: true, symJambe: true, coteBras: 'G', coteJambe: 'G', fermes: ['tronc', 'materiel'],
  ...garde,
};
if (params.has('sujet')) ui.sujet = params.get('sujet')!;
if (!sujets.has(ui.sujet)) ui.sujet = 'repos';
if (params.has('exemple')) ui.exemple = Number(params.get('exemple'));
if (params.has('planche')) ui.planche = params.get('planche') === '1';
if (!('tour' in garde)) Object.assign(ui, sujets.get(ui.sujet)!.pose.camera);
if (params.has('tour')) ui.tour = Number(params.get('tour'));
if (params.has('hauteur')) ui.hauteur = Number(params.get('hauteur'));
// Le miroir ne s'impose jamais à une pose qui n'est pas symétrique.
const symDepart = symetries(sujets.get(ui.sujet)!.pose);
ui.symBras = ui.symBras && symDepart.bras;
ui.symJambe = ui.symJambe && symDepart.jambe;
let phase = 0;

const courant = (): Sujet => sujets.get(ui.sujet)!;
const reglable = (): boolean => ui.sujet !== 'repos';
const cleCourante = (): Pose => courant().pose.cles[ui.cle]!;
const tempsDeCle = (i: number): number => (courant().pose.cles.length < 2 ? 0 : i / (courant().pose.cles.length - 1));

/** Symétrie détectée sur toutes les poses clés. */
function symetries(p: PoseExercice): { bras: boolean; jambe: boolean } {
  return {
    bras: p.cles.every((k) => egal(k.brasD, miroirBras(k.brasG))),
    jambe: p.cles.every((k) => egal(k.jambeD, miroirJambe(k.jambeG))),
  };
}

// -----------------------------------------------------------------------------
// Modifier la pose
// -----------------------------------------------------------------------------
type Chemin = readonly (string | number)[];
function lire(o: unknown, chemin: Chemin): unknown {
  return chemin.reduce<unknown>((x, k) => (x as Record<string | number, unknown>)[k], o);
}
function fixer<T>(o: T, chemin: Chemin, v: unknown): T {
  if (chemin.length === 0) return v as T;
  const [k, ...reste] = chemin;
  const base = o as unknown as Record<string | number, unknown>;
  const copie = (Array.isArray(o) ? [...o] : { ...base }) as Record<string | number, unknown>;
  copie[k!] = fixer(base[k!], reste, v);
  return copie as T;
}

/** Remet le côté droit en miroir du gauche, là où la symétrie est demandée. */
function symetriser(k: Pose): Pose {
  let p = k;
  if (ui.symBras) p = { ...p, brasD: miroirBras(p.brasG) };
  if (ui.symJambe) p = { ...p, jambeD: miroirJambe(p.jambeG) };
  return p;
}

function changerSujet(f: (p: PoseExercice) => PoseExercice): void {
  const s = courant();
  s.pose = f(s.pose);
  // Tout remis comme dans le fichier : plus rien à enregistrer.
  s.modifie = s.nouveau || !egal(s.pose, POSES[s.pose.id]);
  sauverBrouillons();
  majEnTete();
  aDessiner = true;
}

/** Modifie la pose clé choisie ; la lecture s'arrête sur elle. */
function changerCle(f: (k: Pose) => Pose): void {
  changerSujet((p) => ({ ...p, cles: p.cles.map((k, i) => (i === ui.cle ? symetriser(f(k)) : k)) }));
  if (ui.lecture !== 'pause' || ui.t !== tempsDeCle(ui.cle)) {
    ui.lecture = 'pause';
    ui.t = tempsDeCle(ui.cle);
    majLecture();
  }
}

// -----------------------------------------------------------------------------
// Éléments
// -----------------------------------------------------------------------------
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...enfants: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  e.append(...enfants);
  return e;
}
const bouton = (texte: string, action: () => void, attrs: Record<string, string> = {}): HTMLButtonElement => {
  const b = el('button', { type: 'button', ...attrs }, texte);
  b.addEventListener('click', action);
  return b;
};
const choix = (options: readonly (readonly [string, string])[], valeur: string, action: (v: string) => void): HTMLSelectElement => {
  const s = el('select');
  for (const [v, texte] of options) s.append(el('option', { value: v }, texte));
  s.value = valeur;
  s.addEventListener('change', () => action(s.value));
  return s;
};

/**
 * Un curseur, sa valeur exacte (modifiable au clavier) et « ↺ », qui remet la
 * valeur enregistrée dans le fichier (`reference`, absente pour une pose
 * jamais enregistrée).
 */
function curseur(libelle: string, valeur: number, [min, max]: readonly [number, number], pas: number, reference: number | undefined, action: (v: number) => void): HTMLElement {
  const glisse = el('input', { type: 'range', min: String(min), max: String(max), step: String(pas) });
  const exact = el('input', { type: 'number', step: String(pas) });
  const remettre = el('button', { type: 'button', class: 'remettre' }, '↺');
  let actuelle = valeur;
  const afficher = (v: number): void => {
    glisse.value = String(v);
    exact.value = String(Number(v.toFixed(2)));
  };
  const majRemettre = (): void => {
    remettre.hidden = reference === undefined;
    remettre.disabled = reference === undefined || egal(actuelle, reference);
    remettre.title = reference === undefined ? '' : `Remettre la valeur enregistrée (${String(Number(reference.toFixed(2))).replace('.', ',')})`;
  };
  const changer = (v: number): void => {
    actuelle = v;
    majRemettre();
    action(v);
  };
  afficher(valeur);
  majRemettre();
  glisse.addEventListener('input', () => {
    const v = Number(glisse.value);
    exact.value = String(Number(v.toFixed(2)));
    changer(v);
  });
  exact.addEventListener('change', () => {
    const v = Number(exact.value);
    if (!Number.isFinite(v)) return afficher(actuelle);
    glisse.value = String(v);
    changer(v);
  });
  remettre.addEventListener('click', () => {
    if (reference === undefined) return;
    afficher(reference);
    changer(reference);
  });
  return el('label', { class: 'curseur' }, el('span', {}, libelle), glisse, exact, remettre);
}

/** Lit un nombre à ce chemin, s'il existe (un membre en angles n'a pas de cible). */
function lireNombre(o: unknown, chemin: Chemin): number | undefined {
  let x = o;
  for (const k of chemin) {
    if (x === null || typeof x !== 'object') return undefined;
    x = (x as Record<string | number, unknown>)[k];
  }
  return typeof x === 'number' ? x : undefined;
}

/** La pose telle que l'enregistre son fichier : ce que « ↺ » rétablit. */
const reference = (): PoseExercice | undefined => (courant().nouveau ? undefined : POSES[ui.sujet]);

/** La pose clé du fichier qui correspond à celle qu'on règle : départ pour départ, arrivée pour arrivée. */
function cleDeReference(): Pose | undefined {
  const ref = reference(), n = courant().pose.cles.length;
  if (ref === undefined) return undefined;
  if (ui.cle === 0) return ref.cles[0];
  if (ui.cle === n - 1) return ref.cles[ref.cles.length - 1];
  return ref.cles.length === n ? ref.cles[ui.cle] : undefined;
}

/** Curseur sur un nombre de la pose clé choisie. */
const surCle = (libelle: string, chemin: Chemin, bornes: readonly [number, number], pas = 1): HTMLElement =>
  curseur(libelle, lire(cleCourante(), chemin) as number, bornes, pas, lireNombre(cleDeReference(), chemin), (v) => changerCle((k) => fixer(k, chemin, v)));

/** Trois curseurs pour un point ou une direction. */
const surVecteur = (libelles: readonly [string, string, string], chemin: Chemin, bornes: readonly (readonly [number, number])[], pas: number, cible: 'cle' | 'sujet'): HTMLElement[] =>
  libelles.map((l, i) =>
    cible === 'cle'
      ? surCle(l, [...chemin, i], bornes[i]!, pas)
      : curseur(l, lire(courant().pose, [...chemin, i]) as number, bornes[i]!, pas, lireNombre(reference(), [...chemin, i]), (v) => changerSujet((p) => fixer(p, [...chemin, i], v))),
  );

/**
 * Confirmation dans la page : le premier clic change le texte du bouton, le
 * second agit. (Le navigateur intégré à l'app de Claude ne montre pas les
 * fenêtres `confirm()` : elles y répondent « non » sans rien afficher.)
 */
function aConfirmer(b: HTMLButtonElement, question: string, action: () => void): void {
  let texte = '', arme: number | null = null;
  b.addEventListener('click', () => {
    if (arme === null) {
      texte = b.textContent ?? '';
      b.textContent = question;
      b.classList.add('a-confirmer');
      arme = window.setTimeout(() => {
        b.textContent = texte;
        b.classList.remove('a-confirmer');
        arme = null;
      }, 4000);
      return;
    }
    window.clearTimeout(arme);
    arme = null;
    b.textContent = texte;
    b.classList.remove('a-confirmer');
    action();
  });
}

function section(id: string, titre: string, ...contenu: (Node | string)[]): HTMLDetailsElement {
  const d = el('details', { 'data-id': id }, el('summary', {}, titre), ...contenu);
  d.open = !ui.fermes.includes(id);
  d.addEventListener('toggle', () => {
    ui.fermes = d.open ? ui.fermes.filter((x) => x !== id) : [...new Set([...ui.fermes, id])];
    sauverInterface();
  });
  return d;
}
const groupe = (titre: string, ...contenu: Node[]): HTMLElement => el('fieldset', {}, el('legend', {}, titre), ...contenu);

// -----------------------------------------------------------------------------
// Panneau de réglage
// -----------------------------------------------------------------------------
const TRONC = [['lombaires', 'Lombaires'], ['thorax', 'Thorax'], ['cou', 'Cou'], ['tete', 'Tête']] as const;
const L = LIMITES;

function message(texte: string, genre: 'info' | 'alerte' = 'info'): void {
  const m = $('message');
  m.textContent = texte;
  m.dataset.genre = genre;
}

/** Passe un membre des angles à la cible (ou inversement) sur toutes les poses clés. */
function changerMode(membre: 'bras' | 'jambe', c: Cote, versCible: boolean, repere = 'thorax'): void {
  const nom = (membre + c) as 'brasG' | 'brasD' | 'jambeG' | 'jambeD', bout = membre === 'bras' ? 'poignet' : 'cheville';
  const bouges: number[] = [];
  changerSujet((p) => ({
    ...p,
    cles: p.cles.map((k, i) => {
      const nouveau = membre === 'bras'
        ? (versCible ? brasEnCible(k, c, repere) : brasEnAngles(k, c))
        : (versCible ? jambeEnCible(k, c) : jambeEnAngles(k, c));
      const apres = symetriser({ ...k, [nom]: nouveau });
      if (V.len(V.sub(resoudre(k)[bout + c]!.o, resoudre(apres)[bout + c]!.o)) > 0.5) bouges.push(i + 1);
      return apres;
    }),
  }));
  if (bouges.length > 0) {
    message(`Un angle sortait des limites anatomiques${NB}: le membre a un peu bougé (pose${bouges.length > 1 ? 's' : ''} ${bouges.join(', ')}).`, 'alerte');
  } else message('');
  construirePanneau();
}

function panneauBras(): HTMLElement[] {
  const c: Cote = ui.symBras ? 'G' : ui.coteBras, nom = 'bras' + c, b = cleCourante()[nom as 'brasG'];
  const enCible = b.cible !== null;
  const out: HTMLElement[] = [];
  const sym = el('input', { type: 'checkbox' });
  sym.checked = ui.symBras;
  sym.addEventListener('change', () => {
    ui.symBras = sym.checked;
    // Le droit reprend le miroir du gauche.
    if (ui.symBras) changerSujet((p) => ({ ...p, cles: p.cles.map(symetriser) }));
    sauverInterface();
    construirePanneau();
  });
  out.push(el('label', { class: 'case' }, sym, 'Les deux bras ensemble (le droit en miroir)'));
  if (!ui.symBras) {
    out.push(el('div', { class: 'onglets' },
      ...(['G', 'D'] as const).map((x) => bouton(x === 'G' ? 'Bras gauche' : 'Bras droit', () => { ui.coteBras = x; sauverInterface(); construirePanneau(); }, { 'aria-pressed': String(ui.coteBras === x) }))));
  }
  out.push(el('div', { class: 'onglets' },
    bouton('Angles', () => enCible && changerMode('bras', c, false), { 'aria-pressed': String(!enCible) }),
    bouton('Main sur une cible', () => !enCible && changerMode('bras', c, true), { 'aria-pressed': String(enCible) })));
  if (b.cible === null) {
    out.push(groupe('Épaule',
      surCle('Flexion (vers l\'avant)', [nom, 'epaule', 'flex'], L.epaule.flex),
      surCle('Abduction (vers l\'extérieur)', [nom, 'epaule', 'abd'], L.epaule.abd),
      surCle('Rotation (externe)', [nom, 'epaule', 'rot'], L.epaule.rot)));
    out.push(groupe('Coude', surCle('Flexion', [nom, 'coude'], L.coude)));
  } else {
    const rep = choix(REPERES_CENTRAUX.map((r) => [r, r] as const), b.cible.repere, (r) => changerMode('bras', c, true, r));
    out.push(groupe('Cible de la main',
      el('label', { class: 'curseur' }, el('span', {}, 'Dans le repère'), rep),
      ...surVecteur(['Main, gauche-droite', 'Main, hauteur', 'Main, avant-arrière'], [nom, 'cible', 'pos'], [[-90, 90], [-90, 90], [-90, 90]], 0.5, 'cle'),
      ...surVecteur(['Coude vers, X', 'Coude vers, Y', 'Coude vers, Z'], [nom, 'cible', 'pole'], [[-1, 1], [-1, 1], [-1, 1]], 0.05, 'cle')));
  }
  out.push(groupe('Avant-bras et main',
    surCle('Pronation', [nom, 'pronation'], L.pronation),
    surCle('Poignet, flexion', [nom, 'poignet', 'flex'], L.poignet.flex),
    surCle('Poignet, inclinaison', [nom, 'poignet', 'dev'], L.poignet.dev)));
  out.push(groupe('Épaule (moignon)',
    surCle('Haussement (cm)', [nom, 'clav', 0], [-3, 6], 0.5),
    surCle('Vers l\'avant (cm)', [nom, 'clav', 1], [-4, 6], 0.5)));
  return out;
}

function panneauJambes(): HTMLElement[] {
  const c: Cote = ui.symJambe ? 'G' : ui.coteJambe, nom = 'jambe' + c, j = cleCourante()[nom as 'jambeG'];
  const enCible = j.cible !== null;
  const out: HTMLElement[] = [];
  const sym = el('input', { type: 'checkbox' });
  sym.checked = ui.symJambe;
  sym.addEventListener('change', () => {
    ui.symJambe = sym.checked;
    if (ui.symJambe) changerSujet((p) => ({ ...p, cles: p.cles.map(symetriser) }));
    sauverInterface();
    construirePanneau();
  });
  out.push(el('label', { class: 'case' }, sym, 'Les deux jambes ensemble (la droite en miroir)'));
  if (!ui.symJambe) {
    out.push(el('div', { class: 'onglets' },
      ...(['G', 'D'] as const).map((x) => bouton(x === 'G' ? 'Jambe gauche' : 'Jambe droite', () => { ui.coteJambe = x; sauverInterface(); construirePanneau(); }, { 'aria-pressed': String(ui.coteJambe === x) }))));
  }
  out.push(el('div', { class: 'onglets' },
    bouton('Angles', () => enCible && changerMode('jambe', c, false), { 'aria-pressed': String(!enCible) }),
    bouton('Pied posé (cible)', () => !enCible && changerMode('jambe', c, true), { 'aria-pressed': String(enCible) })));
  if (j.cible === null) {
    out.push(groupe('Hanche',
      surCle('Flexion (vers l\'avant)', [nom, 'hanche', 'flex'], L.hanche.flex),
      surCle('Abduction (vers l\'extérieur)', [nom, 'hanche', 'abd'], L.hanche.abd),
      surCle('Rotation (externe)', [nom, 'hanche', 'rot'], L.hanche.rot)));
    out.push(groupe('Genou et cheville',
      surCle('Genou, flexion', [nom, 'genou'], L.genou),
      surCle('Cheville, flexion', [nom, 'cheville'], L.cheville)));
  } else {
    out.push(groupe('Pied (dans l\'espace, en cm)',
      ...surVecteur(['Gauche-droite', 'Hauteur de la cheville', 'Avant-arrière'], [nom, 'cible', 'pos'], [[-60, 60], [0, 120], [-80, 80]], 0.5, 'cle'),
      surCle('Ouverture du pied', [nom, 'cible', 'tour'], [-45, 60]),
      surCle('Talon levé', [nom, 'cible', 'pointe'], [0, 60])));
    out.push(groupe('Genou vers',
      ...surVecteur(['X (gauche)', 'Y (haut)', 'Z (devant)'], [nom, 'cible', 'pole'], [[-1, 1], [-1, 1], [-1, 1]], 0.05, 'cle')));
  }
  return out;
}

const MODELES: Readonly<Record<string, { nom: string; pieces: readonly Piece[] }>> = {
  barre: { nom: 'Barre sur le dos', pieces: [{ type: 'barre', repere: 'thorax', centre: [0, 23, -10.4] }] },
  barreMains: { nom: 'Barre dans les mains', pieces: [{ type: 'barre', repere: 'monde', centre: [0, 100, 20] }] },
  halteres: {
    nom: 'Deux haltères',
    pieces: [{ type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] }, { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] }],
  },
  haltere: { nom: 'Un haltère (main gauche)', pieces: [{ type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] }] },
  cable: { nom: 'Câble (main gauche)', pieces: [{ type: 'cable', de: ['monde', [30, 200, 40]], a: ['poignetG', [0, -5, 0]] }] },
};
const NOMS_PIECES: Readonly<Record<Piece['type'], string>> = { barre: 'Barre', haltere: 'Haltère', cable: 'Câble' };

function panneauMateriel(): HTMLElement[] {
  const out: HTMLElement[] = [];
  const BORNES: readonly (readonly [number, number])[] = [[-100, 100], [-60, 220], [-100, 100]];
  courant().pose.materiel.forEach((m, i) => {
    const retirer = bouton('Retirer', () => {
      changerSujet((p) => ({ ...p, materiel: p.materiel.filter((_, j) => j !== i) }));
      construirePanneau();
    });
    const repere = (chemin: Chemin, valeur: string): HTMLElement =>
      el('label', { class: 'curseur' }, el('span', {}, 'Repère'),
        choix(TOUS_REPERES.map((r) => [r, r] as const), valeur, (r) => { changerSujet((p) => fixer(p, chemin, r)); construirePanneau(); }));
    if (m.type === 'cable') {
      out.push(groupe(`${i + 1}. Câble`,
        el('p', { class: 'aide' }, 'Départ (la poulie)'), repere(['materiel', i, 'de', 0], m.de[0]),
        ...surVecteur(['X', 'Y', 'Z'], ['materiel', i, 'de', 1], BORNES, 0.5, 'sujet'),
        el('p', { class: 'aide' }, 'Arrivée (la poignée)'), repere(['materiel', i, 'a', 0], m.a[0]),
        ...surVecteur(['X', 'Y', 'Z'], ['materiel', i, 'a', 1], BORNES, 0.5, 'sujet'),
        retirer));
    } else {
      out.push(groupe(`${i + 1}. ${NOMS_PIECES[m.type]}`, repere(['materiel', i, 'repere'], m.repere),
        ...surVecteur(['Centre, X', 'Centre, Y', 'Centre, Z'], ['materiel', i, 'centre'], BORNES, 0.1, 'sujet'), retirer));
    }
  });
  const ajout = choix([['', 'Ajouter une pièce…'], ...Object.entries(MODELES).map(([k, v]) => [k, v.nom] as const)], '', (k) => {
    const modele = MODELES[k];
    if (modele === undefined) return;
    changerSujet((p) => ({ ...p, materiel: [...p.materiel, ...modele.pieces] }));
    construirePanneau();
  });
  out.push(ajout);
  out.push(el('p', { class: 'aide' }, `Le matériel est commun à toutes les poses clés. Il suit le repère qui le porte${NB}: une barre posée sur le thorax descend avec lui.`));
  return out;
}

function construirePanneau(): void {
  const panneau = $('reglages');
  panneau.replaceChildren();
  if (!reglable()) {
    panneau.append(el('p', { class: 'aide' }, `La pose de repos fixe la longueur de repos de chaque muscle${NB}: elle ne se règle pas ici. Choisissez un exercice, ou créez une nouvelle pose.`));
    return;
  }
  const p = courant().pose;
  const mains = el('input', { type: 'checkbox' });
  mains.checked = p.mainFermee;
  mains.addEventListener('change', () => changerSujet((x) => ({ ...x, mainFermee: mains.checked })));
  const valide = el('input', { type: 'checkbox' });
  valide.checked = p.valide;
  valide.addEventListener('change', () => changerSujet((x) => ({ ...x, valide: valide.checked })));
  const vue = el('span', { class: 'aide' }, `tour ${p.camera.tour}°, hauteur ${p.camera.hauteur}°`);
  panneau.append(
    section('exercice', 'Exercice',
      el('label', { class: 'case' }, mains, 'Mains fermées sur une prise'),
      el('label', { class: 'case' }, valide, 'Pose validée (la fiche montre l\'animation au lieu des photos)'),
      el('div', { class: 'ligne' }, el('span', {}, `Angle de vue par défaut${NB}:`), vue,
        bouton('Prendre la vue actuelle', () => {
          changerSujet((x) => ({ ...x, camera: { tour: ui.tour, hauteur: ui.hauteur } }));
          construirePanneau();
        }))),
    el('h2', {}, `Pose clé ${ui.cle + 1}${ui.cle === 0 ? ' (départ)' : ui.cle === p.cles.length - 1 ? ' (arrivée)' : ''}`),
    section('bassin', 'Bassin',
      ...surVecteur(['Gauche-droite (cm)', 'Hauteur (cm)', 'Avant-arrière (cm)'], ['bassin', 'pos'], [[-60, 60], [10, 130], [-80, 80]], 0.5, 'cle'),
      surCle('Bascule (vers l\'avant)', ['bassin', 'bascule'], [-100, 100]),
      surCle('Tour', ['bassin', 'tour'], [-180, 180]),
      surCle('Penché de côté', ['bassin', 'penche'], [-45, 45])),
    section('tronc', 'Tronc et tête',
      ...TRONC.map(([cle, titre]) => groupe(titre,
        surCle('Flexion (vers l\'avant)', [cle, 'flex'], L[cle].flex),
        surCle('Penché de côté', [cle, 'penche'], L[cle].penche),
        surCle('Torsion', [cle, 'tour'], L[cle].tour)))),
    section('bras', 'Bras', ...panneauBras()),
    section('jambes', 'Jambes', ...panneauJambes()),
    section('materiel', 'Matériel', ...panneauMateriel()),
  );
}

// -----------------------------------------------------------------------------
// En-tête : sujet, nouvelle pose, enregistrement
// -----------------------------------------------------------------------------
function majEnTete(): void {
  const s = courant();
  const options = [...sujets.values()]
    .map((x) => [x.pose.id, `${nomDe(x.pose.id)}${x.modifie ? ' •' : ''}${x.pose.valide ? ' (validée)' : ''}`] as const)
    .sort((a, b) => (a[0] === 'repos' ? -1 : b[0] === 'repos' ? 1 : a[1].localeCompare(b[1], 'fr')));
  const sel = $<HTMLSelectElement>('sujet');
  sel.replaceChildren(...options.map(([v, t]) => el('option', { value: v }, t)));
  sel.value = ui.sujet;
  const nouveau = $<HTMLSelectElement>('nouveau');
  if (nouveau.options.length === 0 || nouveau.dataset.nb !== String(sujets.size)) {
    const libres = [...catalogue.values()].filter((e) => !sujets.has(e.id)).sort((a, b) => a.nom_fr.localeCompare(b.nom_fr, 'fr'));
    nouveau.replaceChildren(el('option', { value: '' }, `Nouvelle pose… (${libres.length} exercices sans pose)`), ...libres.map((e) => el('option', { value: e.id }, e.nom_fr)));
    nouveau.dataset.nb = String(sujets.size);
  }
  $('etat').textContent = !reglable() ? '' : s.nouveau ? 'Nouvelle pose, pas encore enregistrée' : s.modifie ? 'Modifications non enregistrées' : 'Enregistrée';
  $<HTMLButtonElement>('b-enregistrer').disabled = !reglable() || !(s.modifie || s.nouveau);
  $('b-abandonner').hidden = !(s.modifie || s.nouveau);
  $('b-abandonner').textContent = s.nouveau ? 'Retirer cette nouvelle pose' : 'Abandonner les modifications';
  $('nouveau').hidden = !CREATION;
  $('l-exemple').hidden = catalogue.has(ui.sujet);
}

function choisirSujet(id: string): void {
  // Une nouvelle pose qu'on quitte sans l'avoir touchée ne reste pas dans la liste.
  const avant = sujets.get(ui.sujet);
  if (avant !== undefined && avant.nouveau && !avant.modifie && ui.sujet !== id) sujets.delete(ui.sujet);
  ui.sujet = id;
  ui.cle = 0;
  ui.lecture = 'boucle';
  const sym = symetries(courant().pose);
  ui.symBras = sym.bras;
  ui.symJambe = sym.jambe;
  Object.assign(ui, courant().pose.camera);
  history.replaceState(null, '', `?sujet=${id}${CREATION ? '&creer=1' : ''}`);
  message('');
  toutMettreAJour();
}

async function enregistrer(): Promise<void> {
  const s = courant();
  const ids = [...new Set([...Object.keys(POSES), s.pose.id])];
  const fichiers = [{ nom: `${s.pose.id}.ts`, contenu: fichierPose(s.pose, nomDe(s.pose.id)) }];
  if (s.nouveau) fichiers.push({ nom: 'index.ts', contenu: fichierRegistre(ids) });
  // L'enregistrement fait recharger la page par le serveur de développement :
  // le brouillon de ce sujet disparaît, l'interface et les autres brouillons restent.
  s.modifie = false;
  sauverBrouillons();
  sauverInterface();
  message('Enregistrement…');
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}__atelier/enregistrer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fichiers }),
    });
    if (!r.ok) throw new Error(await r.text());
    s.nouveau = false;
    message(`Enregistré${NB}: src/visuels/poses/${s.pose.id}.ts`);
  } catch (e) {
    s.modifie = true;
    sauverBrouillons();
    message(`Échec de l'enregistrement${NB}: ${e instanceof Error ? e.message : String(e)}`, 'alerte');
  }
  majEnTete();
}

function abandonner(): void {
  const s = courant();
  if (s.nouveau) {
    sujets.delete(s.pose.id);
    sauverBrouillons();
    choisirSujet('repos');
    return;
  }
  s.pose = POSES[s.pose.id]!;
  s.modifie = false;
  sauverBrouillons();
  choisirSujet(s.pose.id);
}

// -----------------------------------------------------------------------------
// Poses clés, lecture, vue
// -----------------------------------------------------------------------------
function majCles(): void {
  const p = courant().pose, n = p.cles.length;
  const zone = $('cles');
  zone.replaceChildren(el('span', { class: 'aide' }, `Poses clés${NB}:`),
    ...p.cles.map((_, i) => bouton(`${i + 1}${i === 0 ? ' · départ' : i === n - 1 ? ' · arrivée' : ''}`, () => {
      ui.cle = i;
      ui.lecture = 'pause';
      ui.t = tempsDeCle(i);
      toutMettreAJour();
    }, { 'aria-pressed': String(ui.cle === i && ui.lecture === 'pause' && ui.t === tempsDeCle(i)) })));
  if (!reglable()) return;
  zone.append(
    bouton('Dupliquer', () => {
      changerSujet((x) => ({ ...x, cles: [...x.cles.slice(0, ui.cle + 1), x.cles[ui.cle]!, ...x.cles.slice(ui.cle + 1)] }));
      ui.cle += 1;
      ui.lecture = 'pause';
      ui.t = tempsDeCle(ui.cle);
      toutMettreAJour();
    }, { title: 'Insère une copie de cette pose clé juste après elle' }),
  );
  if (n > 1) {
    zone.append(bouton('Retirer', () => {
      changerSujet((x) => ({ ...x, cles: x.cles.filter((_, i) => i !== ui.cle) }));
      ui.cle = Math.max(0, ui.cle - 1);
      ui.t = tempsDeCle(ui.cle);
      toutMettreAJour();
    }, { title: 'Retire cette pose clé' }));
  }
}

function majLecture(): void {
  $('b-lecture').textContent = ui.lecture === 'boucle' ? 'Pause' : 'Lecture';
  majTemps();
  majCles();
}
function majTemps(): void {
  const t = tempsAffiche();
  $<HTMLInputElement>('temps').value = String(t);
  $('o-temps').textContent = `${Math.round(t * 100)}${NB}%`;
}
const tempsAffiche = (): number => (ui.lecture === 'boucle' ? avancement(phase) : ui.t);

function majVue(): void {
  $('b-planche').setAttribute('aria-pressed', String(ui.planche));
  $('planche').hidden = !ui.planche;
  toile.classList.toggle('hors-champ', ui.planche);
  $<HTMLInputElement>('tour').value = String(ui.tour);
  $<HTMLInputElement>('hauteur').value = String(ui.hauteur);
  $('o-tour').textContent = `${ui.tour}°`;
  $('o-hauteur').textContent = `${ui.hauteur}°`;
  $<HTMLSelectElement>('exemple').value = String(ui.exemple);
  aDessiner = true;
}

function toutMettreAJour(): void {
  ui.cle = Math.min(ui.cle, courant().pose.cles.length - 1);
  majEnTete();
  majLecture();
  majVue();
  construirePanneau();
  majPhotos();
  sauverInterface();
}

const sauverInterface = (): void => ecrireStockage(CLE_INTERFACE, ui);

// -----------------------------------------------------------------------------
// Photos de référence et ébauche (MediaPipe Pose)
// -----------------------------------------------------------------------------
// MediaPipe n'est pas une dépendance de l'app : l'atelier le charge à la
// demande, depuis un CDN, la première fois qu'on demande une ébauche.
const MEDIAPIPE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20';
const MODELE_POSE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task';
interface Detection {
  readonly landmarks: PointDetecte[][];
  readonly worldLandmarks: PointDetecte[][];
}
interface Detecteur {
  detect(image: HTMLCanvasElement): Detection;
}
let detecteur: Promise<Detecteur> | null = null;
function chargerDetecteur(): Promise<Detecteur> {
  detecteur ??= (async () => {
    const mp = (await import(/* @vite-ignore */ `${MEDIAPIPE}/vision_bundle.mjs`)) as {
      FilesetResolver: { forVisionTasks(chemin: string): Promise<unknown> };
      PoseLandmarker: { createFromOptions(f: unknown, o: unknown): Promise<Detecteur> };
    };
    const fichiers = await mp.FilesetResolver.forVisionTasks(`${MEDIAPIPE}/wasm`);
    return mp.PoseLandmarker.createFromOptions(fichiers, {
      baseOptions: { modelAssetPath: MODELE_POSE, delegate: 'CPU' },
      runningMode: 'IMAGE',
      numPoses: 1,
    });
  })();
  detecteur.catch(() => { detecteur = null; });
  return detecteur;
}

/** Photo chargée dans une toile ordinaire (ses pixels sont lisibles : le détecteur en a besoin). */
async function chargerPhoto(url: string): Promise<HTMLCanvasElement> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`photo introuvable (${r.status})`);
  const image = await createImageBitmap(await r.blob());
  const c = el('canvas');
  c.width = image.width;
  c.height = image.height;
  c.getContext('2d')!.drawImage(image, 0, 0);
  return c;
}

const OS_PHOTO = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]] as const;
/** Le squelette détecté, dessiné sur la photo : rouge à gauche, bleu à droite, plus pâle s'il est peu visible. */
function dessinerSquelette(c: HTMLCanvasElement, points: readonly PointDetecte[]): void {
  const g = c.getContext('2d')!, cote = (i: number): number => (i % 2 === 1 ? 1 : -1);
  g.lineWidth = Math.max(2, c.width / 220);
  for (const [a, b] of OS_PHOTO) {
    g.strokeStyle = cote(a) !== cote(b) ? '#3fbf5f' : cote(a) === 1 ? '#ff4a4a' : '#4a8cff';
    g.globalAlpha = Math.max(0.3, Math.min(points[a]!.visibility ?? 1, points[b]!.visibility ?? 1));
    g.beginPath();
    g.moveTo(points[a]!.x * c.width, points[a]!.y * c.height);
    g.lineTo(points[b]!.x * c.width, points[b]!.y * c.height);
    g.stroke();
  }
  g.globalAlpha = 1;
}

let photosDe = '';
function majPhotos(): void {
  const zone = $('photos');
  if (photosDe === ui.sujet) return;
  photosDe = ui.sujet;
  const photos = reglable() ? photosFor(ui.sujet) : null;
  zone.hidden = photos === null;
  if (photos === null) return zone.replaceChildren();
  const ebauche = el('button', { type: 'button', id: 'b-ebauche' }, 'Ébaucher le départ et l\'arrivée depuis les photos');
  aConfirmer(ebauche, `Remplacer le départ et l'arrivée${NB}? Cliquer encore pour confirmer`, () => void ebaucherDepuisPhotos(photos.startUrl, photos.endUrl));
  zone.replaceChildren(
    el('div', { class: 'duo' },
      ...[photos.startUrl, photos.endUrl].map((url, i) =>
        el('figure', { 'data-photo': String(i) }, el('img', { src: url, alt: '', loading: 'lazy' }), el('figcaption', {}, i === 0 ? 'Départ' : 'Arrivée')))),
    ...(CREATION
      ? [ebauche, el('p', { class: 'aide' }, `L'ébauche (MediaPipe Pose) règle le tronc, les épaules, les coudes, les hanches et les genoux${NB}; le reste est à faire à la main. Elle se trompe souvent allongé ou dans une machine.`)]
      : []),
    el('p', { class: 'aide' }, `Photos de free-exercise-db, pour comparer. Certaines sont attribuées au mauvais exercice${NB}: s'y fier avec prudence.`),
  );
}

async function ebaucherDepuisPhotos(depart: string, arrivee: string): Promise<void> {
  const p = courant().pose, symetrique = !(catalogue.get(p.id)?.uni ?? false);
  const b = $<HTMLButtonElement>('b-ebauche');
  b.disabled = true;
  try {
    message(`Chargement du détecteur (environ 30${NB}Mo la première fois)…`);
    const [d, photos] = await Promise.all([chargerDetecteur(), Promise.all([chargerPhoto(depart), chargerPhoto(arrivee)])]);
    message('Détection…');
    const resultats = photos.map((c, i) => {
      const r = d.detect(c);
      const image = r.landmarks[0], monde = r.worldLandmarks[0];
      if (image === undefined || monde === undefined) throw new Error(`aucune personne détectée sur la photo ${i === 0 ? 'de départ' : 'd\'arrivée'}`);
      dessinerSquelette(c, image);
      const fig = $('photos').querySelector(`[data-photo="${i}"]`)!;
      fig.querySelector('img, canvas')!.replaceWith(c);
      // La visibilité se lit sur les points de l'image.
      return { image, ...ebaucher(monde.map((m, k) => ({ ...m, visibility: image[k]?.visibility ?? 0 })), symetrique) };
    });
    // Pieds au sol (jambes en cible) s'ils ne bougent pas d'une photo à l'autre ; sinon, jambes en angles.
    let a = resultats[0]!.pose, z = resultats[1]!.pose;
    const auSol = piedsImmobiles(resultats[0]!.image, resultats[1]!.image);
    if (auSol) {
      const sol = piedsAuSol(a);
      a = sol.pose;
      z = piedsAuSol(z, sol.pieds).pose;
    }
    // Les poses clés intermédiaires prennent le même mode de jambes (l'interpolation l'exige).
    const memeMode = (k: Pose): Pose => {
      if ((k.jambeG.cible !== null) === auSol) return k;
      return auSol
        ? { ...k, jambeG: jambeEnCible(k, 'G'), jambeD: jambeEnCible(k, 'D') }
        : { ...k, jambeG: jambeEnAngles(k, 'G'), jambeD: jambeEnAngles(k, 'D') };
    };
    ui.symBras = symetrique;
    ui.symJambe = symetrique;
    changerSujet((x) => ({ ...x, cles: x.cles.map((k, i) => (i === 0 ? a : i === x.cles.length - 1 ? z : memeMode(k))) }));
    // La vue de la photo de départ, pour comparer d'un coup d'œil.
    ui.tour = Math.round(angleNormal(resultats[0]!.tourCamera));
    ui.hauteur = 5;
    ui.cle = 0;
    ui.lecture = 'pause';
    ui.t = 0;
    const conf = resultats.map((r) => r.confiance.toFixed(2).replace('.', ','));
    const douteux = resultats.some((r) => r.confiance < 0.7);
    message(`Ébauche faite. Confiance de la détection${NB}: départ ${conf[0]}, arrivée ${conf[1]}${douteux ? ` (sous 0,7${NB}: à vérifier de près)` : ''}.`, douteux ? 'alerte' : 'info');
    toutMettreAJour();
  } catch (e) {
    message(`Ébauche impossible${NB}: ${e instanceof Error ? e.message : String(e)}`, 'alerte');
  } finally {
    b.disabled = false;
  }
}

// -----------------------------------------------------------------------------
// Dessin
// -----------------------------------------------------------------------------
const toile = $<HTMLCanvasElement>('vue');
const rendu = creerRendu(toile);
const mesh = new Maillage();
let aDessiner = true;

const coefficients = (id: string): Readonly<Record<string, number>> => catalogue.get(id)?.muscles ?? EXEMPLES[ui.exemple]!.muscles;

function dessiner(): void {
  if (rendu === null) return;
  const s = courant().pose, corps = corpsPour(s.mainFermee), cadre = mesurerSujet(corps, s), t = tempsAffiche();
  if (ui.planche) {
    // Une seule toile WebGL : chaque vue y est dessinée puis recopiée dans une toile ordinaire.
    const grille = $('planche');
    for (const [i, vue] of PLANCHE.entries()) {
      dessinerImage(rendu, mesh, corps, cadre, s, coefficients(s.id), { tour: vue.tour, hauteur: ui.hauteur, t });
      const copie = grille.children[i]!.querySelector('canvas')!;
      copie.width = toile.width;
      copie.height = toile.height;
      copie.getContext('2d')!.drawImage(toile, 0, 0);
    }
  }
  dessinerImage(rendu, mesh, corps, cadre, s, coefficients(s.id), { tour: ui.tour, hauteur: ui.hauteur, t });
}

// -----------------------------------------------------------------------------
// Branchements
// -----------------------------------------------------------------------------
if (rendu === null) message(`WebGL indisponible dans ce navigateur${NB}: rien ne peut être dessiné.`, 'alerte');
$('exemple').replaceChildren(...EXEMPLES.map((e, i) => el('option', { value: String(i) }, e.nom)));
$('planche').replaceChildren(...PLANCHE.map((v) => el('figure', {}, el('canvas'), el('figcaption', {}, v.nom))));
$('sujet').addEventListener('change', (e) => choisirSujet((e.target as HTMLSelectElement).value));
$('nouveau').addEventListener('change', (e) => {
  const id = (e.target as HTMLSelectElement).value;
  if (id === '') return;
  sujets.set(id, { pose: { id, camera: { tour: 25, hauteur: 8 }, mainFermee: false, materiel: [], cles: [REPOS, REPOS], valide: false }, nouveau: true, modifie: false });
  sauverBrouillons();
  choisirSujet(id);
});
$('b-enregistrer').addEventListener('click', () => void enregistrer());
aConfirmer($<HTMLButtonElement>('b-abandonner'), `Sûr${NB}? Cliquer encore pour confirmer`, abandonner);
$('exemple').addEventListener('change', (e) => { ui.exemple = Number((e.target as HTMLSelectElement).value); majVue(); sauverInterface(); });
$('b-planche').addEventListener('click', () => { ui.planche = !ui.planche; majVue(); sauverInterface(); });
$('b-lecture').addEventListener('click', () => {
  if (ui.lecture === 'boucle') {
    ui.t = avancement(phase);
    ui.lecture = 'pause';
  } else ui.lecture = 'boucle';
  majLecture();
});
$('temps').addEventListener('input', (e) => {
  ui.lecture = 'pause';
  ui.t = Number((e.target as HTMLInputElement).value);
  // La pose clé la plus proche devient celle qu'on règle.
  const n = courant().pose.cles.length;
  if (n > 1) ui.cle = Math.round(ui.t * (n - 1));
  $('b-lecture').textContent = 'Lecture';
  majTemps();
  majCles();
  construirePanneau();
  aDessiner = true;
});
for (const id of ['tour', 'hauteur'] as const) {
  $(id).addEventListener('input', (e) => { ui[id] = Number((e.target as HTMLInputElement).value); majVue(); sauverInterface(); });
}
window.addEventListener('beforeunload', sauverInterface);

// Glisser sur la figure : tourner autour, un seul degré de liberté.
let prise: { x: number; tour: number } | null = null;
toile.addEventListener('pointerdown', (e) => { prise = { x: e.clientX, tour: ui.tour }; toile.setPointerCapture(e.pointerId); });
toile.addEventListener('pointermove', (e) => {
  if (prise === null) return;
  ui.tour = Math.round(angleNormal(prise.tour - (e.clientX - prise.x) * 0.9));
  majVue();
});
toile.addEventListener('pointerup', () => { prise = null; sauverInterface(); });
toile.addEventListener('pointercancel', () => { prise = null; });

let avant = performance.now();
function image(maintenant: number): void {
  const anime = ui.lecture === 'boucle' && courant().pose.cles.length > 1;
  if (anime) {
    phase = (phase + (maintenant - avant) / STYLE.periode) % 1;
    majTemps();
  }
  avant = maintenant;
  if (anime || aDessiner) {
    dessiner();
    aDessiner = false;
  }
  requestAnimationFrame(image);
}
toutMettreAJour();
requestAnimationFrame(image);
