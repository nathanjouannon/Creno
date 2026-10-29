# Politique de sécurité

## Versions prises en charge

Créno est en phase MVP : seule la dernière version publiée (la branche `main` et sa dernière release) reçoit des correctifs de sécurité.

## Signaler une vulnérabilité

**Ne créez pas d'issue publique.** Utilisez le signalement privé de GitHub : onglet **Security** du dépôt, puis **Report a vulnerability**. Le rapport n'est visible que de vous et des mainteneurs.

Indiquez si possible :

- la route, la page ou le composant concerné ;
- les étapes pour reproduire, et l'effet obtenu ;
- la version ou le commit testé.

Ne joignez ni mot de passe, ni jeton, ni données personnelles réelles.

## Ce que vous pouvez attendre

- Un accusé de réception sous 7 jours.
- Une première évaluation (confirmée ou non, gravité) sous 14 jours.
- Un correctif publié avant toute divulgation, puis une mention de votre contribution si vous le souhaitez.

Le projet est maintenu bénévolement : ces délais sont des objectifs, pas des garanties.

## Cadre

Merci de tester sur votre propre instance, sans accéder aux données d'autrui, sans déni de service ni ingénierie sociale. Le modèle de menaces et les protections en place sont décrits dans [`docs/architecture/security.md`](docs/architecture/security.md).
