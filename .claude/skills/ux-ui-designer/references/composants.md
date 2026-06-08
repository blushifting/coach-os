# Génération de composants (React / Tailwind)

> Comment produire un composant Coach OS on-brand, accessible et mobile-first, sans réinventer le style à chaque fois. Adapter aux conventions réelles du repo (à lire avant de coder).

## Avant de coder

1. **Lis le repo.** Repère la stack exacte (React + Vite + Tailwind d'après le plan), la structure des composants existants, et **où vivent les tokens** (config Tailwind, variables CSS, ou fichier de thème). Réutilise l'existant — ne crée pas un système parallèle.
2. **Vérifie s'il existe déjà** un composant proche. Étends ou compose plutôt que dupliquer (cohérence + maintenance).

## Principes de composant

- **Tokens, jamais de valeurs en dur.** Couleurs, espacements, radius viennent du design system (`design-system.md`). Pas de `#1f1f1f` ni de `margin: 13px` au hasard.
- **Mobile-first.** Conçois pour le petit écran d'abord, élargis ensuite. La cible est le téléphone à la salle.
- **Accessible par défaut.** Cibles tactiles ≥ 44 px, focus visible, contraste conforme, `aria-label` sur les boutons icône, structure sémantique (`button` pour une action, pas une `div` cliquable). Voir `accessibilite.md`.
- **Tous les états.** Défaut/pressé/focus/désactivé/chargement/erreur (voir design-system). Un composant sans état pressé donne une sensation « morte » en usage tactile.
- **Props minimales, défauts sûrs.** Le composant doit s'utiliser sans config et bien se comporter par défaut. Pas de prop obligatoire sans valeur par défaut raisonnable.
- **Texte = placeholder.** Mets un libellé correct mais signale qu'il faut le passer au skill `ux-writer-coach-os`. Ne fige pas le wording ici.

## Squelette type — exemple : bouton d'action principale

```tsx
type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

export function Button({ children, onClick, variant = "primary", disabled }: ButtonProps) {
  const base =
    "min-h-[44px] px-5 rounded-xl font-medium tabular-nums transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 " +
    "disabled:opacity-40 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-red-700 text-zinc-100 active:bg-red-800",
    secondary: "bg-zinc-800 text-zinc-100 border border-zinc-700 active:bg-zinc-700",
  };
  return (
    <button className={`${base} ${variants[variant]}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
```

Ce squelette illustre les non-négociables : hauteur de cible ≥ 44 px, focus visible avec offset sur le fond sombre, chiffres tabulaires, état pressé (`active:`), état désactivé perceptible, variantes via tokens. Adapte la syntaxe (Tailwind v3/v4, cva, clsx…) aux conventions réelles du repo.

## Validation & complétion (pattern Coach OS)

- Une **série réalisée** se marque par une **coche verte + halo vert** autour de la ligne (vert = « c'est fait », jamais rouge — voir design-system).
- Quand **toutes les séries d'un exo sont faites**, l'exo se **replie (collapse)** automatiquement pour dégager l'écran sur ce qui reste — avec un **moyen clair de le ré-ouvrir** (tap sur l'en-tête, chevron). Le collapse range l'info, il ne l'efface jamais.
- La couleur ne suffit pas : la **coche** (icône) + le **repli** portent l'état autant que le vert (accessibilité).

## Affordance — ce qui est cliquable doit se voir

- Un élément interactif **se signale** visuellement : un libellé-lien porte un indice (soulignement, **soulignement pointillé** pour l'aide « pour comprendre »/« en savoir plus », chevron sur une carte dépliable). On ne devine pas qu'on peut cliquer — on le voit (ex. cartes « pour qui c'est fait »).
- **Pas de cliquable dans un cliquable.** Un bouton/lien imbriqué dans une carte cliquable provoque des mis-clics. Sors le second niveau du bloc, ou crée une hiérarchie nette : la carte mène à un écran, l'action secondaire est un bouton distinct **bien espacé**.
- **Bouton retour** toujours présent et atteignable au pouce, ≥ 44 px — ne le miniaturise pas (s'inspirer du placement constant d'une app comme Revolut).
- Deux cibles proches qui se ressemblent (l'œil de visu à côté de « variantes », les ±/− de charge) : **agrandir + espacer** pour éviter le tap raté (doigts en salle).

## Composer un écran

- Une seule action principale par écran (un seul bouton rouge). Le reste en secondaire.
- Hiérarchie d'abord (taille/poids/gris), couleur en dernier (voir esthétique).
- Espacement selon l'échelle ; groupe par proximité.
- Réutilise les primitives (Button, Card, Chip, Sheet…) plutôt que de re-styliser localement.

## Checklist composant

- Tokens partout, zéro valeur en dur hors échelle ?
- Cibles ≥ 44 px, focus visible, contraste OK ?
- Tous les états présents (pressé, focus, désactivé, chargement, erreur) ?
- Élément sémantique correct (`button`/`a`/`input`) ?
- Mobile d'abord, lisible à distance de bras ?
- Texte en placeholder + renvoi au writer ?
