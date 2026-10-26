# Tâches de développement

Les tâches sont suivies dans **GitHub Issues** (décision du 2026-10-26). Les fichiers `T-NNN-*.md` de ce dossier sont le contenu prêt à copier des tickets : un fichier = un ticket, avec objectif, fichiers à lire, travail, critères d'acceptation, tests attendus et hors-périmètre. L'ordre, les jalons et les dépendances sont dans [`../roadmap.md`](../roadmap.md).

## Créer les tickets

1. Créer les six jalons GitHub : `M0 – Squelette`, `M1 – Installation et accès`, `M2 – Événements et créneaux`, `M3 – Inscriptions`, `M4 – Invitations et membres`, `M5 – Compte et mise en service`.
2. Pour chaque fichier, créer une issue dont le titre est `T-NNN : <titre>` et dont le corps est le fichier (sans la première ligne), avec le jalon correspondant. Avec l'outil `gh` :

   ```
   gh issue create --title "T-001 : Monorepo pnpm, Next.js, outils de qualité" \
     --milestone "M0 – Squelette" --body-file docs/tasks/T-001-monorepo-squelette.md
   ```

3. Dans les tickets, remplacer « Dépend de : T-004 » par la référence de l'issue (`#12`) une fois les numéros connus, et reporter le numéro dans le tableau de `roadmap.md`.

## Une fois les tickets créés

L'issue GitHub devient la référence : on la modifie là, plus dans ce dossier. Pour éviter deux versions, supprimer les fichiers `T-NNN-*.md` dans le commit qui ajoute les numéros d'issue à `roadmap.md`, ou les garder en précisant ici qu'ils sont figés. Les tâches de la v1.1 et de la v2 s'écrivent directement dans GitHub quand elles sont cadrées.

## Règles d'écriture d'un ticket

- Une tâche tient en une session de travail ; au-delà, la découper.
- Elle cite les fichiers à lire au lieu de recopier leur contenu.
- Ses critères d'acceptation sont vérifiables (un test ou une mesure), jamais « fonctionne bien ».
- Elle termine par `definition-of-done.md`.
