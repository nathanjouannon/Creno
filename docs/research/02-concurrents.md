# Concurrents et alternatives

Question à trancher : **qui fait déjà mieux ?** Dernière vérification : 2026-10-21 (recherche web rapide, à confirmer sur les sites officiels).

## Tableau comparatif

| Outil | Type | Licence / hébergement | Créneaux + capacité | Modifier sa réponse | Prix | Source / statut |
|---|---|---|---|---|---|---|
| Google Forms (statu quo) | Formulaire | Propriétaire, SaaS | Non natif | Limité (cf. vision) | Gratuit | Vision, ✅ |
| SignUpGenius | Inscription créneaux | Propriétaire, SaaS | Oui | À vérifier | Freemium (à vérifier) | [GetApp](https://www.getapp.fr/reviews/105637/signupgenius), noté 4,6/5 ; détails à vérifier |
| BenevolOps | Gestion bénévoles | Propriétaire, hébergé en France, RGPD | Oui (créneaux, remplacements, présences) | Oui (inscription autonome) | Offre gratuite + essai 30 j | [GetApp](https://www.getapp.fr/software/2099642/benevolops) ; limites du gratuit à vérifier |
| Anolla | Inscription créneaux | Propriétaire | Oui (répartition auto) | À vérifier | À vérifier | [Anolla](https://anolla.com/fr/logiciel-de-gestion-des-benevoles) |
| RosterThat | Plannings récurrents | Propriétaire, SaaS | Oui, échange de créneaux | Oui | Gratuit ≤ 20 pers., 2 plannings | [AlternativeTo](https://alternativeto.net/software/rosterthat/about/) |
| ephios | Plannings bénévoles (secours) | **Open source** (Python) | Oui, inscription directe ou sur candidature | À vérifier | Auto-hébergé | [PyPI](https://pypi.org/project/ephios/0.18.0) ; **concurrent le plus proche, à étudier en priorité** |
| Framadate / Framaforms | Sondage / formulaire | Open source | Non | À vérifier | Gratuit | Framasoft les met en retrait ([blog](https://framablog.org/2021/05/25/forget-about-framaforms-the-software-make-room-for-yakforms/)) |
| Mobilizon | Événements | Open source | À vérifier | – | – | non vérifié |
| HelloAsso | Paiement / adhésions / billetterie pour assos | Propriétaire, SaaS | Aucun module de planning bénévoles trouvé | – | Gratuit (plateforme de collecte) | [La Fabrique du Net](https://www.lafabriquedunet.fr/logiciel/helloasso), [Capterra](https://capterra.com/p/183414/HelloAsso/reviews/) ; son blog cite Recrewteer pour les bénévoles ([blog](https://www.helloasso.com/blog/?p=45361)). Complémentaire plus que concurrent |
| AssoConnect | Gestion globale d'asso (compta, CRM, site, mails) | Propriétaire, SaaS | Aucun planning de missions trouvé | – | À partir de 19 € (selon FrenchWeb, croît avec les contacts) | [FrenchWeb](https://www.frenchweb.fr/fw-radar-assoconnect-veut-devenir-indispensable-au-quotidien-des-benevoles/271643), [Capterra](https://www.capterra.fr/software/194611/assoconnect) |
| Bénévol'app | – | – | – | – | – | **Introuvable**, aucune page. Peut-être un autre nom ou un produit local (ex. app de la ville de Nice : [Nice Métropole Bénévoles](https://apps.apple.com/us/app/-/id6462850209)) |
| Kiosk | – | – | – | – | – | **Introuvable** sous ce nom. À préciser (éditeur ? lien ?) |
| Volunteer Planner | Plannings de créneaux (accueil de réfugiés) | Code sur GitHub ([coders4help/volunteer_planner](https://github.com/coders4help/volunteer_planner)), Django/Python ; **licence non confirmée** | Oui (shifts) | À vérifier | Gratuit | Infos de 2015-2016 ([CCC wiki](https://events.ccc.de/congress/2016/wiki/Projects:Volunteer-Planner)), activité actuelle inconnue. Cible : Berlin |
| VolunteerLocal | Gestion de bénévoles pour événements | Propriétaire, SaaS | Oui (à vérifier en détail) | À vérifier | ≈ 600 $/an (Discover), 2 400 $/an (Grow) | [Capterra](https://capterra.com/p/122906/VolunteerLocal/), [TrustRadius](https://www.trustradius.com/compare-products/volunteerlocal-vs-volgistics) ; essai gratuit : sources contradictoires |
| Rosterfy | Gestion de bénévoles (recrutement → planning → comms) | Propriétaire, SaaS | Oui | À vérifier | Sur devis, à partir d'environ 7 000 $/an | [Capterra](https://www.capterra.com/p/157726/Rosterfy/) ; vise les programmes > 500 bénévoles, hors de portée d'un petit club |
| Autres vus au passage | InitLive, Volunteer Scheduler Pro, Recrewteer, Volunteo, Vome | – | – | – | InitLive sur demande | [Appvizer InitLive](https://www.appvizer.fr/ressources-humaines/gestion-benevoles/initlive), [Capterra](https://www.capterra.fr/software/1007373/volunteer-scheduler-pro) ; non analysés |

## À vérifier (non couvert par la recherche)

- Bénévol'app et Kiosk : introuvables. Avez-vous un lien ou l'éditeur ?
- Confirmer sur les sites officiels : HelloAsso et AssoConnect n'ont pas de planning bénévoles (absence dans les résultats ≠ preuve d'absence).
- Licence et activité actuelle de Volunteer Planner (fichier LICENSE, derniers commits).
- Autres projets open source (chercher sur GitHub : « volunteer shift scheduler »).

## Lecture rapide

- Les outils spécialisés payants à 600-7 000 $/an sont hors budget pour un club à 0 €. Seuls les paliers gratuits (BenevolOps, RosterThat) sont de vraies alternatives immédiates.
- HelloAsso et AssoConnect sont des outils de gestion d'asso, pas de planning : plutôt complémentaires.
- Côté open source, seuls ephios et Volunteer Planner sont apparus ; ephios est le plus actif d'après ce qu'on voit (paquet PyPI récent), à confirmer.

## Questions clés pour la décision

1. **ephios** couvre-t-il déjà 80 % du besoin ? Si oui, contribuer ou forker plutôt que repartir de zéro (pivot possible).
2. Les offres gratuites (BenevolOps, RosterThat) suffisent-elles pour un petit club ? Si oui, quelle est la valeur d'un outil open source (souveraineté des données, pas de limite, gratuité durable) ?
3. Quel est l'argument face à « Google Form + WhatsApp, ça marche déjà » ?

## Test de ephios

### Historique des changements 

la fonctionnalité est top. 

### Création d'évent + shift

La fonctionnalité est bonne et correspond à 90% au besoins demandé. 
La notion de shift est bien, elle permet de bloquer des créneaux mais ne bloque pas l'utilisateurs complètement à ce créneaux. 
Certaines fonctionnalité néanmoins ne sont pas utile et peuvent perdre l'utilisateur. 
Il faut prévoir de réduire les possibilité au minimum

### Suivie des heures

Cette focntionnalité n'était pas prévu dans le cahiers des chagers mais est la bienvenus et permet de voir les personnes les plus contributrice. 

### Groupe / tags

Les groupes et les tags ne sont pas adaptées. Pour les évènements, il en existe deux types. Mais aucun n'ont du sens pour nous. Les groupes de même n'ont pas de sens mais peuvent être modifié/supprimé/ajouté donc pas de problème. 

### Permission 

C'est très prtique que les permissions soit implémenté et c'est quelque chose qu'il faut garder. La revue des gruopes permetteras d'y voir plus clair sur les permission aussi. 

### Langues

L'application est disponible uniquement en Allemand et en anglais (mal traduis/ pas traduis parfois).
Il faut prévoir une traduction française. Pour la traduction, il faut remplir les catalogues de traduction et la documentation. Cela représente un peu de travail mais n'est pas insurmontable

## Conclusion. 

Le tableau comparatif permet de conclure que : 
- Les outils spécialisés payants à 600-7 000 $/an sont hors budget pour un club à 0 €. Seuls les paliers gratuits (BenevolOps, RosterThat) sont de vraies alternatives immédiates.
- HelloAsso et AssoConnect sont des outils de gestion d'asso, pas de planning : plutôt complémentaires.
- Côté open source, seuls ephios et Volunteer Planner sont apparus ; ephios est le plus actif d'après ce qu'on voit (paquet PyPI récent), à confirmer.

Les outils payant sont écarté et les outils qui ne répondent pas au besoin aussi. Il reste donc Ephios (open source). 

Après le test d'ephios. Celui-ce présente beaucoup d'avanatge mais ne colle pas à 100% au besoin. Comme détaillé dans la section au dessus un certain nombre de changements est à prévoir. 

A ce point deux possibilité se présente :
- Forker le repo de ephios et faire les modifications nécessaire
- Faire une application from scratch avec la possibilité de s'insipirer du code d'ephios. 

Etant donné que le projet à aussi un but éductif. La décision est "GO" sur le développement d'une solution from scratch. 