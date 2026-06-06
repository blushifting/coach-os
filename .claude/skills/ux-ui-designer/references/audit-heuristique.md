# Audit heuristique — revue d'utilisabilité

> Le pilier « revue » : inspecter un écran existant contre les 10 heuristiques de Jakob Nielsen pour repérer les problèmes d'utilisabilité sans test utilisateur. C'est du diagnostic, pas de la création.

## Méthode

Parcours l'écran (ou le flow) et confronte-le aux 10 principes ci-dessous. Pour chaque problème trouvé : **décris-le**, **dis quelle heuristique il viole**, **estime sa sévérité**, **propose une correction**. Trois passes valent mieux qu'une (on attrape ~60 % des soucis à trois regards).

### Échelle de sévérité

- **0** — pas un problème.
- **1 — cosmétique** : à corriger si le temps le permet.
- **2 — mineur** : gêne réelle mais contournable.
- **3 — majeur** : bloque ou frustre fréquemment, à corriger en priorité.
- **4 — catastrophique** : empêche d'accomplir la tâche, à corriger absolument.

## Les 10 heuristiques (avec questions Coach OS)

1. **Visibilité de l'état du système.** L'app dit-elle en permanence ce qui se passe ? *Coach OS : la série enregistrée affiche-t-elle une confirmation ? Le Plafond mis à jour est-il visible ? Sait-on où on en est dans le cycle/la séance ?*
2. **Correspondance avec le monde réel.** Le langage et les concepts sont-ils ceux de l'utilisateur, pas ceux du dev ? *Pas de « e1RM », « compound » bruts (→ voir skill writer). Les pictos de pattern (squat/hinge) sont-ils reconnaissables ?*
3. **Contrôle et liberté.** Y a-t-il toujours une sortie de secours ? *Peut-on annuler une saisie ratée, revenir en arrière dans l'onboarding, sauter/substituer un exo si la machine est prise, quitter sans tout perdre ?*
4. **Cohérence et standards.** Les mêmes éléments se comportent-ils pareil partout ? *Un bouton de validation a-t-il toujours le même look/place ? Le terme « Récupération » est-il employé partout pareil ? Conventions iOS/Android respectées ?*
5. **Prévention des erreurs.** Le design empêche-t-il l'erreur en amont ? *Saisie de charge bornée à des valeurs plausibles ? Stepper plutôt que clavier libre ? Confirmation avant une action destructive (changer de programme) ?*
6. **Reconnaître plutôt que se rappeler.** L'info utile est-elle visible au lieu d'être à mémoriser ? *La charge cible est-elle rappelée au moment de saisir ? La variante choisie en séance 0 est-elle pré-remplie ? Pas besoin de retenir son RPE de la dernière fois ?*
7. **Flexibilité et efficacité.** Débutant **et** habitué sont-ils servis ? *Saisie rapide (< 5 s) pour l'expert pressé, valeurs pré-remplies, raccourcis ; tout en restant clair pour le novice. Accélérateurs sans piéger le débutant.*
8. **Esthétique et design minimaliste.** L'écran est-il épuré, sans bruit ? *Trop d'infos d'un coup ? Du décor inutile ? L'essentiel ressort-il ? (voir esthetique-finition)*
9. **Aider à reconnaître et réparer les erreurs.** Les messages d'erreur sont-ils clairs, sans blâme, avec solution ? *En langage humain, près du champ, qui disent quoi faire (→ détail dans le skill writer, mais le placement/visibilité relèvent du design).*
10. **Aide et documentation.** L'aide est-elle dispo quand il faut, ciblée sur la tâche ? *Le « ? » d'aide contextuelle est-il là où les termes techniques apparaissent ? Le tuto séance 0 est-il accessible ? Pas besoin d'un manuel externe.*

## Format de sortie d'un audit

Présente les findings groupés par écran, triés par sévérité décroissante, pour qu'Azur priorise :

```
## Écran : Saisie de série
- [Sévérité 3 — Visibilité de l'état] Rien ne confirme que la série est enregistrée.
  → Afficher un état "enregistré" (coche + ligne validée) après la saisie.
- [Sévérité 2 — Prévention des erreurs] Le champ charge accepte n'importe quel nombre.
  → Stepper par incréments réels + bornes plausibles selon le Plafond.
- [Sévérité 1 — Esthétique] Trois niveaux de gris concurrents brouillent la hiérarchie.
  → Réduire à deux (primaire zinc-100, secondaire zinc-400).
```

## Articulation avec les autres piliers

L'audit **trouve** les problèmes ; la correction puise dans les piliers création : esthétique/design-system pour la forme, composants pour le code, accessibilité pour les garde-fous, et le skill `ux-writer-coach-os` pour tout ce qui est texte (heuristiques 2 et 9 surtout).
