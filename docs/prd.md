# PRD – openBenevola

Statut : brouillon v0.1 (2026-10-22). Fait suite à `00-vision.md` et `research/99-decision.md` (GO, développement from scratch).

## 1. Résumé

openBenevola est une application web open source qui permet à une association d'organiser ses bénévoles : l'organisateur publie des événements découpés en créneaux avec une capacité, les bénévoles s'inscrivent, se désinscrivent et modifient leur réponse eux-mêmes. Elle remplace le Google Form, qui ne permet ni de consulter ni de modifier sa réponse.

Terrain d'essai : le club de ski de l'auteur (moins de 30 bénévoles). Le projet a aussi un but éducatif.

## 2. Objectifs et non-objectifs

**Objectifs du MVP**
- Un organisateur gère un événement réel de bout en bout (création, inscriptions, suivi du remplissage) sans Google Form.
- Un bénévole retrouve et modifie son inscription seul.
- Le tout fonctionne à 0 € de budget, auto-hébergeable.

**Non-objectifs du MVP** : voir section 7 (hors périmètre).

## 3. Personas

### Camille, l'organisateur (administrateur)
- Membre du bureau, organise les événements du club (compétitions, journées de ski…).
- Aujourd'hui : crée un Google Form, relance par messagerie, recompte à la main, ne sait pas qui a changé d'avis.
- Veut : voir en un coup d'œil quels créneaux sont pourvus, corriger une inscription, ne plus relancer à la main.
- Attentes techniques : aisance numérique moyenne à bonne.

### Alex, le bénévole
- Adhérent du club, disponible de façon occasionnelle ou régulière, utilise surtout son smartphone.
- Aujourd'hui : répond à un formulaire, ne peut pas modifier sa réponse, doit écrire à l'organisateur s'il est indisponible.
- Veut : voir ce dont le club a besoin, s'inscrire en quelques clics, annuler ou changer facilement.
- Attentes techniques : faibles. Doit fonctionner sur mobile sans installation.

Note : les personas viennent de l'expérience de l'auteur, aucun entretien n'a encore été réalisé (voir risques).

## 4. Fonctionnalités et priorités (MoSCoW)

| n° | Fonctionnalité | Priorité | Version | Critère de réussite |
| --- | --- | --- | --- | --- |
| F-01 | Lien d'invitation généré depuis un événement (réutilisable, valable jusqu'au début de l'événement) et création de compte pour rejoindre le club | Must | v1 (MVP) | Un invité crée son compte en moins de 2 minutes depuis son téléphone |
| F-02 | Connexion et déconnexion par e-mail + mot de passe | Must | v1 (MVP) | Un utilisateur inscrit se connecte en moins de 3 clics ; blocage temporaire après 5 échecs |
| F-03 | Rôles et permissions (administrateur, utilisateur) | Must | v1 (MVP) | Un bénévole ne peut accéder à aucune action d'administration, y compris par URL directe |
| F-04 | Créer, modifier, supprimer un événement | Must | v1 (MVP) | L'administrateur publie un événement avec titre, description, lieu et dates de début et de fin en moins de 3 minutes ; un événement peut être enregistré sans créneau |
| F-05 | Définir des créneaux (shifts) par événement avec horaires et nombre de places. Par défaut, le nombre de places est illimité ; l'administrateur peut le limiter à la création du créneau | Must | v1 (MVP) | Un créneau sans limite accepte toute inscription ; un créneau limité complet n'accepte plus d'inscription et sa limite n'est jamais dépassée |
| F-06 | Consulter la liste des événements et leurs créneaux | Must | v1 (MVP) | Un bénévole voit, pour chaque créneau, les noms des inscrits et, si le créneau est limité, les places restantes |
| F-07 | S'inscrire à un créneau | Must | v1 (MVP) | L'inscription est enregistrée immédiatement et visible sans recharger manuellement l'écran de confirmation |
| F-08 | Se désinscrire ou changer de créneau | Must | v1 (MVP) | Le bénévole modifie sa réponse seul ; la place libérée est aussitôt disponible |
| F-09 | Vue administrateur : remplissage des créneaux (qui est inscrit, places restantes des créneaux limités) | Must | v1 (MVP) | L'administrateur voit en un seul écran les inscrits de chaque créneau et repère les créneaux limités vides ou presque vides |
| F-10 | Gestion des membres : lister, donner le droit administrateur (seul l'intéressé peut retirer le sien), générer un lien de réinitialisation de mot de passe | Must | v1 (MVP) | L'administrateur retrouve un membre et lui donne le droit administrateur ou un lien de réinitialisation en moins de 3 clics ; il reste toujours au moins un administrateur |
| F-11 | Suppression de son compte et de ses données personnelles (RGPD) | Must | v1 (MVP) | Après suppression, plus aucune donnée nominative n'est conservée |
| F-12 | Inscription d'un bénévole par l'administrateur | Should | v1.1 | L'administrateur ajoute ou retire un bénévole d'un créneau, même complet, avec avertissement |
| F-13 | Historique des changements (qui a changé quoi, quand) | Should | v1.1 | Chaque création, modification, inscription et désinscription apparaît dans un journal consultable par l'administrateur |
| F-14 | Mon planning : liste de mes prochaines inscriptions | Should | v1.1 | Le bénévole voit toutes ses inscriptions à venir sur un seul écran |
| F-15 | Notifications par e-mail (confirmation, rappel, créneaux non pourvus) | Could | v2 | Un rappel est envoyé avant le créneau sans doublon |
| F-16 | Suivi des heures et classement des contributeurs | Could | v2 | Le total d'heures d'un bénévole correspond à la somme de ses créneaux validés |
| F-17 | Export des inscriptions (CSV / impression) | Could | v2 | Le fichier exporté reflète exactement l'écran de l'événement |
| F-18 | Vue calendrier d'un événement côté administrateur (qui est sur quel créneau, d'un coup d'œil), en plus de la liste de F-09 | Could | Versions futures | L'administrateur voit sur un calendrier les inscrits de chaque créneau, identiques à la liste de F-09 |

Principe directeur (retour du test d'ephios) : réduire les options au strict minimum pour ne pas perdre l'utilisateur.

## 5. MVP

Le MVP regroupe F-01 à F-11.

**Définition de « fini » d'une fonctionnalité** : ses user stories (`user-stories.md`) ont toutes leurs scénarios Given/When/Then passants, testés automatiquement ou manuellement, l'interface est utilisable sur mobile, le texte est en français, et la documentation utilisateur concernée est à jour.

**Scénario cible du MVP** : l'administrateur invite les bénévoles du club, crée un événement avec ses créneaux, les bénévoles s'inscrivent et ajustent leur choix, l'administrateur suit le remplissage jusqu'au jour J.

## 6. Contraintes

- Open source, développé bénévolement, budget 0 €.
- Auto-hébergeable sur une infrastructure gratuite ou très bon marché (choix de la stack à faire en phase architecture).
- Interface en français uniquement.
- Une instance = une association.
- Données personnelles limitées au nom, prénom et e-mail (RGPD) ; aucun téléphone.
- Responsive web, pas d'installation côté bénévole.

## 7. Hors périmètre (Won't pour le MVP)

- Paiements, adhésions, billetterie (couvert par HelloAsso, complémentaire).
- Application mobile native.
- Groupes et tags d'événements complexes (jugés inadaptés dans ephios).
- Échange de créneaux entre bénévoles.
- Plusieurs associations sur une même instance (multi-tenant).
- Interface multilingue.
- Notifications automatiques (F-15 reporté).
- Désactivation d'un compte par un administrateur (et donc réactivation). À ajouter seulement si les administrateurs en expriment le besoin.

Les décisions d'exclusion ne sont pas définitives : elles pourront être revues après le premier événement réel.

## 8. Indicateurs de succès

| Indicateur | Cible proposée | Mesure |
| --- | --- | --- |
| Adoption | Au moins 1 événement réel du club géré entièrement avec l'outil ; au moins 70 % des bénévoles actifs ont un compte | Comptage en base |
| Temps de l'organisateur | Temps d'organisation et nombre de relances divisés par 2 par rapport au Google Form | Chronométrage de l'organisateur sur un événement avant/après |

Les cibles chiffrées sont des propositions à confirmer. La référence « avant » n'est pas mesurée à ce jour.

## 9. Hypothèses

- H1 : les bénévoles du club ont un smartphone et une adresse e-mail.
- H2 : le Google Form est vécu comme un vrai frein, pas seulement un inconvénient.
- H3 : l'administrateur acceptera de changer d'outil si l'effort de mise en route est faible.
- H4 : les bénévoles acceptent que leur nom soit visible par les autres inscrits.
- H5 : sans notification, les bénévoles consultent spontanément l'application (le lien est diffusé par le canal habituel du club, par exemple WhatsApp).
- H6 : un seul administrateur ou un petit groupe suffit, pas de rôle intermédiaire.

## 10. Risques

| Risque | Impact | Mitigation |
| --- | --- | --- |
| Aucun entretien utilisateur réalisé : le besoin repose sur l'avis de l'auteur | Périmètre mal calibré | Mener 3 à 5 entretiens courts avec le guide de `research/01-entretiens.md` avant la fin du MVP |
| Sans notifications, la mobilisation dépend d'un canal externe | Faible taux d'adoption | Lien partageable simple ; F-15 prioritaire en v2 si le constat se confirme |
| Développement bénévole, avancement irrégulier | Délai non maîtrisé | MVP resserré (F-01 à F-11), livraisons incrémentales |
| Choix de ne pas forker ephios (développement plus long, accepté dans la décision) | Délai et dette de fonctionnalités | S'inspirer du code et du modèle de données d'ephios |
| Conformité RGPD | Risque légal | Données minimales, F-11 en Must, mentions d'information |
| Les bénévoles ne veulent pas créer un compte | Frein à l'adoption | Mesurer en test ; invitation par lien pour limiter la friction |
| Un seul club de test | Généralisation incertaine | Tester auprès d'une autre association après le MVP |

## 11. Questions ouvertes

- Date cible du MVP et temps hebdomadaire disponible (aucun délai défini dans la vision).
- Qui administre l'instance en production : l'auteur seul, ou plusieurs personnes du bureau ?
- Faut-il une liste d'attente quand un créneau limité est complet ? (non traité dans les user stories)
- Faut-il un nombre minimum de bénévoles par créneau (pour repérer les créneaux sous-pourvus) ? Retiré pour l'instant : seule une limite maximale optionnelle existe.
- Hébergement à 0 € (à trancher en phase architecture).

Décisions prises lors des user stories (détail dans `user-stories.md`, règles RG-01 à RG-13) :
- Chevauchement de créneaux autorisé sans contrôle.
- Inscription et désinscription possibles jusqu'au début du créneau.
- Limite d'un créneau non abaissable sous le nombre d'inscrits.
- Suppression d'un événement ou créneau avec inscrits : confirmation indiquant le nombre d'inscrits.
- Mot de passe oublié : lien de réinitialisation généré par l'administrateur (aucun e-mail au MVP).
- Premier administrateur créé à l'installation ; événements passés masqués aux utilisateurs.

Décisions prises lors des flows (2026-10-23) :
- Un événement a sa propre date et heure de début et de fin (RG-06) ; il peut exister sans créneau.
- Lien de réinitialisation de mot de passe valable 3 jours (RG-12).
- Pas de désactivation de compte par l'administrateur au MVP (RG-05 abandonnée).
- Désinscription avec confirmation ; suppression d'un événement ou créneau sans inscrit sans confirmation (RG-10).
