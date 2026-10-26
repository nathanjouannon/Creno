# Règles de gestion – Créno

Statut : brouillon v0.3 (2026-10-26). Les règles sont numérotées (RG-01, RG-02…) afin d'être citées dans le code, les user stories, les tickets et les tests. Un numéro n'est jamais réutilisé : une règle abandonnée est barrée, pas renumérotée. Les termes suivent `glossary.md` (utilisateur, créneau, inscription…).

Révision v0.2 : vocabulaire aligné sur le glossaire, précisions sur RG-01, RG-03, RG-06 à RG-09, RG-11 et RG-12 ; ajout de RG-14 à RG-16.
Révision v0.3 : blocage de connexion par adresse saisie (RG-03), premier administrateur créé par la page d'installation (RG-04), fuseau du club (RG-16) ; ajout de RG-17.

## Comptes
- **RG-01** : Un utilisateur comporte un nom, un prénom (non vides), une adresse e-mail et un mot de passe d'au moins 10 caractères (aucune autre règle de complexité). L'adresse e-mail est unique sans tenir compte de la casse ; les espaces autour sont retirés avant enregistrement. Aucun e-mail de vérification n'est envoyé (RG-13) : l'adresse n'est pas confirmée.
- **RG-03** : Après 5 échecs de connexion consécutifs avec une même adresse e-mail saisie, que cette adresse corresponde ou non à un compte, la connexion avec cette adresse est bloquée 15 minutes, même avec le bon mot de passe. La réponse est identique dans les deux cas. Une connexion réussie remet le compteur à zéro ; les tentatives pendant le blocage ne le prolongent pas. Une limite par adresse IP s'y ajoute (valeurs dans `architecture/security.md`).
- **RG-11** : À la suppression d'un compte, par son titulaire après confirmation, les données nominatives sont effacées. Les inscriptions à des créneaux qui n'ont pas commencé sont libérées ; celles des créneaux déjà commencés sont conservées et anonymisées (« ancien membre »).
- **RG-12** : Mot de passe oublié : l'administrateur génère pour l'utilisateur un lien de réinitialisation à usage unique et le transmet lui-même. Le lien est valable 3 jours. Générer un nouveau lien invalide les précédents. Une réinitialisation réussie remet à zéro le blocage de RG-03 et ferme toutes les sessions ouvertes de l'utilisateur.

## Invitations
- **RG-02** : Une invitation est un lien généré par un administrateur depuis un événement qui n'a pas commencé. Il est réutilisable par plusieurs personnes et valable jusqu'à la date et l'heure de début actuelles de cet événement (si l'événement est reporté, la validité suit). Il permet de créer un compte, actif immédiatement, et de rejoindre le club, donc d'accéder à tous les événements du club. Supprimer l'événement rend ses invitations invalides.

## Administration
- **RG-04** : Il existe toujours au moins un administrateur. Le premier est créé par la page d'installation (RG-17). Un administrateur peut donner le droit administrateur à un autre utilisateur, mais seul l'intéressé peut retirer son propre droit. Le dernier administrateur ne peut ni se retirer le droit, ni supprimer son compte. Le contrôle est atomique : deux retraits simultanés ne peuvent pas laisser zéro administrateur.
- ~~**RG-05**~~ : *abandonnée le 2026-10-23 : la désactivation d'un compte par un administrateur est retirée du MVP. Un compte ne se supprime que par son titulaire (RG-11).*
- **RG-17** : À l'installation d'une instance, une page unique crée le club (nom et fuseau horaire) et le premier administrateur (nom, prénom, e-mail, mot de passe, RG-01). Elle n'est accessible que tant qu'aucun utilisateur n'existe ; ensuite elle répond « introuvable ». La création du club et de l'administrateur est atomique : si deux installations arrivent en même temps, une seule aboutit. Avant l'installation, toute autre page redirige vers elle.
- **RG-14** : Seul un administrateur peut effectuer une action d'administration (gérer les événements, créneaux, invitations, utilisateurs, liens de réinitialisation, inscriptions d'autrui). La vérification se fait côté serveur pour chaque requête, jamais seulement dans l'interface.

## Événements
- **RG-06** : Un événement comporte un titre (obligatoire), une description et un lieu (facultatifs), une date et heure de début et une date et heure de fin (fin après début). Il peut être enregistré sans créneau : les créneaux s'ajoutent ensuite.
- **RG-09** : Les utilisateurs voient les noms des inscrits de chaque créneau, au format « Prénom N. » (prénom et initiale du nom) ; les inscriptions anonymisées s'affichent « ancien membre ». Un événement est passé quand sa date et heure de fin sont dépassées ; il est alors masqué pour les utilisateurs (une URL directe répond « introuvable ») et reste visible par les administrateurs.
- **RG-10** : Supprimer un événement ou un créneau qui a des inscrits exige une confirmation indiquant le nombre d'inscrits concernés (pour un événement : tous créneaux confondus). Sans inscrit, la suppression est immédiate. Aucune notification n'est envoyée.
- **RG-15** : Un événement passé est en lecture seule : ni lui ni ses créneaux ne peuvent être modifiés ou supprimés, et les inscriptions ne changent plus.

## Créneaux et inscriptions
- **RG-07** : Un créneau comporte une date, une heure de début, une heure de fin (après le début) et une limite de places facultative, d'au moins 1. Sans limite, le nombre de places est illimité. La limite n'est jamais dépassée par une inscription d'utilisateur et ne peut pas être abaissée sous le nombre d'inscrits. Un créneau peut sortir des dates de l'événement (par exemple un montage avant le début) : l'administrateur en est averti mais peut valider. L'inscription est atomique : la dernière place ne peut pas être attribuée à deux personnes.
- **RG-08** : Un utilisateur, administrateur compris, peut s'inscrire et se désinscrire d'un créneau tant que celui-ci n'a pas commencé (heure courante strictement avant son heure de début). Il ne peut être inscrit qu'une fois au même créneau. Le chevauchement de deux créneaux n'est pas contrôlé. Un administrateur peut retirer l'inscription d'un utilisateur, avec confirmation, même sur un créneau commencé, tant que l'événement n'est pas passé (RG-15) ; l'ajout d'un inscrit par un administrateur est prévu en v1.1 (F-12).
- **RG-16** : Une instance a un seul fuseau horaire, celui du club, choisi à l'installation (`Club.timezone`). Toutes les dates et heures saisies et affichées sont dans ce fuseau ; elles sont stockées avec leur fuseau (UTC).

## Notifications
- **RG-13** : Au MVP, l'application n'envoie aucun e-mail.

## Contraintes pour la phase architecture
- Atomicité requise : inscription à la dernière place (RG-07) et retrait du droit administrateur (RG-04) ; à traiter par transaction ou verrou, et à couvrir par des tests de concurrence.
