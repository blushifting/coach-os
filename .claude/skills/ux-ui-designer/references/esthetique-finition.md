# Esthétique & finition

> Les principes de beauté visuelle, indépendants de toute direction précise. C'est ce qui sépare « cohérent mais fade » de « soigné ». Fondé sur Refactoring UI (Wathan/Schoger) et NN/g (effet esthétique-utilisabilité, hiérarchie visuelle, design minimaliste).

## Pourquoi ça compte

L'**effet esthétique-utilisabilité** : les gens perçoivent une interface jolie comme plus facile à utiliser, et tolèrent mieux ses petits défauts. Le beau achète de la confiance — décisif pour une app qui prétend te coacher sérieusement. Mais attention : le beau ne remplace pas le fonctionnel, il le sert. On ne sacrifie jamais la lisibilité d'une charge ou d'un RPE pour un effet.

## Principe 1 — Hiérarchie : tout ne peut pas être important

Si tout crie, on n'entend rien. Décide pour chaque écran **ce qui doit ressortir en premier** (souvent : la charge à faire, ou l'action principale) et **désaccentue délibérément le reste**. Le secondaire en retrait rend le primaire puissant par contraste.

Trois leviers de hiérarchie, dans l'ordre : **taille**, **poids** (graisse de police), **couleur/contraste**. N'utilise pas que la taille — un texte secondaire, c'est souvent juste « même taille, plus gris ». Évite de tout mettre en gras : si tout est gras, rien ne l'est.

## Principe 2 — L'espacement fait le pro

L'espace, c'est l'outil le plus sous-estimé. Donne de l'air. Méthode : **commence avec trop d'espace, puis retire jusqu'à être satisfait** — on atterrit presque toujours sur « juste ce qu'il faut », rarement sur « pas assez ».

- Travaille avec une **échelle d'espacement** (pas de valeurs au hasard) — voir design-system.
- Groupe ce qui va ensemble, sépare ce qui diffère (proximité = parenté, principe de Gestalt). L'espace entre groupes > l'espace dans un groupe.
- Plus de padding sur les zones tactiles et les cartes : ça respire et c'est plus facile à toucher.

## Principe 3 — Concevoir en niveaux de gris d'abord

Enlève la couleur au début. Tu es forcé de créer la hiérarchie par la **taille, le poids, l'espacement et le contraste de gris**. La couleur arrive en dernier, comme une touche, pas comme une béquille. Une interface qui marche en noir et blanc marchera en couleur ; l'inverse est faux.

## Principe 4 — Profondeur subtile

Imite la lumière réelle : **source lumineuse venant d'en haut**. Une ombre douce sous un élément le fait paraître surélevé. En dark mode, l'élévation se fait surtout par **surfaces plus claires** (un voile blanc 5–10 %) plutôt que par des ombres marquées (voir design-system). Reste subtil : des ombres dures ou trop d'effets font « cheap ».

## Principe 5 — Retenue (design minimaliste, heuristique #8)

Chaque élément en plus rivalise avec les autres et dilue l'essentiel. Avant d'ajouter, demande si c'est nécessaire **maintenant, à ce moment de la séance**. Préfère retirer. Pas de décor gratuit, pas de bordure quand un espace suffit, pas de dégradé qui n'apporte rien. Le luxe ici, c'est le vide bien placé.

## Mouvement & transitions (cohérence avant tout)

Coach OS n'est pas une app plate et figée : les volets, sheets et changements d'écran **s'animent**, pour situer l'utilisateur dans l'espace (d'où ça vient, où ça va). Intention de référence : le « il y a toujours du mouvement » d'une app comme Revolut.

- **Volets / bottom sheets** : entrent en **slide** depuis le bord d'où ils émergent, pas en apparition brutale.
- **Transitions de page** : **un seul** type cohérent dans toute l'app (fondu *ou* slide directionnel), jamais un mélange au hasard.
- **Court et au service du sens** : ~150–250 ms, courbe naturelle (ease-out à l'entrée). Le mouvement oriente, il ne fait pas attendre — aucune animation décorative qui retarde une action.
- **`prefers-reduced-motion`** toujours respecté : on atténue/désactive proprement (voir accessibilité).

Ça **nuance** le curseur « Effets » ci-dessous : même en direction sobre, les **transitions de navigation existent et sont cohérentes**. Ce qu'on garde discret, ce sont les effets décoratifs (glows, ombres marquées), pas le feedback de mouvement.

## Le mécanisme : direction esthétique en paramètre

Le skill ne fige pas une esthétique. À chaque usage, on part d'une **direction** (donnée par l'utilisateur ou proposée puis validée). Voici comment traduire une direction en choix concrets, **toujours dans le thème verrouillé anthracite + rouge / dark mode** (la direction règle des curseurs, elle ne change pas l'identité).

Les curseurs à régler selon la direction :

| Curseur | Faible ←——→ Fort |
|---|---|
| **Intensité de l'accent rouge** | rouge rare, réservé aux moments forts ←→ rouge plus présent |
| **Densité** | très aéré, peu d'infos par écran ←→ dense, dashboard riche |
| **Contraste** | doux, gris proches ←→ tranché, blancs francs |
| **Effets** (ombres, glows, transitions) | quasi nuls, plat ←→ profondeur et micro-animations marquées |
| **Rondeur** (radius) | angles nets ←→ coins très arrondis |

Exemples de traduction :

- **Sobre premium** (Linear/Whoop/Oura) → accent rouge **rare** (réservé PR/RPE atteint/déload), densité moyenne mais très aérée, contraste maîtrisé (gris anthracite, blancs non purs), effets discrets et nets, radius modéré. C'est l'esthétique par défaut la plus sûre pour Coach OS.
- **Sportif / énergique** → accent rouge **plus présent**, contraste plus tranché, micro-animations un peu plus visibles — sans tomber dans le criard « gym bro » (pas de néon, pas de dégradés flashy).
- **Minimaliste discret** → accent **minimal**, densité faible, effets quasi nuls, presque utilitaire, le contenu seul porte l'écran.

Quoi qu'il arrive, tu valides la direction en une ligne avant de produire, et tu restes dans la palette et le mode sombre du design system.

## Checklist finition (avant de livrer un écran)

- Y a-t-il **une** chose qui ressort en premier, et est-ce la bonne ?
- Le secondaire est-il assez en retrait (gris, plus petit) ?
- L'espacement suit-il l'échelle, et y a-t-il assez d'air ?
- Les groupes d'éléments sont-ils lisibles par leur espacement (Gestalt) ?
- La couleur ajoute-t-elle du sens, ou décore-t-elle pour rien ?
- Peut-on retirer un élément sans rien perdre ? (si oui, retire-le)
- L'écran est-il lisible **à distance de bras, en 3 secondes** ?
