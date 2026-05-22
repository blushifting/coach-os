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

## État courant — fin Conv #15 vague 3 (2026-05-22) — V1.5.0

Itération sur dump 14 retours Azur post-V1.4.0. Bump **v1.5.0**
(2 fixes critiques : persistance + recalibrage qui ne marchaient
PAS réellement en V1.4 malgré le commit ; bouton "Annuler la séance"
ajouté ; nombreuses corrections de textes + polish UX).

**Fixes critiques (annoncés mais cassés en V1.4)**
- **Persistance entries au remount SeancePage** : l'ordre des conditions
  dans le useEffect était mauvais. `sessionChanged = currentSessionId
  !== prevId` se déclenchait à tort au remount (prevId = null), forçant
  `initEntries` AVANT que le check "1er mount" puisse préserver
  `storedEntries`. Fix : tester `prev === null` d'abord (préserve si
  compatible), `sessionChanged` ensuite (init seulement si on était
  déjà monté).
- **Recalibrage continu pour fresh user** : `state.e1rm` est vide pour
  un utilisateur post-onboarding (bootstrap se fait à la volée sans
  persister). Mon ref captait donc `{}` → `e1rmStart` undefined →
  no-op systématique. Fix : `bootstrapE1rmIfMissing` exporté depuis
  `engine.ts`, snapshot enrichi au mount du SessionRunner avec le
  bootstrap heuristique pour les exos non encore mesurés.
- **Bouton "Annuler la séance"** dans SessionRunner : `cancelPlannedSession`
  appelé après confirmation Dialog. Distinct de "Sauter" (qui marque
  status='skipped', case barrée dans le calendrier) — annuler supprime
  la ligne, comme si la séance n'avait jamais été programmée.

**Polish UX**
- Doublon "visite guidée" : le tag rouge restait, le label persona
  changé en "Découvre Kotsh via le profil d'Alex".
- "joué" → "effectué" partout (persona.summary, AideSheet).
- Bulle démo : position fixe par step (`bannerSide?: 'top' | 'bottom'`
  dans TourStep) — 'top' uniquement sur step 1 (programme), 'bottom'
  partout ailleurs. L'auto-positionnement de Conv #14d sautait
  visuellement entre étapes.
- Textes longs : `text-justify hyphens-auto` sur les paragraphes du
  WelcomeBanner, WelcomeOverlay (intro + sortie), et bandeau démo
  (step.body). ":" déplacés / supprimés quand ils traînaient en fin
  de ligne.
- PlanDaySheet FreeFutureBlock : "Choisis la séance à programmer ce
  jour" (sans "et démarrer maintenant" qui débordait), boutons
  enrichis avec "X exos · Y séries · ~Z min" en sous-titre.
- Bilan cycle : `text-xl` + `whitespace-nowrap` sur les Metrics
  (volume "1 234 kg" reste sur une ligne). Label "PR" → "Records".
- Bilan séance : "PR du jour" → "Records du jour".
- ForceView : chips "PR" remplacés par des **étoiles dorées** sur les
  points qui battent le record d'au moins +2 kg. Sens expliqué dans
  le step démo correspondant.
- AideSheet "Première séance (calibration)" : retiré toute mention de
  "séance 0" (rayée de l'app depuis Conv #12a), texte refondu sur
  la calibration transparente.
- WelcomeBanner et démo step 1 : "8 semaines" → "semaines du cycle
  en cours" (calendrier ne montre QUE 5 semaines).
- Bouton "Continuer pareil" du bilan cycle : **disabled en mode démo**
  pour éviter qu'on valide accidentellement le bilan d'Alex.
- ProgrammePage : `gap-3` + retrait `pb-4` → plus de scroll de 1-2 px
  parasitaire sur l'onglet Séances.

**Démo Alex**
- Step 1 (programme) — reformulation : "Le calendrier ci-dessous
  montre les semaines du cycle en cours, séances faites en vert,
  prévues en bleu et le repos en grisé." `bannerSide: 'top'`.
- Step 4 (progres-force) — réécrit : étoiles ★ expliquées, déload
  positionné comme volontaire et non comme recul.
- Persona.label "Visite guidée de Kotsh" → "Découvre Kotsh via le
  profil d'Alex" (évite la redondance avec le tag rouge "Visite
  guidée").

**Logique**
- **Séance sautée ≠ repos jour suivant** : `dashboard.ts`
  `prevWasSkipped` filtré explicitement. Une séance `status='skipped'`
  ne déclenche plus `restSuggested` ni `recentMuscles` sur le
  lendemain.

**Démo Alex (données)**
- 2 séances **planned** ajoutées (Upper B jeudi + Lower B samedi),
  pour que la démo montre aussi des cases bleues "prévue" dans le
  calendrier, pas seulement les passées + le jour.
- `alex.json` : 35 sessions (33 + 2 planned).

**Tests fin Conv #15 vague 3** : **497 Vitest + 23/23 e2e verts**.

**Backlog Conv #16** (mis à jour) — chantiers visuels / refonte UX
- Silhouette muscles plus human-like (RBH trop stylisée).
- Refonte visu volume (Progrès > Volume "très moche").
- Audit réalisme des plafonds Alex (200 kg presse à jambes etc.).
- Step2 onboarding : silhouette cliquable pour ajouter le muscle,
  liste priorités en dessous, "ajouter manuellement" plus bas.
- Simplifier l'aide : un gros bouton "Aide" dans Profil qui ouvre
  les différentes options.

**Backlog Conv #17+ (gros chantier, état)**
- Modifier le profil ou les priorités après onboarding : reprendre
  un mini onboarding partiel + terminer prématurément le cycle en
  cours avec bilan archivé (mais pas affiché dans la foulée pour ne
  pas divertir).

## État courant — fin Conv #15 vague 2 (2026-05-21) — V1.4.0

Suite immédiate de la vague 1 (V1.3.0) sur 14 nouveaux retours Azur.
Bump **v1.4.0** (minor : 2 nouvelles features algorithmiques majeures
— recalibrage continu + suggestion variée).

**Bugs corrigés**
- **Bodyweight strict** : `crunch_machine`, `good_morning_machine`,
  `leg_curl_standing` ont `equip=[]` dans le catalog malgré
  `charge=machine_stack`. Garde-fou ajouté dans `catalog.filter` :
  charge ∈ {MACHINE_STACK, CABLE, BODYWEIGHT_LOADED,
  BODYWEIGHT_ASSISTED} + `equip_available` vide ⟹ skip. Plus robuste
  qu'un patch JSON (couvre d'autres oublis éventuels).
- **Calendrier "repos recommandé" pas orange** : `cn()` accumulait
  `bg-anthracite-*` + `bg-amber-*`, Tailwind tranchait alphabétiquement
  en faveur d'anthracite. Fix dans `DayCell` : override complet du
  STATUS_BASE par REST_SUGGESTED_OVERLAY si `restSuggested`.
- **Persistance séance KO** : le clic sur la case du jour rouvrait la
  sheet "Démarrer la séance" et perdait les coches. 3 fixes :
  1. `ProgrammePage.handleDayClick` — si session active sur la même
     date, court-circuite la sheet et navigue direct vers
     `/seance/runner`.
  2. `loadPlannedSessionForRunner` — skip le `setState` si même
     sessionId déjà actif (évite de provoquer un re-init via le
     useEffect SeancePage).
  3. `SeancePage` useEffect — au 1er mount, si `storedEntries` est
     déjà cohérent (même nb d'items + nb de sets), on le garde plutôt
     que d'écraser via `initEntries`.
  4. `skip` / `finish` / `cancel` / `reset` / `import` :
     `currentSessionEntries: null` ajouté aux clears pour propreté.

**Polish UX**
- Légende calendrier — retiré "(liseré)" sur la puce "Aujourd'hui".
- `Step2Muscles` — layout `grid-cols-[1fr_auto]` : liste priorités à
  gauche (truncate), silhouette compacte (w-[120px] h-40) à droite.
  `SortablePriorityRow` réduit à h-7 / text-xs, boutons objectif en
  text-[10px]. But : tout voir sans scroller sur mobile.
- `TabbedLayout` — `scrollTop = 0` sur change `pathname` (sinon scroll
  laissé sur Catalogue persistait sur Programme).
- `WelcomeBanner` — texte refait : "tape la case d'aujourd'hui
  (entourée en rouge)" au lieu de l'inexistant "onglet Séance".
- `SessionRunner` — `rpe_target` affiché arrondi 0.5 (`Math.round(× 2)
  / 2`). Termine "Effort cible 6.3/10" au lieu de "6.33333…/10".
- `SessionRunner` — Dialog de confirmation avant `onFinish` : "Tu as
  coché X/Y séries…" / "Toutes les séries sont cochées…". Évite
  l'erreur de manip qui clôturait définitivement.

**Textes démo Alex (visite guidée)**
- WelcomeOverlay : `persona.label` → "Visite guidée de Kotsh" (plus
  de "Coach OS"). `persona.summary` réécrite pour expliquer qu'on
  parcourt le profil d'un utilisateur fictif (Alex), pas un truc qui
  sort de nulle part.
- Step 1 (programme) : "8 semaines" → "4 semaines + 1 déload =
  5 semaines par cycle". Suppression de "séances déjà jouées".
- Step 4 (progres-force) : retiré le chiffre "120 → 127 kg". Ajouté
  explication des creux ponctuels et de la semaine de déload (-40 %).
- Régénération `alex.json` via `npm run demo:generate`.

**Algos** (les 2 vraies features de V1.4)
- **Suggestion de séance variée** (`PlanDaySheet`) — `variationSuggestion`
  trouve la dernière séance complétée dans les 7 derniers jours,
  localise son label dans `current_cycle_plan.days`, suggère le label
  suivant (modulo nb de jours). Affichage : badge ★ + variant primary
  sur le bouton suggéré + encart "💡 Tu as fait Full A récemment —
  pour varier, suggérée : Full B".
- **Recalibrage continu en cours de séance**
  (`recalibrateUpcomingSets` dans `lib/session-runner.ts`,
  `SessionRunner.handleEntriesChange`) — à chaque transition
  `done false → true` d'une série fiable (`measurementIsReliable`
  passe), on calcule `e1rm_live` (max sur séries done fiables de
  l'exo) et un `ratio = e1rm_live / e1rm_initial`. Si |ratio − 1| ≥
  0.05, on ajuste `load_kg` des séries non-cochées du même exo
  proportionnellement, arrondi à `inc_kg`. Heuristique
  "non touché par user" : on n'écrase que les `load_kg` encore
  identiques à la prescription d'origine du plan (dès qu'une charge a
  été ajustée par algo ou modifiée par user, on respecte).
  `e1rm_initial` figé via `useRef` au mount du SessionRunner (clé
  `currentSessionId` dans SeancePage pour garantir le remount à
  chaque vraie nouvelle session).

**Tests fin Conv #15 vague 2** : **497 Vitest + 23/23 e2e verts**
(seance.spec.ts ajusté pour cliquer le nouveau `dialog-confirm`).

## État courant — fin Conv #15 (2026-05-21) — V1.3.0

Itération sur retours d'usage Azur post-V1.2.0. Bump **v1.3.0** (mix
fixes + features UX significatives : silhouette muscles, persistance
entries séance).

**Bugs corrigés**
- **Équipement non filtré** (`engine/selection.ts`) — un Set vide ne
  court-circuite plus le filtre catalog. Si l'utilisateur ne coche
  aucun équipement dans l'onboarding, seuls les exos `equip.length === 0`
  (bodyweight pur) sont proposés. Banner d'info ajouté dans
  `Step1Profile` quand `draft.equipment.size === 0`.
- **Adhérence 10000 %** dans le bilan démo Alex — schéma attend une
  fraction 0-1, le générateur écrivait `100`. Fix dans
  `scripts/generate-alex-demo.mts` + régénération de `alex.json`.
- **Vue séance non scrollable + perte des coches** — `SeancePage`
  rendait directement le `SessionRunner` dans un AppShell
  `overflow-hidden`, et stockait `entries` en `useState` local
  (démontage = perte). Refonte :
  - wrapper `<main>` avec `overflow-y-auto`,
  - header avec bouton `← Programme` (séance "en pause"),
  - `entries` migrés dans le store global
    (`currentSessionEntries`) — survivent à la nav vers Catalogue,
    Progrès, etc.,
  - clé de réconciliation = `currentSessionId` (changement d'ID ⟹
    init fresh, remplacement d'exo intra-session ⟹ préserve les
    exos inchangés).

**Polish UX**
- **Silhouette muscles dans Step2 onboarding** : `AnatomicalSilhouette
  view="both"` affichée. Top-3 prioritaire = `highlight`, autres =
  `ok`, hors pool = neutre. Mise à jour live au fil du drag&drop.
- **Calendrier — couleurs distinctes** : vert succès = séance faite,
  bleu = prévue, dashed anthracite = libre, sang barré = sautée,
  ambre = repos recommandé. Légende refondue (puces 14px, labels
  longs : "Séance faite" au lieu de "fait", entrée explicite pour
  "Aujourd'hui (liseré)").
- **Pédagogie calibration**
  - `WelcomeBanner` : encart explicite "L'app te suggère charge/
    reps/effort comme objectif — modifie si la réalité diffère,
    l'algo apprend".
  - Step démo `seance` reformulé : "Les valeurs pré-remplies sont
    des objectifs à viser — si en réalité tu fais plus ou moins,
    modifie les chiffres avant de cocher."

**Visu force Alex — courbe squat retravaillée**
- Avant : dents de scie 125/118 (squat inscrit à la fois en main
  force et accessoire hyp, e1rm Epley différent) + creux final à
  98 (déload).
- Fix générateur : accessoire Lower B = `leg_press_45` au lieu d'un
  2e squat. Progression e1rm rehaussée à +1 %/séance (palier
  inc_kg=1.25 absorbe les +0.4 % précédents). `loadBias +1.25` sur
  W3D1 squat (mini-saut visible). `loadBias +2.5` sur le PR W4D1.
- Fix algo : `computeE1rmHistory` filtre désormais les sets
  `rpe_perceived < 6.5` (élimine les déloads de la courbe Force
  pour tout le monde, pas que la démo).
- Résultat squat : 125 → 125 → 126.6 → 131.3 (PR), au lieu de
  125/118/125/118/128/121/98/98.

**Notes techniques**
- `package.json > demo:generate` : ajout du flag
  `--tsconfig tsconfig.app.json` (tsx ne lisait pas les `paths` du
  tsconfig racine — references vides — depuis l'ajout de
  `@/lib/onboarding-preview` dans `engine/rebalance.ts` Conv #14e).
- `store/index.ts > currentSessionEntries` : sortie typée en
  `SessionEntries | null`. `setCurrentSession` clear automatiquement
  les entries pour éviter les fuites entre sessions.

**Tests fin Conv #15** : **497 Vitest verts** (aucun changement de
contrat), **23/23 e2e verts**.

**Backlog Conv #16** (notes Azur pour la suite)
- Chercher une **silhouette muscles plus réaliste / human-like** —
  la silhouette RBH actuelle est trop stylisée/robotique. Idée
  retenue, exécution à revoir.
- **Refondre la visualisation du progrès en volume** (onglet
  Progrès > Volume) — actuellement très peu lisible.

## État courant — fin Conv #14e (2026-05-23) — V1.2.0

> Note de nomenclature : les commits `a475071` et `edbaaf6` portent le
> label "Conv #16" dans leur message (mismatch — `Conv` correspond à la
> session Claude Code globale, pas à une phase de travail). Le vrai
> numéro est **Conv #14e**. Mêmes ajustements pour les commits "Conv
> #15" (= Conv #14d en réalité).

Itération sur retours d'usage post-V1.1.0. Bump **v1.2.0** (minor :
nouvelle feature majeure = rééquilibrage durées séances).

**Conv #14e-1 — fixes UX démo + SetInput** (commit `a475071`,
labellisé "#16-1")
- Welcome démo manquante : `resetApp` clear les LS `coach-os.demo-
  welcome-seen` + `coach-os.welcome-dismissed`. `OnboardingPage.
  finalize()` force `resetDemoDismissals()` avant `enterDemoMode`
  → la welcome overlay est garantie au 1er auto-launch
  post-onboarding, même après reset app.
- Cohérence date snapshot Alex : `ProgrammePage` utilise
  `currentSessionPlan.seance_date` comme "now" en mode démo (via
  `parseDateKey`). Avant : marqueur today posé à la vraie date
  système, incohérent avec le texte "Alex est mardi".
- Calendrier non-interactif en mode démo : `onDayClick=noop` quand
  `demoActive` → la `PlanDaySheet` ne s'ouvre plus pendant le tour
  (sinon elle masquait le bandeau démo).
- SetInput largeur reps/effort : `92px` → `112px`. Boutons `−`/`+`
  passés `w-8` → `w-9` (32→36px) pour tap targets ≥ 44px. `min-w-0`
  + `text-sm` sur l'input number pour retirer la min-width
  implicite qui repoussait le `+` hors du conteneur
  `overflow-hidden`.

**Conv #14e-2 — rééquilibrage généralisé des durées** (intégré au
commit `edbaaf6`, labellisé "#16-2")
- Nouveau module `engine/rebalance.ts` appelé en fin de
  `generateCyclePlan` (après `topUpMaintenance` /
  `enforceLengthenedBias` / `resolveCapacityConflict`).
- Algo glouton **intra-groupe `slot_kind`** : UPPER avec UPPER,
  LOWER avec LOWER, FULLBODY entre eux. Respecte l'esprit du split.
- À chaque itération : identifie L (long) + S (short) du groupe,
  énumère toutes les **opérations candidates** (Move = déplacer un
  exo L→S ; Swap = échanger un exo L↔S), retient celle qui maximise
  le gain sur `max-min`. Accepte seulement si :
  - gain ≥ 3 min (pas de micro-swap),
  - fréquence muscle prioritaire préservée (`targetFrequency`),
  - aucun jour ne devient vide,
  - pas de doublon `exercise_id` créé.
- Stop quand plus d'op valide à ≥ 3 min OU 10 itérations atteintes.
- Généralisable à tous les programmes (custom "haut du corps × 3",
  etc.) — pas de cas spécial full-body / UL / PPL.
- `target_muscles_focus` volontairement non recalculé (métadonnée
  historique).

**Tests fin Conv #14e** : **497 Vitest verts** (+7 sur rebalance),
**23/23 e2e verts**.

## État courant — fin Conv #14d (2026-05-22) — V1.1.0

Dump de retours d'usage post-V1 traité en 3 vagues (11 items au total),
bump **v1.1.0** (minor : changements de comportement visibles).

**Vague 1 — polish UI** (commit `7f3997d`)
- Header h-12 → h-10 + filigrane K remonté pour aligner avec la barre
  du step indicator d'onboarding (#14d-1).
- Logo Kotsh footer Profil x2 + padding aéré (#14d-2).
- Démo : "ⓘ" devant Étape N/M retiré, Précédent étape 1 rouvre la
  welcome overlay, étape Profil supprimée (5 étapes au lieu de 6).
  Demo.spec.ts adapté (#14d-3).
- SetInput refondu en 2 lignes : "Série N" + tick (✓) en haut, valeurs
  reps/kg/effort en bas avec largeurs équilibrées. kg garde flex-1,
  reps + effort en w-[92px] (#14d-4).
- CycleBilanPage : "Plafonds — Δ sur le cycle" → "Évolution sur le
  cycle", exId brut → nom français via `exerciseLabel`. Page accepte
  `?cycle=N` pour cibler un bilan archivé. Lien "Voir le bilan complet
  →" sur chaque CycleCard de Progrès > Cycles (#14d-5).
- Infobulle "adherence" dans help-glossary + HelpButton dans
  ReviewKeyMetrics (#14d-6).

**Vague 2 — démo + pédagogie** (commit `afe0314` partie 1)
- Démo auto-lancée à la fin de l'onboarding via `enterDemoMode()` en
  fin de `finalize()`. LS flag `coach-os.skip-auto-demo` désactive en
  e2e ; nouveau helper `runOnboardingMinimalWithAutoDemo` (#14d-7).
- Bulle démo qui ne masque pas le pointé : `useTargetMeasure`
  détermine si le target est en haut ou en bas de la viewport, le
  bandeau et la flèche s'adaptent (#14d-8).
- Nouvelle étape démo "effort" (entre seance et progres-force) avec
  body détaillé. `help-glossary.rpe` enrichi : repères 6-10 + "plus
  honnête = mieux calibré" (#14d-9).

**Vague 3 — fond / algo** (commit `afe0314` partie 2)
- Calibration range 3-6 → 3-8 reps dans CalibrationBanner. L'algo
  `measurementIsReliable` accepte n_equiv ≤ 15, donc 3-8 reste
  largement fiable (#14d-10).
- `parameterizeSplit` équilibre désormais sur le **coût estimé en
  exos** par muscle (volume_min + fréquence) plutôt que sur le nombre
  brut de muscles. First-fit decreasing : muscles les plus coûteux
  d'abord. Le scénario full-body 3j default passait de 58/39/31 min
  (max-min 27) à une répartition lissée. Test smoke :
  `onboarding-preview.test.ts` vérifie max-min ≤ 18 min (#14d-11).

**Tests fin Conv #14d** : **490 Vitest verts** (+1), **23/23 e2e verts**
(+2 : auto-démo + Précédent étape 1).

## État courant — fin Conv #14 (2026-05-20) — V1.0.0

Conv #14 = pass UI / UX en 3 sous-conv (#14a/b/c). Bump **package.json
1.0.0** : V1 officialisée. La version est affichée en pied de
`ProfilPage` via `__APP_VERSION__` injecté par Vite `define`.

**#14a — polish visuel** (commit `ff7f002`)
- Courbes Force (`ForceView`) : axe Y 3 ticks (kg), pointillé sang au
  plafond courant, polyline épaisseur 3, chips "PR" aux pics ≥ +2 kg.
- Widgets Programme : flamme stylisée (streak), `ProgressRing`
  (cette semaine + cycle), barre temporelle (prochain bilan). Nouvelle
  fonction `computeCycleTimeProgress` (`lib/dashboard.ts`).
- Logo Kotsh extrait en `components/KotshLogo.tsx` (réutilisable),
  posé en pied de `ProfilPage` avec `v{__APP_VERSION__}`.
- Police titres : Oswald → **Inter Tight Variable**
  (`@fontsource-variable/inter-tight`). Comparateur dev à
  `/dev/fonts` pour itérations futures.

**#14b — refonte navigation** (commits `2e02f24`, `c894809`)
- Onglet "Séance" supprimé de la TabBar (5 → 4). Le runner vit
  désormais sur `/seance/runner` (hors `TabbedLayout`, plein écran).
  `/seance` redirige vers `/programme` (compat).
- Démarrage 100 % depuis le `PlanDaySheet` du Programme. Tap sur jour
  fait → mini-bilan inline (exos / sets / charge / RPE / volume).
- Bouton **Sauter cette séance** dans `SessionRunner` →
  `engine.skipCurrentSession` / `txSkipSession` → status='skipped',
  case calendrier marquée "sautée".
- Heuristique de périodicité (`lib/periodicity.ts`) : nudge "💡 Tu
  fais souvent X le mardi" dans `PlanDaySheet` quand le jour matche
  un slot dominant sur les 6 dernières semaines.
- `StartSessionList.tsx` supprimé (plus utilisé).

**#14c — lisibilité / contenu** (commit `46f6f1c`)
- Onglet "Programme" → **"Séances"** (route `/programme` inchangée).
- Volume Progrès refondu : toggle "Prioritaires" / "Tout afficher",
  palette anthracite neutre + accent sang sur valeurs hors-cible (plus
  d'orange).
- Historique cycles "Visé vs fait" : `CycleReview.muscle_goals_snapshot`
  optionnel posé au bilan, `CyclesView` affiche `progressed / plateau /
  sous-volume / sur-volume` par muscle prioritaire.
- `muscleLabel` unifié dans `lib/progress.ts` (dictionnaire FR sans
  article : "Pectoraux", "Dos en largeur", "Ischio-jambiers", …).
  Réexporté depuis `lib/balance-reasons.ts`.
- Renommage UI **coach-os → Kotsh** dans les phrases user-visibles
  (DemoMode, AideSheet, filename export `kotsh-export-DATE.json`).
  Identifiants techniques (`DB_NAME`, `APP_NAME`, paths
  `/coach-os/`) inchangés.
- Audit jargon : "RPE" → "effort" dans `PlanDaySheet` (mini-bilan) et
  `ManualE1rmSheet`. Le glossaire `help-glossary.ts` garde la mention
  pédagogique.

**Tests fin Conv #14** : **489 Vitest verts**, **21/21 e2e verts**,
build OK.

**Reliquats post-V1** :
- Sync cloud Supabase V1.5 (incident iOS Safari).
- Calibration : recalcul auto charges séries suivantes + écran
  `Profil > Plafonds`.
- Estimation plafond par ratios entre exos (bootstrap + reprise).
- `EquipmentOverride` UI + édition objectifs/programme + bouton
  "Ajuster" du Bilan + régénération cycle plan.
- Persistance d'une routine fixée par jour (suite #14b-4 — pour
  l'instant seul un nudge informatif).
- Affiner muscles primaires fins (`pec_haut`/`pec_bas`).
- Champs "exécution" / "erreurs courantes" structurés sur les exos.
- Parité Python du mapping synonymes (UI-only aujourd'hui).

---

## Backlog Conv #13 — Tuto démo (persona Alex)

**Objectif** : tutoriel interactif post-onboarding qui montre toutes les
surfaces de Coach OS via un utilisateur fictif "Alex" avec un historique
réaliste. Rejoue-able à tout moment via `ProfilPage > Aide > Relancer tuto`.

### Décisions actées (Conv #12, début) — ne pas re-discuter

- **Persona** : "Alex", 4×/sem **Upper/Lower**, équipement salle complet
  (haltères + barre + machines + poulies). Objectifs **force + hypertrophie
  50/50** → montre les deux axes simultanément.
- **Historique simulé** : 8 semaines = **1 cycle terminé + 1 cycle entamé
  semaine 4**. Doit faire apparaître au moins :
  - 2 PR sur exos majeurs (squat + bench probablement)
  - 1 semaine de déload visible dans le calendrier
  - ~3 swaps d'exos durables (ex: dév incliné haltères → barre)
  - 1 ajustement RPE bas → baisse charge (récup ratée)
  - 1 ajustement RPE haut → hausse charge (saut de palier)
  - 1 séance ratée → dette volume
- **Exos couverts** : squat, soulevé de terre, dév couché, tractions
  (assistées au début → libres après PR), rowing, dév militaire, curl,
  extensions tri. Couvre `BODYWEIGHT_ASSISTED`, `BODYWEIGHT_LOADED`,
  charges libres, machines.
- **Données démo préfabriquées en JSON** : `/public/demo/alex.json`,
  généré **une fois** via `prototype/coach_os/simulation.py`, commité.
  **Pas de port TS du simulator** — on veut un parcours déterministe
  identique pour tous les utilisateurs.
- **Mode démo** : flag `demoMode: boolean` + `demoSnapshot: DemoState |
  null` dans le store. Les selectors lisent `demoSnapshot` quand actif.
  La vraie DB n'est **jamais touchée** en mode démo. Sortie = on flippe
  le flag, tout revient instantanément.
- **Guidage** : pas de tour rigide étape-par-étape (lourd, ennuyeux).
  Plutôt :
  - **Bulle d'accueil plein écran** à l'entrée : "Voici Coach OS vu par
    Alex, intermédiaire, 8 semaines d'historique. Explore librement, on
    te guidera."
  - **Hints flottants contextuels** en bas, 1-2 par page visitée
    ("Ici, le plafond mesuré — il évolue à chaque RPE remonté").
    Dismissible individuellement.
  - **Checklist de découverte** flottante repliable en bas à droite,
    "5/8 endroits visités" : Programme du jour / Lancer une séance /
    Bilan de séance / Onglet Progrès / Bilan de cycle / Catalogue / Swap
    d'exo / Profil. Persistante jusqu'à fermeture du mode démo.
  - **Bouton "Quitter la démo"** toujours visible en haut, confirmation
    légère, retour aux vraies données.
- **Entry points** : (a) auto post-onboarding (avant le `WelcomeBanner`
  de `ProgrammePage` posé en #12b — ou en remplacement) ; (b) toujours
  accessible dans `ProfilPage > Aide > Relancer le tuto`.

### Périmètre technique #13

1. **Générer `/public/demo/alex.json`** via Python.
   - Adapter `prototype/coach_os/simulation.py` pour produire un profil
     Alex (params ci-dessus) et exporter en JSON le tuple
     `{ userState, history, currentCyclePlan, completedCycles }`.
   - Format JSON validé par un **schéma Zod côté TS** (`lib/demo-schema.ts`)
     pour que tout changement de format casse vite avec un message clair.
   - Asset commité sous `/public/demo/alex.json` (servi tel quel par Vite).

2. **Module `lib/demo.ts`**
   - `loadDemoSnapshot(): Promise<DemoState>` (fetch + Zod parse du JSON).
   - `enterDemoMode()` / `exitDemoMode()` : pose/retire `demoMode` +
     `demoSnapshot` dans le store, sans toucher à `userState` réel.
   - `isDemoActive(state): boolean` helper pur.

3. **Adapter `store/selectors.ts`** : chaque selector qui lit `userState`
   ou `history.*` doit checker `demoMode` et lire `demoSnapshot.*` à la
   place. Liste à recenser (probablement 8-10 selectors). Tester à part.

4. **`components/DemoMode/`** :
   - `DemoModeProvider` (contexte React pour les étapes de checklist).
   - `WelcomeOverlay` (bulle plein écran d'accueil).
   - `HintBubble` (générique, props : `route`, `target`, `text`, `id`
     pour persistance dismiss).
   - `DiscoveryChecklist` (flottante, repliable, persistante).
   - `ExitDemoButton` (header fixe, confirmation).
   - Hints contextuels par route : un mapping `route → Hint[]` (Programme,
     Séance, Progrès, Catalogue, Profil, Bilan).

5. **Entry points UX** :
   - **Auto post-onboarding** : remplacer `WelcomeBanner` par un bouton
     "Voir le tuto" + "Je commence direct" (skip). Si "Voir", on entre
     en mode démo immédiatement.
   - **`ProfilPage > Aide`** : nouvelle section "Tuto" avec bouton
     "Relancer le tuto". (Si pas déjà de bloc Aide, créer la section.)

6. **Tests** :
   - Vitest : selectors lus en mode démo retournent `demoSnapshot.*`.
   - Vitest : schéma Zod accepte un JSON valide / rejette un malformé.
   - E2E (1 spec) : parcours `entre démo → coche 1 hint → quitte démo
     → vraies données revenues`.

### Hors scope #13 (à pousser plus tard si besoin)

- Mode démo qui **simule une séance live** (saisie séries avec sets cochés
  d'avance pour montrer le flow) — V2 nice-to-have.
- Mode démo **multilingue** ou animations sophistiquées — V2.
- A/B des persona (Alex / Bea / ...) — sans intérêt en V1.

### Limites résiduelles de #12 à éventuellement folder dans #13

- **Recalcul live des charges proposées** après 1re série fiable :
  aujourd'hui le banner affiche "Plafond appris : X kg" mais ne patche pas
  `entries`. À discuter — est-ce utile en V1, ou on garde le compromis
  actuel (l'user ajuste à la main) ?
- **`ProfilPage > Plafonds`** pour édition hors séance : utile si l'user
  veut corriger un plafond saisi à tort. Indépendant du tuto, peut sortir
  en hotfix.

---

## État courant — fin Conv #13 (2026-05-19, refonte visite guidée)

Tuto démo persona Alex **refondu en visite guidée linéaire** après
retours Azur (la version libre/checklist était hors sujet pour un
onboarding "prise en main 1re séance"). **5 commits pushés** :
`93a5790` #13a · `b764a7e` #13b · `7b89793` #13c · `08a5afb` #13d ·
`b091f8f` #13e.

**Refonte #13d/e** (par-dessus #13a/b/c) :
- Snapshot Alex enrichi : ajout C2W4D0 (Upper A lundi déjà jouée) +
  `current_session` (Lower A mardi = DEMO_TODAY, posée sur
  currentSessionPlan à l'enterDemoMode). Couverture sem courante
  remplie, écran Séance live avec runner actif.
- `lastCycleReview` injecté à l'enterDemoMode depuis `cycles[0].review`
  (sinon `/cycle-bilan` reste vide en démo).
- UI : `DiscoveryChecklist` + `HintBubble` (route hints éparpillés)
  remplacés par un `GuidedTour` linéaire 6 étapes (Programme → Séance
  → Force → Bilan cycle → Profil → Sortie). Bandeau narratif unique
  bordure sang 2px + shadow-glow-sang-lg + ring sang/20 (clairement
  identifiable maintenant). Plus de label "Astuce", juste badge
  "Étape N/T" + icône ⓘ.
- Hide-on-sheet via MutationObserver — la bulle se masque quand un
  `role=dialog` apparaît (sinon cachait récap séance, Aide, etc.).
- Flèche SVG sang qui pointe sur l'élément central de chaque étape
  via `[data-testid]`. Resize/scroll-safe.
- Étape Séance : highlight ponctuel `animate-row-flash` 700ms sur
  set-row-0 pour montrer le retour visuel d'une validation.
- Étape Force : `clickOnEnter` qui clique programmatiquement sur le
  sous-onglet `tab-force` (état local non-routable).
- Sortie via "Démarrer ma vraie 1re séance" = `exit + nav /programme`.
- Pas de reprise mi-parcours (relance = étape 1).

**Tests** : 474 Vitest verts (+3 sur lastCycleReview / currentSession /
backup propre). **20/20 e2e verts** (4 specs démo : tour complet,
Précédent, exit mi-parcours, relance Aide).

- **`public/demo/alex.json`** (10k lignes) — snapshot 8 sem UL 4j avec
  2 PR, déload S5, 3 swaps durables, 1 séance ratée. Généré par
  `scripts/generate-alex-demo.mts` (lancé via `npm run demo:generate`).
  Décision design vs backlog : script TS (engine = source de vérité)
  plutôt que simulator Python, parcours scripté plutôt que stochastique.
- **`src/lib/demo-schema.ts`** : Zod qui valide la forme du JSON
  (parsé au load + au build).
- **`src/lib/demo.ts`** : `loadDemoSnapshot` (fetch + memoize),
  `enterDemoMode` (backup state courant + swap userState/history),
  `exitDemoMode` (restaure backup). Pas d'interception au niveau
  selectors — l'UI lit normalement ses hooks.
- **`src/store/`** : ajout `demoMode` + `demoSnapshot`.
- **`src/components/DemoMode.tsx`** : provider monté dans AppShell.
  WelcomeOverlay (1× par session via LS), ExitDemoButton fixed top-right,
  HintBubble (5 mappings route → hint, dismissible par id), Discovery
  Checklist 8 étapes repliable.
- **Entry points** : WelcomeBanner `/programme` (bouton "Voir un
  exemple"), Profil > Aide section "Tuto interactif".
- **E2E** : 2 nouveaux Playwright (`demo.spec.ts`) parcours
  WelcomeBanner + Profil. Fix collatéral : `onboarding.spec.ts`
  attendait `/seance-0` → patché `/programme`.
- Tests : 471 Vitest verts, build OK.

**Fix collatéral Conv #13 (commit `3ce9552`)** : 12 e2e cassés depuis
#12a (attente de `/seance-0`) corrigés via extraction d'un helper
partagé `tests/playwright/_helpers.ts` (`runOnboardingMinimal`).
**20/20 e2e verts** (avec les 4 specs démo refondues).

**Hors scope #13** : protection paranoïaque mode démo (bloquer
"Démarrer séance" pendant la démo). À voir si Azur trouve la version
read-only-soft suffisante.

---

## État courant — fin Conv #12b (2026-05-19)

UX de la calibration transparente — banner par exo en séance + option
"Je connais mon plafond" + écran de bienvenue post-onboarding.

- **`lib/calibration-status.ts`** : confidence dérivée par exo
  (`'not_calibrated' | 'measured' | 'stale'`). Pas de refonte du type
  `e1rm` : on lit `e1rmSnapshots` (table existante) pour le `measured_at`.
  - `'not_calibrated'` si aucun snapshot pour l'exo (même si `e1rm[id]` est
    posé via bw-bootstrap dans `bootstrapE1rmIfMissing`).
  - `'measured'` si dernier snapshot < `STALE_WEEKS` (8 sem = 56 jours).
  - `'stale'` au-delà. Calcul en `Date.UTC` pour neutraliser les bascules
    DST mars/oct (sinon `Math.floor` peut renvoyer 55 au lieu de 56 et
    fausser la frontière).
- **`pages/seance/CalibrationBanner.tsx`** : affiché au-dessus des séries
  d'un exo dans `SessionRunner` si confidence ≠ `'measured'`. 2 états :
  - Avant 1re série fiable : "On apprend ta charge — vise 3-6 reps en
    gardant 2-3 reps en réserve" + bouton "Je connais mon plafond".
  - Après 1re série fiable cochée : "Plafond appris : X kg — ajuste les
    séries suivantes si besoin." (calcul max des `e1rmObserved` sur les
    sets fiables `n_equiv ≤ 15`).
- **`pages/seance/ManualE1rmSheet.tsx`** : sheet "Je connais mon plafond"
  ouverte depuis le banner. Input charge à 1 rep, validation →
  `useEngine.setManualE1rm` pose `state.e1rm[id]` (via
  `effectiveLoadForE1rm` pour BW loaded/assisted) + insère un snapshot
  daté `today` (table `e1rmSnapshots`). Confidence passe instantanément
  en `'measured'`, banner disparaît.
- **`db/transactions.ts`** : `txCommitManualE1rm` (nouvelle tx, met à jour
  `userState` + insère 1 snapshot, atomique).
- **`pages/programme/WelcomeBanner.tsx`** : Card "Bienvenue, ton cycle
  commence aujourd'hui" sur `ProgrammePage`. Affiché tant que
  `history.feedbacks.length === 0` ET pas dismissé.
  Dismiss persisté en localStorage (`coach-os.welcome-dismissed`).
- **`SessionRunner`** : intègre `CalibrationBanner` par exo via le memo
  `confidenceByExo` (e1rmConfidenceFor pour chaque item du plan, lecture
  des snapshots depuis le store).

**Tests** : 451 Vitest verts (+12 nouveaux sur calibration-status :
lastSnapshotDateFor, e1rmConfidenceFor cases not_calibrated / measured /
stale + frontière 56j, helpers isNotCalibrated / isStale).

**Limites résiduelles** (à itérer plus tard si Azur souhaite) :
- Pas de **recalcul live des charges proposées** des séries suivantes
  après la 1re série fiable cochée. Seul un texte "Plafond appris : X kg"
  s'affiche — l'utilisateur ajuste sa charge manuellement s'il veut.
  L'ajout d'un recalcul auto avec patch de `entries` est faisable mais
  demande un useEffect-callback ciblé pour éviter les boucles avec le
  state UI.
- Pas de **Profil > Plafonds** pour éditer/supprimer les plafonds hors
  séance (le seul chemin manuel est via le banner pendant une séance).

---

## État courant — fin Conv #12a (2026-05-18)

**Retrait Séance 0 — calibration transparente RPE-based** (décision Azur Conv
#12, fin de la conv tuto). La Séance 0 dédiée disparaît : depuis l'onboarding
on arrive directement sur `/programme`, et pour chaque exo sans plafond
mesuré, le moteur bootstrap heuristique bw-based (`bootstrapE1rmIfMissing`
déjà en place dans `engine/engine.ts`), puis raffine via le filtre EMA à
chaque feedback RPE (`updateE1rmForExercise` existant). Plus de calibration
dédiée — l'algo apprend en marchant.

**Why** : la Séance 0 forçait une étape de friction inutile avant de
s'entraîner. La calibration peut être transparente puisque le moteur RPE
est déjà conçu pour ça (bootstrap + EMA).

**Changements structurels** :
- Suppression `src/pages/seance-0/` (3 fichiers : Seance0Page, CalibrationStep,
  VariantPickerSheet). `VariantPickerSheet` déplacé à `src/components/`
  (utilisé par Step5Preview et ExerciseDetailSheet).
- Route `/seance-0` retirée de `router.tsx`.
- `WeeklyTemplate.requires_calibration` retiré du modèle (`engine/models.ts`).
- `hasRequiredPlafonds` retiré (`engine/guided_programs.ts`) — plus utilisé.
- `commitInitialCalibration` + `shiftCurrentCycleStartToTomorrow` retirés
  de `useEngine.ts`. `txShiftCycleStart` retiré de `db/transactions.ts`.
- `generateInitialCyclePlan` simplifié : ne pose plus `requires_calibration`
  ni n'appelle `pickCalibrationExercises`.
- `OnboardingPage.finalize` : navigue toujours vers `/programme` post-onboarding.
- `SeancePage` / `ProgrammePage` : retirent le redirect vers `/seance-0`.
  Si `current_cycle_plan === null`, retour `/onboarding`.
- Filtres `feedback.label === 'Séance 0'` retirés dans :
  - `lib/dashboard.ts` (+ const `CALIBRATION_LABEL` + `isCalibrationFeedback`)
  - `lib/progress.ts` (`computeCoverageThisWeek`, `computeVolumeHistory`)
  - `engine/lifecycle.ts` (`generateCycleReview`)
- `lib/calibration.ts` réduit à `alternativeVariantsFor` (+ helpers privés).
  Les anciennes fonctions de calibration (`pickCalibrationExercises`,
  `e1rmFromSubmaxTest`, `e1rmFromKnown1RM`, `validateSubmaxInput`,
  `SUBMAX_*`, `allowsKnown1RM`, `loadLabelFor`) sont supprimées.

**Tests** : 439 Vitest verts (-6 retirés cohérents : tests requires_calibration,
hasRequiredPlafonds, "Séance 0 exclue du décompte"). E2e `seance0.spec.ts`
supprimé. Build vert.

**Limites #12a** : l'UX de calibration transparente reste sommaire pour
l'instant — l'utilisateur ne voit pas explicitement que sa 1re série d'un exo
inconnu calibre le plafond. À traiter en **#12b** :
- Banner "On apprend ta charge" dans `SetInput` quand exo non mesuré.
- Recalcul live des charges proposées des séries suivantes après 1re série
  fiable cochée.
- Marquage `stale` (dernier snapshot > 8 sem) + bannière re-calibrage.
- Écran récap léger post-onboarding ("Ton cycle commence aujourd'hui").

---

## État courant — fin Conv #11i bis (2026-05-18)

3 fix complémentaires post-#11i, suite à retours immédiats Azur :

- **Séance 0 totalement exclue du programme** (Azur : "elle a lancé le
  décompte des semaines dans le calendrier : ce ne doit être le cas nulle
  part") :
  - `computeCoverageThisWeek` (`lib/progress.ts`) filtre désormais
    `feedback.label === 'Séance 0'`.
  - `computeVolumeHistory` idem.
  - `buildCalendarMatrix` (`lib/dashboard.ts`) filtre la Séance 0 lors
    de la construction de `feedbackDates` → la cellule du jour ne s'affiche
    plus "completed" si seule la Séance 0 a été enregistrée. Le type
    de `feedbacks` est étendu à `Pick<…, 'seance_date' | 'feedback'>`
    pour accéder au label.
  - Nouvelle tx `txShiftCycleStart(cycleIndex, newStartDate)` (`db/
    transactions.ts`). Nouvelle méthode `shiftCurrentCycleStartToTomorrow`
    (`hooks/useEngine.ts`) qui appelle la tx + `refreshHistory`.
  - `Seance0Page.finalize` appelle ce shift **après** `recordFeedbackAndCommit`,
    **uniquement si au moins une série a été cochée** (`feedbackSets.length > 0`).
    Si l'user passe sans cocher (cas test e2e, ou validation symbolique),
    pas de shift → comportement conservé. Sinon : la S1 du programme
    commence demain, pas le jour de la calibration.
- **Alignement filigrane K / titre Header** (`AppShell` + `Header`) :
  `top` du filigrane passe à `max(env(safe-area-inset-top), 0.75rem)`
  (identique au padding-top du Header), donc le centre vertical du K est
  rigoureusement sur la même ligne que le centre du titre h-12. Le `pl-14`
  du Header passe à `pl-20` pour augmenter l'écart horizontal K↔titre
  (l'utilisateur les voyait collés).
- **Doublon "Profil"** retiré : la `<h1>Profil</h1>` redondante en haut
  de `ProfilPage` est supprimée (le Header affichait déjà le titre).

Tests : **445 Vitest verts** (inchangé). **20 e2e verts** (workers=1).
Build OK (46.03 kB CSS / 693.96 kB JS, +0.24 CSS / +1.10 JS depuis #11i).

**Note prochaine conv** — Azur veut un **tuto post-Séance 0** avec
simulation d'un utilisateur fictif (multi-cycles réalistes) comme support
pédagogique, accessible aussi via Profil > Aide. Reporté à #12 (porter
`prototype/coach_os/simulation.py` en TS, mode "demo" du store,
parcours guidé multi-écrans).

## État courant — fin Conv #11i (2026-05-18)

Piste E refonte visuelle — micro-interactions et animations (dernier
item du backlog #11) :

- **Haptics Vibration API** (`lib/haptics.ts`) : wrapper minimal autour de
  `navigator.vibrate`. Patterns prédéfinis : `set-done` (25 ms), `set-undone`
  (12 ms), `session-done` ([40, 60, 40, 60, 80] ms), `pr` (pattern 7 pulses),
  `error`, `tap-soft`. Silent si pas de support (iOS Safari) ou si
  `prefers-reduced-motion: reduce`. Branché sur SetInput (toggle done /
  undone) et SessionRunner (btn-finish-session → 'session-done').
- **Animations cochage série** (`SetInput.tsx`) : nouveau state `justChecked`
  (600 ms après passage à done). Le row pulse via `animate-row-flash`
  (background sang qui fade in/out) et le bouton ✓ via `animate-tick-pop`
  (scale 0.85 → 1.15 → 1 avec courbe easing élastique, halo sang qui
  enfle). Pas d'animation à l'undone (action calme).
- **Progress ring** (`components/ProgressRing.tsx`) : SVG pur, anneau
  circulaire avec track anthracite-700 + arc sang qui se remplit selon
  `value/total`. Transition CSS sur `stroke-dasharray` (360 ms). Affiché
  dans `SessionRunner` : un grand ring 44 px à côté du compteur global
  `{done}/{total}`, et un mini ring 28 px sur chaque header d'exo à côté
  du compteur per-exo. `showLabel` optionnel pour mettre les chiffres au
  centre.
- **Animations Bilan** (`CycleBilanPage.tsx`) : Metric et entries plafonds
  passent en `animate-reveal-up` (slide up + fade, courbe ease-out élégante
  cubic-bezier(0.16, 1, 0.3, 1)). Stagger 80 ms entre les 3 metrics, 60 ms
  entre chaque plafond. Numéros Metric passent en `font-display text-2xl`
  pour matcher la signature visuelle.
- **Animation courbe Force** (`ForceView.MiniLine`) : polyline animée via
  `animate-draw-line` (`pathLength={1}` + `strokeDasharray={1}` +
  keyframe sur `strokeDashoffset` 1 → 0) → la courbe se trace
  progressivement en 900 ms. Les cercles aux points apparaissent en
  `animate-reveal-up` avec stagger 60 ms après le tracé.
- **Tailwind keyframes** (`tailwind.config.ts`) : 4 nouvelles animations
  one-shot (`tick-pop`, `row-flash`, `reveal-up`, `draw-line`).

Tests : **445 Vitest verts** (inchangé — modifs purement cosmétiques).
**20 e2e verts** (workers=1). Build OK (45.79 kB CSS / 692.86 kB JS,
+0.84 CSS / +2.94 JS depuis #11h bis).

**Backlog Conv #11 — soldé**. Le 2e dump de retours d'Azur est entièrement
traité (items 1-12) + ajustements complémentaires (#11h bis : trackings
semaines programme, plafond catalogue mis en évidence, filtres habituels/
mesurés ; #11i : piste E refonte visuelle).

## État courant — fin Conv #11h bis (2026-05-18)

Trois ajouts en complément de #11h, suite à retours immédiats Azur :

- **Trackings alignés sur les semaines du programme** (`lib/dashboard.ts` :
  `weekStartFor(date, cycleStart) / weekKeyFor`). Fallback semaine ISO si
  `cycleStart === null`. Cascadé dans `computeCoverageThisWeek`,
  `computeVolumeHistory`, `computeStreak`. Les pages `ProgresPage` et
  `ProgrammePage` extraient `cycle.start_date` du cycle courant pour le
  passer. Cohérence visuelle avec le calendrier cycle-aligned : "cette
  semaine" = la semaine du programme contenant aujourd'hui, pas la
  semaine ISO lundi-dim.
- **Plafond mis en évidence sur les cards catalogue** (`ExerciseCard`) :
  chip distinct à droite du nom de l'exo (au lieu de l'ancienne ligne de
  tags), gradient sang-600→800 plein, font-display tabulaire, halo
  `shadow-glow-sang`. Plus de confusion avec les tags neutres
  ("polyarticulaire", "barre", muscles).
- **Filtres "Exos habituels" + "Plafond mesuré"** (`lib/catalog-filter.ts`) :
  `CatalogFilters` étendu (`habitualOnly`, `measuredOnly`). `applyFilters`
  accepte un `CatalogFilterContext` (`{habitualIds, e1rmMap}`).
  `CataloguePage` calcule `habitualIds` depuis `userState.current_cycle_plan`
  et passe le contexte. `FiltersSheet` ajoute une section "Mon programme"
  en tête avec 2 chips (testids `filter-habitual-only`, `filter-measured-only`).

Tests : **445 Vitest verts** (+7 : weekStartFor null/cycleStart, 4 sur
les filtres habitual/measured, applyFilters habitualOnly sans contexte).
**20 e2e verts** (workers=1). Build OK
(44.95 kB CSS / 689.92 kB JS, +0.30 CSS / +0.49 JS).

## État courant — fin Conv #11h (2026-05-18)

Calendrier aligné cycle + co-construction programme + filigrane à gauche
(items 11, 12 du dump #11 bis).

- **Calendrier aligné sur cycle.start_date** (`lib/dashboard.ts →
  buildCalendarMatrix`) : `anchor` passe de `startOfWeekMonday(start_date)`
  à `parseDateKey(start_date)`. La 1re case du calendrier est désormais
  toujours S1J1, et la 5e ligne couvre strictement les jours 29-35 depuis
  le démarrage → le déload est correctement positionné même si le cycle
  ne commence pas un lundi. Le `dayOfWeek` de chaque case est calculé
  depuis la vraie date (`(date.getDay() + 6) % 7`), donc le `DayCell`
  affiche le bon label (M si mardi, J si jeudi…) — la 1re colonne porte
  le jour de démarrage (mer si on a démarré un mer).
- **Estimateur de durée séance** (`lib/onboarding-preview.ts`) :
  `estimateExerciseDurationMinutes(planned, exType)` (heuristique
  setup 60 s + sets × (exécution 30 s + repos 120 s compound / 60 s
  isolation)) + `estimateDayDurationMinutes(day, catalog)` somme par jour.
  Calibré sur l'indice "6 exos calibrés = 45-50 min" donné par Azur
  (compound × 3 sets ≈ 8.5 min). Seuil `SESSION_DURATION_WARN_MIN = 75 min`.
- **Détecteur de tensions** (`analyzeProgramTension(template, catalog)`) :
  retourne `{durationsMin[], avgMin, maxMin, tooLong}`. `tooLong = maxMin >
  75`. Sert au Step5 à afficher un panneau d'arbitrage.
- **Affichage Step5** : sous `VolumeRecap`, encart `TensionPanel` toujours
  visible (durée moyenne + max). Si `tooLong`, fond sang-900/15 + bandeau
  d'arbitrage transparent listant les leviers (plus de séances, moins de
  muscles, programme custom, accepter séances + longues). Chaque day card
  affiche aussi sa durée individuelle (`{n} exos · ~{X} min`, testid
  `day-duration-${di}`).
- **Filigrane K déplacé à gauche** (`AppShell.BrandWatermark`) :
  `left-3` + `flex h-12 items-center` pour être centré verticalement avec
  le titre du Header (h-12). Taille passée à `h-8 w-8` (32px) pour rester
  visible. Le Header gagne `pl-14` au lieu de `px-5` pour libérer la
  zone à gauche et garder le titre lisible. Opacity inchangée à 0.32 +
  drop-shadow pour bien distinguer du titre adjacent.

Tests : **438 Vitest verts** (+4 : analyzeProgramTension low/high
volume + exos inconnus + compound > isolation, 1 test calendrier mis
à jour pour l'anchor start_date). **20 e2e verts** (workers=1). Build OK
(44.65 kB CSS / 689.43 kB JS, +0.26 CSS / +2.44 JS depuis #11g).

**Backlog Conv #11 — restant** :
- **#11i — Piste E refonte visuelle** : transitions sur cochage de série,
  progress ring autour des exos, haptics via Vibration API, animations
  courbes Bilan. Reste en suspens depuis #11c (A→D livré, E à évaluer).

## État courant — fin Conv #11g (2026-05-18)

Visualisation des données (items 6, 9, 10 du dump #11 bis).

- **Onglet "Force"** (`pages/progres/ForceView.tsx` + tab dans `ProgresPage`) :
  pour chaque exo présent dans l'historique avec ≥ 2 points → carte avec
  nom, plafond actuel (kg, en font-display tabulaire), delta % depuis le
  1er point (vert si > +0.5 %, sang si < −0.5 %, anthracite sinon), et
  une mini-courbe SVG (polyline sang sur fond card). Calcul dans
  `lib/progress.ts → computeE1rmHistory` : on parcourt `history.feedbacks`,
  applique `e1rmObserved` (Epley) sur chaque set valide, garde le plus
  haut e1RM par date, trie chrono ascendant. Tri global par nombre de
  points décroissant (les exos les plus suivis remontent), top 8.
  Tab order : Couverture / Force / Volume / Cycles.
- **Plafonds dans le catalogue** (item 9 minimal — pas d'estimation) :
  `CataloguePage` lit `userState.e1rm` et passe la valeur courante à
  chaque `ExerciseCard` (petit chip sang `{val} kg` dans la rangée de
  tags, testid `card-e1rm-${exId}`) et à `CatalogueDetailSheet` (bloc
  encadré sang sous la description, "Ton plafond — {val} kg" en
  font-display). Les exos non mesurés n'affichent rien — pas d'estimation
  par ratio dans cette conv (cf. backlog : ça demande une table de
  conversion validée scientifiquement, hors scope).
- **Séance 0 exclue du décompte de cycle** (`lib/dashboard.ts` + `engine/
  lifecycle.ts`) : `computeCycleProgress`, `computeWeekSessions` et
  `isCycleFinished` filtrent les feedbacks avec `feedback.label === 'Séance 0'`.
  Nouvelle const exportée `CALIBRATION_LABEL = 'Séance 0'`. Idem dans
  `generateCycleReview` : `cycleSessions` exclut la Séance 0 du calcul
  d'adhérence et de l'analyse muscles. **Le volume hebdo / la couverture
  continuent d'inclure la Séance 0** (filtres par dates seuls,
  `computeVolumeHistory` et `computeCoverageThisWeek` inchangés).

Tests : **434 Vitest verts** (+6 : 3 sur `computeE1rmHistory`, 2 sur
exclusion Séance 0 dans dashboard, 1 e1rm test "single point excluded").
**20 e2e verts** (workers=1). Build OK (44.39 kB CSS / 686.99 kB JS,
+1.19 CSS / +1.68 JS depuis #11f).

**Backlog Conv #11 — restant** :
- **#11h** — Calendrier (déload bien placé quel que soit le jour de
  démarrage S1) + co-construction programme (détecteur de tensions full
  body × n séances × volume avec arbitrages explicites et estim. durée
  séance).
- **Estimation de plafond par ratios** (item 9 partiel) : reportée. Demande
  une table de conversion entre exos d'un même muscle/pattern (ex : front
  squat ≈ 0.85 × back squat) appuyée sur de la littérature. Hors scope #11.

## État courant — fin Conv #11f (2026-05-18)

Refonte onboarding/calibration + chrome (items 4, 5, 7, 8 du dump #11 bis).

- **Filigrane logo K** (`layout/AppShell.tsx → BrandWatermark`) : `<img
  src=icon.svg>` 28×28 en `fixed` top-right, `opacity-[0.32]`,
  `pointer-events-none`, `z-50` (pour passer au-dessus du Header sticky).
  Présent sur tous les écrans (onboarding, séance 0, tabs, etc.). Testid
  `brand-watermark`. Le `top` respecte la safe-area iOS.
- **"Je teste" en mode par défaut** (`CalibrationStep.tsx`) : mode initial
  `'submax'` quel que soit `allowsKnown1RM`. Tabs inversés (Je teste 1re
  position, "Je le connais" 2e — texte raccourci de "Je connais mon
  plafond"). Petit paragraphe explicatif sous le tab `submax` : "Choisis
  une charge où tu penses tenir 3 à 8 reps propres…"
- **Titre exo en font-display** (`CalibrationStep.tsx`) : header restructuré
  avec sur-titre "Exo N / total" en sang-400 / tracking large + nom de
  l'exo en `font-display text-2xl tracking-wide`. Plus marqué que
  l'ancien `text-xl font-semibold`.
- **IntroBanner Séance 0 enrichie** (`Seance0Page.tsx`) : Card en `accent`,
  surtitre "Séance 0" sang-400, titre "Calibration" en font-display, puis
  liste 1-2-3 numérotée (1. mesurer plafond, 2. 2 séries de travail à
  effort 8/10 qui comptent dans l'historique, 3. exo suivant, ~7-8 min/exo
  → estim. totale calculée). Pédagogie pour un user qui découvre le format.
- **Titres onboarding harmonisés** (Step1-5) : pattern `<header>` avec
  sur-titre "Étape N" en sang-400 / `tracking-[0.22em]` + `<h1>` en
  `font-display text-3xl tracking-wide`. Cohérent avec le Header app
  (Oswald, gros chiffres). Step5 gagne aussi le sous-titre "· Aperçu".
- **Safety net débordement boutons** (`components/Button.tsx`) : `whitespace-nowrap`
  retiré au profit de `min-w-0 max-w-full leading-tight` — le bouton peut
  se rétrécir dans un flex contraint et wrapper son label au lieu de sortir
  du cadre. C'est une dégradation gracieuse (wrap 2 lignes) plutôt qu'un
  débordement horizontal. Test visuel : footer OnboardingPage + footer
  CalibrationStep tiennent en 390px.

Tests : **428 Vitest** verts (inchangé). **20 e2e** verts (workers=1).
Build OK (43.20 kB CSS / 685.31 kB JS, +0.56 CSS / +0.70 JS depuis #11e).

**Backlog Conv #11 — restant** :
- **#11g — Visualisation** (items 6, 9, 10) : plafonds mesurés visibles
  dans le catalogue + estimés pour variantes, courbe de progrès en charge
  (régression depuis prototype à vérifier), séance 0 retirée du décompte
  du cycle mais contribuant au volume hebdo.
- **#11h — Calendrier + co-construction programme** (items 11, 12) :
  déload bien placé quel que soit le jour de démarrage S1, détecteur de
  tensions de programme (full body × n séances × volume) avec arbitrages
  explicites et estim. durée séance.

## État courant — fin Conv #11e (2026-05-18)

UX de saisie des séries (items 1-3 du dump #11 bis) — `SetInput` refondu,
appliqué partout (séances normales + phase work de la Séance 0).

- **Modèle `SetEntry`** (`lib/session-runner.ts`) : `reps` et `load_kg`
  deviennent `number | null`. `null` = champ vidé par l'utilisateur, affiché
  vide à l'écran. Plus de défaut à 0 qui forçait des "07"/"08" quand on
  reprend la saisie. La sérialisation feedback (`buildSessionFeedback`) et
  le commit Séance 0 (`CalibrationStep.handleCommit`) skippent les sets
  avec `reps === null` ou `load_kg === null` (en plus de `reps <= 0`).
  `load_kg === 0` reste valide (= poids du corps).
- **Steppers +/-** pour reps (step 1) et effort (step 0.5, min 6, max 10) :
  boutons − et + flanquent l'input. Tap targets ≥ 44px (h-11). Clamping
  automatique aux bornes. Pas de stepper pour kg (charge libre).
- **Lock après coche** : quand `entry.done === true`, tous les inputs
  (reps, kg, effort) + steppers sont disabled. Le bouton ✓ reste
  actionnable pour déverrouiller (re-clic = uncheck). Anti-misclick demandé
  par Azur.
- **Refus de coche si champ vide** : bouton ✓ disabled tant que
  `reps === null || load_kg === null` (sauf BW pur où load est ignoré).
  Title-tooltip explicite "Renseigne reps et charge avant de valider".
- **Charge ajoutée — toggle "Poids du corps"** :
  - `BODYWEIGHT` pur (pompes, dips bodyweight, …) → badge non-éditable
    "Poids du corps" à la place de l'input kg. `load_kg` ignoré au commit.
  - `BODYWEIGHT_LOADED` / `BODYWEIGHT_ASSISTED` (lestables/assistés) →
    input kg + chip "PdC" à droite du label. Toggle ON = `load_kg = 0`
    (highlight sang) ; toggle OFF = repasse à `null` (input vide).
  - autres charges (barre, dumbbell, machine, câble) → input kg standard.
  - `chargeType` propagé via prop : depuis `SessionRunner` (catalog.get)
    et depuis `CalibrationStep` (`currentEx.charge`).
- **Layout** : flex 1 ligne, S# en label compact, steppers reps/effort
  étirables (`flex-1`), kg étirable aussi. Mobile 390px tient.
- **Testids préservés** : `set-row-${i}`, `toggle-done-${i}`,
  `input-reps-${i}`, `input-rpe-${i}`, `input-load-${i}` ; nouveaux :
  `stepper-dec-reps-${i}`, `stepper-inc-reps-${i}`, idem rpe,
  `toggle-bw-${i}`, `bw-badge-${i}`.
- Tests : **428 Vitest verts** (+3 sur null skip + bodyweight ok dans
  buildSessionFeedback). **20 e2e verts** (workers=1 — en parallèle
  certains tests catalogue/profil flakent au timeout 30s sur cette
  machine, pas un régression). Build OK (42.64 kB CSS / 684.61 kB JS,
  +0.23 CSS / +2.87 JS depuis le patch logo).

**Backlog Conv #11 — à venir** :
- **#11f** — Refonte onboarding/calibration (item 4), logo Kotsh persistant
  (item 7), audit des largeurs (item 8), "Je teste" en mode prio (item 5).
- **#11g** — Visualisation : plafonds dans catalogue (item 9), courbe de
  progrès en charge (item 10), retrait séance 0 du décompte de cycle
  (item 6).
- **#11h** — Calendrier (déload bien placé, item 11) + co-construction
  programme avec estim. durée séance et arbitrages explicites (item 12).

## État courant — fin Conv #11d (2026-05-18)

- **Prompt MAJ PWA** (`components/UpdatePrompt.tsx`) monté dans `AppShell`,
  alimenté par `useRegisterSW` de `virtual:pwa-register/react`. Passage de
  `registerType: 'autoUpdate'` → `'prompt'` dans `vite.config.ts`. Quand le
  SW détecte une nouvelle version, bannière en bas-droite avec boutons
  "Mettre à jour" / "Plus tard". Le reload préserve IndexedDB.
- **Perf suite de tests** (commit 8438e47 — détails dans le commit).
- **Décision durable post-#11d** : la sync cloud devient prioritaire post-V1
  (au-delà du V1.5 originel). Raison : un utilisateur iOS a perdu toutes ses
  données après "Effacer historique Safari" — irréparable côté client (aucune
  API web ne résiste à cette commande système Apple). Direction visée :
  Supabase (gratuit ≤500MB, offline-first conservé, snapshot JSON last-write-wins
  puisque mono-utilisateur).

**Patch logo "disque de poids" (2026-05-18, post-#11d)**

- `public/icon.svg` + `public/icon-maskable.svg` : le `<circle>` rouge sang
  plein du logo K (point en haut à droite) est remplacé par un disque-de-poids
  (anneau via `stroke` épais, outer r=54, hole r=13). Approche `stroke` au
  lieu de `fill-rule="evenodd"` car `@resvg/resvg-js` ignore evenodd au
  rendu PNG (le trou disparaissait à la génération d'icônes).
- `pages/WelcomeScreen.tsx` : le `<span>o</span>` Oswald sang-500 du titre
  "Kotsh" devient un SVG inline du même disque-de-poids (viewBox 100×100,
  `<circle cx=50 cy=50 r=31 stroke-width=38>` → outer r=50, hole r=12),
  taille `h-[0.62em] w-[0.62em]` pour matcher la cap du 'o' Oswald bold 7xl,
  aligné en `align-baseline`. Signature de marque unifiée entre logo PWA
  et logo type.
- PNG régénérés via `npm run generate-icons`. Build OK (42.41 kB CSS /
  681.74 kB JS, +0.58 CSS / +3.74 JS depuis #11c — gain mineur).

## État courant — fin Conv #11c (2026-05-17)

Refonte visuelle complète, pistes A→D (pas E ce coup-ci). Cosmétique
pure — pas de Vitest dédié, sanity check : **425 tests verts**, build OK.

- **Piste A — graphite chaleureux + texture brossée** (`tailwind.config.ts`
  + `index.css`) :
  - Nouvelle palette `graphite` (gris infusé brun-rouge) : 700→950 (`#3a2f2a`
    → `#16110f`). Utilisée pour `body` background + TabBar/Header en
    sur-couche translucide.
  - Les cards/inputs restent en `anthracite` (gris froid) → contraste subtil
    fond/surfaces, plus organique.
  - 2 couches de texture sur `body` : `::before` grain SVG (0.05 opacity,
    z -2) + `::after` brushed metal SVG (stries horizontales 0.07 opacity,
    z -1, blend overlay). `#root::before` = vignette radiale sang très
    discrète en top.
- **Piste B — rouge structurel partout** :
  - `Card.tsx` : nouvelle prop `accent` (barre verticale gradient
    sang-500→800 à gauche). Shadow par défaut : `shadow-card-soft` (inset
    blanc top + **reflet sang en bas** + ombre extérieure douce) → toute
    card a une signature rouge permanente discrète.
  - `Button.tsx` : variants en gradients (primary sang-600→800, secondary
    anthracite-700→800, danger sang-700→900), `shadow-glow-sang` au
    hover/focus, ring-2 sang au `focus-visible`.
  - `TabBar.tsx` : tab actif → fond gradient sang-900/30 + label sang-400
    en font-medium + barre haute gradient sang avec `shadow-glow-sang`.
  - `StepIndicator.tsx` : barre étape active en gradient sang-500→700 +
    `shadow-glow-sang-lg`. Étapes done en sang-700 plein. Label actif
    sang-400.
  - `HelpButton.tsx` : fond `bg-sang-900/40`, bordure `border-sang-700/40`,
    "?" en sang-300 (anciennement anthracite).
  - `SetInput.tsx` : numéro de série (S1/S2…) en font-display sang-400
    quand done, sinon anthracite-300. Select Effort colorisé selon RPE
    (anthracite ≤7, amber 7.5-8, sang 8.5-9, sang vif >9). Bouton ✓ done en
    gradient sang-500→700 + `shadow-glow-sang`. Inputs reps/charge avec
    `focus:border-sang-700/50`.
  - `SessionRunner.tsx` : Card "session-progress" en `accent`, label séance
    en `font-display text-2xl`, compteur done/total en `font-display
    text-3xl` (done en sang-400, total en anthracite-400).
  - `Header.tsx` : bordure basse `border-sang-700/25`, fond
    `graphite-950/85 backdrop-blur-md`.
- **Piste C — profondeur + glassmorphism** :
  - `shadow-card-soft` + `shadow-glow-sang` + `shadow-glow-sang-lg`
    définis dans `tailwind.config.ts`.
  - `Sheet.tsx` : backdrop overlay en `bg-black/70 backdrop-blur-md`,
    sheet en `bg-anthracite-900/85 backdrop-blur-xl`, bordure haute
    `border-sang-700/30`, ombre extérieure haute.
- **Piste D — police display + grands chiffres** :
  - Police display = **Oswald** (Conv #11c bis : remplace Anton qui ne
    distinguait pas les majuscules/minuscules — feedback Azur). Condensée
    avec vraies minuscules, weights 500/700 chargés via
    `@fontsource/oswald`. `tailwind.config.ts` : `fontFamily.display`.
  - `Header.tsx` titre en `font-display text-2xl uppercase tracking-[0.06em]`.
  - `WelcomeScreen.tsx` : "K**o**tsh" en `font-display text-7xl font-bold`,
    le **o** en `text-sang-500` (évoque le disque de poids — clin d'œil
    discret, signature de marque).
  - `SessionRunner` + `SetInput` : grands chiffres tabular en font-display.
- Tests : sanity **425 Vitest verts** (pas de régression). Build OK :
  **41.83 kB CSS / 678 kB JS** (+3.7 CSS / +0.3 JS depuis #11b). Précache
  PWA gonflé à 1144 kB par les multiples weights/scripts d'Oswald
  (vietnamien, cyrillique, latin-ext chargés à la demande par le navigateur
  via unicode-range — peu téléchargés en pratique).

**Backlog Conv #11 — restant** :
- **#11d ou #11c'** — piste E (transitions sur cochage, progress ring
  autour des exos, haptics Vibration API, animations courbes Bilan).
  Laissé en suspens — Azur réévalue après revue visuelle des A→D.

## État courant — fin Conv #11b (2026-05-17)

Aperçu programme + personnalisation des variantes en onboarding
(2e item du dump #11) :

- **Nouveau Step 5 "Aperçu"** dans le wizard onboarding
  (`pages/onboarding/Step5Preview.tsx` + `OnboardingPage` étendu à 5 étapes).
  Affiche les séances générées (1 carte par jour), pour chaque exo :
  icône pattern + nom + nb séries + muscles primaires + bouton "Variantes".
  Le bouton ouvre `VariantPickerSheet` (réutilisé Conv #4c/#10d) avec
  toggle "mode élargi" pour voir tous les exos ciblant le muscle. Adapté
  au nb de séances/sem (2 à 6) puisqu'il itère sur `template.days`.
- **Préview en mémoire pure** (`lib/onboarding-preview.ts`) — aucune
  écriture en DB tant que l'utilisateur n'a pas validé Step5.
  `buildPreviewTemplate(profile, muscleGoals, programmeId, catalog)` :
  construit un `UserState` temporaire via `engine.startUser` puis appelle
  `fitGuidedProgram` ou `generateCyclePlan`. `applyVariantsToTemplate`
  applique les swaps sur une copie (conserve base_sets / progression /
  role / intensity_scheme). `weeklyVolumeByMuscle` somme les séries par
  muscle primaire pour le récap. `muscleDeltaForSwap` calcule lost/gained
  primaires pour l'avertissement.
- **Avertissement non-bloquant** : si un swap retire des muscles
  primaires (ex : traction → tirage vertical perd les biceps), un
  bandeau amber sous le slot signale la perte avec le label des muscles
  concernés. Non bloquant ; pas de suggestion auto d'exo compensatoire
  (à creuser ultérieurement si Azur juge ça nécessaire).
- **Transparence** : panneau "Volume hebdo par muscle (semaine 1)" en
  haut du Step5 (chiffres bruts, pas d'algo expliqué). Panneau dépliable
  "Comment ça marche ?" en option (RPE / autorégulation / progression
  5 sem / remplacement en séance — court).
- **Finalize étendu** (`OnboardingPage.finalize`) : `startUser` →
  `generateInitialCyclePlan` (force la pose du plan immédiatement) →
  `applyVariantReplacements` (nouveau, cf. ci-dessous) → navigate vers
  `/seance-0` ou `/programme` selon `requires_calibration`. Auparavant on
  ne faisait que `startUser` et c'est `Seance0Page` qui posait le plan.
- **`useEngine.applyVariantReplacements`** (nouveau, durable) : mute
  `current_cycle_plan.days[di].exercises[pi].exercise_id` pour chaque
  replacement, persiste via `txSaveUserStateOnly`. **Ne touche pas**
  `requires_calibration` (contrairement à `commitInitialCalibration`
  qui le flip false). Idempotent : liste vide ou plan null → no-op.
- **Tests Playwright** : 6 specs touchées (ajout d'un `btn-next` Step
  4→5 + `btn-finish` Step 5). 20 e2e verts.
- Tests : **425 Vitest** verts (+10 nouveaux sur `onboarding-preview` :
  buildPreviewTemplate custom + guidé, no-mutation, weeklyVolumeByMuscle,
  applyVariantsToTemplate preserve fields, muscleDeltaForSwap).
  `npm run build` OK (28.14 kB CSS / 675.7 kB JS, +0.1 CSS / +8.7 JS).
  Suite e2e Playwright **20/20 verte**.

**Backlog Conv #11 — restant** :
- **#11c — Refonte visuelle complète** : pistes A (graphite chaleureux +
  brushed metal), B (rouge structurel + gradient RPE + halos), C
  (profondeur + glassmorphism sheets + bordures lumineuses), D (font
  display Anton + gros chiffres + silhouettes background), E
  (transitions + progress ring + haptics). Probablement à splitter en
  #11c/#11c'.

## État courant — fin Conv #11a (2026-05-17)

Bundle séance & inter-séance + fix Progrès (1er morceau du 2e dump Azur) :

- **Cochage séquentiel des séries** (`pages/seance/SetInput.tsx`) : nouveau prop
  `checkLocked` câblé dans `SessionRunner` (`j > 0 && !entrySets[j-1].done`).
  Le bouton ✓ est désactivé (curseur not-allowed + style gris) tant que la
  série précédente n'est pas validée. Les inputs reps/charge/effort restent
  éditables — on peut renseigner d'avance. `data-locked` exposé sur la row.
- **Dette de volume hebdo** (`state.weekly_volume_debt: Record<string, number>`) :
  - Nouveau champ sur `UserState` (`models.ts` + `makeUserState`), sérialisé/
    désérialisé en optional (rétrocompat anciens blobs + exports JSON).
  - `engine.applyMissedVolumeToDebt(state, catalog, plan, feedback)` :
    accumule `setsManques = prescrits - faits` par muscle primaire de chaque
    exo. Appelé depuis `recordFeedback(..., {plan})`.
  - `consumeWeeklyDebt(plan, state, catalog)` (private, appelé en fin de
    `generateSession`) : pour chaque muscle avec dette, ajoute des séries
    aux exos qui le couvrent en primaire. Cap par exo = `max(1, ceil(0.3 ×
    base_sets))`. Décrémente la dette de chaque muscle primaire des exos
    modifiés. Pas explicite côté UI — c'est juste un rattrapage silencieux
    sur les séances restantes de la semaine.
  - `endOfWeek` reset `weekly_volume_debt = {}` (un manque ponctuel n'est
    pas grave en RPE-based, on repart propre).
  - `useEngine.recordFeedbackAndCommit` passe `currentSessionPlan` au moteur.
- **Rotation forcée A→B→C** (`pages/seance/StartSessionList.tsx`) : les jours
  déjà faits cette semaine sont `disabled` tant qu'il reste un autre jour
  non fait (`lockedThisWeek`). Quand tous ont été faits ≥1 fois,
  déverrouillage global pour permettre un 2e tour. Header reformulé pour
  refléter l'état. `data-locked` exposé. `PlanDaySheet` non touché — la
  programmation de jour futur reste libre (semaine prochaine).
- **Bug barres V_min/V_max illisibles dans Progrès** : la "bande grise"
  `anthracite-700/60` se fondait dans le fond `anthracite-900` (contraste
  quasi nul). Remplacée par **2 lignes pointillées horizontales** qui
  traversent toute la ligne du muscle : `border-dashed sang-400/80` pour
  V_max, `border-dashed anthracite-200/60` pour V_min. Légende sous le
  tableau refondue avec swatches. Nouveaux testids `vmin-line-${muscle}` /
  `vmax-line-${muscle}`.
- **Équilibrage A/B/C non touché** : analyse code = custom équilibre par
  construction (chaque muscle traité indépendamment via `composeSession`),
  guidé hérite de l'asymétrie choisie par le concepteur du programme. À
  reprendre seulement si Azur valide un cas concret d'asymétrie injustifiée.
- **Schéma Zod export** (`io/schema.ts`) : `weekly_volume_debt` ajouté en
  `.optional()` pour rétrocompat avec exports antérieurs à Conv #11a.
- Tests : **415 Vitest verts** (+4 nouveaux : applyMissedVolumeToDebt
  accumule par muscle, consumeWeeklyDebt applique le cap, endOfWeek reset
  debt, startUser init debt = {}). `npm run build` OK (28.01 kB CSS / 667 kB JS,
  +0.2 CSS / +3 JS). E2e Playwright non relancée (touché structurel
  léger — engine.recordFeedback signature étendue avec options optionnelles,
  rétrocompat).
- **API engine #11a (durable)** : `engine.applyMissedVolumeToDebt(state,
  catalog, plan, feedback)`, `engine.recordFeedback(state, catalog,
  feedback, options?: {plan})`.

**Backlog Conv #11 — à venir** :
- **#11b — Onboarding preview programme** : Step 5 aperçu adapté au nb de
  séances (2/3/4/5/6), variantes par slot via `VariantPickerSheet` existant,
  bandeau rééquilibrage si swap change profil musculaire, panneau "Volume
  hebdo par groupe" + "Comment ça marche" optionnel déroulable.
- **#11c — Refonte visuelle complète** : pistes A (graphite chaleureux +
  brushed metal), B (rouge structurel + gradient RPE + halos), C (profondeur
  + glassmorphism sheets + bordures lumineuses), D (font display Anton +
  gros chiffres + silhouettes background), E (transitions + progress ring +
  haptics). Probablement à splitter en #11c/#11c'.

## État courant — fin Conv #10d (2026-05-16)

Bundle Catalogue + Séance + Planning (dump initial Azur + ajout en cours
de conv) :

- **Aliases / synonymes d'exos** : nouveau module
  `src/data/exercise-synonymes.ts` (Record id → string[]) mergé au chargement
  par `loadExercises()`. Couvre abréviations FR (DC, SDT, RDL, OHP, GHR, …)
  et noms anglais usuels (bench press, squat, deadlift, …) sur ~110/141 exos.
  `Catalog.search_fuzzy` retravaillé : fold accents (`developpé` ↔ `developpe`)
  + match multi-tokens (tous les tokens doivent matcher au moins un champ).
  Le JSON `src/data/exercises.json` reste inchangé — pas de duplication avec
  `prototype/data/exercises.json`. Parité Python triviale (recherche UI-only).
- **Élargissement `alternativeVariantsFor`** (`lib/calibration.ts`) : nouveau
  paramètre `options.expand`. Mode strict (défaut) = même `subst`. Mode
  élargi = tout exo qui partage ≥1 muscle primaire. Toggle "Voir tous les
  exos ciblant ce muscle" dans `VariantPickerSheet` (sheet refactorée pour
  porter `expanded` + `onToggleExpand` + `title` configurable).
- **Fiche exo détaillée** : `CatalogueDetailSheet` et `ExerciseDetailSheet`
  refondues sur la même structure — silhouette face+dos `view="both"`
  centrée en tête (h-44 à h-56), chips type/pattern/charge, description,
  muscles primaires (chips sang), synergistes (chips anthracite), bloc
  "Recommandations" (reps hyper/force, repos, difficulté), matériel requis
  (nouveau `equipLabel` dans `catalog-filter.ts` : 30 codes equip → labels
  FR humains), variantes/tags.
- **Remplacement d'exo pendant la séance** : nouvelle fonction
  `replaceSessionItem` dans `engine/engine.ts` (recalcule la prescription
  avec `buildPrescription` pour le nouvel exo, conserve le nb de séries),
  exposée via `useEngine.replaceSessionExercise` (persiste via nouveau
  `txUpdateSessionPlan`). `ExerciseDetailSheet` accepte un prop `onReplace`
  optionnel → si fourni, affiche bouton "Remplacer cet exo" qui ouvre un
  `VariantPickerSheet` (mode `expand=true` par défaut). `SessionRunner`
  câble le callback. `SeancePage` utilise `useRef` pour préserver les
  entries cochées des autres exos lors du remplacement.
- **Lock séance hors-jour + mode preview** : sépare planification et
  démarrage. Nouvelles fonctions `useEngine.planSessionForDay` (crée + persiste
  status=planned, **ne charge pas** le store) et `loadPlannedSessionForRunner`
  (lit depuis DB, refuse si `seance_date !== today`). `PlanDaySheet` refondue :
  free-future → "Programmer" (pour jour futur) ou "Programmer et commencer"
  (pour today) ; planned today → preview exos + "Démarrer la séance" ; planned
  future → preview read-only + "Annuler la séance" ; planned past → "non faite"
  + "Annuler". `generateAndStoreSession` (compat) = plan + load combinés.
- **Annulation de séance planifiée** : nouveau `txCancelSession` (delete
  row) + `useEngine.cancelPlannedSession`. Bouton "Annuler cette séance"
  dans `PlanDaySheet` pour tout jour planned.
- **Recommandations repos sur la vue semainière** : `CalendarDay` étendu
  avec `restSuggested: boolean` + `recentMuscles: readonly string[]`.
  `buildCalendarMatrix` reçoit un nouveau param optionnel `catalog: Catalog | null`
  pour calculer les muscles primaires de la veille. Affichage dans `DayCell`
  (overlay amber + lettre Z) pour les jours `free-future` dont la veille est
  active. `PlanDaySheet` montre un avertissement "RestWarning" listant les
  muscles travaillés hier.
- Tests : **411 Vitest** verts (+15 nouveaux : 5 catalog search fuzzy aliases,
  5 calibration alternativeVariantsFor expand/strict, 2 engine replaceSessionItem,
  3 dashboard restSuggested). `npm run build` OK (27.8 kB CSS +1.3 / 664 kB JS
  +21.6). Suite e2e Playwright **non relancée** dans cette conv (stratégie
  "structurel touché en fin de conv seulement") — à valider en suivant si
  régression remontée.
- **API engine** Conv #10d (durable) : `engine.replaceSessionItem(plan, idx,
  newExId, state, catalog) → SessionPlan` ; `db/transactions.txUpdateSessionPlan`,
  `txCancelSession`.
- **API useEngine** Conv #10d (durable) : `planSessionForDay`,
  `loadPlannedSessionForRunner`, `replaceSessionExercise`, `cancelPlannedSession`.
  `generateAndStoreSession` reste exposée (compat) mais c'est désormais une
  composition `planSessionForDay + load` pour démarrage immédiat.

## État Conv #10c' (2026-05-16) — archive

Bug fix bundle suite retours d'usage post-#10c :

- **Bug reprise Séance 0 en mode custom** : si l'utilisateur quittait l'app
  entre la fin de l'onboarding et la Séance 0, à la réouverture la
  redirection vers `/seance-0` ne se faisait pas — `ProgrammePage`
  s'appuie sur `current_cycle_plan.requires_calibration`, mais
  `generateCyclePlan` (custom) laissait ce flag à `false` (seul
  `fitGuidedProgram` le posait). Fix dans
  `hooks/useEngine.ts:generateInitialCyclePlan` : après la branche
  custom, on appelle `pickCalibrationExercises` et on flip
  `requires_calibration=true` si la liste est non vide.
- **Bug drag-and-drop onboarding** : sur mobile, le drag de réorganisation
  des muscles prioritaires (`Step2Muscles` / `@dnd-kit/core`
  `PointerSensor`) ne déclenchait pas — le touch était consommé comme
  scroll natif. Fix : `touch-none` (Tailwind → `touch-action: none`)
  sur le bouton drag handle.
- **Bug silhouette fessiers** : exos qui ne ciblent que les fessiers
  (ex : kickback poulie, hip thrust) affichaient la face. `fessiers`
  était mappé à la fois dans `CO_TO_FACE` (`abductors`) et `CO_TO_BACK`
  (`gluteal+abductor`) → égalité de score → `pickBestSide` retournait
  `face` par défaut. Fix : retrait de `fessiers` de `CO_TO_FACE`.
  Les fessiers ne sont plus highlightés que côté dos — cohérent avec
  l'anatomie.
- **UX repos** : `SessionRunner.tsx` affichait `repos 90s`. Nouveau
  helper `formatRest(seconds)` exporté depuis `lib/session-runner.ts` :
  < 60 s → `45 s`, multiple de 60 → `2 min`, sinon → `1 min 30 s`.
- **Bug orthographe "Cible le les pectoraux"** : `buildDescription`
  (`lib/catalog-filter.ts`) préfixait par `'le'`/`'les'` alors que
  `muscleLabel` renvoie déjà le label avec article ("les pectoraux",
  "le dos en largeur"). Résultat : "Cible le les pectoraux." → réparé
  en supprimant le préfixe.

Tests : **396 Vitest + 20 e2e** verts, aucune régression.
`npm run build` OK (27.5 kB CSS / 643 kB JS).

**Point deltos antérieurs (laissé en l'état, choix scientifique)** :
Azur a remonté l'asymétrie `deltos_lateraux` + `deltos_posterieurs`
sans `deltos_anterieurs` dans les muscles cibles. C'est volontaire —
`deltos_anterieurs` est dans `SYNERGISTES_SANS_QUOTA` (cf. `models.ts:144`)
parce qu'il est saturé par tout push horizontal (pectoraux). Le compter
en quota séparé créerait du sur-volume systémique. Le catalogue
reflète bien ça : aucun exo n'a `deltos_anterieurs` comme **seul**
primaire — toujours en duo avec `deltos_lateraux` (presses verticales).
Pas de fix code, doc/réponse seulement.

## État Conv #10c (2026-05-16) — archive

- **Refonte Séance 0** : chaque exo de calibration enchaîne maintenant
  2 phases sur le même écran. Phase **measure** = test plafond (1RM connu
  ou submax, comme avant). Phase **work** = 2 séries de travail
  pré-remplies via `buildPrescription(exercise, e1rm, profile, week, {muscleGoals, state})`
  (charges déduites du plafond fraîchement mesuré, RPE cible selon
  `targetRpeForExercise`). L'user ajuste, coche « ✓ » ce qu'il a fait,
  puis « Exo suivant ». Navigation : en **work**, « Modifier le plafond »
  rebascule en **measure** (même exo) ; en **measure**, « Précédent »
  revient à l'exo précédent. La phase est exposée via
  `data-phase="measure"|"work"` sur `[data-testid=calibration-step]`.
- **Persistance feedback** : à la finalisation,
  `Seance0Page.finalize()` appelle `commitInitialCalibration` puis,
  si au moins 1 série est cochée, `recordFeedbackAndCommit` avec un
  `SessionFeedback {label: "Séance 0"}`. Le moteur raffine les e1RM
  via Epley sur ces séries → calibration plus fine que le seul test
  plafond. L'historique commence donc avec une vraie séance.
- **Nouveaux testids** : `btn-work-back`, `btn-work-next`,
  `work-recap`, et `set-row-*` (réutilisés de SetInput) en phase work.
  L'attribut `data-phase` sur `calibration-step` permet d'assert la
  phase. Tous les `fillSubmaxAndNext` des spec e2e ont été mis à jour
  pour cliquer `btn-next` puis `btn-work-next` (skip working sets).
- **Polish bundle** :
  - `Button` gagne `whitespace-nowrap` + `gap-1.5` par défaut →
    plus de wrap "Précédent" sur 2 lignes.
  - Nouveau module `src/components/icons.tsx` : `ChevronLeft` /
    `ChevronRight` (SVG 16×16 currentColor, strokeWidth 1.75,
    `align-text-bottom`). Remplacent les Unicode `←`/`→` dans
    `OnboardingPage` (Précédent / Suivant), `CalibrationStep` (les 4
    boutons primary/secondary des 2 phases) et `ProgrammePage`
    (chevron du bandeau "Cycle terminé").
- Tests : **396 Vitest + 20 e2e** verts (1 nouveau spec couvre la
  phase work). `npm run build` OK (27.5 kB CSS +0.9 / 643 kB JS +4).
- **Nouveau type public** : `CalibrationWorkingSet` exporté depuis
  `CalibrationStep.tsx`. `CalibrationStepValue` étend désormais avec
  un champ `workingSets: ReadonlyArray<CalibrationWorkingSet>`.

### Backlog Conv #10 — à reprendre en nouvelle conv

**#10d — Catalogue (items 5, 6, 7 dump initial)** — à faire maintenant.
1. **Fiche exo** (`pages/catalogue/CatalogueDetailSheet.tsx` + `ExerciseCard.tsx`) :
   silhouette `AnatomicalSilhouette` au premier plan, grand format centré ;
   descriptif détaillé dessous (exécution, erreurs courantes, muscles
   primaires/synergistes, matériel, variantes). Actuellement silhouette
   trop petite et description riquiqui.
2. **Aliases** : ajouter `aliases: string[]` sur chaque entrée de
   `src/data/exercises.json` (et côté Python `prototype/data/exercises.json`
   en miroir, parité). Recherche du catalogue (`catalog-filter.ts`) doit
   matcher sur le nom + tous les aliases.
3. **Remplacement libre** : actuellement `alternativeVariantsFor`
   (`lib/calibration.ts`) ne propose que les variantes du même *pattern*.
   Élargir à "muscle primaire en commun" avec un toggle "voir tous les
   exos ciblant X".

---

## État Conv #10b' (2026-05-16) — archive

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
