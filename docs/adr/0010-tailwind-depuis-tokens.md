# ADR-0010 : Tailwind CSS généré depuis `tokens.json`

Statut : acceptée (2026-10-26)

## Contexte
Le design système est défini dans `design/tokens.json` (couleurs, typographies, espacements, rayons, tailles). La règle du projet est de ne jamais mettre de valeur de style en dur. Les maquettes utilisent déjà des variables nommées d'après ces tokens.

## Décision
Tailwind CSS, avec un thème généré à partir de `tokens.json` par Style Dictionary (variables CSS et thème Tailwind). Les classes utilitaires ne reposent que sur les tokens (`bg-primary`, `text-muted`, `rounded-button`). Le fichier généré ne se modifie jamais à la main ; la génération est intégrée à la compilation et à l'intégration continue. Les valeurs arbitraires (`bg-[#2563EB]`, `p-[13px]`) sont interdites par une règle de lint, et la règle est reprise dans `AGENTS.md`.

## Alternatives écartées
- CSS maison avec variables seules : plus de code de style à écrire et à relire.
- Bibliothèque de composants préfabriquée : style imposé, écart avec les tokens et les maquettes.

## Conséquences
- (+) Changer une valeur se fait dans un seul fichier ; l'IA et l'équipe suivent les mêmes valeurs.
- (-) Une étape de génération à maintenir ; la correspondance exacte entre catégories de tokens et thème Tailwind (typographies, espacements) et la version de Tailwind sont à fixer à l'implémentation du squelette (phase 8).
