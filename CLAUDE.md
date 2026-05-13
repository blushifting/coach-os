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

À ajouter par les prochaines conv : vite-plugin-pwa (#9).

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

## État courant — fin Conv #5a (2026-05-13)

- **Dashboard Programme livré** : `/programme` affiche 4 widgets (streak /
  séances cette sem / % cycle / prochain bilan) + calendrier condensé
  5 sem × 7 jours avec badges de statut par jour + sheet "Planifier ce
  jour" (stub — démarrage de séance reporté en 5b).
- Arbo : `src/pages/programme/{ProgrammePage,Widgets,CondensedCalendar,DayCell,PlanDaySheet}.tsx`,
  `src/pages/cycle-bilan/{CycleBilanPage,selectors}.ts(x)`,
  `src/lib/dashboard.ts` (sélecteurs purs : `computeStreak`,
  `computeCycleProgress`, `computeWeekSessions`, `nextCycleReviewDate`,
  `isDeloadWeek`, `isCycleFinished`, `buildCalendarMatrix`).
- Route `/cycle-bilan` ajoutée (TabbedLayout) : affiche adhérence,
  volume, PR, Δ plafonds, muscles ; 3 boutons d'action (Continuer /
  Ajuster / Changer) en stub pour 5b/6c. Lecture seule du dernier
  `CycleReview` (state + fallback DB).
- Streak = nb semaines consécutives avec ≥1 feedback (non punitif :
  tolère la semaine en cours encore vide). % cycle = `done / planned * 100`
  sur les `days.length × 5` séances. Calendrier ancré au lundi de la
  semaine de `cycle.start_date`.
- Tests : **323 Vitest** (290 + 33 nouveaux sur `lib/dashboard.ts`) +
  **9 Playwright e2e** (4 onboarding + 3 séance 0 + 2 programme).
- Build : `npm run test && npm run build && npm run parity-check && npm run lint && npm run test:e2e` — OK.
- Prochaine conv : **Conv #5b — onglet Séance** (exécution, feedback set
  par set, câblage `generateAndStoreSession` / `recordFeedbackAndCommit`,
  bilan fin de séance, et câblage réel des boutons stub de PlanDaySheet
  et CycleBilan).
- Backlog connu : D1 push/pull + D2 lengthened_bias → Conv #7 ;
  `EquipmentOverride` → Conv #6c.
