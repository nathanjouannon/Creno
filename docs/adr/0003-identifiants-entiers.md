# ADR-0003 : Identifiants entiers auto-incrémentés

Statut : acceptée (2026-10-26)

## Contexte
Toute entité a une clé primaire. Les options étudiées : entier auto-incrémenté, UUID v4, UUID v7, ULID, identifiant court public. Les identifiants apparaissent dans les URLs et l'API.

## Décision
Entiers auto-incrémentés (`INTEGER GENERATED ALWAYS AS IDENTITY`) pour toutes les entités, clés étrangères comprises. Exception : `club`, qui n'a qu'une seule ligne dont l'`id` vaut toujours 1. Les jetons d'invitation et de réinitialisation ne sont pas des identifiants : ce sont des chaînes aléatoires longues.

## Alternatives écartées
- UUID v4 : non devinable, mais 16 octets et index moins bien remplis, sans besoin à cette échelle.
- UUID v7 : triable par date, support moins universel selon la pile.
- Identifiant court public : à réserver à un éventuel besoin de lien partageable, non présent au MVP.

## Conséquences
- (+) Le plus simple et le plus compact ; lisible dans les journaux et les tests.
- (-) Les identifiants sont énumérables (`/events/43`) : chaque route vérifie les droits côté serveur (RG-14), ce que `architecture/security.md` détaille.
- (-) Pas d'identifiant connu avant l'insertion ; fusion de bases plus difficile.
