# ADR-0004 : Déploiement par Docker sur VPS ou Raspberry

Statut : acceptée (2026-10-26)

## Contexte
Open source, budget logiciel 0 €, auto-hébergeable sur une infrastructure très bon marché (PRD section 6). Aucune astreinte : disponibilité visée 99 % par mois, sauvegarde quotidienne, restauration en moins de 4 h. Hébergement dans l'Union européenne (RGPD).

## Décision
Une image Docker de l'application et un fichier `docker compose` qui démarre l'application, PostgreSQL et un reverse proxy. Cibles : petit VPS ou Raspberry, chez un membre du club ou un hébergeur européen (coût visé 5 € par mois au plus). Configuration par variables d'environnement ; `docker compose up` suffit à démarrer.

## Alternatives écartées
- PaaS gratuit (Vercel, Render, Fly avec base gérée gratuite) : vrai 0 € mais limites et dépendance au fournisseur, auto-hébergement moins direct. Un guide de déploiement sur PaaS pourra être ajouté plus tard.
- Hébergement mutualisé sans Docker : ne convient pas à Next.js et PostgreSQL.

## Conséquences
- (+) Reproductible partout, l'association garde la maîtrise de ses données.
- (-) L'exploitation (mises à jour, sauvegardes, certificats) est à la charge du club : couverte par `architecture/environments.md`.
- Le reverse proxy est Caddy (HTTPS automatique) ; le détail du déploiement, des sauvegardes et de la mise à jour est dans `architecture/environments.md`.
