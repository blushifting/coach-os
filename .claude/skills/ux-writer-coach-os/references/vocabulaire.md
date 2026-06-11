# Vocabulaire verrouillé — source de vérité

> La table de naming officielle de Coach OS. Ce fichier fait foi. Si un autre document dit autre chose, c'est ce fichier qui gagne (et il faut corriger l'autre). En cas d'évolution, modifier ici en premier, puis répercuter dans `recherche/08_ux_decisions.md` du projet.

## Règle générale

Chaque concept technique a **un seul** mot d'interface. On l'emploie partout pareil. Deux écrans ne doivent jamais nommer la même chose différemment — c'est la première cause de confusion. Les termes marqués « nom UI » prennent une majuscule de nom propre quand ils désignent le concept précis de l'app (le Plafond, un Cycle, la Récupération) ; en usage courant dans une phrase, suis le sens.

## Table de naming

| Concept technique | Mot d'interface | Glose courte (sous-titre / aide) |
|---|---|---|
| `e1RM` (estimated 1 rep max) | **Plafond** | « La charge max estimée que tu pourrais soulever 1 fois. Calculée à partir de tes séries. » |
| `1RM` réel (test max) | **Max** ou **1 rép max** | « La charge la plus lourde que tu peux soulever une seule fois. » |
| `compound` | **Polyarticulaire** | « Mobilise plusieurs articulations à la fois (ex. squat, développé). » |
| `isolation` | **Isolation** | « Cible un seul muscle, une seule articulation (ex. curl biceps). » |
| objectif `hypertrophie` | **Hypertrophie** | « Faire grossir le muscle. » (jamais « Volume musculaire » → collision avec Volume hebdo) |
| objectif `force` | **Force** | « Soulever plus lourd. » |
| objectif `endurance` | **Endurance** | « Tenir un effort long sans flancher. » |
| objectif `maintien` | **Entretien** (ou Maintien) | « Garder ses acquis sans chercher à progresser. » |
| `volume` (séries × …) | **Volume hebdo** / **Séries par semaine** | « Le nombre de séries que tu fais par muscle et par semaine. » À NE PAS confondre avec « volume musculaire ». |
| `mésocycle` | **Cycle** (ou **Bloc**) | « Un bloc de 4 semaines de progression + 1 semaine plus légère. » |
| `déload` | **Récupération** (terme « Déload » toléré + infobulle) | « Une semaine allégée pour faire redescendre la fatigue. » |
| `RPE` / `RIR` (effort perçu / reps en réserve) | **Réserve** (« reps en réserve ») | ⚠️ **Conv #26 — « Effort » est RETIRÉ de l'UI.** On saisit les **reps en réserve** : « combien de reps tu aurais encore pu faire avant l'échec ». Curseur de **« 4+ »** (gauche, beaucoup en réserve = trop facile) à **« échec »** (droite, 0 en réserve). PAS de cible affichée. Les sigles **RPE/RIR** ne servent qu'en aide/« En savoir plus » comme ancrage (« aussi appelé RPE »). Conversion interne : réserve = 10 − RPE (le moteur garde le RPE). |
| `lengthened bias` | **Étiré** | « Travaille le muscle en position allongée — meilleur pour l'hypertrophie. » |
| `ROM complet` | **Amplitude complète** | « Le mouvement parcouru sur toute son étendue. » |
| `V_min` / `V_max` | (jargon, graphes seulement) | « Le plancher et le plafond de séries hebdo appris pour toi. » Exposé seulement dans les graphes, avec infobulle. |
| `plateau` | **Plateau** (ou « ça stagne ») | « Quand tu ne progresses plus sur un exercice malgré l'effort. » |
| `set` | **série** | (ne pas utiliser « set » en français) |
| `rep` / `répétition` | **rep** (admis) ou **répétition** | — |
| `PR` (personal record) | **PR** (+ glose 1ʳᵉ fois) | « PR = record perso. » Glose obligatoire à la première occurrence. |
| `warm-up` | **échauffement** | — |
| `working set` | **série de travail** | « La vraie série qui compte, après l'échauffement. » |
| `tempo` | **tempo** | « La vitesse d'exécution du mouvement. » |
| `split` | **répartition** (ou nom du programme) | « Comment les muscles sont répartis sur tes jours de la semaine. » N'expose pas « split » brut. |
| `session label` (jour de programme) | **Séance A / B / C** (format « Séance A — Upper ») | ⚠️ **Conv #28** : la lettre est **GLOBALE et unique** dans la semaine — elle IDENTIFIE la séance ; le type (Upper, Full Body…) décrit le contenu. Un U/L 4× = Séances A/B/C/D (« Séance A — Upper », « Séance B — Lower »…), **jamais deux « Séance A »**. Affichage via `lib/session-label.ts` (`formatSessionLabel`) ; ne pas reconstruire le format à la main. |
| jour « spé » du U/L 5× | **Focus** | « La séance qui re-cible tes muscles prioritaires. » (Conv #22.5 « Spec »→« Bonus » ; Conv #28 → **Focus**.) Affiché « Séance E — Focus ». |

## Détecteur de jargon — termes bannis du texte utilisateur

Si l'un de ces termes apparaît dans une chaîne visible par l'utilisateur, c'est un défaut à corriger :

| Banni dans l'UI | Remplacer par |
|---|---|
| e1RM, 1RM estimé | Plafond |
| compound | Polyarticulaire |
| mésocycle, mesocycle | Cycle / Bloc |
| deload (en français nu) | Récupération (ou Déload + infobulle) |
| lengthened bias | Étiré |
| ROM | Amplitude (complète) |
| Volume musculaire (comme objectif) | Hypertrophie |
| RIR / RPE / **Effort** (comme label UI) | **Réserve** (reps en réserve) — RPE admis seulement dans l'aide, glosé « aussi appelé RPE » |
| set (français) | série |
| split (brut) | répartition |
| 1RM (sans glose, pour un débutant) | Max / 1 rép max, avec glose |

## Note sur les noms de programmes guidés

Les 5 programmes prefab gardent leur **nom propre d'origine** (Starting Strength, GreySkull LP, Upper/Lower Helms, 5/3/1 BBB, PPL Nippard) — ce sont des marques connues de la communauté, les traduire perdrait le repère. Mais **chaque nom est accompagné d'une ligne en clair** qui dit pour qui et pour quoi (ex. « PPL Nippard — pousser/tirer/jambes, 6 jours, pour prendre du muscle quand tu peux venir souvent »). Le débutant ne connaît pas ces noms ; c'est la glose qui l'oriente.
