# ADR-0013 : Blocage de connexion par adresse saisie

Statut : acceptée (2026-10-26)

## Contexte
RG-03 bloque la connexion pendant 15 minutes après 5 échecs. Si le blocage ne s'applique qu'aux comptes existants, l'écran « Trop de tentatives » révèle qu'un compte existe pour une adresse donnée.

## Décision
Le compteur d'échecs et le blocage s'appliquent à l'adresse saisie, qu'elle corresponde ou non à un compte. La réponse est identique dans les deux cas. Les échecs sont stockés dans la table `login_attempts`, indexée par l'empreinte de l'adresse normalisée (pas l'adresse en clair), sans clé étrangère. Les anciennes lignes sont purgées. Une limite par adresse IP (par exemple 10 requêtes par minute sur la connexion) s'y ajoute, au niveau de l'application ou du reverse proxy ; les valeurs sont fixées dans `architecture/security.md`.

## Alternatives écartées
- Blocage des seuls comptes existants : révèle l'existence d'un compte, acceptable pour un petit club mais évitable à faible coût.
- Pas de message de blocage : plus sûr, mais l'utilisateur ne comprend pas l'échec, ce qui contredit F-02 et l'écran A7.

## Conséquences
- (+) Aucune fuite d'information sur l'existence d'un compte.
- (-) Un tiers peut bloquer 15 minutes la connexion à une adresse connue en la saisissant 5 fois ; atténué par la limite par adresse IP.
- (-) Une table de plus à purger.
