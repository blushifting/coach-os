# CLAUDE.md — Coach OS

> Mémoire projet Claude Code pour le repo `coach-os`. **À lire en premier** au
> début de chaque conversation, avant tout autre fichier.

## 1. Pointeurs vers la doc

La spec et le prototype Python source-de-vérité ne sont **pas** dans ce repo —
ils restent dans le dossier OneDrive d'Azur, identique sur tous ses PCs :

- **Plan d'attaque** (segmentation des conv, périmètres, critères de fin) :
  `C:\Users\antoi\OneDrive\Desktop\Coach OS\recherche\10_plan_claude_code.md`
- **Index recherche** : `…\OneDrive\Desktop\Coach OS\recherche\00_README.md`
- **Specs** : `…\recherche\03_modele_mathematique.md`,
  `…\recherche\04_specifications_coach_os.md §3.1`,
  `…\recherche\08_ux_decisions.md`, `…\recherche\09_programmation.md`
- **Prototype Python** (source de vérité algo, ~5800 lignes, 232 tests verts) :
  `…\OneDrive\Desktop\Coach OS\prototype\coach_os\`
- **Catalogue exos** (origine) : `…\prototype\data\exercises.json` — copié dans
  ce repo en `src/data/exercises.json`.
- **Maquettes UX** : `…\OneDrive\Desktop\Coach OS\maquettes\coach_os_app_v2.html`

## 2. Règle de portage Python → TypeScript

Le **prototype Python est la source de vérité**. Tout changement algo passe par
mise à jour de spec d'abord (`recherche/09_programmation.md` ou autre), puis
modification simultanée Python (référence) **et** TS (port).

Conventions de port :

- `Enum(str, Enum)` Python → `enum` TS string-valued (mêmes noms, mêmes valeurs).
- `@dataclass(frozen=True)` Python → `interface` TS readonly + factory `makeXxx`
  (ou `exerciseFromDict` pour les types qui chargent du JSON).
- `@dataclass` mutable → `interface` TS + factory avec valeurs par défaut.
- `tuple[...]` Python à arité fixe → `readonly [T1, T2]` TS.
- `set[T]` Python → `Set<T>` TS.
- `dict[K, V]` Python → `Record<K, V>` TS (sauf si on a besoin d'itérer en
  ordre d'insertion, alors `Map`).
- `Optional[T]` Python (`X | None`) → `T | null` TS — pas `undefined`, pour
  rester explicite et matcher la sémantique Python.

Parité numérique attendue (Conv #2c) : ±1 kg / ±0.1 RPE sur 6 profils
synthétiques, vérifiée par `tools/parity-check.ts`.

## 3. Conventions de code

- **TypeScript strict** (cf. `tsconfig.app.json`). `noUnusedLocals`,
  `noUnusedParameters`, `noFallthroughCasesInSwitch` activés.
- **Nommage** : `camelCase` pour fonctions/variables, `PascalCase` pour
  composants React et types/interfaces, `kebab-case` pour les fichiers UI,
  `snake_case` pour les fichiers de données et les **clés JSON** (rétrocompat
  avec le format Python du prototype).
- **Imports** : alias `@/...` = `src/...` (configuré dans Vite, Vitest et TS).
- **Français** partout : noms de tests, commentaires, messages d'erreur, UI.
- **ESLint flat config** (`eslint.config.js`) + Prettier (`.prettierrc.json`).

## 4. Stack

| Couche | Choix |
|--------|-------|
| Framework | React 18 + TypeScript strict |
| Build | Vite 5 (`base: '/coach-os/'` pour GitHub Pages, cf. Conv #9) |
| Styling | Tailwind 3 + palette anthracite + sang dans `tailwind.config.ts` |
| Tests unitaires | Vitest 2 (env `node` par défaut) |
| Lint/format | ESLint 9 (flat) + Prettier |

| Persistance | Dexie 4 (IndexedDB) — schéma v1, 7 tables (cf. Conv #3) |
| State | Zustand 5 — store unique, 4 sections logiques (cf. Conv #3) |
| Validation IO | Zod 3 — schéma versionné de l'export/import JSON |

| Routing | React Router 6 — `createBrowserRouter`, `basename` aligné sur `BASE_URL` |
| Drag&drop | `@dnd-kit/core` + `sortable` + `utilities` (ranking onboarding, #4b) |
| Tests e2e | Playwright (Chromium only, viewport 390×844, #4b) |
| PWA | `vite-plugin-pwa` 1.x (Workbox, autoUpdate, precache) — #9 |
| Génération d'icônes | `@resvg/resvg-js` (dev) + `scripts/generate-icons.mjs` |

## 5. Scripts npm

| Script | Effet |
|--------|-------|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` (bundle dist/) |
| `npm run preview` | Sert le bundle dist/ |
| `npm run test` | Vitest run (one-shot) |
| `npm run test:watch` | Vitest watch |
| `npm run test:e2e` | Playwright e2e (lance Vite dev auto via `webServer`) |
| `npm run lint` | ESLint sur tout le repo |
| `npm run format` | Prettier write src/ + tests/ |
| `npm run generate-icons` | Régénère les PNG PWA depuis `public/icon*.svg` |

## 6. Préférences Azur

- **Discussion d'abord, fichiers consolidés ensuite.** Avant tout scaffold
  significatif (nouveau dossier, nouvelle dépendance hors stack §2.1, conventions
  atypiques), proposer la structure et attendre validation.
- **Rigueur scientifique mais simplicité opérationnelle**. Pas de complexité
  algorithmique inutile.
- **FR partout** dans l'UI et les commentaires.
- **Sources : méta-analyses et revues systématiques en priorité** (cf. top 10
  dans `recherche/00_README.md`).

## 7. Git / repo

- **Repo distant** : <https://github.com/blushifting/coach-os> (public, GitHub
  Pages cible : <https://blushifting.github.io/coach-os/>).
- **Working dir local** : `D:\coach-os\` (à la racine de D, **hors OneDrive**).
- **Dev sur un seul PC** (le fixe). Le repo distant sert de **backup** et
  de source pour GitHub Pages — pas de workflow multi-PCs actif.
- **Push à chaque fin de conv** (`git push origin main`) : chaque conv
  devient un checkpoint récupérable si le disque local meurt. Coût quasi
  nul, assurance non-nulle.
- **Commits** : atomiques par tâche, messages **en français**, pas de
  force-push sur `main`.

## 8. Anti-compaction (règles à appliquer dans chaque conv)

Claude Code compresse son contexte autour de 200k tokens. Une conv compactée
oublie des bouts → erreurs en cascade. Donc :

- Au début de chaque conv : lire **uniquement** ce `CLAUDE.md` + la section
  `§3 Conv #N` du plan dans
  `…\recherche\10_plan_claude_code.md`. Ne pas relire l'historique des conv
  précédentes ni les autres docs `recherche/` sauf besoin ciblé.
- Lecture de fichiers existants : sélective, pas de `find` / `ls -R`
  exhaustif sur le repo.
- Quand on porte un module Python : lire **uniquement** ce module + les
  modules dont il dépend directement. Pas tout `coach_os/`.
- Pas de récap long en fin de réponse, pas de re-citation du plan.
- À ~60 % de la fenêtre de contexte : commit ce qui marche, mettre à jour
  ce `CLAUDE.md` (`TODO Conv #N.b : …`), arrêter, signaler à Azur qu'une
  conv bis est nécessaire.
- À la fin de chaque conv : `## État courant` ci-dessous mis à jour
  (≤10 lignes), commit, stop.

## 9. Note OneDrive

Le repo dev est sur `D:\` justement **parce que** OneDrive corrompt
`node_modules` (millions de petits fichiers) et l'index `.git` (écritures
concurrentes). Ne jamais déplacer ce repo dans le dossier OneDrive.

Pour les fichiers de référence dans OneDrive (`recherche/`, `prototype/`),
écriture concurrente Python = risque connu. Si on doit créer/modifier un
fichier Python sourcé par OneDrive en mode intensif, faire dans `/tmp/`
puis copier (cf. `prototype/README.md` pour l'historique).

---

## État courant — fin Conv #10b' (2026-05-16)

- **Marque "Kotsh" capitalisée** dans toute l'UI : manifest PWA
  (`vite.config.ts` name/short_name), `index.html` title +
  apple-mobile-web-app-title, fallback Header, h1 WelcomeScreen, titres
  sheets d'installation, body glossaire (rpe), message d'erreur import.
  Le repo + identifiants internes (`coach-os`, `useCoachOsStore`,
  Dexie) restent inchangés (nom de dev).
- **Palette éclaircie** : `text-anthracite-500` (#454a52, gris foncé
  difficile à lire) remplacé par `text-anthracite-300` (#9aa0aa) sur
  les 126 occurrences du codebase. Aucune autre couleur palette
  modifiée — `anthracite-500` n'était utilisé qu'en texte.
- **Texture / relief** :
  - **Card** : bordure passe de `border-anthracite-700` à
    `border-anthracite-600/60` (un poil plus claire et translucide),
    shadow inset blanc renforcé (0.03 → 0.06) + ajout d'un shadow
    extérieur 1px noir 40 % pour détacher les cards du fond.
  - **Button primary** : ajout d'un ring sang
    (`ring-1 ring-sang-500/40`) + shadow inset blanc 12 % +
    shadow extérieur noir 40 % → relief net, contourage visible.
  - **Button secondary** : bordure passe de `anthracite-600` à
    `anthracite-500` + petit inset 5 %.
  - **Button danger** : ring sang-600/40.
  - **Grain SVG** : opacité 0.6 → 0.9 dans `index.css` body::before
    (la texture du fond devient juste perceptible consciemment).
- Tests : skip Vitest/e2e car cosmétique pur (renommages + classes
  Tailwind). `npm run build` OK (26.5 kB CSS + 639 kB JS, +0.3 kB CSS).
- **Stratégie tests** (durable) : modifs cosmétiques → build seul ;
  modifs comportementales → Vitest + build ; suite e2e complète
  uniquement en toute fin de conv si structurel touché.

### Backlog Conv #10 — à reprendre en nouvelle conv

**#10c — Refonte Séance 0 (item 3 dump initial Azur)** — *à faire avant #10d.*
Actuel : `pages/seance-0/Seance0Page.tsx` + `CalibrationStep.tsx` font passer
chaque exo clé l'un après l'autre en mode test plafond pur (1RM connu ou
test sous-max), sans série de travail normale derrière. Azur a remonté que
ce format n'est pas pratique :
> "C'est pas pratique de faire d'abord tester les plafonds uniquement, ça
> oblige à aller faire plusieurs petits exos courts, on va plutôt faire une
> séance 0 normale qui contient les mêmes exos clés du programme, pour chaque
> exo on teste le plafond puis on fait 1 ou 2 séries avant de passer au suivant,
> histoire de bien calibrer."

Format cible : pour chaque exo de la liste de calibration, **test plafond
PUIS 1-2 séries normales** (charges déduites du plafond fraîchement mesuré,
RPE cible ≈ 8) avant de passer au suivant. La séance 0 doit ressembler à une
vraie séance qui calibre, pas à un sondage. Pédagogie renforcée à chaque
étape (vocabulaire #10b déjà en place, à réutiliser).

Pistes d'implémentation : étendre `CalibrationStepValue` pour porter
optionnellement les séries de travail réalisées ; brancher le moteur de
prescription pour générer 1-2 séries cible après le commit du plafond ;
réutiliser `SetInput` pour la saisie. Tests : `seance0.spec.ts` à étendre.

**Polish trivial à bundle dans #10c (ou conv libre)** :
- Boutons "← Précédent" / "Suivant →" de l'onboarding
  (`pages/onboarding/OnboardingPage.tsx` lignes ~154-180) : actuellement
  "Précédent" wrap sur 2 lignes (label sous la flèche) car le bouton est
  trop étroit. Ajouter `whitespace-nowrap` sur le composant Button (ou
  via prop). Remplacer aussi les flèches `←` / `→` typographiques par
  des SVG inline alignés verticalement avec le texte (les caractères
  Unicode rendent mal selon la fonte). Toucher `components/Button.tsx`
  (whitespace-nowrap par défaut) + remplacer les chevrons dans
  `OnboardingPage.tsx`, `CalibrationStep.tsx`, et tout autre écran avec
  navigation précédent/suivant.

**#10d — Catalogue (items 5, 6, 7 dump initial)** — après #10c.
1. **Fiche exo** (`pages/catalogue/CatalogueDetailSheet.tsx` + `ExerciseCard.tsx`) :
   silhouette `AnatomicalSilhouette` au premier plan, grand format centré ;
   descriptif détaillé dessous (exécution, erreurs courantes, muscles
   primaires/synergistes, matériel, variantes). Actuellement silhouette
   trop petite et description riquiqui.
2. **Aliases** : ajouter `aliases: string[]` sur chaque entrée de
   `src/data/exercises.json` (et côté Python `prototype/data/exercises.json`
   en miroir, parité). Recherche du catalogue (`catalog-filter.ts`) doit
   matcher sur le nom + tous les aliases. Origine : Azur cherche un exo
   sous un nom différent → ne le trouve pas.
3. **Remplacement libre** : actuellement `alternativeVariantsFor`
   (`lib/calibration.ts`) ne propose que les variantes du même *pattern*.
   Azur veut pouvoir remplacer un exo pecs par un autre exo pecs même si
   c'est pas le même pattern de mouvement (équipement différent, schéma
   différent). Élargir le filtre à "muscle primaire en commun" avec un
   toggle "voir tous les exos ciblant X".

---

## État Conv #10b (2026-05-16) — archive

- **Vocabulaire grand public + bulles d'aide systématiques.**
- Mapping UI retenu (le code interne garde `rpe`/`e1rm` — c'est seulement
  la couche d'affichage qui est traduite) :
  - **RPE → Effort** (sur 10) — labels, sélecteurs, textes
  - **1RM / e1RM → plafond** (charge max pour 1 rep)
  - **déload** conservé mais bulle d'aide systématique
  - **polyarticulaire / isolation / cycle / volume hebdo / vminmax** :
    bulles d'aide existantes ré-exploitées (glossary `HELP_GLOSSARY`
    inchangé en clés, titres + bodies enrichis pour `rpe`, `plafond`,
    `deload`).
- Fichiers touchés :
  - `lib/help-glossary.ts` : `rpe.title` → "Effort", bodies de `rpe`,
    `plafond`, `deload` réécrits en vocabulaire simple avec mention du
    jargon technique entre parenthèses.
  - `pages/seance/SetInput.tsx` : label "RPE" → "Effort" (testid
    `input-rpe-${i}` inchangé pour ne pas casser les tests).
  - `pages/seance/SessionRunner.tsx` : "RPE cible {n}" → "Effort cible
    {n}/10" + `HelpButton topic="rpe"`.
  - `pages/seance-0/CalibrationStep.tsx` : tab "Je connais mon 1RM" →
    "Je connais mon plafond", label "RPE perçu" → "Effort perçu" +
    `HelpButton`, options du select "RPE {r}" → "Effort {r}/10",
    `HelpButton topic="plafond"` sur la ligne "Plafond estimé".
  - `pages/seance-0/Seance0Page.tsx` IntroBanner reformulé en
    vocabulaire simple + `HelpButton topic="plafond"`.
  - `pages/profil/AideSheet.tsx` : tutos "première séance" et
    "feedback" reformulés (RPE → effort perçu sur 10).
  - `pages/programme/Widgets.tsx` : `WidgetTile` accepte un prop
    optionnel `helpTopic`. Tile "Cycle" reçoit `helpTopic="cycle"`.
- Tests : **396 Vitest + 19 e2e** verts. `npm run build` OK
  (26.2 kB CSS + 639 kB JS).
- Backlog Conv #10 : #10c refonte Séance 0 (exo par exo, calibration
  + 1-2 séries normales avant suivant), #10d catalogue (fiche détaillée
  + aliases + remplacement libre par muscle).

---

## État Conv #10a (2026-05-16) — archive

- **Écran de bienvenue + shell mobile-first livrés**. Au premier lancement
  ou après reset (userState === null), redirection vers `/welcome` —
  logo K + "kotsh" + pitch *"Ta muscu, ajustée à ton effort réel"*.
- **Bouton conditionnel** : "Installer l'app" si dans navigateur (déclenche
  `beforeinstallprompt` natif ou ouvre un sheet d'instructions iOS / autres),
  "Commencer" si en standalone. `import.meta.env.DEV` traité comme installé
  pour ne pas bloquer dev/e2e. Module : `src/lib/install-prompt.ts`.
- **Fix bug reset** : `resetApp()` garde `bootstrapped: true` — l'ancien
  `bootstrapped: false` figeait le splash car `bootstrap()` n'est appelé
  qu'au mount initial d'`AppShell` (deps `[]`). Reset navigue vers
  `/welcome` au lieu de `/onboarding`.
- **Shell mobile** : `html/body { height: 100%; overflow: hidden;
  overscroll-behavior: none }` (kill pull-to-refresh), `AppShell` passe
  à `h-dvh overflow-hidden`. Tous les wrappers `min-h-dvh` des pages
  hors `TabbedLayout` remplacés par `flex-1` / `h-full` + scroll interne
  via `overflow-y-auto`. La `TabBar` reste accessible en bas en
  permanence (sibling de `<main>` flex-1).
- Redirections `userState === null` repointées vers `/welcome` :
  ProgrammePage, SeancePage, ProgresPage, ProfilPage (post-reset).
- Tests : **396 Vitest + 19 e2e** verts (test reset mis à jour pour
  passer par `/welcome` → `/onboarding`). `npm run build` OK
  (26.2 kB CSS + 638 kB JS).

---

## État Conv #9 (2026-05-15) — archive

- **PWA installable + déploiement GitHub Pages livrés**. Le nom de marque
  utilisateur devient **kotsh** (le repo et les identifiants internes
  restent `coach-os` — nom de développement).
- **vite-plugin-pwa 1.x** configuré (`vite.config.ts`) : registerType
  `autoUpdate`, Workbox precache (25 entrées, ~886 kB), navigateFallback
  vers `index.html`, scope/start_url/id = `/coach-os/`. Manifest généré
  dans `dist/manifest.webmanifest`.
- **Manifest** : `name`/`short_name` = `kotsh`, `display: standalone`,
  `orientation: portrait`, `background_color`/`theme_color` =
  `#0e0f12` (anthracite-950), `lang: fr`. iOS et Android capitaliseront
  probablement *Kotsh* sous l'icône (comportement OS, non contrôlable).
- **Icônes** : SVG source dans `public/icon.svg` + `public/icon-maskable.svg`
  (lettre **K** anthracite-50 + point sang-700, fond anthracite-950, coins
  arrondis 96px). Maskable safe zone = 70 % du viewBox. PNG générés via
  `npm run generate-icons` (script `scripts/generate-icons.mjs` +
  `@resvg/resvg-js`) en 192/512/maskable-512/apple-touch-180/favicon-32.
- **index.html** : `<title>kotsh</title>`, meta `apple-mobile-web-app-*`
  (capable, status-bar `black-translucent`, title `kotsh`), description,
  liens icon/apple-touch-icon.
- **Renommage UI** : `Header.tsx` fallback `'Coach OS'` → `'kotsh'`,
  `io/import.ts` message d'erreur user-facing aligné. Les commentaires
  JSDoc internes, le nom de classe `useCoachOsStore`, le nom de la DB
  Dexie et le path `/coach-os/` sont **inchangés** — nom de dev.
- **Fix bootstrap au reload direct** : `AppShell` appelle `bootstrap()`
  au mount et affiche un splash (`data-testid="app-splash"`,
  `aria-busy="true"`) tant que `bootstrapped === false`. Les appels
  redondants dans `OnboardingPage`/`Seance0Page` sont laissés en place
  (idempotents) pour ne pas modifier le périmètre Conv #4. Toutes les
  routes reloadent désormais correctement.
- **GitHub Actions** : `.github/workflows/deploy.yml`. Build à chaque
  push sur `main` (Node 20, `npm ci`, `npm run build`), upload
  `dist/` via `actions/upload-pages-artifact@v3`, déploiement via
  `actions/deploy-pages@v4`. Permissions `pages: write` +
  `id-token: write`, concurrency `pages` cancel-in-progress.
  → Action requise côté repo : **Settings → Pages → Source = GitHub
  Actions**.
- **README** : section "Installation sur ton téléphone" (iOS Safari +
  Android Chrome) ajoutée.
- Tests : **396 Vitest** + **19 e2e** verts. `npm run build` OK
  (25.5 kB CSS + 634 kB JS, SW + manifest générés).
- **Critère de fin Conv #9** : `npm run build` + workflow prêts. Reste à
  Azur : push sur `main`, activer Pages (Source = Actions), attendre
  le workflow, ouvrir l'URL sur téléphone, installer.
- Backlog inchangé pour la suite : `EquipmentOverride` UI + boutons
  "Ajuster"/"Changer" du Bilan + régénération de cycle plan post-changement
  profil.

---

## État Conv #8 (2026-05-15) — archive

- **Polish visuel — pass thème + phrasé livré**.
- **Thème** :
  - Police **Inter Variable** (`@fontsource-variable/inter`) chargée
    localement (offline-ready pour Conv #9). Chargement subsetté par
    `unicode-range` côté navigateur : seul `inter-latin-wght-normal`
    (~48 kB) est rapatrié en pratique.
  - **Tabular nums** activés globalement via `font-feature-settings` au
    `:root` — les colonnes de chiffres (poids, séries, RPE, %) ne sautent
    plus.
  - **Palette étendue** : `tailwind.config.ts` ajoute `anthracite.50-400`
    et `sang.400/950`. Les tons 500-950 sont **inchangés** — aucun
    composant existant ne régresse. Texte par défaut passe à
    `anthracite-100` (au lieu de blanc plein), plus doux à l'œil.
  - **Grain SVG subtil** (turbulence + opacité 0.05) en pseudo-élément
    `body::before` fixed, derrière tout, casse l'aspect plat des aplats
    anthracite sans être perceptible consciemment.
  - **Hiérarchie typographique de base** dans `@layer base`
    (`index.css`) : `h1` = `text-xl tracking-tight`, `h2` = `text-base`,
    `h3` = `text-sm`. Les composants restent libres d'override.
  - `Header` titre passe à `text-xl tracking-tight` + bordure basse
    `anthracite-800/60`.
  - `Card` gagne un `shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]`
    qui détache subtilement les cards du fond.
- **Phrasé** : audit complet réalisé. Le tutoiement est constant et le
  glossaire (`lib/help-glossary.ts`) couvre déjà les termes signalés en
  retours V2 (`vs sem1`, `PR du jour`, `RPE`, etc.). "Compound" déjà
  mappé en "Polyarticulaire" dans l'UI (`catalog-filter.ts`). Seule
  correction : `engine/guided_programs.ts:689` "votre équipement" →
  "ton équipement" (incohérence de tutoiement résiduelle).
- **Pictos pattern moteurs** (`pages/seance/PatternIcon.tsx`) : refonte
  complète. Chaque pattern (squat, hinge, lunge, push-h, push-v, pull-h,
  pull-v, isolation, core) a son glyphe SVG inline distinct
  (stroke-currentColor, viewBox 24×24, line-cap round). Plus de pastilles
  2-lettres. Testid `pattern-icon-${pattern}` conservé.
- **Silhouette anatomique** : nouveau composant partagé
  `src/components/AnatomicalSilhouette.tsx` (face + dos, 6 statuts :
  off / low / ok / high / highlight / synergist). Polygones extraits du
  projet **react-body-highlighter** (MIT © 2020 GV79,
  <https://github.com/giavinh79/react-body-highlighter>) — copyright
  préservé dans le header du fichier. Mapping Coach OS via
  `CO_TO_FACE` / `CO_TO_BACK`. Le muscle `dos_largeur` (lats), absent
  de RBH, a 2 polygones custom maison. Les SOLEUS RBH ont été retirés
  pour aligner la hauteur face/dos ; un scaleY = 195.5/200 est
  appliqué au dos pour aligner précisément chevilles + bassin.
  - Prop `view`: `'both' | 'face' | 'back' | 'auto'`. En mode `auto`,
    `pickBestSide` choisit la vue qui met le plus en valeur les muscles
    highlightés (primaire pondéré ×3, synergiste ×1).
- **CoverageView** (`pages/progres/CoverageView.tsx`) : silhouette
  face+dos `view="both"` en tête (h-48), grille de chips conservée en
  dessous pour les chiffres précis (séries vs V_min-V_max).
- **MiniSilhouette** (`pages/catalogue/MiniSilhouette.tsx`) : wrapper
  `AnatomicalSilhouette view="auto"` (face ou dos selon les muscles
  travaillés). Highlights primaires (coef ≥ 1.0) + synergistes
  (coef ≥ 0.5) lus directement depuis `exercise.muscles`. Signature
  acceptant `exercise` (utilisé partout) ou `muscles` (legacy).
- Tests : **396 Vitest** + **19 e2e** verts. `npm run build` OK
  (25.4 kB CSS + Inter latin 48 kB + 626 kB JS).
- Critère de fin Conv #8 **atteint** côté code. Revue visuelle Azur
  restante (`npm run dev`).
- Backlog Conv #8 (résolu en #9) : bootstrap au reload direct.
