# User stories – Créno

Statut : brouillon v0.3 (2026-10-26, aligné sur la revue des règles de gestion, le glossaire et la phase architecture). Chaque histoire porte l'identifiant de la fonctionnalité du tableau MoSCoW de `prd.md` (F-01, F-02…). Les règles de gestion (RG-xx) sont définies dans [`domain/business-rules.md`](domain/business-rules.md) et référencées dans les scénarios.

Rôles : **administrateur** (`ADMIN`) et **utilisateur** (`USER`, appelé « bénévole » ou « membre » dans l'interface, voir `glossary.md`). Un administrateur dispose aussi de toutes les actions d'un utilisateur, y compris s'inscrire à un créneau (RG-08).

---

## MVP (v1)

### « Installation de l'instance » (F-19)

En tant que **personne qui met en place Créno pour son association**, je veux créer le club et son premier administrateur depuis une page d'installation afin de pouvoir ensuite inviter les bénévoles.

Scénario 1 : installation réussie (RG-17, RG-04, RG-16, RG-01)
- Given : une instance neuve, sans aucun utilisateur
- When : la personne ouvre l'adresse de l'instance, saisit le nom du club « Ski Club des Arcs », le fuseau horaire « Europe/Paris », son nom, son prénom, son e-mail `mail.ex@exemple.fr` et un mot de passe de 10 caractères ou plus, puis valide
- Then : le club et l'administrateur sont créés, la personne est connectée en administrateur et arrive sur la liste des événements, qui affiche « Aucun événement à venir pour le moment »

Scénario 2 : champ manquant ou invalide (RG-01, RG-17)
- Given : la page d'installation
- When : la personne laisse le nom du club vide, ou saisit un mot de passe de 9 caractères, ou un e-mail mal formé, et valide
- Then : rien n'est créé, les messages d'erreur s'affichent sous les champs concernés et les autres champs restent remplis

Scénario 3 : page indisponible après l'installation (RG-17)
- Given : une instance déjà installée
- When : une personne ouvre l'adresse de la page d'installation
- Then : la page répond « introuvable » et aucun second administrateur ne peut être créé par ce biais

Scénario 4 : redirection avant installation (RG-17)
- Given : une instance non installée
- When : une personne ouvre l'URL d'un événement, de la connexion ou de n'importe quelle autre page
- Then : elle est redirigée vers la page d'installation

Scénario 5 : deux installations simultanées (RG-17)
- Given : une instance non installée et deux personnes qui valident la page d'installation en même temps
- When : les deux demandes arrivent
- Then : une seule installation aboutit, l'autre voit « introuvable » et il n'existe qu'un club et un administrateur

### « Invitation et création de compte » (F-01)

**Histoire 1.** En tant qu'**administrateur**, je veux générer un lien d'invitation depuis un événement afin que les bénévoles du club puissent créer leur compte.

Scénario 1 : génération du lien (RG-02)
- Given : un administrateur connecté sur la page d'un événement qui n'a pas encore commencé
- When : il clique sur « Inviter des bénévoles »
- Then : un lien est affiché avec sa date de fin de validité (le début de l'événement) et un bouton pour le copier

Scénario 1 bis : événement reporté (RG-02)
- Given : un lien d'invitation généré pour un événement qui commence le 14 mars à 08:00
- When : l'administrateur reporte le début de l'événement au 21 mars à 08:00
- Then : le même lien reste valable jusqu'au 21 mars à 08:00

**Histoire 2.** En tant que **personne invitée**, je veux créer mon compte à partir du lien reçu afin de rejoindre le club et voir ses événements.

Scénario 2 : création de compte réussie (RG-01, RG-02)
- Given : une personne sans compte qui ouvre un lien d'invitation valide
- When : elle saisit son nom, son prénom, son e-mail `mail.ex@exemple.fr` et un mot de passe de 10 caractères ou plus, puis clique sur « Créer mon compte »
- Then : son compte est actif, elle est connectée, arrive sur la page de l'événement dont provient le lien et son prénom s'affiche en haut à droite

Scénario 3 : mot de passe trop court (RG-01)
- Given : une personne sur le formulaire de création de compte
- When : elle saisit un mot de passe de 9 caractères et valide
- Then : le compte n'est pas créé et le message « Le mot de passe doit contenir au moins 10 caractères » s'affiche, les autres champs restant remplis

Scénario 4 : lien expiré (RG-02)
- Given : un lien d'invitation dont l'événement a déjà commencé
- When : une personne l'ouvre
- Then : aucun compte ne peut être créé et le message « Ce lien n'est plus valide, demande un nouveau lien à un administrateur » s'affiche

Scénario 5 : e-mail déjà utilisé (RG-01)
- Given : une personne qui possède déjà un compte avec `mail.ex@exemple.fr` et ouvre un lien d'invitation valide
- When : elle saisit cet e-mail dans le formulaire de création, quelle que soit la casse (`Mail.Ex@exemple.fr`)
- Then : aucun second compte n'est créé et un message lui propose de se connecter

Scénario 5 bis : connexion après une invitation (RG-02)
- Given : la personne du scénario précédent, sur la page de connexion après avoir ouvert un lien d'invitation valide
- When : elle se connecte avec ses identifiants
- Then : elle arrive sur la page de l'événement dont provient le lien

Scénario 6 : champ manquant ou invalide (RG-01)
- Given : une personne sur le formulaire de création de compte
- When : elle laisse le nom, le prénom ou l'e-mail vide, ou saisit un e-mail mal formé, et clique sur « Créer mon compte »
- Then : le compte n'est pas créé, un toast « Renseigne ton nom, ton prénom et une adresse e-mail valide » s'affiche et les champs saisis sont conservés

Scénario 7 : invitation impossible sur un événement commencé (RG-02)
- Given : un administrateur sur la page d'un événement dont la date de début est passée
- When : il consulte la page
- Then : le bouton « Inviter des bénévoles » n'est pas affiché

### « Connexion et déconnexion » (F-02)

En tant qu'**utilisateur**, je veux me connecter avec mon e-mail et mon mot de passe afin d'accéder aux événements du club.

Scénario 1 : connexion réussie
- Given : un utilisateur inscrit avec l'e-mail `mail.ex@exemple.fr` et le mot de passe correct, sur la page de connexion
- When : il saisit son e-mail et son mot de passe, puis clique sur « Se connecter »
- Then : il est redirigé vers la liste des événements et son prénom s'affiche en haut à droite

Scénario 2 : mot de passe incorrect
- Given : le même utilisateur, sur la page de connexion
- When : il saisit un mot de passe erroné et clique sur « Se connecter »
- Then : il reste sur la page, voit le message « E-mail ou mot de passe incorrect » et le champ mot de passe est vidé

Scénario 3 : blocage après trop d'essais (RG-03)
- Given : un utilisateur qui a déjà échoué 5 fois de suite
- When : il tente une 6e connexion, même avec le bon mot de passe
- Then : l'accès est bloqué 15 minutes et un message l'indique

Scénario 3 ter : adresse sans compte (RG-03)
- Given : une adresse e-mail qui ne correspond à aucun compte, saisie 5 fois de suite avec un mot de passe quelconque
- When : une personne tente une 6e connexion avec cette adresse
- Then : le même message de blocage de 15 minutes s'affiche que pour un compte existant, ce qui ne révèle pas si l'adresse a un compte

Scénario 3 bis : compteur remis à zéro (RG-03)
- Given : un utilisateur qui a échoué 4 fois de suite
- When : il se connecte avec le bon mot de passe puis échoue une fois de plus plus tard
- Then : cet échec compte pour le premier, l'accès n'est pas bloqué

Scénario 1 bis : retour à la page demandée
- Given : une personne non connectée qui a ouvert l'URL d'un événement et a été redirigée vers la page de connexion
- When : elle se connecte avec des identifiants corrects
- Then : elle arrive sur la page de cet événement et non sur la liste des événements

Scénario 4 : déconnexion
- Given : un utilisateur connecté
- When : il clique sur « Se déconnecter »
- Then : il revient sur la page de connexion et ne peut plus accéder aux pages protégées sans se reconnecter

Scénario 5 : réinitialisation du mot de passe (RG-12, RG-01)
- Given : un utilisateur qui a reçu de l'administrateur un lien de réinitialisation valide (moins de 3 jours)
- When : il ouvre le lien, saisit un nouveau mot de passe de 10 caractères ou plus et valide
- Then : son mot de passe est changé, le lien ne fonctionne plus, ses sessions ouvertes sont fermées, un éventuel blocage de connexion est levé et il peut se connecter avec le nouveau mot de passe

Scénario 6 : lien de réinitialisation expiré ou déjà utilisé (RG-12)
- Given : un lien de réinitialisation de plus de 3 jours, ou déjà utilisé
- When : une personne l'ouvre
- Then : le mot de passe n'est pas modifiable et le message « Ce lien n'est plus valide, demande un nouveau lien à un administrateur » s'affiche

### « Rôles et permissions » (F-03)

En tant qu'**administrateur**, je veux que les actions d'administration soient réservées aux administrateurs afin que les bénévoles ne puissent pas modifier les événements ni les comptes.

Scénario 1 : accès refusé à un utilisateur (RG-14)
- Given : un utilisateur sans droit administrateur, connecté
- When : il ouvre directement l'URL de la page de création d'événement ou de gestion des membres
- Then : l'accès est refusé avec le message « Tu n'as pas le droit d'accéder à cette page » et rien n'est modifié

Scénario 2 : action d'administration refusée côté serveur (RG-14)
- Given : un utilisateur sans droit administrateur, connecté
- When : il envoie directement une requête de suppression d'événement
- Then : la requête est refusée et l'événement n'est pas supprimé

Scénario 3 : visiteur non connecté
- Given : une personne non connectée
- When : elle ouvre l'URL de n'importe quelle page du club
- Then : elle est redirigée vers la page de connexion

Scénario 4 : accès administrateur
- Given : un administrateur connecté
- When : il ouvre la page de création d'événement
- Then : la page s'affiche normalement

### « Créer, modifier, supprimer un événement » (F-04)

En tant qu'**administrateur**, je veux créer et gérer des événements afin de publier les besoins en bénévoles.

Scénario 1 : création réussie (RG-06)
- Given : un administrateur sur la page de création d'événement
- When : il saisit le titre « Course de ski du 15 janvier », une description, le lieu « Station des Arcs », un début le 15 janvier à 08:00, une fin le 15 janvier à 17:00, ajoute un créneau et clique sur « Enregistrer »
- Then : l'événement apparaît dans la liste des événements à venir, visible par tous les utilisateurs, et l'administrateur arrive sur la page de l'événement

Scénario 2 : titre manquant
- Given : un administrateur sur le formulaire de création
- When : il laisse le titre vide et clique sur « Enregistrer »
- Then : l'événement n'est pas créé et le message « Le titre est obligatoire » s'affiche

Scénario 3 : création sans créneau (RG-06)
- Given : un administrateur sur le formulaire, titre, lieu et dates remplis, aucun créneau ajouté
- When : il clique sur « Enregistrer »
- Then : l'événement est créé sans créneau et l'administrateur arrive sur sa page, où il peut en ajouter

Scénario 3 bis : dates incohérentes (RG-06)
- Given : un administrateur sur le formulaire de création
- When : il saisit une date de fin antérieure ou égale à la date de début et clique sur « Enregistrer »
- Then : l'événement n'est pas créé et le message « La fin doit être après le début » s'affiche

Scénario 4 : modification
- Given : un administrateur sur la page d'un événement existant
- When : il change le lieu et enregistre
- Then : le nouveau lieu s'affiche pour tous les utilisateurs et les inscriptions sont conservées

Scénario 5 : suppression avec inscrits (RG-10)
- Given : un administrateur sur un événement dont les créneaux totalisent 6 inscrits
- When : il clique sur « Supprimer »
- Then : une confirmation indique « 6 inscriptions seront supprimées » ; après confirmation, l'événement et ses inscriptions disparaissent, et sans confirmation rien n'est supprimé

Scénario 6 : suppression sans inscrit (RG-10)
- Given : un administrateur sur un événement dont aucun créneau n'a d'inscrit
- When : il clique sur « Supprimer »
- Then : l'événement est supprimé immédiatement, sans confirmation

Scénario 7 : événement passé en lecture seule (RG-15)
- Given : un administrateur sur la page d'un événement dont la date de fin est dépassée
- When : il consulte la page
- Then : les boutons « Modifier », « Supprimer », « Ajouter un créneau » et ceux des créneaux ne sont pas proposés, et les inscriptions ne peuvent plus changer

Scénario 8 : fuseau horaire du club (RG-16)
- Given : une instance configurée sur le fuseau « Europe/Paris »
- When : l'administrateur saisit un début à 08:00 pour un événement
- Then : l'événement s'affiche à 08:00 pour tous les utilisateurs, quel que soit le fuseau de leur appareil

### « Créneaux et nombre de places » (F-05)

En tant qu'**administrateur**, je veux définir des créneaux avec une limite de places facultative afin de répartir les bénévoles sur la durée de l'événement.

Scénario 1 : créneau illimité par défaut (RG-07)
- Given : un administrateur qui ajoute un créneau à un événement
- When : il saisit la date, le début 09:00 et la fin 12:00 sans renseigner de limite
- Then : le créneau est créé sans limite de places

Scénario 2 : créneau limité (RG-07)
- Given : un créneau limité à 4 places comptant déjà 4 inscrits
- When : un cinquième utilisateur tente de s'inscrire
- Then : l'inscription est refusée, le créneau est marqué « Complet » et il reste 4 inscrits

Scénario 3 : horaires incohérents (RG-07)
- Given : un administrateur qui ajoute un créneau
- When : il saisit une heure de fin antérieure ou égale à l'heure de début
- Then : le créneau n'est pas créé et le message « La fin doit être après le début » s'affiche

Scénario 3 bis : limite inférieure à 1 (RG-07)
- Given : un administrateur qui ajoute un créneau
- When : il saisit une limite de 0 place
- Then : le créneau n'est pas créé et un message indique que la limite doit être d'au moins 1 (ou vide pour illimité)

Scénario 3 ter : créneau hors des dates de l'événement (RG-07)
- Given : un événement du 14 mars de 08:00 à 18:00 et un administrateur qui ajoute un créneau le 14 mars de 07:00 à 08:00
- When : il valide le créneau
- Then : un avertissement « Ce créneau est hors des dates de l'événement » s'affiche mais le créneau est créé

Scénario 4 : limite inférieure aux inscrits (RG-07)
- Given : un créneau avec 5 inscrits
- When : l'administrateur essaie de fixer la limite à 3
- Then : la modification est refusée avec le message « 5 personnes sont déjà inscrites : retire des inscrits avant de baisser la limite » et la limite reste inchangée

Scénario 5 : passage d'illimité à limité (RG-07)
- Given : un créneau illimité avec 5 inscrits
- When : l'administrateur fixe la limite à 8
- Then : la limite est enregistrée et il reste 3 places

Scénario 6 : suppression d'un créneau avec inscrits (RG-10)
- Given : un créneau de 3 inscrits, dans un événement qui a un autre créneau
- When : l'administrateur supprime ce créneau et confirme « 3 inscriptions seront supprimées »
- Then : le créneau et ses inscriptions disparaissent et l'autre créneau est inchangé

Scénario 7 : suppression d'un créneau sans inscrit (RG-10)
- Given : un créneau sans inscrit
- When : l'administrateur clique sur « Supprimer » ce créneau
- Then : le créneau est supprimé immédiatement, sans confirmation

Scénario 8 : suppression du dernier créneau (RG-06)
- Given : un événement qui n'a qu'un créneau
- When : l'administrateur supprime ce créneau
- Then : l'événement est conservé sans créneau

### « Consulter les événements et leurs créneaux » (F-06)

En tant qu'**utilisateur**, je veux voir les événements à venir et leurs créneaux afin de savoir où le club a besoin de moi.

Scénario 1 : liste des événements à venir (RG-09)
- Given : un utilisateur connecté et deux événements à venir
- When : il ouvre la page d'accueil
- Then : les deux événements sont listés par date de début croissante, avec titre, lieu et date

Scénario 2 : détail d'un créneau limité (RG-07, RG-09)
- Given : un créneau limité à 4 places avec 3 inscrits : Léa Bernard, Marc Dupont et Sofia Thomas
- When : l'utilisateur ouvre l'événement
- Then : le créneau affiche les horaires, les noms « Léa B., Marc D., Sofia T. » (prénom et initiale du nom, RG-09) et « 1 place restante »

Scénario 3 : détail d'un créneau illimité (RG-07)
- Given : un créneau sans limite avec 2 inscrits
- When : l'utilisateur ouvre l'événement
- Then : les noms des 2 inscrits s'affichent, aucun nombre de places restantes n'est affiché et l'inscription reste possible

Scénario 4 : événement passé masqué (RG-09)
- Given : un événement dont la date de fin est dépassée
- When : un utilisateur ouvre la liste des événements
- Then : cet événement n'apparaît pas, alors qu'un administrateur le retrouve dans une section « Événements passés »

Scénario 4 bis : URL d'un événement passé (RG-09)
- Given : un événement dont la date de fin est dépassée
- When : un utilisateur sans droit administrateur ouvre directement son URL
- Then : la page répond « introuvable » comme pour un événement qui n'existe pas

Scénario 5 : aucun événement
- Given : aucun événement à venir
- When : un utilisateur ouvre la page d'accueil
- Then : le message « Aucun événement à venir pour le moment » s'affiche

### « S'inscrire à un créneau » (F-07)

En tant qu'**utilisateur**, je veux m'inscrire à un créneau afin de confirmer ma présence.

Scénario 1 : inscription réussie (RG-08)
- Given : un utilisateur connecté, non inscrit, devant un créneau à venir avec des places
- When : il clique sur « Je m'inscris »
- Then : son nom apparaît dans la liste du créneau, le bouton devient « Me désinscrire » et le nombre de places restantes diminue de 1 si le créneau est limité

Scénario 2 : créneau complet (RG-07)
- Given : un créneau limité complet
- When : un utilisateur non inscrit ouvre l'événement
- Then : le bouton d'inscription est indisponible et le créneau affiche « Complet »

Scénario 3 : dernière place prise en même temps (RG-07)
- Given : un créneau limité avec une seule place restante et deux utilisateurs qui cliquent en même temps
- When : les deux demandes arrivent
- Then : une seule inscription est enregistrée, l'autre utilisateur voit « Ce créneau vient d'être complété » et la limite n'est pas dépassée

Scénario 4 : créneau commencé (RG-08)
- Given : un créneau dont l'heure de début est passée
- When : un utilisateur ouvre l'événement
- Then : il ne peut plus s'inscrire et le message « Ce créneau a commencé » s'affiche

Scénario 4 bis : frontière exacte (RG-08)
- Given : un créneau qui commence à 09:00 et un utilisateur non inscrit
- When : il clique sur « Je m'inscris » à 09:00 précises
- Then : l'inscription est refusée, le créneau étant commencé

Scénario 4 ter : un administrateur s'inscrit (RG-08)
- Given : un administrateur sur la page d'un événement, devant un créneau à venir avec des places
- When : il clique sur « Je m'inscris »
- Then : son nom apparaît dans la liste, avec les mêmes règles de limite et d'horaire que pour un utilisateur

Scénario 5 : chevauchement autorisé (RG-08)
- Given : un utilisateur déjà inscrit au créneau 09:00-12:00
- When : il s'inscrit au créneau 11:00-14:00 du même jour
- Then : les deux inscriptions sont enregistrées sans avertissement

### « Se désinscrire ou changer de créneau » (F-08)

En tant qu'**utilisateur**, je veux annuler ou modifier mon inscription afin de rester fiable quand mes disponibilités changent.

Scénario 1 : désinscription (RG-08)
- Given : un utilisateur inscrit à un créneau limité complet à venir
- When : il clique sur « Me désinscrire » puis confirme
- Then : son nom disparaît de la liste, une place est de nouveau disponible pour les autres et le bouton redevient « Je m'inscris »

Scénario 1 bis : abandon de la désinscription
- Given : un utilisateur inscrit à un créneau à venir, qui vient de cliquer sur « Me désinscrire »
- When : il refuse la confirmation
- Then : son inscription est conservée

Scénario 2 : changement de créneau réussi
- Given : un utilisateur inscrit au créneau A, et un créneau B de la même journée avec une place libre
- When : il se désinscrit de A (avec confirmation) puis s'inscrit à B
- Then : il n'apparaît plus dans A et apparaît dans B

Scénario 3 : le nouveau créneau est complet
- Given : un utilisateur inscrit au créneau A, et un créneau B complet
- When : il tente de s'inscrire à B
- Then : l'inscription à B est refusée et son inscription à A est conservée

Scénario 4 : créneau commencé (RG-08)
- Given : un utilisateur inscrit à un créneau dont l'heure de début est passée
- When : il ouvre l'événement
- Then : le bouton « Me désinscrire » n'est pas proposé et le message « Contacte un administrateur pour modifier ton inscription » s'affiche

### « Vue administrateur du remplissage » (F-09)

En tant qu'**administrateur**, je veux voir en un écran les inscrits de chaque créneau afin de savoir où il me manque du monde.

Scénario 1 : vue d'ensemble d'un événement (RG-07)
- Given : un événement de trois créneaux, un limité à 4 avec 3 inscrits, un limité à 6 sans inscrit, un illimité avec 2 inscrits
- When : l'administrateur ouvre la vue de remplissage de l'événement
- Then : chaque créneau affiche ses inscrits, « 3 / 4 », « 0 / 6 » et « 2 inscrits », les trois sur un seul écran

Scénario 2 : créneau limité sans inscrit mis en évidence
- Given : le créneau limité « 0 / 6 » du scénario précédent
- When : l'administrateur ouvre la vue
- Then : ce créneau est visuellement distingué des autres (alerte « Aucun inscrit »)

Scénario 3 : événement passé (RG-09)
- Given : un événement terminé
- When : l'administrateur ouvre la section « Événements passés » puis cet événement
- Then : la vue de remplissage s'affiche en lecture seule avec les inscrits finaux

Scénario 4 : accès refusé à un utilisateur (F-03)
- Given : un utilisateur sans droit administrateur
- When : il ouvre l'URL de la vue de remplissage
- Then : l'accès est refusé

Scénario 5 : retrait d'un inscrit par l'administrateur (RG-08)
- Given : un administrateur sur la vue de remplissage d'un créneau limité à 4 avec 4 inscrits, dont Marie D.
- When : il clique sur « Retirer » à côté de Marie D. et confirme « Marie D. ne sera plus inscrit(e) à ce créneau »
- Then : Marie D. disparaît de la liste, le compteur passe à « 3 / 4 » et la place est de nouveau disponible ; sans confirmation, rien n'est retiré

Scénario 6 : retrait sur un créneau commencé (RG-08)
- Given : un créneau dont l'heure de début est passée, dans un événement en cours, avec Marie D. inscrite
- When : l'administrateur retire Marie D. et confirme
- Then : Marie D. disparaît de la liste, alors qu'un utilisateur ne peut pas se désinscrire

Scénario 7 : retrait impossible sur un événement passé (RG-15)
- Given : un événement terminé
- When : l'administrateur ouvre sa vue de remplissage
- Then : aucun bouton « Retirer » n'est proposé

### « Gestion des membres » (F-10)

En tant qu'**administrateur**, je veux gérer les membres du club afin de contrôler qui a accès à l'application et avec quels droits.

Scénario 1 : liste des membres
- Given : un administrateur connecté
- When : il ouvre la page « Membres »
- Then : la liste affiche nom, prénom, e-mail et rôle de chaque membre

Scénario 2 : donner le droit administrateur (RG-04)
- Given : un administrateur et un utilisateur
- When : il clique sur « Donner le droit administrateur » sur la fiche de cet utilisateur
- Then : cet utilisateur devient administrateur ; les deux administrateurs coexistent

Scénario 3 : retirer son propre droit (RG-04)
- Given : deux administrateurs, A et B
- When : A clique sur « Retirer mon droit administrateur »
- Then : A devient utilisateur, B reste administrateur

Scénario 4 : aucun bouton pour retirer le droit d'un autre (RG-04)
- Given : un administrateur A qui consulte la fiche d'un autre administrateur B
- When : A ouvre la fiche de B
- Then : aucune action ne lui permet de retirer le droit à B

Scénario 5 : le dernier administrateur ne peut pas se retirer (RG-04)
- Given : un seul administrateur
- When : il clique sur « Retirer mon droit administrateur »
- Then : l'action est refusée avec le message « Nomme d'abord un autre administrateur » et son rôle ne change pas

Scénario 6 : administrateur qui perd son droit (RG-04)
- Given : deux administrateurs, A et B, A sur la page « Membres »
- When : A se retire son droit administrateur
- Then : A arrive sur la liste des événements avec un toast de confirmation et n'a plus accès aux pages d'administration

Scénario 7 : lien de réinitialisation de mot de passe (RG-12)
- Given : un membre qui a oublié son mot de passe
- When : l'administrateur clique sur « Générer un lien de réinitialisation » sur sa fiche
- Then : un lien à usage unique est affiché avec sa date de fin de validité (3 jours) et un bouton pour le copier

Scénario 8 : un nouveau lien invalide le précédent (RG-12)
- Given : un lien de réinitialisation déjà généré pour un membre, non utilisé
- When : l'administrateur génère un nouveau lien pour ce membre
- Then : l'ancien lien affiche « Ce lien n'est plus valide, demande un nouveau lien à un administrateur » et seul le nouveau fonctionne

### « Suppression de son compte » (F-11)

En tant qu'**utilisateur**, je veux supprimer mon compte et mes données afin de quitter le club en maîtrisant mes données personnelles.

Scénario 1 : suppression réussie (RG-11)
- Given : un utilisateur connecté, inscrit à un créneau qui n'a pas commencé et à un créneau déjà commencé (RG-11)
- When : il clique sur « Supprimer mon compte » puis confirme
- Then : il est déconnecté et arrive sur la page de connexion, son nom, son prénom et son e-mail sont effacés, l'inscription au créneau qui n'a pas commencé est libérée et l'autre apparaît sous « ancien membre »

Scénario 2 : abandon
- Given : un utilisateur sur l'écran de confirmation de suppression
- When : il clique sur « Annuler »
- Then : son compte et ses inscriptions sont inchangés

Scénario 3 : dernier administrateur (RG-04)
- Given : le seul administrateur de l'instance
- When : il clique sur « Supprimer mon compte »
- Then : l'action est refusée dès ce clic, sans écran de confirmation, avec le message « Nomme d'abord un autre administrateur », et son compte est conservé

Scénario 4 : connexion impossible après suppression
- Given : un compte supprimé
- When : l'ancien titulaire essaie de se connecter avec ses anciens identifiants
- Then : la connexion échoue avec le message « E-mail ou mot de passe incorrect »

---

## Version 1.1

### « Inscription d'un bénévole par l'administrateur » (F-12)

En tant qu'**administrateur**, je veux inscrire un bénévole à un créneau afin de corriger une situation sans passer par lui. Le retrait d'un inscrit est déjà disponible au MVP (F-09).

Scénario 1 : ajout sur un créneau avec place
- Given : un administrateur sur la vue de remplissage d'un créneau avec une place libre
- When : il choisit un membre et clique sur « Inscrire »
- Then : le membre apparaît dans la liste du créneau

Scénario 2 : ajout sur un créneau complet (exception à RG-07)
- Given : un créneau limité complet
- When : l'administrateur inscrit un membre supplémentaire et confirme l'avertissement « Ce créneau est complet, la limite sera dépassée »
- Then : le membre est inscrit et le créneau affiche « 5 / 4 » ; sans confirmation, rien n'est ajouté

Scénario 3 : créneau déjà commencé (RG-08)
- Given : un créneau dont l'heure de début est passée, dans un événement en cours
- When : l'administrateur ajoute un membre
- Then : l'ajout est possible, alors qu'il est refusé pour un utilisateur qui s'inscrit lui-même

### « Historique des changements » (F-13)

En tant qu'**administrateur**, je veux consulter l'historique des changements afin de savoir qui a modifié quoi et quand.

Scénario 1 : une inscription est tracée
- Given : un utilisateur qui s'inscrit à un créneau
- When : un administrateur ouvre le journal
- Then : une ligne indique l'auteur, l'action « inscription », le créneau concerné, la date et l'heure

Scénario 2 : les modifications d'administration sont tracées
- Given : un administrateur qui modifie le lieu d'un événement
- When : un administrateur ouvre le journal
- Then : une ligne indique l'auteur, l'action « modification de l'événement », l'ancienne et la nouvelle valeur du lieu

Scénario 3 : accès réservé (F-03)
- Given : un utilisateur sans droit administrateur
- When : il ouvre l'URL du journal
- Then : l'accès est refusé

### « Mon planning » (F-14)

En tant qu'**utilisateur**, je veux voir la liste de mes prochaines inscriptions afin de ne rien oublier.

Scénario 1 : liste des inscriptions
- Given : un utilisateur inscrit à trois créneaux à venir
- When : il ouvre « Mon planning »
- Then : les trois créneaux s'affichent par ordre chronologique avec événement, lieu, date et horaires

Scénario 2 : aucun créneau
- Given : un utilisateur sans inscription à venir
- When : il ouvre « Mon planning »
- Then : le message « Tu n'es inscrit à aucun créneau » s'affiche avec un lien vers les événements

---

## Version 2

### « Notifications par e-mail » (F-15)

En tant qu'**utilisateur**, je veux recevoir un rappel avant mon créneau afin de ne pas l'oublier.

Scénario 1 : rappel envoyé (délai à préciser, levant RG-13)
- Given : un utilisateur inscrit à un créneau qui commence dans le délai de rappel
- When : le délai est atteint
- Then : il reçoit un e-mail avec l'événement, le lieu et les horaires

Scénario 2 : pas de doublon
- Given : un utilisateur qui a déjà reçu le rappel de ce créneau
- When : le système vérifie de nouveau les rappels à envoyer
- Then : aucun second e-mail n'est envoyé

### « Suivi des heures » (F-16)

En tant qu'**administrateur**, je veux voir le total d'heures de chaque bénévole afin de repérer les plus contributeurs.

Scénario 1 : total d'heures
- Given : un bénévole inscrit à deux créneaux terminés de 3 h et 2 h
- When : l'administrateur ouvre le classement
- Then : le bénévole apparaît avec 5 h

Scénario 2 : créneaux à venir exclus
- Given : un bénévole inscrit à un créneau terminé de 3 h et à un créneau futur de 2 h
- When : l'administrateur ouvre le classement
- Then : le total affiché est de 3 h

### « Export des inscriptions » (F-17)

En tant qu'**administrateur**, je veux exporter les inscriptions d'un événement afin de les imprimer ou les partager.

Scénario 1 : export CSV
- Given : un événement avec deux créneaux et cinq inscrits au total
- When : l'administrateur clique sur « Exporter en CSV »
- Then : le fichier contient une ligne par inscription avec créneau, nom et prénom, identique à l'écran de l'événement

---

## Versions futures

### « Vue calendrier d'un événement » (F-18)

En tant qu'**administrateur**, je veux voir sur un calendrier qui est sur quel créneau afin de repérer d'un coup d'œil les trous dans le planning.

Scénario 1 : calendrier des inscrits
- Given : un événement de deux créneaux, l'un avec 3 inscrits et l'autre avec 1
- When : l'administrateur ouvre la page de l'événement et choisit la vue calendrier
- Then : chaque créneau est placé à son horaire et affiche ses inscrits, identiques à la liste de F-09

---

## Points à confirmer

- Délai du rappel de la F-15 et définition de « validés » pour la F-16 (présence réelle ou simple inscription).
- Le journal (F-13) conserve-t-il les noms après la suppression d'un compte ? Cohérence à vérifier avec RG-11.
