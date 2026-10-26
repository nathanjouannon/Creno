# ADR-0007 : Accessibilité WCAG 2.2 niveau AA

Statut : acceptée (2026-10-26)

## Contexte
Les bénévoles ont des attentes techniques faibles et utilisent surtout leur smartphone. Les tokens du design système prévoient déjà des cibles tactiles de 40 px. Aucune obligation légale n'impose le RGAA à une association privée, mais l'accessibilité doit être incluse dès la conception.

## Décision
Viser WCAG 2.2 niveau AA : contrastes, navigation au clavier, libellés reliés aux champs, focus visible, messages d'erreur reliés (`aria-describedby`), sens non porté par la seule couleur. Vérifié par des tests automatisés (axe) dans l'intégration continue et par un contrôle manuel avant la première mise en ligne.

## Alternatives écartées
- RGAA complet : audit et déclaration d'accessibilité lourds ; à envisager si les associations deviennent des clients publics.
- Meilleur effort sans objectif : aucun critère de réussite ni test.

## Conséquences
- (+) Utilisable par plus de personnes, cohérent avec `design/components.md`.
- (-) Quelques jours de travail de vérification avant la mise en ligne.
- Tout composant doit prévoir ses états `focus` et `error` (`design/components.md`, section 1).
