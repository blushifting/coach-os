# Charte de ton — Coach OS

> La voix de l'app. À lire avant de rédiger quoi que ce soit. Tout texte visible par l'utilisateur doit sonner comme une seule et même personne : le coach kiné.

## Le persona : un coach kiné

Imagine un préparateur physique ou un kiné du sport expérimenté qui te suit en salle. Il **sait** de quoi il parle, mais il ne te le fait pas sentir. Il dit l'essentiel, au bon moment, sans dramatiser ni survendre. Il te tutoie parce qu'il te connaît, mais il reste pro. Il ne hurle pas « ALLEZ ON LÂCHE RIEN », il dit « Garde le dos droit, on y va ». Quand tu rates, il ne te juge pas : il ajuste.

Quand tu hésites sur un mot, demande-toi : **est-ce que ce coach dirait ça, comme ça, à ce moment ?**

Ce qu'il est : calme, précis, fiable, encourageant sobrement, économe de ses mots.
Ce qu'il n'est pas : hype, sergent-instructeur, copain envahissant, prof magistral, marque qui fait de l'humour.

## Les 4 dimensions de ton (modèle NN/g), positionnées pour Coach OS

Tout texte se situe sur 4 axes. Voici où Coach OS se place, et pourquoi.

1. **Sérieux ↔ Drôle → résolument SÉRIEUX.** Pas de blagues, pas de jeux de mots, pas de punchlines. L'humour vieillit mal quand on relit le même message à chaque séance, et il sape la confiance dans un domaine où la personne veut des repères fiables. La seule « chaleur » autorisée est l'encouragement sobre.

2. **Décontracté ↔ Formel → MÉDIAN, côté décontracté.** On tutoie, phrases naturelles, pas de raideur administrative. Mais pas de familiarité forcée ni d'argot de salle (« on va t'exploser les pecs »). Naturel et net, comme un pro qui te parle simplement.

3. **Irrévérencieux ↔ Respectueux → RESPECTUEUX.** On ne se moque jamais de l'utilisateur, de son niveau, de ses choix ou de ses ratés. Le débutant qui met 20 kg au développé est traité avec exactement le même sérieux que celui qui en met 100.

4. **Enthousiaste ↔ Factuel → plutôt FACTUEL, avec une pointe d'encouragement.** On ne s'extasie pas (« Incroyable !!! Tu es une machine !!! »). On constate les faits avec justesse et on valorise les progrès réels, sobrement (« +2,5 kg sur ton Plafond au développé. Solide. »).

## Tutoiement — règle absolue

**On tutoie partout, sans exception.** « On mesure ton Plafond », « Choisis ta variante », « Tu peux changer plus tard ». Jamais de « vous ». Si tu croises du vouvoiement dans le code (ex. « Vous n'avez pas mentionné les jambes »), c'est une incohérence à corriger en tutoiement (« Tu n'as pas mentionné les jambes »).

## Règles d'écriture concrètes

**Voix active, présent.** « Coach OS calcule ton Plafond » plutôt que « Ton Plafond sera calculé ». Active = on sait qui fait quoi, c'est plus court et plus direct.

**Phrases courtes.** Un concept par phrase. Si tu mets « et », « mais », « car », « afin de » dans un message d'interface, regarde si deux phrases ne seraient pas plus lisibles.

**Commence par l'essentiel.** La personne scanne. Le premier mot d'un titre ou d'un bouton doit déjà l'informer. « Lance ta calibration » > « Avant de commencer, tu vas pouvoir lancer ta calibration ».

**Parle de l'action, pas de la fonctionnalité.** « Note tes reps » > « Module de saisie du feedback ». L'utilisateur se fiche du nom interne des choses.

**Boutons = verbes d'action concrets.** Le libellé dit ce qui va se passer. « Commencer la séance », « Enregistrer », « Choisir cette variante ». Évite « Get Started », « Valider », « OK », « Soumettre » — vagues ou jargonneux. Voir patrons-microcopy pour les CTA.

**Capitalisation : à la française.** Une majuscule en début de phrase/libellé, le reste en minuscules. « Commencer la séance », pas « Commencer La Séance » ni « COMMENCER ». Les termes UI verrouillés gardent leur majuscule de nom propre quand c'est leur sens technique (Plafond, Cycle, Récupération) — voir vocabulaire.

**Chiffres en chiffres.** « 5 reps », « 3 séries », « RPE 8 », « 2 min de repos » — jamais « cinq répétitions ». Les chiffres se scannent mieux et c'est une app pleine de nombres. (Aligne-toi sur les chiffres tabulaires prévus dans le design.)

**Pas d'anglicismes évitables.** On garde « RPE » et « set »→ dis plutôt **série**. « reps » est admis (usage courant en salle). Évite « warm-up » → **échauffement**, « tracker » → **suivre**, « load » → **charge**. Exceptions tolérées car ancrées dans la communauté : RPE, déload (avec infobulle), PR (avec glose « record perso » à la première occurrence).

## Ponctuation, emoji, intensité

- **Points d'exclamation : quasi jamais.** Un ! occasionnel sur un vrai moment de réussite (un PR) à la rigueur. Jamais en rafale, jamais sur un message neutre.
- **Pas d'emoji** dans le texte d'interface. Le design porte l'émotion (pictos, couleurs), pas des émojis dans les phrases.
- **Pas de majuscules d'emphase** (« ATTENTION », « IMPORTANT »). Si c'est important, dis-le clairement et place-le bien.
- **Pas de superlatifs creux** : « incroyable », « énorme », « génial », « parfait ». Le coach kiné constate, il ne s'emballe pas.

## Mots et tournures à bannir

- Gamification punitive : « tu as perdu ta série de X jours », « streak brisée », « tu as échoué ».
- Culpabilisation : « tu n'as pas fait… », « tu aurais dû… », « dommage ».
- Hype / bro-culture : « no pain no gain », « beast mode », « on lâche rien », « warrior », « monstre ».
- Jargon nu non glosé : « e1RM », « compound », « mésocycle », « lengthened bias », « RIR » sans explication.
- Vague : « Oups », « Une erreur est survenue », « Valider », « OK », « En savoir plus » comme seul libellé de lien.
- Corporate / marketing : « optimise ton expérience », « débloque tout ton potentiel », « la solution ultime ».

## Exemples avant → après

**Onboarding, étape objectif**
- ❌ « Veuillez sélectionner l'objectif d'entraînement souhaité pour chacun des groupes musculaires ciblés. »
- ✅ « Pour chaque muscle, choisis ce que tu veux travailler : prendre du volume, gagner en force, ou juste entretenir. »

**Infobulle RPE**
- ❌ « RPE : Rating of Perceived Exertion basé sur le RIR. »
- ✅ « RPE = à quel point la série était dure, de 6 à 10. RPE 8, c'est : tu aurais pu faire 2 reps de plus. »

**Message d'erreur (charge vide)**
- ❌ « Erreur : champ invalide. »
- ✅ « Indique la charge utilisée pour enregistrer ta série. »

**Fin de séance**
- ❌ « Félicitations !!! Séance terminée avec succès ! 💪🔥 »
- ✅ « Séance bouclée. +2,5 kg sur ton Plafond au développé couché. »

**Déload qui arrive**
- ❌ « Semaine de deload : volume réduit de 50%. »
- ✅ « Cette semaine, on lève le pied : moins de séries pour laisser la fatigue redescendre. C'est prévu, ça fait progresser. » (+ infobulle Récupération)

**Suggestion muscle non couvert**
- ❌ « Vous n'avez pas mentionné les jambes, voulez-vous au moins du maintien ? »
- ✅ « Tu n'as pas mis les jambes dans tes priorités. On les garde en entretien pour rester équilibré ? »
