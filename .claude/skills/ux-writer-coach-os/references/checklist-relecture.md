# Checklist de relecture — le test du débutant

> À passer sur chaque texte avant de le livrer. Si un point bloque, réécris avant de proposer.

## Le test du débutant (le plus important)

Pour chaque chaîne, pose-toi **la** question : *est-ce qu'une personne qui n'a jamais soulevé une barre comprend ça du premier coup, sans aller chercher ailleurs ?*

Si la réponse est « non » ou « peut-être » :
- soit tu remplaces le terme technique par son mot UI verrouillé,
- soit tu ajoutes une glose / un « ? » avec infobulle,
- soit tu coupes le superflu jusqu'à ce que le sens saute aux yeux.

## Grille en 10 points

1. **Clarté** — Compréhensible à la première lecture ? Un seul concept par phrase ?
2. **Jargon** — Aucun terme technique nu ? Tout ce qui est pointu est glosé ou remplacé (voir `vocabulaire.md`) ?
3. **Vocabulaire** — Les mots verrouillés sont employés exactement (Plafond, Cycle, Récupération…) ? Aucun terme banni (e1RM, compound, mésocycle, lengthened bias, Volume musculaire) ?
4. **Tutoiement** — « Tu » partout, zéro « vous » ?
5. **Ton** — Sonne comme le coach kiné : sobre, factuel, encourageant sans hype ? Pas de !, d'emoji, de superlatif creux, de blague ?
6. **Action** — Les boutons nomment l'action ? La personne sait ce qui va se passer ?
7. **Scannabilité** — L'essentiel en premier ? Les 2 premiers mots portent le sens ?
8. **Concision** — Peut-on retirer des mots sans perdre le sens ? (Si oui, retire-les.)
9. **Bienveillance** — Aucun message ne culpabilise, ne juge, ne blâme ? Les erreurs disent quoi faire ensuite ?
10. **Cohérence** — La même chose est nommée pareil partout ? Pas de doublon de wording entre deux écrans ?

## Test de cohérence d'ensemble (sur un écran ou un flow complet)

- Liste tous les termes techniques employés → chacun est-il introduit/glosé à sa première apparition ?
- Un même concept a-t-il deux noms différents dans le flow ? (à uniformiser)
- Le registre (tu) et le ton sont-ils constants du premier au dernier écran ?
- Les boutons de même fonction portent-ils le même libellé partout ?

## Réflexe « En savoir plus »

Si tu as dû entasser de l'explication dans une infobulle (plus de 2 phrases), c'est le signal : garde 2 phrases + exemple au niveau 2, bascule le reste en « En savoir plus » optionnel. La science ne s'impose jamais ; elle se propose à qui creuse.

## Mini-rubrique de notation (pour un audit)

Pour auditer un écran existant, note chaque chaîne :
- 🟢 OK — claire, bon ton, bon vocabulaire, rien à changer.
- 🟡 À retoucher — compréhensible mais perfectible (trop longue, ton un peu off, glose manquante).
- 🔴 À refaire — jargon nu, vouvoiement, culpabilisant, terme banni, ou incompréhensible pour un débutant.

Présente l'audit en diff : `chaîne actuelle → version proposée + raison courte`, regroupé par écran, pour qu'Azur valide terme par terme.
