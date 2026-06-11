# Patrons de microcopy par surface

> Recettes par type d'écran, avec principes et exemples Coach OS. Quand tu écris pour une surface donnée, lis sa section et calque-toi dessus.

## Table des matières

- [Boutons & CTA](#boutons--cta)
- [Champs : labels, placeholders, aide](#champs--labels-placeholders-aide)
- [Messages d'erreur](#messages-derreur)
- [États vides](#états-vides)
- [Onboarding](#onboarding)
- [Aide contextuelle vs Aide / FAQ](#aide-contextuelle-vs-aide--faq)
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
- Label : « Réserve » · Aide : « Combien de reps tu aurais encore pu faire. » + « ? » vers l'infobulle (curseur de « 4+ » à « échec », pas de cible affichée)

Saisie de feedback entre séries : vise **moins de 5 secondes** pour le cas normal. Pré-remplis avec les reps prévues ; la personne corrige seulement si ça a différé.

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

## Onboarding

**Principe global :** faire avancer, pas faire un cours. On demande le strict nécessaire, on explique chaque notion **au moment où elle sert**, et on repousse le détail dans les « ? ». Pas d'écran de bienvenue : on entre direct. La calibration n'est PAS dans l'onboarding (elle est en séance 0).

**Condensation (priorité haute sur les écrans d'intro).** Il y a trop de texte sur ces écrans : **supprime les phrases non nécessaires**, garde une ligne de *pourquoi* par étape, pas un paragraphe. Une consigne d'action + une raison courte suffisent. Tout le vocabulaire / les explications non indispensables passent **derrière un « en savoir plus »** (ou un « ? »), jamais en clair dans le flux. Test : si la phrase ne change pas ce que la personne fait à l'instant, elle dégage ou elle va dans l'aide.

Le ton : un coach qui prend tes mesures avant de bâtir ton programme.

**Étape — Profil**
- Titre : « Faisons connaissance »
- Sous-titre : « Quelques infos pour calibrer ton programme. »
- Champs : sexe, âge, poids, séances par semaine. (Le niveau et l'équipement ne sont plus demandés : auto-calibration cycle après cycle, équipement déduit des choix d'exos.)

**Étape — Muscles (prioritaires + entretien fusionnés)**
- Titre : « Sur quoi tu veux progresser ? »
- Sous-titre court : « Choisis tes muscles prioritaires. »
- **Une seule page** : les muscles **prioritaires** et les muscles d'**entretien** vivent ensemble sur la silhouette (deux teintes = prio / entretien — voir design system). Le full body apparaît alors comme l'intégrale des muscles.
- **Auto-complétion de l'entretien** : les muscles non choisis se mettent en entretien tout seuls pour garder l'équilibre. Si la personne valide un ensemble **déséquilibré**, un **popin d'avertissement** (orange) le signale et propose d'équilibrer — **avec la possibilité de refuser** : « Ton choix laisse [zone] de côté. On l'ajoute en entretien pour rester équilibré ? » → « Équilibrer » / « Garder mon choix ».
- Objectif par muscle prioritaire (Force / Hypertrophie / Endurance / Entretien) : chaque option avec sa glose courte, le détail derrière le « ? ».

**Étape — Programme**
- Titre : « Ton programme »
- **Voie principale, mise en avant : le sur-mesure.** « Coach OS construit ton programme à partir de tes muscles et objectifs. » C'est le choix recommandé, le plus visible.
- **En alternative, en dessous et moins en évidence : les programmes prefab**, présentés en **tableau comparatif en lignes** (5–6 programmes = une ligne chacun, question de place) : **en-tête de ligne sélectionnable** + colonnes avantages / inconvénients (checks/croix). Chaque prefab garde son nom propre + sa glose « pour qui / pour quoi » (voir vocabulaire).
- Récap final : le programme proposé + lien « Voir le détail des semaines à venir ». Les séances y sont nommées **« Séance A / B / C »** (préfixe obligatoire, voir vocabulaire).
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

**Principe :** déclenchées par le « ? », jamais imposées. 1 à 2 phrases + un exemple concret chiffré. Le détail scientifique va derrière un « En savoir plus » optionnel. Voir `glossaire-vulgarisation.md` pour le contenu rédigé de chaque terme. Couvre au minimum : Plafond, Réserve, Cycle, Récupération, Polyarticulaire, Isolation, Étiré, Volume hebdo, V_min/V_max, Amplitude, Hypertrophie.

## Aide contextuelle vs Aide / FAQ

Deux familles d'aide, à ne pas mélanger — elles ne vivent pas au même endroit :

- **Aide contextuelle** : laissée **au moment de l'action**, quand elle aide à **faire un choix** (choisir une variante, doser son effort, comprendre une suggestion). Forme : « ? », infobulle, une ligne sous un champ. Courte, ciblée, jetable. Elle reste près de la décision.
- **Aide générale / vocabulaire** : tout ce qui **n'est pas nécessaire pour agir maintenant** (définitions de fond, « pourquoi le modèle fait ça », sources scientifiques). Ça **ne s'impose pas dans le flux** : ça va dans une **section Aide / FAQ** dédiée, atteignable à la demande. Les « ? » contextuels peuvent y **renvoyer** vers l'entrée pertinente.

Règle de tri : *est-ce que cette explication change ce que la personne fait à la seconde où elle la lit ?* Oui → aide contextuelle. Non → Aide / FAQ. Quelques notions-clés mises en avant dans l'app (Plafond, Réserve) gardent une aide contextuelle ; le reste du vocabulaire est rangé dans l'Aide.
