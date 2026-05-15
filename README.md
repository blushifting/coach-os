# kotsh

PWA d'aide à la musculation autorégulée RPE-based, 100 % locale (téléphone seul,
IndexedDB, export JSON manuel, pas de cloud, pas de compte).

> *« kotsh »* est le nom utilisateur. Le repo et le code interne gardent le nom
> de développement *coach-os* (chemin GitHub Pages, identifiants Zustand/Dexie).

## Installation sur ton téléphone

L'app est publiée sur GitHub Pages à <https://blushifting.github.io/coach-os/>.

- **iOS (Safari)** : ouvre le lien → bouton Partager → « Ajouter à l'écran
  d'accueil ».
- **Android (Chrome)** : ouvre le lien → menu ⋮ → « Installer l'application »
  (ou bandeau d'installation en bas).

Une fois installée, l'app fonctionne **hors-ligne**. Toutes tes données restent
sur ton téléphone (IndexedDB), aucune n'est envoyée ailleurs.

## Quickstart dev

```bash
# Pré-requis : Node ≥ 20.
npm install
npm run dev      # serveur Vite local
npm run test     # Vitest (one-shot)
npm run build    # bundle dist/ (préfixé /coach-os/ pour GitHub Pages)
```

## Structure

```
src/
├── engine/      # port TypeScript du prototype Python (source de vérité)
├── data/        # exercises.json (catalogue ~141 exos)
├── layout/      # AppShell, Header, TabBar, TabbedLayout
├── pages/       # une route = un dossier
└── main.tsx
public/          # icônes PWA, manifest source
tests/unit/      # tests Vitest miroirs des tests pytest du prototype
tests/playwright/ # tests e2e (Chromium, viewport 390×844)
```

Voir [CLAUDE.md](./CLAUDE.md) pour les conventions, le plan de travail et les
pointeurs vers la doc.
