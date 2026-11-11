# CLAUDE.md — dépôt `coach-os` (application Kotsh)

Conventions de code uniquement. Les consignes de travail (règles, chantier en
cours, mémoire) sont dans le dossier de documentation, d'où les sessions sont
lancées : `C:\Users\antoi\OneDrive\Desktop\Kotsh\CLAUDE.md`.

L'ancien contenu de ce fichier (états courants des convs #8 à #17, 2 100 lignes)
reste consultable par `git show b44fcd1:CLAUDE.md`.

## Stack
| Couche | Choix |
|---|---|
| Interface | React 18, TypeScript strict, Tailwind 3 (palette anthracite + sang) |
| Build | Vite 5, `base: '/coach-os/'`, PWA par `vite-plugin-pwa` |
| État | Zustand 5 (store moteur) + store d'authentification séparé |
| Persistance | Dexie 4 (IndexedDB) ; sauvegarde en ligne Supabase (instantané JSON) |
| Validation | Zod 3 (schéma versionné d'export / import) |
| Routage | React Router 6 |
| Tests | Vitest 2 (unitaires, intégration), Playwright (parcours, Chromium 390×844) |

## Organisation de `src/`
- `engine/` — moteur pur, sans dépendance à l'interface : prescription, feedback,
  volume, génération de programme, cycle de vie.
- `hooks/useEngine.ts` — **toute mutation de l'état passe par là** et est
  persistée dans la même opération.
- `lib/` — calculs pour les écrans (progrès, tableau de bord, séance), sauvegarde,
  démo. `store/` — état global et sélecteurs. `db/`, `io/` — base locale, import/export.
- `pages/`, `components/`, `layout/` — interface. `data/` — catalogue d'exercices.
- Tests : `tests/unit`, `tests/db`, `tests/io`, `tests/store`, `tests/e2e`
  (Vitest) et `tests/playwright` (Playwright).

## Conventions
- Français partout : commentaires, noms de tests, messages d'erreur, interface, commits.
- `camelCase` pour le code, `PascalCase` pour composants et types, `kebab-case`
  pour les fichiers d'interface, `snake_case` pour les fichiers de données et les
  **clés JSON persistées**.
- Imports par l'alias `@/…` (= `src/…`).
- `null` plutôt que `undefined` pour une valeur absente dans le modèle.
- ESLint (config plate) et Prettier.

## Commandes
| Commande | Effet | Durée mesurée (2026-11-11) |
|---|---|---|
| `npx vitest run --reporter=dot` | tous les tests unitaires et d'intégration (723) | ~4 s |
| `npm run build` | vérification des types (`tsc -b`) puis bundle | ~8 s |
| `npx playwright test --workers 1` | parcours de bout en bout (26) | lent |
| `npm run dev` | serveur de développement (port 5173, chemin `/coach-os/`) | |
| `npm run demo:generate` | régénère la démo `public/demo/alex.json` | |
| `npm run check:rls` | vérifie de l'extérieur la sécurité de la base en ligne | |

## Pièges connus
- **Vitest ne vérifie pas les types** (il passe par esbuild). Un test vert ne dit
  rien d'une erreur de type : `npm run build` avant chaque commit.
- **Sans `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, toute la couche en ligne
  est inerte.** C'est ce qui protège le développement et les tests ; la
  configuration de test neutralise ces variables, ne pas retirer cette protection.
- **Un push sur `main` déploie en production** (`.github/workflows/deploy.yml`).
  Le déploiement lance Vitest avant le build : un test rouge bloque la mise en ligne.
- Dans un écran, la date du jour vient de `useToday()`, jamais de `new Date()`
  (la démo est ancrée à une date fixe).
- Le catalogue d'exercices vit dans plusieurs fichiers de données à garder
  synchronisés (voir la mémoire `project_import_exos.md`).
- Ce dépôt ne doit jamais être déplacé dans OneDrive (corruption de
  `node_modules` et de `.git`).
- Des en-têtes de modules disent encore « Port 1:1 de … .py » : le prototype
  Python n'est plus une référence, ces commentaires sont périmés.

## Git
Commits atomiques, messages en français, jamais de push forcé sur `main`.
Commit et push uniquement sur signal d'Azur. Le message de commit porte le récit
de la livraison (ce qui a changé et pourquoi).
