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

## Cadre

Merci de tester sur votre propre instance, sans accéder aux données d'autrui, sans déni de service ni ingénierie sociale. Le modèle de menaces et les protections en place sont décrits dans [`docs/architecture/security.md`](docs/architecture/security.md).
