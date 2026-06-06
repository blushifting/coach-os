# Data-viz — progression Coach OS

> Courbes de Plafond, volume hebdo, heatmap silhouette des muscles, bilans de cycle. Objectif : comprendre en 3 secondes, sur téléphone, en dark mode. Fondé sur les bonnes pratiques NN/g (preattentive processing) et data-viz mobile.

## Règle d'or : une question par écran/graphe

Sur mobile, chaque graphe répond à **une seule question**. « Est-ce que je progresse au développé ? » → une courbe de Plafond. « Quels muscles j'ai assez travaillés cette semaine ? » → la heatmap. N'empile pas 5 métriques dans un même visuel : identifie les 3 à 5 indicateurs que la personne consulte le plus et donne-les sans interaction.

## Choisir le bon graphe

- **Évolution dans le temps** (Plafond, volume au fil des semaines) → **courbe**. Limite à **2–3 séries** max ; au-delà, sépare.
- **Comparaison de catégories** (volume par muscle cette semaine) → **barres**. Limite à **5–7 barres** ; trie par valeur si l'ordre n'a pas de sens intrinsèque.
- **Couverture corporelle** (muscles travaillés) → **heatmap sur silhouette** (intensité = séries hebdo) + **légende chiffrée**.
- Évite les camemberts (peu lisibles, surtout en petit) ; si vraiment besoin, < 7 parts.

## Lisibilité immédiate (preattentive)

Le cerveau lit instantanément la **longueur** et la **position 2D** ; il lit mal l'aire, l'angle, la teinte fine. Donc : encode le quantitatif par la hauteur/longueur et la position, pas par la taille d'un cercle ou une nuance de couleur. Mets en évidence **le point qui compte** (dernière valeur, PR, plateau) par contraste, le reste en retrait.

## Dark mode & thème

- Fond de graphe = surface (`zinc-900`), pas noir pur. Grille très discrète (`zinc-800`), ou pas de grille.
- Lignes/barres : `zinc` clair pour le neutre, **accent rouge réservé à ce qui compte** (la série principale, un PR, la zone de déload). Ne colorie pas tout en rouge.
- **Chiffres tabulaires** sur les axes et étiquettes.
- Accents désaturés (cf. design-system) pour ne pas vibrer sur fond sombre.
- Contraste des éléments de données ≥ 3:1 (cf. accessibilité) ; jamais la couleur seule (légende + libellés).

## Densité & interaction (mobile)

- Affiche l'essentiel **sans interaction** ; l'utilisateur est entre deux séries, il ne va pas fouiller.
- Si zoom/détail nécessaire : bouton « Agrandir » dédié plutôt que de capturer le scroll (sinon on ne peut plus scroller la page).
- Filtres / sélecteurs de période dans le **bas de l'écran** (zone du pouce).
- Étiquette directement la dernière valeur sur la courbe plutôt que d'obliger à lire l'axe.

## Sobriété

Pas de 3D, pas de dégradés gratuits, pas d'effets. Le minimalisme sert la lecture. Supprime tout ce qui n'aide pas à répondre à la question du graphe (axes redondants, décimales inutiles, légendes évidentes).

## Exemples Coach OS

- **Courbe de Plafond (un exo)** : une ligne, dernière valeur étiquetée (« 92 kg »), PR marqué d'un point rouge + icône, semaines de déload légèrement grisées. Question : « je progresse ? »
- **Volume hebdo par muscle** : barres horizontales triées, bande discrète indiquant la plage V_min–V_max apprise. Question : « j'en fais assez par muscle ? »
- **Heatmap silhouette** : muscles en intensité de rouge selon les séries hebdo, + légende chiffrée (0 / 1–4 / 5–9 / 10+). Question : « qu'est-ce que j'ai négligé ? »

## Checklist data-viz

- Le graphe répond-il à une seule question claire ?
- Bon type de graphe, nombre de séries/barres limité ?
- Le point important ressort-il par contraste ?
- Chiffres tabulaires, dark mode respecté, accents désaturés ?
- Lisible sans interaction, sur petit écran, en 3 s ?
- Info jamais portée par la couleur seule (légende/labels présents) ?
