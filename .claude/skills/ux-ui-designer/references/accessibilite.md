# Accessibilité (WCAG 2.2) — appliquée à Coach OS

> Garde-fou systématique, pas une option. Le contexte (salle, debout, doigts moites, lecture à distance, parfois en sueur) rend l'accessibilité utile à *tout le monde*, pas seulement aux personnes en situation de handicap.

## Contraste (WCAG 2.2 AA)

- **Texte** : contraste ≥ **4.5:1** avec son fond (≥ 3:1 pour le grand texte, ~24 px+ ou 18.5 px gras).
- **Composants d'interface et objets graphiques** (bordures d'input, icônes porteuses de sens, segments de courbe) : ≥ **3:1**.
- En dark mode, ça tombe juste avec `zinc-100` sur `zinc-950` et les accents désaturés. **Vérifie** les cas limites : texte `zinc-500` sur `zinc-900`, texte sur accent rouge, libellés sur graphes. Dans le doute, mesure le ratio.
- Évite le blanc pur sur noir pur (trop dur) — d'où les tokens anthracite/zinc.

## Taille des cibles tactiles

- Minimum WCAG 2.2 AA : **24×24 px**. Mais pour Coach OS (usage debout, doigts moites, mouvement), **vise 44–48 px** sur tout ce qui se tape (boutons, chips, steppers de saisie, items de liste). C'est le confort qui compte ici, pas le minimum légal.
- Espace suffisant entre cibles adjacentes pour éviter les taps ratés (steppers +/- de charge, boutons de série).

## La couleur ne porte jamais seule l'information

Daltonisme + coup d'œil rapide = on ne peut pas se fier à la couleur seule. **Double toujours** d'une icône, d'un libellé, d'une forme ou d'une position :

- PR / réussite : pas seulement « en vert » → + icône + libellé.
- RPE élevé / alerte : pas seulement « en rouge » → + texte.
- Déload dans le calendrier : pas seulement une teinte → + label « Récupération » + traitement visuel distinct.
- Heatmap silhouette : ne pas reposer uniquement sur l'intensité de rouge → ajouter une légende chiffrée.

## Focus visible

Tout élément interactif a un **état focus net** (anneau visible, `focus-visible:ring` avec offset sur fond sombre). Indispensable pour la navigation clavier et les lecteurs d'écran. Ne supprime jamais l'outline sans le remplacer.

## Sémantique & lecteur d'écran

- Élément juste : `button` pour une action, `a` pour un lien, `input` pour une saisie — pas de `div` cliquable.
- **Boutons icône** (le « ? » d'aide, fermer, +/-) → `aria-label` explicite (« Aide sur le RPE », « Augmenter la charge »).
- Champs avec **label** associé (pas un placeholder qui sert de label).
- Ordre de focus logique (suit l'ordre visuel).
- États annoncés : erreur de champ liée via `aria-describedby` ; chargement annoncé (`aria-live`).

## Texte & lisibilité

- Respecte la taille de police système de l'utilisateur quand c'est possible (dynamic type) ; ne bloque pas le zoom.
- Pas de texte dans des images.
- Lignes ni trop longues ni trop serrées.

## Mouvement

- Animations courtes et discrètes (la doctrine Coach OS l'exige déjà). Respecte `prefers-reduced-motion` : désactive/atténue pour qui le demande.

## Checklist accessibilité (à passer sur chaque écran)

- Contraste texte ≥ 4.5:1, composants/graphes ≥ 3:1 ?
- Cibles tactiles ≥ 44 px, bien espacées ?
- Aucune info portée par la couleur seule (icône/label/position en doublon) ?
- Focus visible partout ?
- Boutons icône avec `aria-label` ? Champs avec label ?
- Éléments sémantiques corrects ?
- `prefers-reduced-motion` respecté ?
