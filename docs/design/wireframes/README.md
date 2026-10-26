# Wireframes

Maquettes basse fidélité en deux versions, générées à partir de `docs/flows/*.mmd` et de `docs/prd.md` :
- `-mobile` : écran de 360 px (version prioritaire, les bénévoles utilisent surtout leur smartphone) ;
- `-desktop` : écran de 1000 px, avec navigation dans l'en-tête et contenu centré.

Chaque écran porte le même code dans les deux versions (A1, B3…) avec ses références (F-xx, flux, RG-xx).

| Fichier (à compléter par `-mobile` ou `-desktop`) | Écrans | Flux |
| --- | --- | --- |
| `01-authentification` | A1 à A9 : invitation, connexion, réinitialisation du mot de passe | 01, 02, 03 |
| `02-benevole-evenements` | B1 à B7 : liste, événement et états des créneaux, désinscription | 04 |
| `03-admin-evenements` | C1 à C10 : liste admin, remplissage (inscription de l'administrateur, retrait d'un inscrit), formulaires, invitation, suppression, passés, confirmation de retrait | 01, 05, 06 |
| `04-membres-et-compte` | D1 à D6, E1 à E3 : membres, fiche, menu du prénom, suppression du compte | 00, 07, 08 |

- `.excalidraw` : source éditable (à ouvrir sur excalidraw.com ou dans l'extension VS Code).
- `.png` : export pour la relecture.

Points marqués « à CONFIRMER » en orange : ils reprennent les questions encore ouvertes dans les flows (B5). Le texte orange de C6 est un avertissement, pas une question ouverte.
Les wireframes sont volontairement sans couleur de marque : les couleurs et tailles viendront de `design/tokens.json`.
