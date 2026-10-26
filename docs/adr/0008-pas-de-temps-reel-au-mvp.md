# ADR-0008 : Pas de temps réel au MVP

Statut : acceptée (2026-10-26)

## Contexte
F-07 demande que l'inscription soit visible sans recharger manuellement l'écran de confirmation. L'écran B7 gère la dernière place prise entre-temps. Environ 20 utilisateurs simultanés au plus.

## Décision
Pas de WebSocket ni de SSE. L'interface se met à jour après chaque action de l'utilisateur et au rafraîchissement de la page. La concurrence est gérée côté serveur : la dernière place n'est attribuée qu'une fois (RG-07) et l'utilisateur qui arrive trop tard voit « Ce créneau vient d'être complété ».

## Alternatives écartées
- Interrogation périodique toutes les 30 à 60 secondes : un peu plus fluide, charge inutile à cette échelle.
- Temps réel (SSE ou WebSocket, ou Convex) : complexité d'hébergement et de test non justifiée au MVP.

## Conséquences
- (+) Architecture plus simple, aucun service persistant en plus.
- (-) Un utilisateur ne voit pas l'inscription d'un autre sans recharger ; atténué par la gestion du conflit côté serveur.
- Réévaluable après le premier événement réel si le besoin se confirme.
