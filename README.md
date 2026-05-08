# Coach OS

PWA d'aide à la musculation autorégulée RPE-based, 100 % locale (téléphone seul,
IndexedDB, export JSON manuel, pas de cloud, pas de compte).

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
├── App.tsx
└── main.tsx
tests/unit/      # tests Vitest miroirs des tests pytest du prototype
```

Voir [CLAUDE.md](./CLAUDE.md) pour les conventions, le plan de travail et les
pointeurs vers la doc.
