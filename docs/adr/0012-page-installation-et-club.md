# ADR-0012 : Page d'installation et entité Club

Statut : acceptée (2026-10-26)

## Contexte
Une instance sert une seule association (PRD section 6). RG-04 exige un premier administrateur, et RG-16 un fuseau horaire unique par instance. La décision précédente du glossaire, « le club est implicite, sans entité », est remplacée par un besoin de saisir le nom du club et son fuseau à l'installation.

## Décision
Une page d'installation, accessible tant qu'aucun utilisateur n'existe, crée en une seule transaction le club (entité `Club`, une seule ligne : nom, fuseau horaire) et le premier administrateur (RG-17, F-19). Ensuite elle répond « introuvable ». L'unicité est garantie par la base : clé primaire `club.id = 1` et transaction. Avant l'installation, toute autre page redirige vers elle.

Pas de code d'installation : la personne qui installe l'instance crée elle-même le club et le premier administrateur, et il lui est demandé d'installer juste après le déploiement. Point à revoir si le produit évolue (hébergement public, plusieurs instances).

## Alternatives écartées
- Commande d'installation en ligne de commande : pas de mot de passe dans la configuration, mais moins accessible pour un club sans compétence technique.
- Variables d'environnement `ADMIN_EMAIL` et `ADMIN_PASSWORD` : un mot de passe passe par la configuration.
- Code d'installation affiché dans les journaux, à saisir sur la page : protège la fenêtre entre déploiement et installation, écarté car jugé inutile pour le cas d'usage actuel.
- Club implicite (configuration seulement) : ne permet pas de saisir le nom et le fuseau dans l'application.

## Conséquences
- (+) Installation guidée, sans manipulation technique après `docker compose up`.
- (-) Tant que l'installation n'est pas faite, quiconque atteint l'adresse de l'instance pourrait la faire à sa place ; risque accepté par le porteur du projet, atténué en installant juste après le déploiement.
- Impacts sur le schéma (`Club`), les règles (RG-04, RG-16, RG-17), les flux (09), les wireframes (A10, A11) : déjà reportés dans les documents.
