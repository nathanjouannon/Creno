# Tâches de développement

Les tâches sont suivies dans **GitHub Issues** (décision du 2026-10-26) : une issue `T-NNN : <titre>` par tâche, rattachée à son jalon (`M0` à `M5`). Le numéro d'issue est égal au numéro de tâche (`T-007` = `#7`). Les tickets ont été créés à partir des fichiers `T-NNN-*.md`, supprimés ensuite : **l'issue GitHub est la seule version**, on la modifie là.

L'ordre, les jalons et les dépendances sont dans [`../roadmap.md`](../roadmap.md), qui renvoie vers chaque issue. Les tâches de la v1.1 et de la v2 s'écrivent directement dans GitHub quand elles sont cadrées.

## Règles d'écriture d'un ticket

- Une tâche tient en une session de travail ; au-delà, la découper.
- Elle cite les fichiers à lire au lieu de recopier leur contenu.
- Ses critères d'acceptation sont vérifiables (un test ou une mesure), jamais « fonctionne bien ».
- Elle termine par `definition-of-done.md`.
- Sections d'un ticket : objectif, fichiers à lire, travail, critères d'acceptation, tests attendus, hors-périmètre.
