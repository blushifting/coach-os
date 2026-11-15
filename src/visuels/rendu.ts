/**
 * Rendu WebGL de base, sans bibliothèque : rien à télécharger, marche hors
 * ligne. Seul fichier du moteur qui touche au navigateur.
 */

import type { Camera } from './camera';
import { PAR_SOMMET } from './maillage';
import type { Couleur, Maillage } from './maillage';

const SOMMETS = `
attribute vec3 aPos, aNor;
attribute vec4 aCol;
uniform vec3 uR, uU, uV;
uniform vec2 uCentre;
uniform float uDemi, uGonfle;
varying vec3 vNor;
varying vec4 vCol;
void main() {
  vec3 p = aPos + aNor * uGonfle;
  gl_Position = vec4((dot(p, uR) - uCentre.x) / uDemi, (dot(p, uU) - uCentre.y) / uDemi, -dot(p, uV) / 500.0, 1.0);
  vNor = aNor; vCol = aCol;
}`;

// Couleur d'un point : la teinte de la pièce, éclaircie face à la lumière,
// assombrie à l'opposé, et assombrie encore là où la surface fuit le regard.
// Ce dernier effet creuse un sillon sombre au bord de chaque muscle : c'est la
// « couture » entre deux pièces voisines.
const PIXELS = `
precision mediump float;
uniform vec3 uL, uRegard, uTrait;
uniform float uRelief, uBord, uContour;
varying vec3 vNor;
varying vec4 vCol;
void main() {
  if (uContour > 0.5) { gl_FragColor = vec4(uTrait, 1.0); return; }
  vec3 n = normalize(vNor);
  vec3 c = vCol.rgb;
  float k = uRelief * vCol.a;
  float t = 0.5 + 0.5 * dot(n, uL);
  if (t >= 0.6) { float m = (t - 0.6) / 0.4; c = c * (1.0 + 0.5 * k * m) + 0.1 * k * m; }
  else { float m = (0.6 - t) / 0.6; c = c * (1.0 - 0.6 * k * m); }
  float face = clamp(dot(n, uRegard), 0.0, 1.0);
  c *= mix(1.0 - uBord * vCol.a, 1.0, smoothstep(0.0, 0.6, face));
  gl_FragColor = vec4(c, 1.0);
}`;

export interface OptionsImage {
  /** Centre de l'image et demi-côté, en cm (voir `cadrer`). */
  readonly centre: readonly [number, number];
  readonly demi: number;
  readonly fond: Couleur;
  /** Couleur du trait de contour. */
  readonly trait: Couleur;
  readonly relief: number;
  readonly bord: number;
  /** Épaisseur du trait, en cm ; 0 = pas de trait. */
  readonly epaisseurTrait: number;
}

export interface Rendu {
  /** `debutContour` : premier indice à cerner d'un trait (ce qui précède, le sol, n'en a pas). */
  dessiner(mesh: Maillage, debutContour: number, cam: Camera, o: OptionsImage): void;
  /** Rend ce que le rendu a pris à la carte graphique : à appeler quand l'animation s'arrête. */
  liberer(): void;
}

/**
 * Prépare WebGL sur une toile. Rend `null` si WebGL n'est pas disponible :
 * l'appelant se replie alors sur la photo.
 */
export function creerRendu(toile: HTMLCanvasElement): Rendu | null {
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = toile.getContext('webgl', { antialias: true, alpha: false });
  } catch {
    gl = null;
  }
  if (gl === null) return null;
  const g = gl;

  const shader = (type: number, src: string): WebGLShader | null => {
    const s = g.createShader(type);
    if (s === null) return null;
    g.shaderSource(s, src);
    g.compileShader(s);
    return g.getShaderParameter(s, g.COMPILE_STATUS) ? s : null;
  };
  const vs = shader(g.VERTEX_SHADER, SOMMETS), fs = shader(g.FRAGMENT_SHADER, PIXELS), prog = g.createProgram();
  if (vs === null || fs === null || prog === null) return null;
  g.attachShader(prog, vs);
  g.attachShader(prog, fs);
  g.linkProgram(prog);
  if (!g.getProgramParameter(prog, g.LINK_STATUS)) return null;
  g.useProgram(prog);

  const u = (nom: string): WebGLUniformLocation | null => g.getUniformLocation(prog, nom);
  const uR = u('uR'), uU = u('uU'), uV = u('uV'), uCentre = u('uCentre'), uDemi = u('uDemi'), uGonfle = u('uGonfle');
  const uL = u('uL'), uRegard = u('uRegard'), uTrait = u('uTrait'), uRelief = u('uRelief'), uBord = u('uBord'), uContour = u('uContour');
  const v3 = (ou: WebGLUniformLocation | null, v: readonly [number, number, number]): void => g.uniform3f(ou, v[0], v[1], v[2]);
  const tampon = g.createBuffer(), indices = g.createBuffer();
  g.bindBuffer(g.ARRAY_BUFFER, tampon);
  g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, indices);
  const pas = PAR_SOMMET * 4;
  ([['aPos', 3, 0], ['aNor', 3, 12], ['aCol', 4, 24]] as const).forEach(([nom, taille, decalage]) => {
    const a = g.getAttribLocation(prog, nom);
    g.enableVertexAttribArray(a);
    g.vertexAttribPointer(a, taille, g.FLOAT, false, pas, decalage);
  });
  g.enable(g.DEPTH_TEST);
  g.enable(g.CULL_FACE);

  return {
    dessiner(mesh, debutContour, cam, o) {
      const cote = Math.max(1, Math.round(toile.clientWidth * Math.min(3, window.devicePixelRatio || 1)));
      if (toile.width !== cote || toile.height !== cote) {
        toile.width = cote;
        toile.height = cote;
      }
      g.viewport(0, 0, cote, cote);
      g.clearColor(o.fond[0] / 255, o.fond[1] / 255, o.fond[2] / 255, 1);
      g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
      g.bufferData(g.ARRAY_BUFFER, mesh.s.subarray(0, mesh.ns * PAR_SOMMET), g.DYNAMIC_DRAW);
      g.bufferData(g.ELEMENT_ARRAY_BUFFER, mesh.i.subarray(0, mesh.ni), g.DYNAMIC_DRAW);
      v3(uR, cam.R);
      v3(uU, cam.U);
      v3(uV, cam.V);
      g.uniform2f(uCentre, o.centre[0], o.centre[1]);
      g.uniform1f(uDemi, o.demi);
      v3(uL, cam.lumiere);
      v3(uRegard, cam.V);
      g.uniform3f(uTrait, o.trait[0] / 255, o.trait[1] / 255, o.trait[2] / 255);
      g.uniform1f(uRelief, o.relief);
      g.uniform1f(uBord, o.bord);
      // 1. Les surfaces.
      g.cullFace(g.BACK);
      g.uniform1f(uGonfle, 0);
      g.uniform1f(uContour, 0);
      g.drawElements(g.TRIANGLES, mesh.ni, g.UNSIGNED_SHORT, 0);
      // 2. Le trait de contour : les mêmes pièces, un peu gonflées, dont on ne
      //    dessine que l'envers. Il ne dépasse donc qu'autour de chaque pièce.
      if (o.epaisseurTrait > 0) {
        g.cullFace(g.FRONT);
        g.uniform1f(uGonfle, o.epaisseurTrait);
        g.uniform1f(uContour, 1);
        g.drawElements(g.TRIANGLES, mesh.ni - debutContour, g.UNSIGNED_SHORT, debutContour * 2);
      }
    },
    liberer() {
      // On rend les tampons et le programme, pas le contexte : la même toile
      // peut être animée de nouveau (React remonte un composant en développement).
      g.deleteBuffer(tampon);
      g.deleteBuffer(indices);
      g.deleteProgram(prog);
      g.deleteShader(vs);
      g.deleteShader(fs);
    },
  };
}
