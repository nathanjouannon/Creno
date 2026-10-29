# Wireframes : créneaux libres (F-22)

Statut : brouillon v0.1 (2026-10-29). Maquettes textuelles basse fidélité, version mobile (360 px) ; la version desktop reprend la même structure, centrée dans `size.content-max`. Comme pour la description de créneau (F-21), les `.excalidraw` et `.png` des écrans existants ne sont pas redessinés : les écrans nouveaux ou modifiés sont décrits ici, leurs composants dans [`../components.md`](../components.md) (`RegistrationModeField`, `FreeSlotForm`, `FreeSlotList`), leurs flux dans [`../../flows/10-creneaux-libres.mmd`](../../flows/10-creneaux-libres.mmd). Sans couleur de marque : les couleurs et tailles viendront de `tokens.json`.

Les codes d'écran prolongent ceux de `README.md` : **B8** et **B9** (côté bénévole, fichier `02`), **C2** (modifié) et **C11** (côté administrateur, fichier `03`), **C4** et **C5** (modifiés).

| Écran | Contenu | Flux | Règles |
| --- | --- | --- | --- |
| B8 | Page d'un événement côté bénévole en mode `FREE` ou `BOTH` : créneaux libres, « Choisir mes horaires » | 04, 10 | RG-19, RG-20 |
| B9 | Fenêtre « Choisir mes horaires » et ses erreurs | 10 | RG-20 |
| C2 (modifié) | Page d'un événement côté administrateur avec les créneaux libres et le retrait d'un inscrit | 06, 10 | RG-08, RG-20 |
| C4, C5 (modifiés) | Formulaire d'événement avec le choix « Inscriptions » | 05 | RG-19 |
| C11 | Changement de mode refusé | 05 | RG-19 |

## B8 – Événement en créneaux libres (bénévole, mode `FREE`)

```
┌──────────────────────────────────────┐
│ Créno                      Léa ▾     │
├──────────────────────────────────────┤
│ ← Événements                         │
│ Journée de ski du club               │
│ Les Arcs · 14 déc. 09:00 → 18:00     │
│ Montage, accueil, remontées...       │
│                                      │
│ Créneaux libres                      │
│ Choisis les heures où tu es dispo.   │
│ ┌──────────────────────────────────┐ │
│ │ Léa B. (toi)  10:00 – 12:30      │ │
│ │               [ Me désinscrire ] │ │
│ │ ──────────────────────────────── │ │
│ │ Marc D.       11:00 – 13:00      │ │
│ │ ──────────────────────────────── │ │
│ │ Sofia T.      14:00 – 16:00      │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [      Choisir mes horaires       ]  │
└──────────────────────────────────────┘
```

États de la liste : `filled` (ci-dessus) · `empty` : « Personne ne s'est encore inscrit. Choisis tes horaires. » avec le bouton `primary` · événement passé (`readonly`) : sans bouton. Une ligne commencée porte l'étiquette « Commencé » et, si elle est celle de l'utilisateur, la phrase « Contacte un administrateur pour modifier ton inscription » à la place de « Me désinscrire ».

## B8 – Mode `BOTH` : créneaux proposés puis créneaux libres

```
┌──────────────────────────────────────┐
│ Journée de ski du club               │
│ Les Arcs · 14 déc. 09:00 → 18:00     │
│                                      │
│ Créneaux proposés                    │
│ Inscris-toi sur un de ces créneaux,  │
│ ou choisis tes propres horaires.     │
│ ┌──────────────────────────────────┐ │
│ │ 09:00 – 12:00     [2 places rest.]│ │
│ │ Léa B., Marc D.                  │ │
│ │ [         Je m'inscris         ] │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ 13:00 – 16:00           [Complet]│ │
│ │ Sofia T., Karim L.               │ │
│ │ [      Complet (désactivé)     ] │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Créneaux libres                      │
│ ┌──────────────────────────────────┐ │
│ │ Nina P.       10:00 – 11:00      │ │
│ └──────────────────────────────────┘ │
│ [      Choisir mes horaires       ]  │
└──────────────────────────────────────┘
```

Les `SlotCard` sont inchangées (limite, « Complet », inscription et désinscription, RG-07 et RG-08). Un bénévole peut s'inscrire à un créneau proposé, choisir ses horaires, ou faire les deux.

## B9 – Fenêtre « Choisir mes horaires »

```
┌──────────────────────────────────────┐
│ Choisir mes horaires                 │
│ Événement : 14 déc., 09:00 → 18:00   │
│                                      │
│ Début                                │
│ [ 14/12/2026 ] [ 10:00 ]             │
│ Fin                                  │
│ [ 14/12/2026 ] [ 10:20 ]             │
│ (!) Un créneau libre dure au moins   │
│     30 minutes.                      │
│                                      │
│ [ Annuler ]        [ Enregistrer ]   │
└──────────────────────────────────────┘
```

Valeurs préremplies : jour de l'événement, début et fin de l'événement (le jour change seulement si l'événement dure plusieurs jours). Erreurs affichées sous le champ concerné, saisie conservée (`FieldError`) :

| Cas | Champ | Message |
| --- | --- | --- |
| Hors des dates de l'événement | début ou fin | Les horaires doivent rester dans les dates de l'événement. |
| Moins de 30 minutes | fin | Un créneau libre dure au moins 30 minutes. |
| Fin avant le début | fin | La fin doit être après le début. |
| Début déjà passé | début | Choisis une heure de début à venir. |
| Recouvre un de mes créneaux libres | `Alert danger` en tête de la fenêtre | Tu as déjà des horaires qui recouvrent ceux-ci. |

Focus : à l'ouverture sur « Début » ; piégé dans la fenêtre ; Échap ferme (comme `ConfirmDialog`). Après un enregistrement réussi, la fenêtre se ferme, la ligne apparaît dans `FreeSlotList` et un `Toast success` « Tes horaires sont enregistrés. » s'affiche.

## C2 – Événement côté administrateur (créneaux libres)

```
┌──────────────────────────────────────┐
│ Journée de ski du club  [Modifier]   │
│ Mode : Les deux                      │
│ [Inviter des bénévoles] [Supprimer]  │
│                                      │
│ Créneaux (1)         [Ajouter]       │
│ ┌──────────────────────────────────┐ │
│ │ 09:00 – 12:00            [2 / 4] │ │
│ │ Léa B. ×   Marc D. ×             │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Créneaux libres · 3 inscrits         │
│ ┌──────────────────────────────────┐ │
│ │ Nina P.       10:00 – 11:00   ×  │ │
│ │ Marc D.       11:00 – 13:00   ×  │ │
│ │ Sofia T.      14:00 – 16:00   ×  │ │
│ └──────────────────────────────────┘ │
│ [      Choisir mes horaires       ]  │
└──────────────────────────────────────┘
```

Le mode est rappelé sous le titre (« Mode : Créneaux fixes », « Créneaux libres » ou « Les deux »). Le « × » ouvre `ConfirmDialog remove-registration` (C10) avec « Marc D. ne sera plus inscrit(e) à ce créneau libre » ; il est proposé même sur un créneau libre commencé, absent sur un événement passé. En mode `FREE`, le bloc « Créneaux » et son bouton « Ajouter » sont absents ; en mode `FIXED`, le bloc « Créneaux libres » est absent. Aucune alerte « Aucun inscrit » sur les créneaux libres : liste vide = « Aucun inscrit pour le moment. »

## C4, C5 – Formulaire d'événement : choix « Inscriptions »

```
┌──────────────────────────────────────┐
│ Créer un événement                   │
│ Titre            [__________________]│
│ ...                                  │
│ Début / Fin      [ jour ][ heure ]   │
│                                      │
│ Inscriptions                         │
│ (•) Créneaux fixes                   │
│     Tu définis les créneaux, les     │
│     bénévoles s'y inscrivent.        │
│ ( ) Créneaux libres                  │
│     Chaque bénévole choisit ses      │
│     heures de début et de fin.       │
│ ( ) Les deux                         │
│     Tes créneaux sont proposés, et   │
│     chacun peut aussi choisir ses    │
│     heures.                          │
│                                      │
│ Créneaux (masqués en « libres »)     │
│ [ Ajouter un créneau ]               │
│ [ Annuler ]          [ Enregistrer ] │
└──────────────────────────────────────┘
```

Par défaut « Créneaux fixes ». En modification, une option que le contenu actuel interdit est désactivée avec sa raison en texte sous l'option (« Supprime d'abord les créneaux fixes (2). » pour « Créneaux libres », « Supprime d'abord les créneaux libres (3). » pour « Créneaux fixes »), sans couleur seule.

## C11 – Changement de mode refusé

```
┌──────────────────────────────────────┐
│ Modifier l'événement                 │
│ (!) Pour passer en créneaux libres,  │
│     supprime d'abord les créneaux    │
│     fixes (2).                       │
│ Inscriptions                         │
│ ( ) Créneaux fixes                   │
│ ( ) Créneaux libres   (désactivé)    │
│ (•) Les deux                         │
│ [ Annuler ]          [ Enregistrer ] │
└──────────────────────────────────────┘
```

Cet écran n'apparaît que si le serveur refuse malgré l'interface (par exemple un créneau ajouté entre-temps par un autre administrateur) : `Alert danger` avec le message du catalogue (`EVENT_MODE_HAS_SLOTS` ou `EVENT_MODE_HAS_FREE_SLOTS`), valeur d'origine rétablie, rien n'est modifié.

## Accessibilité et mobile

- Aucun défilement horizontal à 360 px : horaires sous le nom si la ligne est trop étroite.
- Chaque bouton « Me désinscrire » ou « Retirer » nomme la personne et les horaires (« Retirer Marc D., 11:00 – 13:00 »).
- Le sens ne repose jamais sur la couleur seule : « Commencé », « (toi) » et les raisons des options désactivées sont écrits.
- Les champs date et heure ont une étiquette visible ; l'ordre du focus suit l'ordre visuel.
