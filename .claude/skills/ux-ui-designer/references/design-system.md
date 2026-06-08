# Design system & tokens — Coach OS

> La source de vérité visuelle. Couleurs, espacements, typo, élévation, états. Tout écran doit s'y conformer. En cas d'évolution, modifier ici en premier, puis répercuter dans `recherche/08_ux_decisions.md §1`.

## Identité verrouillée

**Anthracite + rouge sombre, mode sombre par défaut, mobile-first.** Sobre, contraste élevé pour lecture à distance, chiffres tabulaires partout. Ces choix ne se négocient pas ; la direction esthétique (voir esthetique-finition) module l'intensité, pas l'identité.

## Couleurs (échelle Tailwind zinc + accents)

Pensé pour le dark mode. Principe clé : **ne pas utiliser le noir pur** comme fond (fatigant, contraste trop dur). On part d'anthracite profond et on monte en clarté pour élever.

| Rôle | Token | Usage |
|---|---|---|
| Fond app | `zinc-950` (ou dégradé radial anthracite) | l'arrière-plan le plus bas |
| Surface / carte | `zinc-900` | cartes, panneaux (1 niveau au-dessus du fond) |
| Surface élevée | `zinc-800` | modales, bottom sheets, éléments au-dessus des cartes |
| Bordure | `zinc-800` (sur carte) / `zinc-700` (sur surface élevée) | séparations discrètes |
| Texte primaire | `zinc-100` | charges, titres, l'info qui compte |
| Texte secondaire | `zinc-400` | labels, sous-titres |
| Texte atténué | `zinc-500` | aides, métadonnées |
| Action principale (marque) | `red-700` / `red-800` | bouton d'action dominant, accents de marque, **décoratif — jamais un état** |
| Problème / erreur | `red-600` (sémantique) | ça ne va pas : valeur invalide, action bloquée, baisse de Plafond |
| Succès / validation | `green-600` / `green-700` | série validée, « c'est fait », progression positive |
| Avertissement | `amber-600` / `amber-700` | alerte douce, déséquilibre, à vérifier avant de continuer |
| Information neutre | `blue-600` / `blue-700` | info factuelle sans danger, rappel de contexte |
| Aide contextuelle | `violet-600` / `violet-700` | bloc d'aide / pédagogie / « pour comprendre » |

**Règles dark mode (issues des bonnes pratiques) :**

- **Désature les accents** : un rouge/vert/ambre vif sur fond sombre vibre désagréablement. Baisse la saturation (~20 points) par rapport à un usage light. Les tokens red-700/green-700 vont déjà dans ce sens.
- **Élévation par la clarté, pas l'ombre** : plus une surface est haute dans le z-index, plus elle est claire (zinc-900 → zinc-800 → zinc-700). Un voile blanc 5–10 % d'opacité simule la lumière. Les ombres restent discrètes.
- **Contraste maîtrisé** : du blanc pur (`#fff`) sur noir pur est trop agressif. D'où `zinc-100` sur `zinc-950`, plus doux mais toujours ≥ 4.5:1 (voir accessibilité).
- **La couleur ne porte jamais seule une info** : double toujours d'une icône, d'un libellé ou d'une position (daltonisme + lecture à l'arrache en salle).

## Système sémantique de couleur (informatif)

Une couleur qui **porte une information d'état** suit une grille fixe, la même partout :

- **rouge = problème** (erreur, blocage, baisse) · **bleu = information neutre** · **orange/jaune = avertissement** · **violet = aide contextuelle** · **vert = succès / validation (« c'est fait »)**.

Règles qui en découlent (non négociables) :

- **Marque ≠ sémantique.** Le rouge de la DA (sang) reste autorisé pour le **décoratif** (barre de progression, logo, action principale, accents d'ambiance). Mais **dès qu'une couleur signale un état**, elle suit la grille — et là le rouge veut dire « problème », jamais « réussi ».
- **Validé = vert, pas rouge.** Une série/un exo terminé se colore en **vert** (« c'est fait »). Le rouge « c'est fait » connote le négatif et entre en collision avec le rouge erreur. Assume qu'il y aura **plus de vert qu'avant**.
- **Pas de doré comme couleur d'état.** L'or/doré ne tient pas en digital comme aplat ou badge de statut : à l'écran il vire au jaune et se lit comme un **avertissement**. Un état « accompli » se traite en vert + icône + libellé (ou un traitement DA dédié), pas en doré. **Exception tolérée** : un petit accent décoratif **ponctuel** de célébration (ex. l'étoile de record posée sur un point de courbe) peut rester doré — à cette échelle c'est un pictogramme, pas une couleur d'état, et le vert y paraîtrait étrange. Jamais de doré sur une grande surface ni pour signaler un statut.
- **« Fait » ≠ « information ».** Un bloc « quelque chose de fait » ne doit pas ressembler à un bloc informatif : les distinguer **au-delà de la couleur** (icône, libellé, traitement).
- **Cohérence d'état.** Le même état porte le même traitement partout. Si « sélectionné » est plein/accentué et « non sélectionné » atténué sur un écran, c'est pareil sur tous — pas d'inversion d'un exo à l'autre.

## Espacement

Échelle (base 4 px, façon Tailwind) : **4, 8, 12, 16, 24, 32, 48, 64**. N'invente pas de valeurs hors échelle. L'espace entre deux groupes doit être nettement plus grand que l'espace à l'intérieur d'un groupe (Gestalt). Sois généreux : commence large, réduis ensuite.

## Typographie

- Police **sans-serif système** (performance + natif). Pas de police décorative.
- **Chiffres tabulaires** (`font-variant-numeric: tabular-nums`) sur toutes les charges, reps, RPE, %, dates — pour que les colonnes de nombres s'alignent verticalement. C'est non négociable dans une app pleine de chiffres.
- Échelle de tailles cohérente (ex. 12 / 14 / 16 / 20 / 24 / 32). Hiérarchie par taille **et** poids **et** couleur, pas que la taille.
- Hauteur de ligne confortable pour le corps (~1.4–1.6), plus serrée pour les gros chiffres.

## Rayons & profondeur

- Radius cohérent selon la direction (ex. cartes `rounded-2xl`, boutons `rounded-xl`, chips `rounded-full`). Garde-le constant par type d'élément.
- Ombres discrètes seulement ; en dark mode, préfère l'élévation par surface plus claire.

## États de composants (obligatoires)

Un composant interactif n'est pas fini tant que ces états ne sont pas définis :

- **Défaut** · **Survol** (desktop, secondaire ici) · **Pressé/actif** (feedback tactile net, important en salle) · **Focus** (anneau visible, pour clavier/lecteur d'écran — voir accessibilité) · **Désactivé** (contraste réduit mais perceptible + raison si possible) · **Chargement** · **Erreur**.

Pour les boutons : l'action principale en `red-700`, les secondaires en surface neutre (`zinc-800` + bordure), jamais deux boutons rouges concurrents sur un même écran.

## Checklist design system

- Toutes les couleurs viennent-elles des tokens ci-dessus (aucune couleur en dur hors échelle) ?
- Les espacements suivent-ils l'échelle ?
- Les chiffres sont-ils tabulaires ?
- Les surfaces respectent-elles la logique d'élévation (plus haut = plus clair) ?
- Les états interactifs sont-ils tous définis, focus compris ?
- Un seul accent rouge fort par écran ?
- Toute couleur **informative** suit-elle la grille sémantique (rouge=problème, bleu=info, orange=avertissement, violet=aide, vert=validé) ?
- Aucun rouge employé pour dire « réussi / fait » ? Aucun doré ?
