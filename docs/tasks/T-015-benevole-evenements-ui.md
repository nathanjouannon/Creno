# T-015 : Interface bénévole : consulter, s'inscrire, se désinscrire

Jalon : M3 – Inscriptions (bénévole) et suivi du remplissage  
Fonctionnalités : F-06, F-07, F-08  
Dépend de : T-010, T-014  
Taille : une session de travail

## Objectif
Les bénévoles voient les événements, s'inscrivent et se désinscrivent depuis leur téléphone.

## À lire avant de commencer
- `user-stories.md` (F-06, F-07, F-08)
- `flows/04-benevole-consulter-inscrire.mmd`
- `design/wireframes/02-benevole-evenements-*` (B1 à B7)
- `design/mockups/B3-evenement-creneaux-mobile.html`
- `design/components.md` (EventListItem, EventHeader, SlotCard `volunteer`, SlotStatusTag, AttendeeList, ConfirmDialog `unregister`)

## Travail
- Liste (B1, B2), page d'un événement et états de créneau (B3, B4), événement sans créneau (B5, texte à confirmer, voir `components.md`, section 8), confirmation de désinscription (B6), dernière place prise (B7).
- L'écran se met à jour après chaque action, sans temps réel (ADR-0008) ; l'administrateur voit les mêmes boutons d'inscription (RG-08).
- Messages « Complet », « Ce créneau a commencé », « Contacte un administrateur pour modifier ton inscription ».

## Critères d'acceptation
- Les scénarios de F-06, F-07 et F-08 passent en E2E sur un viewport de 360 px.
- Une inscription refusée pour `SLOT_FULL` affiche « Ce créneau vient d'être complété » et recharge l'état du créneau.
- Un événement passé saisi par URL affiche « introuvable » à un utilisateur.

## Tests attendus
- E2E : scénarios de F-06, F-07 (dont dernière place avec deux contextes de navigateur), F-08.
- Accessibilité : axe, ordre du focus, nom accessible des boutons « Je m'inscris » par créneau.

## Hors périmètre
- Mon planning (F-14, v1.1).

Terminé quand : `definition-of-done.md` est entièrement cochée.
