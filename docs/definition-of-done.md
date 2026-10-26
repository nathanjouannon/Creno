# Définition de « terminé » – Créno

Statut : version 1.0 (2026-10-26). Liste de contrôle commune à toutes les tâches (`tasks/`). Elle est reprise dans le modèle de pull request ; une tâche n'est fermée que lorsque tout ce qui la concerne est coché. Une case non concernée est barrée avec la raison, pas laissée vide.

## Code et tests
- [ ] Les critères d'acceptation du ticket sont tous vérifiés, un par un.
- [ ] Chaque scénario Given/When/Then et chaque règle RG-xx cités par le ticket ont un test nommé avec son identifiant (`testing.md`, section 5).
- [ ] Les tests obligatoires de la tâche (concurrence, accès refusé, nettoyage de données) existent (`testing.md`, section 4).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` passent ; les seuils de couverture sont tenus.
- [ ] Aucune valeur de style en dur : uniquement les classes issues des tokens (ADR-0010).
- [ ] Les noms du code sont ceux de `glossary.md` ; les règles métier sont dans les services, jamais dans l'interface ni les dépôts.
- [ ] Toute entrée externe est validée par un schéma Zod ; les permissions sont vérifiées côté serveur (RG-14).

## Contrat et documents
- [ ] Si une route ou une erreur change : schéma Zod modifié, `pnpm api:generate` lancé, `docs/api/openapi.yaml` et `docs/api/errors.*` commités, `pnpm api:check` vert.
- [ ] Si un choix d'architecture change : ADR ajouté ou mis à jour, et `architecture/architecture.md` dans le même commit.
- [ ] Si le schéma de base change : migration avec son script de retour, `domain/schema.sql`, `domain/erd.mmd` et `schema.prisma` alignés, test appliquer-défaire-rejouer vert.
- [ ] Si une règle de gestion, un terme ou une story change : `domain/business-rules.md`, `glossary.md` ou `user-stories.md` mis à jour.
- [ ] Si une variable d'environnement est ajoutée : `.env.example` et `architecture/environments.md`.

## Qualité visible
- [ ] Interface : utilisable en 360 px sans défilement horizontal, texte en français, états de chargement, vide et erreur traités.
- [ ] Accessibilité : axe sans violation sérieuse ou critique, parcours possible au clavier.
- [ ] Journaux : aucun mot de passe, jeton ou e-mail complet ; erreurs sans détail technique dans les réponses.
- [ ] Aucun secret dans le dépôt (scan de secrets vert).

## Livraison
- [ ] La pull request décrit le changement, cite le ticket (`Closes #n`) et liste ce qui a été testé à la main.
- [ ] La chaîne d'intégration continue est entièrement verte.
- [ ] Une autre personne (ou une relecture par l'IA suivie d'une validation humaine) a relu la pull request.
- [ ] Les écarts connus et les idées hors périmètre sont des tickets ouverts, pas des commentaires `TODO` oubliés.
