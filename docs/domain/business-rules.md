# Règles de gestion – openBenevola

Statut : brouillon v0.1 (2026-10-22). Les règles sont numérotées (RG-01, RG-02…) afin d'être citées dans le code, les user stories, les tickets et les tests. Un numéro n'est jamais réutilisé : une règle abandonnée est barrée, pas renumérotée.

## Comptes
- **RG-01** : Un compte comporte un nom, un prénom, une adresse e-mail unique et un mot de passe d'au moins 10 caractères (aucune autre règle de complexité).
- **RG-03** : Après 5 échecs de connexion consécutifs, la connexion est bloquée 15 minutes pour ce compte.
- **RG-11** : À la suppression d'un compte, les données nominatives sont effacées, les inscriptions futures sont libérées et les inscriptions passées sont anonymisées (« ancien membre »).
- **RG-12** : Mot de passe oublié : l'administrateur génère pour le compte un lien de réinitialisation à usage unique et le transmet lui-même. Durée de validité à fixer (proposition : 48 h).

## Invitations
- **RG-02** : Un lien d'invitation est généré depuis un événement. Il est réutilisable par plusieurs personnes et valable jusqu'au début de cet événement (début de son premier créneau). Il permet de créer un compte, actif immédiatement, et de rejoindre le club, donc d'accéder à tous les événements du club.

## Administration
- **RG-04** : Il existe toujours au moins un administrateur actif. Le premier est créé à l'installation. Un administrateur peut donner le droit administrateur à un autre membre, mais seul l'intéressé peut retirer son propre droit. Le dernier administrateur ne peut ni se retirer le droit, ni supprimer son compte.
- **RG-05** : Un administrateur ne peut pas désactiver ni supprimer le compte d'un autre administrateur. Il doit d'abord s'être retiré son droit.

## Événements
- **RG-06** : Un événement comporte un titre, une description et un lieu. Il ne peut pas être enregistré sans au moins un créneau. Il commence au début de son premier créneau.
- **RG-09** : Les utilisateurs voient les noms des inscrits de chaque créneau. Un événement est passé quand son dernier créneau est terminé ; il est alors masqué pour les utilisateurs et reste visible par les administrateurs.
- **RG-10** : Supprimer un événement ou un créneau qui a des inscrits exige une confirmation indiquant le nombre d'inscrits concernés. Aucune notification n'est envoyée.

## Créneaux et inscriptions
- **RG-07** : Un créneau comporte une date, une heure de début, une heure de fin et une limite de places facultative. Sans limite, le nombre de places est illimité. La limite n'est jamais dépassée par une inscription d'utilisateur et ne peut pas être abaissée sous le nombre d'inscrits.
- **RG-08** : Un utilisateur peut s'inscrire et se désinscrire d'un créneau jusqu'à son heure de début. Il ne peut être inscrit qu'une fois au même créneau. Le chevauchement de deux créneaux n'est pas contrôlé.

## Notifications
- **RG-13** : Au MVP, l'application n'envoie aucun e-mail.
