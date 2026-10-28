# Composants – Créno

Statut : brouillon v0.1 (2026-10-25). Source : `wireframes/` (écrans A1 à E3), `mockups/B3-evenement-creneaux-mobile.html`, `flows/*.mmd`, `prd.md`, `domain/business-rules.md`.

Règle : aucune couleur, taille, espacement ni rayon en dur, uniquement les tokens de `tokens.json` (notés `color.primary`, `space.md`…). Un composant = un nom dans le code (PascalCase, en anglais) ; les libellés affichés sont en français et tutoient l'utilisateur.

Les états communs à tous les composants interactifs (`default`, `hover`, `focus`, `disabled`, `loading`) sont décrits en section 1 ; chaque composant ne détaille que ce qui s'en écarte.

## 1. Règles communes

| État | Règle |
| --- | --- |
| `hover` | Fond ou bordure assombri(e) : `color.primary-hover` pour les éléments `primary`, sinon `color.surface` en fond. |
| `focus` | Contour visible 2 px en `color.primary` (clavier). Token dédié à créer (voir section 6). |
| `disabled` | Fond `color.surface`, texte `color.text-muted`, bordure `color.border`, curseur interdit. |
| `loading` | Libellé conservé, action bloquée, indicateur de chargement ; jamais de double envoi. |
| `error` | Bordure `color.danger`, message en `color.danger` sous le champ. |
| Hauteur des contrôles | `size.control-height` (cible tactile). |
| Mobile / desktop | Mobile sous `breakpoint.desktop`, boutons pleine largeur ; desktop : contenu centré `size.content-max`, formulaires publics `size.form-max`. |

## 2. Structure de page

### AppHeader
- Rôle : en-tête de toutes les pages ; logo « Créno » et menu du prénom une fois connecté. Fond `color.surface`, bordure basse `color.border`.
- Variantes : `public` (logo seul : écrans A1 à A9) · `authenticated` (logo + `UserMenu`).
- États : aucun propre.
- Réfs : flux 00, wireframes toutes pages.

### MainNav
- Rôle : navigation sous l'en-tête ; onglet actif souligné en `color.primary`, inactifs en `color.text-muted`.
- Variantes : `user` (Événements) · `admin` (Événements, Passés, Membres, F-03).
- États d'un onglet : `default` · `active` · `hover` · `focus`.
- Règle : les onglets admin ne sont jamais rendus pour un utilisateur, la protection réelle reste côté serveur (F-03).

### UserMenu
- Rôle : menu du prénom (avatar à initiale + prénom + flèche), en haut à droite ; contient « Se déconnecter » et « Supprimer mon compte » (en `color.danger`).
- Variantes : une seule.
- États : `closed` · `open` (E1) · `focus`.

### PageContainer
- Rôle : zone de contenu : `size.content-max` centrée, `space.md` de marge sur mobile. Variante `narrow` en `size.form-max` pour les écrans A1 à A9.

### PageTitle / BackLink
- `PageTitle` : `font.size-title`, `font.weight-bold`. `BackLink` : « ‹ Événements » ou « ‹ Membres », `font.size-small`, `color.text-muted` (B3, D2, D4).

## 3. Actions et saisie

### Button
- Rôle : toute action. Hauteur `size.control-height`, rayon `radius.button`, `font.weight-medium`.
- Variantes :

| Variante | Apparence | Usage |
| --- | --- | --- |
| `primary` | Fond `color.primary`, texte `color.on-primary` | Action principale : « Je m'inscris », « Se connecter », « Enregistrer », « Créer mon compte », « Copier le lien » |
| `secondary` | Fond `color.background`, bordure `color.border-strong`, texte `color.text` | « Me désinscrire », « Modifier », « Annuler », « Fermer », « + Ajouter un créneau », « Inviter des bénévoles » |
| `danger` | Fond `color.danger`, texte `color.on-primary` | Confirmation destructive : « Supprimer » (C8, E2) |

- Tailles : `block` (pleine largeur, par défaut mobile) · `inline` (largeur au contenu : paires Modifier / Supprimer d'un créneau, boutons de `ConfirmDialog`).
- États : `default` · `hover` · `focus` · `disabled` (ex. « Complet ») · `loading`.
- Règle : un seul `primary` par écran ou par fenêtre.

### Formulaires : composition

Les formulaires se construisent par couches ; chaque couche n'utilise que celle du dessous.

```
Form                       état, validation, envoi, erreur globale
└── FormField              libellé + contrôle + aide + FieldError, lié à un nom de champ
    └── Input              contrôle seul (TextInput, PasswordInput, NumberInput, Textarea, DateInput, TimeInput)
        └── (élément natif <input>, stylé avec les tokens)
```

Composants de plus haut niveau, construits avec ces couches : `DateTimeRange` (deux `FormField`), puis les formulaires métier (tableau ci-dessous), qui n'assemblent que des `FormField` dans un `Form`.

Bibliothèque : **react-hook-form** si la stack retenue en phase 6 est React ou Next.js, avec un schéma de validation (Zod, déjà cité dans `security.md`) branché par resolver. Pour un autre framework, utiliser l'équivalent de la stack (Vue : vee-validate ; Svelte : sveltekit-superforms ; Angular : Reactive Forms) en gardant les mêmes composants et le même contrat. Le choix sera consigné dans un ADR ; en attendant, rien dans cette spécification ne dépend de la bibliothèque.

### Form
- Rôle : composant réutilisable de tous les formulaires. Il possède l'état (valeurs, erreurs, envoi), valide avec un schéma, appelle `onSubmit` et affiche l'erreur globale. Les enfants accèdent au formulaire par le contexte, sans recevoir de props de câblage.
- Contrat (noms indicatifs) :

| Prop | Rôle |
| --- | --- |
| `schema` | Schéma de validation des valeurs ; les règles viennent de `domain/business-rules.md` (ex. mot de passe ≥ 10 caractères, RG-01) |
| `defaultValues` | Valeurs initiales (création vide, modification pré-remplie) |
| `onSubmit(values)` | Envoi ; renvoie un succès ou une erreur d'API (`code`, `details.fields`) |
| `submitLabel` | Libellé du `Button primary` de validation, rendu en bas du formulaire |
| `children` | Les `FormField` |
| `errorMap` | Correspondance code d'erreur → champ ou message global (ex. `AUTH_INVALID_CREDENTIALS` → `Alert`). Sous un champ, c'est le message du catalogue renvoyé par l'API qui s'affiche, avec ses nombres (`SLOT_CAPACITY_BELOW_REGISTRATIONS` → « 5 personnes sont déjà inscrites… », C7) |
| `resetOnError` | Champs à vider après un échec (ex. `password` à la connexion) |

- Mise en page : champs empilés, espacement `space.md`, bouton de validation `block` en dernier, largeur `size.form-max` pour les écrans publics.
- États :

| État | Comportement |
| --- | --- |
| `pristine` | Rien d'affiché |
| `dirty` | Valeurs modifiées ; `ConfirmDialog` de sortie non prévu au MVP |
| `invalid` | Au premier envoi seulement : erreurs sous les champs concernés, focus sur le premier champ en erreur ; ensuite, revalidation à chaque saisie |
| `submitting` | Bouton `loading`, champs `disabled`, pas de double envoi |
| `server-error` | Erreur d'API affichée en `Alert danger` (message général) ou sous le champ (`details.fields`) ; champs conservés (flux 01 et 02) |
| `success` | Redirection ou fermeture ; l'effet (toast, navigation) appartient au formulaire métier, pas à `Form` |

- Règle : le message affiché vient du catalogue d'erreurs (`api/errors.md`), jamais écrit dans `Form`. La validation côté client est un confort, le serveur reste la référence.

### FormField
- Rôle : lie un `Input` à un champ du formulaire par son `name`, et affiche autour de lui le libellé (`font.size-small`, `color.text-muted`), l'aide (`color.text-muted`) et le `FieldError`.
- Props : `name`, `label`, `help?`, `required?`, `messages?` (libellé propre à ce champ pour un code, quand le catalogue le prévoit : `FIELD_REQUIRED` du titre → « Le titre est obligatoire. »), et un enfant `Input` (ou un composant de groupe comme `DateTimeRange`).
- États (hérités de l'`Input`) : `default` · `focus` · `filled` · `error` · `disabled`.
- Accessibilité : libellé relié au contrôle, erreur reliée par `aria-describedby`, `aria-invalid` en état `error`.

### Input
- Rôle : le contrôle seul, sans libellé ni message ; hauteur `size.control-height`, bordure `color.border-strong` au repos, rayon `radius.button`, police `font.size-base`. Il ne connaît ni le formulaire ni la validation : il reçoit `value`, `onChange`, `onBlur`, `error`, `disabled` (ce qui permet de l'utiliser hors `Form`).
- Variantes : `SelectInput` (fuseau horaire de l'installation) · `TextInput` (nom, prénom, titre, lieu, nom du club) · `EmailInput` · `PasswordInput` (masqué, option « afficher ») · `NumberInput` (limite de places, vide = illimité) · `Textarea` (description) · `DateInput` · `TimeInput`.
- États : `default` · `hover` · `focus` · `filled` · `error` (bordure `color.danger`) · `disabled`. Un `PasswordInput` est vidé après un échec de connexion (flux 02).

### FieldError
- Rôle : message d'erreur sous un champ, `font.size-small`, `color.danger`. Texte fourni par le schéma ou par l'API, jamais écrit en dur dans le composant.

### DateTimeRange
- Rôle : groupe « début / fin » (jour + heure) pour un événement ou un créneau, composé de `FormField` (`DateInput` + `TimeInput`). Porte l'erreur « La fin doit être après le début » (RG-06, C5), validée au niveau du schéma du formulaire.
- États : `default` · `error` (les deux champs de fin en erreur).

### Formulaires métier

| Formulaire | `Form` + `FormField` | Écrans | Particularités |
| --- | --- | --- | --- |
| `InstallForm` | nom du club, fuseau horaire (liste), nom, prénom, e-mail, mot de passe | A10, A11 | Deux groupes « Le club » et « Premier administrateur » ; utilisable une seule fois, introuvable ensuite (RG-17) ; création atomique |
| `InvitationSignupForm` | nom, prénom, e-mail, mot de passe | A1 à A3 | E-mail déjà utilisé : `Alert` + bouton « Aller à la connexion » (RG-01) |
| `LoginForm` | e-mail, mot de passe | A5 à A7 | Erreur unique non détaillée, mot de passe vidé, blocage 15 min (RG-03) |
| `ResetPasswordForm` | nouveau mot de passe | A8 | Lien invalide : l'écran remplace le formulaire (A9) |
| `EventForm` | titre, description, lieu, `DateTimeRange` début / fin, liste de créneaux | C4, C5 | Création et modification (`defaultValues`) ; les créneaux sont une liste de valeurs du formulaire (tableau de champs) |
| `SlotForm` | date, heure de début, heure de fin, limite | C6, C7 | Formulaire distinct, dans une fenêtre (`Modal`, titre « Ajouter un créneau » ou « Modifier le créneau », bouton « Annuler ») ouverte depuis `EventForm` ou la page de l'événement : jamais imbriqué dans le HTML ; depuis `EventForm`, son résultat est ajouté à la liste de créneaux ; fin après début le même jour ; avertissement hors des dates de l'événement calculé à la saisie (RG-07) ; limite sous le nombre d'inscrits refusée sous le champ (RG-07) |

Les actions sans champ (se désinscrire, générer un lien, retirer son droit administrateur) ne sont pas des formulaires : ce sont de simples `Button` avec `ConfirmDialog` ou `Toast`.

### Link
- Rôle : lien texte en `color.primary` (« Déjà un compte ? Se connecter »). États : `default` · `hover` · `focus`.

## 4. Affichage de données

### Card
- Rôle : conteneur à bordure, rayon `radius.card`, padding `space.md`, espacement `space.md` entre cartes.
- Variantes : `default` (bordure `color.border`) · `selected` (bordure `color.primary`, créneau où je suis inscrit) · `alert` (bordure `color.danger`, créneau limité sans inscrit, C2) · `clickable` (flèche ›, `EventListItem` et `MemberListItem`).
- États : `default` · `hover` et `focus` pour `clickable`.

### EventListItem (Card `clickable`)
- Contenu : titre, lieu · date de début (`font.size-small`, `color.text-muted`). Passés : mention « terminé » (C9).
- Variantes : `upcoming` (B1, C1) · `past` (C9, administrateur seulement).

### SlotCard
- Rôle : un créneau d'un événement ; composant central du produit (F-05 à F-09).
- Contenu : horaires (`font.weight-bold`), `SlotStatusTag`, `AttendeeList`, zone d'actions.
- Variantes :
  - `volunteer` : action unique « Je m'inscris » ou « Me désinscrire ».
  - `admin` : compteur « inscrits / limite » ou « N inscrits », boutons Modifier et Supprimer, alerte « Aucun inscrit » si limité et vide, et `AttendeeChip removable` pour retirer un inscrit (C2, RG-08). L'administrateur s'inscrit comme un utilisateur : le créneau affiche aussi « Je m'inscris » ou « Me désinscrire » selon les états du tableau ci-dessous.
  - `readonly` : événement passé (RG-15), sans aucune action ni bouton « Retirer » (flux 06).
- États (côté bénévole, flux 04) :

| État | `Card` | Tag | Action | Message |
| --- | --- | --- | --- | --- |
| `open` | default | « N places restantes » (limité) ou « Sans limite » | `primary` « Je m'inscris » | — |
| `registered` | `selected` | « Inscrit » (succès) | `secondary` « Me désinscrire » | — |
| `full` | default | « Complet » (danger) | `Button disabled` « Complet » | — |
| `started` | default | « Commencé » | aucune | « Ce créneau a commencé : inscription impossible » (RG-08) |
| `started-registered` | default | « Commencé · inscrit » | aucune | « Contacte un administrateur pour modifier ton inscription » |
| `just-filled` | default | « Complet » | `Button disabled` | Toast « Ce créneau vient d'être complété. » (B7, RG-07) |
| `loading` | default | inchangé | `Button loading` | — |

- États (côté admin, flux 06) : `normal` · `empty-alert` (limité à 0 inscrit, `Card alert`, message « (!) Aucun inscrit » en `color.danger`) · `unlimited` (« N inscrits », jamais d'alerte). Un administrateur peut retirer un inscrit même sur un créneau `started` ; l'ajout d'un inscrit par l'administrateur n'existe pas au MVP (F-12, v1.1).

### SlotStatusTag
- Rôle : pastille d'état en haut à droite d'un créneau ; `radius.tag`, `font.size-small`, `font.weight-medium`.
- Variantes : `neutral` (bordure `color.border`, texte `color.text-muted` : places restantes, Sans limite, Commencé) · `success` (bordure `color.success`, texte `color.text` : Inscrit) · `danger` (bordure `color.danger`, fond `color.danger-surface`, texte `color.text` : Complet) · `counter` (« 3 / 4 », version admin).
- Contraste (T-015) : `color.success` sur blanc (3,29:1) et `color.danger` sur `color.danger-surface` (3,94:1) sont sous les 4,5:1 exigés pour un texte de `font.size-small` (WCAG 2.2 AA). La couleur reste sur la bordure ; le texte est en `color.text`.
- Règle : le sens ne repose pas sur la seule couleur, le texte est toujours présent.

### AttendeeList / AttendeeChip
- Rôle : noms des inscrits d'un créneau (« Prénom N. »), visibles de tous (RG-09). Chip : fond `color.surface`, `radius.tag`, `font.size-small`.
- Variantes : `default` · `me` (fond `color.primary`, texte `color.on-primary`, « Alex M. (toi) ») · `former-member` (« ancien membre », RG-11) · `removable` (vue administrateur : ajoute une croix « × » ; un clic ouvre `ConfirmDialog remove-registration`, absent sur un événement passé, RG-15).
- États de la liste : `filled` · `empty` (texte `color.text-muted`, absent côté bénévole si le créneau est vide).

### EventHeader
- Rôle : titre, lieu, dates (début → fin) et description d'un événement. Variantes : `volunteer` · `admin` (ajoute les boutons Inviter / Modifier / Supprimer) · `past` (sans bouton).
- États : `default` · `no-slot` : texte « Aucun créneau pour le moment » (**à confirmer**, B5 et flux 04).

### MemberListItem (Card `clickable`)
- Contenu : « Nom Prénom · Rôle », e-mail dessous. Variante unique ; le rôle est un texte, pas un tag.

### MemberProfile
- Rôle : fiche d'un membre (D2, D4, D5).
- Variantes et actions :

| Variante | Actions affichées |
| --- | --- |
| `user` | « Donner le droit administrateur », « Générer un lien de réinitialisation » |
| `other-admin` | « Générer un lien de réinitialisation » ; note « Aucune action pour lui retirer son droit. » (RG-04) |
| `me-admin` | « Retirer mon droit administrateur » |

- États : `default` · `loading` · `error` (refus RG-04 : `Toast` danger « Nomme d'abord un autre administrateur. »).

### EmptyState
- Rôle : texte `color.text-muted` sous le titre quand une liste est vide. Messages : « Aucun événement à venir pour le moment. » (B2, C1), « Aucun événement passé. » (C9), « Aucun créneau pour le moment. » (page d'un événement sans créneau).

## 5. Retours et fenêtres

### Alert (message en ligne)
- Rôle : message affiché dans la page, fond `color.danger-surface`, bordure `color.danger`, `radius.card`.
- Variantes : `danger` (compte existant A3, identifiants incorrects A6, compte bloqué A7, lien invalide A4 et A9) · `warning` (`color.warning-surface` + `color.warning`, réservé aux points « à confirmer » ou avertissements, par exemple F-12 en v1.1).
- Règle : A6 et A7 ne distinguent jamais « e-mail inconnu » de « mot de passe faux » (sécurité).

### Toast
- Rôle : retour temporaire en bas de page ou sous l'en-tête, fond plein, texte `color.on-primary`, `radius.card`.
- Variantes : `danger` (fond `color.danger` : erreurs de formulaire A2, refus D6 et E3, B7) · `success` (fond `color.success` : confirmation après retrait du droit administrateur, flux 07).
- États : `visible` · `dismissed` (disparition automatique ou à la fermeture). Un toast `danger` reste affiché tant qu'il n'est pas fermé.

### ConfirmDialog
- Rôle : fenêtre modale centrée, largeur max `size.modal-max`, fond `color.background`, rayon `radius.card`, voile `color.overlay`. Titre sous forme de question, texte explicatif, deux boutons (`secondary` « Annuler » à gauche, action à droite).
- Variantes :

| Variante | Bouton d'action | Cas |
| --- | --- | --- |
| `unregister` | `primary` « Me désinscrire » | B6, RG-08 |
| `delete` | `danger` « Supprimer » | C8 (événement ou créneau avec inscrits, indique N, RG-10), E2 (compte, RG-11) |
| `remove-registration` | `danger` « Retirer » | C10 (l'administrateur retire un inscrit, « Marie D. ne sera plus inscrit(e) au créneau… », RG-08) |

- États : `open` · `submitting` (boutons `loading`) · `error`. Fermeture : Échap, clic sur « Annuler », clic sur le voile. Le focus est piégé dans la fenêtre.
- Règle : suppression d'un événement ou créneau sans inscrit : aucune fenêtre (RG-10).

### LinkDialog
- Rôle : fenêtre modale qui affiche un lien à copier (même coque que `ConfirmDialog`) : invitation (C3, flux 01) ou réinitialisation de mot de passe (D3, flux 03). Contenu : titre, date de fin de validité, lien, boutons « Fermer » et « Copier le lien ».
- Variantes : `invitation` (« valable jusqu'au début de l'événement, réutilisable », RG-02) · `reset` (« à usage unique, valable 3 jours », RG-12).
- États : `ready` · `copied` (bouton « Lien copié ») · `error` (copie impossible : lien sélectionné pour copie manuelle).

## 6. Écarts avec `tokens.json` : décisions (T-003)

Tous les points sont tranchés ; les tokens correspondants sont dans `tokens.json`.
- `color.focus` ajouté, alias de `color.primary` ; `border.focus-width` ajouté (2 px) pour l'état `focus`.
- `color.success-surface` ajouté (`#DCFCE7`) pour un fond de succès éventuel.
- `size.avatar` (28 px, maquette B3) et `size.icon` (20 px) ajoutés.
- `shadow.modal` : non créé, `color.overlay` suffit. Un nouveau besoin ouvrira un ticket.
- `motion.fast` : non créé, aucune animation au MVP.
- `space.none` ajouté (0 px, T-010) : les échelles numériques de Tailwind sont supprimées, `right-0` ou `inset-0` ne produisent donc rien ; `right-none`, `inset-none` collent un élément à un bord (fenêtre modale, menu, toasts).
- Contraste (T-015) : voir `SlotStatusTag`, section 4. `color.text-muted` sur `color.surface` fait 4,39:1 (survol d'un `EventListItem`) : à corriger dans les tokens, hors périmètre de T-015.
- Bordures : `color.border-strong` pour les champs, `color.border` pour les cartes au repos. La maquette B3 est déjà conforme pour les cartes ; la description de `color.border-strong` dans `tokens.json` est corrigée en conséquence.

## 7. Correspondance écrans → composants

| Écran | Composants |
| --- | --- |
| A10, A11 | AppHeader `public`, PageContainer `narrow`, InstallForm (Form, FormField, Input), Button, Alert |
| A1 à A4 | AppHeader `public`, PageContainer `narrow`, InvitationSignupForm (Form, FormField, Input), Button, Alert, Link, Toast |
| A5 à A7 | AppHeader `public`, LoginForm, Alert `danger` |
| A8, A9 | ResetPasswordForm, Alert `danger` (A9) |
| B1, B2 | AppHeader, MainNav, EventListItem, EmptyState |
| B3, B4, B7 | EventHeader, SlotCard `volunteer`, SlotStatusTag, AttendeeList, Toast |
| B5 | EventHeader `no-slot` |
| B6 | ConfirmDialog `unregister` |
| C1, C9 | EventListItem, Button, MainNav `admin` |
| C2 | EventHeader `admin`, SlotCard `admin`, AttendeeChip `removable` |
| C3 | LinkDialog `invitation` |
| C4, C5 | EventForm (Form, FormField, DateTimeRange), SlotCard `admin` en liste |
| C6, C7 | SlotForm (Form, FormField, DateTimeRange) ; C6 : texte d'avertissement « Ce créneau est hors des dates de l'événement » (`Alert warning`, validation possible, RG-07) |
| C8 | ConfirmDialog `delete` |
| C10 | ConfirmDialog `remove-registration` |
| D1 | MemberListItem |
| D2, D4, D5 | MemberProfile |
| D3 | LinkDialog `reset` |
| D6, E3 | Toast `danger` |
| E1 | UserMenu `open` |
| E2 | ConfirmDialog `delete` |

## 8. Points à confirmer

- Texte de l'événement sans créneau (B5, flux 04).
- Vue calendrier (F-18) : hors MVP, aucun composant prévu.
