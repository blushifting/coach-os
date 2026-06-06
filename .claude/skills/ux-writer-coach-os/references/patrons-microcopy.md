# Patrons de microcopy par surface

> Recettes par type d'écran, avec principes et exemples Coach OS. Quand tu écris pour une surface donnée, lis sa section et calque-toi dessus.

## Table des matières

- [Boutons & CTA](#boutons--cta)
- [Champs : labels, placeholders, aide](#champs--labels-placeholders-aide)
- [Messages d'erreur](#messages-derreur)
- [États vides](#états-vides)
- [Onboarding (4 étapes)](#onboarding-4-étapes)
- [Séance 0 / Calibration](#séance-0--calibration)
- [Confirmations & destructif](#confirmations--destructif)
- [Succès & PR](#succès--pr)
- [Notifications](#notifications)
- [Infobulles & bottom sheets](#infobulles--bottom-sheets)

---

## Boutons & CTA

**Principe :** un bouton dit **ce qui va se passer**, avec un verbe d'action concret. La personne doit savoir où elle atterrit avant de cliquer. Évite les libellés vagues et génériques.

- ✅ « Commencer la séance », « Enregistrer ma série », « Choisir cette variante », « Lancer la calibration », « Voir le détail des semaines »
- ❌ « Get Started », « Valider », « OK », « Soumettre », « Continuer » tout seul quand on peut être précis, « En savoir plus » comme seul texte de lien

Sur un lien d'aide, mets ce qu'on va apprendre : « Comment on calcule ton Plafond » plutôt que « En savoir plus ».

## Champs : labels, placeholders, aide

**Principe :** le label reste visible (pas de placeholder qui sert de label et disparaît). Le placeholder montre un **exemple de format**. Le texte d'aide, court, lève le doute avant qu'il devienne une erreur.

- Label : « Charge utilisée » · Placeholder : « ex. 60 » · Aide : « En kg, barre comprise. »
- Label : « Reps réalisées » · Placeholder : « ex. 8 »
- Label : « Effort ressenti » · Aide : « Difficulté de la série, 6 à 10. » + « ? » vers l'infobulle

Saisie de feedback entre séries : vise **moins de 5 secondes** pour le cas normal. Pré-remplis avec la cible (reps et effort prévus) ; la personne corrige seulement si ça a différé.

## Messages d'erreur

**Principe (d'après NN/g) :** dire **quoi**, puis **comment réparer**, sans jamais blâmer. Trois règles :

1. **Langage humain, près du champ.** Affiche l'erreur à côté de ce qui coince, en clair. Pas de code, pas de « invalide / illégal / incorrect ».
2. **Décris le problème précis + la solution.** « Une erreur est survenue » n'aide personne.
3. **Ne culpabilise pas, préserve la saisie.** Le système s'adapte à l'utilisateur, pas l'inverse. Ne fais jamais retaper ce qui était bon.

- ❌ « Erreur : champ invalide. » → ✅ « Indique la charge pour enregistrer ta série. »
- ❌ « Valeur incorrecte. » → ✅ « L'effort va de 6 à 10. Choisis une valeur dans cette plage. »
- ❌ « Échec de chargement. » → ✅ « Impossible de charger ta séance. Vérifie ta connexion et réessaie. »

N'affiche pas l'erreur trop tôt (pas avant que la personne ait fini de remplir / quitte le champ vide juste en explorant). Pas d'humour dans une erreur : on la relit trop souvent.

## États vides

**Principe :** un écran vide est une occasion d'orienter, pas un cul-de-sac. Formule : **ce qu'on voit ici** + **pourquoi c'est utile** + **une action**. Règle « deux tiers consigne, un tiers chaleur » — et côté chaleur, on reste sobre (coach kiné).

- Historique vide : « Pas encore de séance enregistrée. Ta première séance servira à mesurer tes Plafonds. » + bouton « Lancer la calibration »
- Progrès vide : « Tes courbes apparaîtront ici après quelques séances. On a besoin d'un peu de données pour suivre ta progression. »
- Catalogue filtré sans résultat : « Aucun exercice avec ces filtres. Enlève un filtre pour élargir. » (pas de jeu de mots, pas de « oups »)

## Onboarding (4 étapes)

**Principe global :** faire avancer, pas faire un cours. On demande le strict nécessaire, on explique chaque notion **au moment où elle sert**, et on repousse le détail dans les « ? ». Pas d'écran de bienvenue : on entre direct. La calibration n'est PAS dans l'onboarding (elle est en séance 0).

Le ton : un coach qui prend tes mesures avant de bâtir ton programme. Chaque étape dit en une ligne **pourquoi** on te demande ça.

**Étape 1 — Profil**
- Titre : « Faisons connaissance »
- Sous-titre : « Quelques infos pour calibrer ton programme. »
- Champs : sexe, âge, poids, niveau, séances par semaine.
- Niveau, en clair (pas « débutant/intermédiaire/avancé » seuls) : « Débutant — moins d'un an de muscu régulière », « Intermédiaire — 1 à 3 ans », « Avancé — plus de 3 ans ». Le niveau ajuste la progression, dis-le : « Ça nous aide à doser ta progression. »

**Étape 2 — Équipement**
- Titre : « Tu t'entraînes avec quoi ? »
- Sous-titre : « On ne te proposera que des exercices faisables avec ce que tu as. »
- Chips à cocher (barre, haltères, machines, poids du corps…).

**Étape 3 — Muscles cibles + objectif par muscle**
- Titre : « Sur quoi tu veux progresser ? »
- Sous-titre : « Choisis tes muscles prioritaires, et ce que tu veux pour chacun. »
- Pour chaque muscle prioritaire : Force / Hypertrophie / Endurance / Entretien — chaque option avec sa glose courte (voir glossaire). Le « ? » ouvre l'explication.
- Suggestion intelligente (tutoiement !) : « Tu n'as pas mis les jambes dans tes priorités. On les garde en entretien pour rester équilibré ? »

**Étape 4 — Choix du programme**
- Titre : « Ton programme »
- Deux voies, expliquées simplement :
  - « **Programme guidé** — on part d'un programme éprouvé, adapté à ton profil. » (chaque prefab avec sa glose « pour qui / pour quoi », voir vocabulaire)
  - « **Programme sur mesure** — Coach OS le construit à partir de tes muscles et objectifs. »
- Récap final : le programme proposé + lien « Voir le détail des semaines à venir ».
- Fin du wizard → onglet Séance, 1ʳᵉ séance marquée « Séance 0 — Calibration ».

## Séance 0 / Calibration

**Principe :** c'est une séance, pas une étape d'onboarding. Un tuto d'intro pose le décor, puis on fait. Voir l'infobulle Calibration dans le glossaire.

- Intro : « On va d'abord mesurer ton Plafond sur les exos clés. Pour chaque exo : choisis ta variante (barre, haltères, machine), puis fais une série de 5 reps avec une charge où il te restait environ 2 reps dans le réservoir. Coach OS en déduit ton Plafond. Tu pourras changer de variante plus tard. »
- Par exo : « Choisis ta variante » → « Fais ta série test » → affichage live « Plafond estimé : 92 kg ».
- Fin : « Tes Plafonds sont posés, ton programme est calibré. Ta vraie première séance t'attend. »

## Confirmations & destructif

**Principe :** ne confirme que ce qui est risqué ou irréversible. Le bouton de confirmation **nomme l'action**, il ne dit pas « OK ».

- Changer de programme (perte du cycle en cours) : « Changer de programme va remplacer ton cycle actuel. Ta progression est gardée. » → boutons « Changer de programme » / « Annuler »
- Supprimer une séance : « Supprimer cette séance ? Tu ne pourras pas la récupérer. » → « Supprimer » / « Annuler »
- Pas de confirmation pour les actions banales et réversibles (changer une variante de l'exo du jour).

## Succès & PR

**Principe :** constater le fait, sobrement, et chiffrer. Pas de feu d'artifice. Le coach kiné valorise le progrès réel sans en faire trop.

- Fin de séance : « Séance bouclée. +2,5 kg sur ton Plafond au développé couché. »
- PR : « Nouveau PR (record perso) au squat : 110 kg. » (un seul ! à la rigueur)
- Fin de cycle (bilan) : « Cycle 2 terminé. 3 Plafonds en hausse, 11 séances sur 12 faites. » + les 3 actions Continuer / Ajuster / Changer.
- Jamais : « Bravo champion !!! », emojis, « tu déchires ».

## Notifications

**Principe :** rares, utiles, jamais culpabilisantes. Elles rappellent ou informent, elles ne harcèlent pas.

- Rappel séance (opt-in) : « Séance jambes prévue aujourd'hui. »
- Sortie de récupération : « Semaine de récupération finie. Nouveau cycle, on repart. »
- Jamais : « Ça fait 4 jours… tu nous manques ! », « Tu vas perdre tes gains ! », rappels en rafale.

## Infobulles & bottom sheets

**Principe :** déclenchées par le « ? », jamais imposées. 1 à 2 phrases + un exemple concret chiffré. Le détail scientifique va derrière un « En savoir plus » optionnel. Voir `glossaire-vulgarisation.md` pour le contenu rédigé de chaque terme. Couvre au minimum : Plafond, Effort, Cycle, Récupération, Polyarticulaire, Isolation, Étiré, Volume hebdo, V_min/V_max, Amplitude, Hypertrophie.
