# Espace pédagogique Terminale — architecture

## Date

2026-10-02

## Contexte

Le TP « Des objets qui agissent » (NSI, POO) tournait comme module autonome sous `/ateliers/poo/` : identité libre saisie par l'élève (alias, groupe, code de séance), export/import de traces JSON, aucune authentification, aucune correction. L'objectif est un espace intégré à `nexus-project_v0` : `Connexion → tableau de bord → activité → sauvegarde automatique → remise` côté élève, `élèves → séances → progression → travaux → correction → annotations` côté enseignant.

Le stockage historique (voir `docs/legacy-poo/LEGACY_POO_INVENTORY.md`) contient **0 dépôt**. Il est conservé tel quel, et un pont manuel est fourni pour rattacher plus tard d'éventuelles traces.

## Décisions

### 1. Une seule plateforme
Aucune seconde base d'utilisateurs, aucune seconde authentification, aucun SQLite pour les nouveaux travaux. Tout vit dans PostgreSQL via Prisma, sous `app/espace`, `app/api/espace`, `lib/espace`, `components/espace`.

### 2. Identité sans email
- `User.username` (unique, normalisé en minuscules ASCII) et `User.pinHash` (bcrypt, coût 11), `User.disabledAt`. Migration additive, colonnes nullables : aucun compte existant n'est touché.
- Un **second fournisseur NextAuth** (`id: 'espace'`) : `authorizeEspaceCredentials`. Le flux email existant n'est pas modifié et n'accepte jamais un code personnel (le code vit dans `pinHash`, jamais dans `password`).
- ELEVE → code personnel (8 caractères, alphabet sans ambiguïté, ≈ 40 bits). COACH → mot de passe. ADMIN, ASSISTANTE et PARENT sont refusés sur ce chemin (un ADMIN passe par `/auth/signin`, puis peut superviser `/espace/enseignant`).
- Même réponse `null` pour toute cause d'échec ; comparaison bcrypt factice quand le compte est absent ou inutilisable (pas d'oracle d'existence, ni par message ni par temps).
- Désactivation = `disabledAt` + incrément de `sessionVersion` (révoque les jetons) ; en plus, l'acteur est **relu en base à chaque requête** (rôle et `disabledAt` actuels).
- Les élèves de l'espace n'ont **pas** de ligne `Student` : `Student.parentId` est obligatoire et ces élèves n'ont pas de fiche parent. L'espace repose sur `User(role = ELEVE)`.
- Enseignant = rôle `COACH` existant, aucun nouveau rôle.

### 3. Matières, groupes, droits
`Subject` existant (`MATHS` du cahier des charges = `MATHEMATIQUES`). `EspaceEnrollment(userId, groupId, subject)` et `EspaceTeacherAssignment(teacherId, groupId, subject)` répondent directement à : qui suit quelle matière, qui appartient à quel groupe, qui enseigne quoi. Un enseignant ne voit un élève que s'il enseigne, pour une matière, un groupe où cet élève est inscrit pour cette matière.

### 4. Modèle de données (12 tables, 5 types)
`espace_groups`, `espace_enrollments`, `espace_teacher_assignments`, `espace_activities` (miroir des clés étrangères : le contenu reste dans le code), `espace_sessions`, `espace_session_participants`, `espace_works`, `espace_work_versions`, `espace_annotations`, `espace_comment_snippets`, `espace_work_attachments`, `espace_legacy_links`.
Travaux, versions, annotations, pièces jointes et liens de provenance sont en `ON DELETE RESTRICT` : supprimer un utilisateur n'efface jamais un travail.

### 5. Sauvegarde automatique à révision optimiste
- Serveur : `EspaceWork.revision` augmente à chaque écriture élève. Toute écriture porte `baseRevision` ; le prédicat SQL de mise à jour contient **révision et statut** → aucune course ne passe (testé en concurrence réelle).
- Un rejeu exact d'une sauvegarde déjà appliquée (réponse perdue) réussit sans écrire.
- Client (`lib/espace/client/sync-engine.ts`, logique pure) : debounce 1 s, brouillon écrit en IndexedDB **avant** envoi, backoff, reprise au retour du réseau et après rafraîchissement, fusion silencieuse si l'autre onglet n'a changé qu'une autre étape, **conflit explicite** si la même étape a changé, arrêt sans réessai si le travail est remis ailleurs.
- L'indicateur ne dit « enregistré » qu'après accusé du serveur.

### 6. Instantanés
`STEP_CHANGE`, `SUBMIT`, `REOPEN`, `CORRECTION` toujours ; `RUN` espacé de 20 s ; `INTERVAL` toutes les 10 min ; jamais d'instantané identique au précédent ; plafond de 300 par travail pour les motifs non essentiels.

### 7. Machine d'états
`DRAFT → IN_PROGRESS → SUBMITTED → CORRECTED → DONE`, `REOPENED` depuis `SUBMITTED/CORRECTED/DONE`. Après la remise : **lecture seule**, y compris pour une requête en vol. Seul l'enseignant rouvre (« à reprendre »). L'enseignant ne modifie jamais le contenu et ses actions ne changent pas `revision`. Les retours (annotations) ne deviennent visibles de l'élève qu'une fois le travail passé au moins une fois entre les mains de l'enseignant.

### 8. Python
Exécuté **uniquement dans le navigateur** (Pyodide, Web Worker détruit au dépassement de délai). Le serveur ne reçoit que du texte. Le harnais de contrôles formatifs est repris à l'identique du TP historique (empreinte figée par test) ; son filtrage AST est une restriction pédagogique, pas une sandbox : le code s'exécute dans le navigateur de l'élève, sans accès aux données d'un autre élève. L'enseignant ne lance jamais le code d'un élève : il le lit comme texte.

### 9. Sécurité
- IDOR : un travail inaccessible est indiscernable d'un travail inexistant (404 identique).
- CSRF : mutations en `application/json` uniquement, `Origin` comparé à l'hôte, cookie `SameSite` de NextAuth.
- Fichiers : type lu dans les octets (PDF/JPEG/PNG), 8 Mo, 10 par travail, nom de stockage = UUID, stockage privé sous `DOCUMENT_STORAGE_ROOT/espace/…`, lecture via `openSecureDocument` (confinement), en-têtes `nosniff` + CSP `sandbox`.
- Corrigés : ressources d'audience `TEACHER` jamais servies à un élève, 404 uniforme.
- XSS : le texte d'élève et les annotations sont stockés bruts et affichés en texte React ; seul le HTML de leçon, issu du dépôt, est injecté.
- Rate-limit : presets dédiés (login : plafond IP large car une classe partage une IP, 5 essais / 15 min par identifiant ; autosave dimensionné pour ≈ 1 écriture/s).
- CSP : `connect-src` autorise `https://cdn.jsdelivr.net` (déjà permis pour scripts, styles, polices, workers) pour que Pyodide charge son WASM.

### 10. Legacy
`/ateliers/poo/` n'est ni modifié ni redirigé. Le pont (`lib/espace/legacy`, `scripts/espace/legacy-poo.ts`) lit l'archive en lecture seule, ne lie rien automatiquement, exige un plan puis un jeton de confirmation, refuse les cas ambigus, ne supprime rien. Voir `docs/legacy-poo/LEGACY_POO_LINKING.md`.

### 11. Parcours « Récursivité et programmation récursive » (2026-10-04)
Même moteur que les autres leçons guidées (autosave, instantanés, remise, annotations, Pyodide en Web Worker) : aucune infrastructure parallèle. Spécificités :
- **Thème d'affichage** (`ActivityDef.theme`) : NSI = « Programmation orientée objet » (TP 1, TP 2) puis « Algorithmique et programmation » ; les activités sans thème (maths) s'affichent comme avant.
- **Harnais comportemental** (`content/espace/nsi-recursivite/runner.py`) : la récursivité est *observée* — le nom de la fonction de l'élève est remplacé par un enveloppeur qui compte les appels ; une version à boucle donne les bonnes valeurs mais échoue au contrôle « s'appelle elle-même ». Limite de profondeur volontairement basse (200) : une `RecursionError` lisible, jamais un blocage ; une récursion exponentielle est interrompue par le délai du Worker (recréé à l'essai suivant).
- **Figure `call-trace`** (`lib/espace/recursion-trace.ts`, composant `CallTrace`) : trace APPEL / RETOUR et pile d'appels (sommet en premier), purement pédagogique, n'écrit rien dans le travail.
- **Compétences suivies** : liste `skills` du contenu ; côté correction, elles pré-remplissent le commentaire existant (annotation d'étape), sans nouveau stockage.

## Limitations connues

- **Core v2** : sur `main`, `CORE_V2_AUTH_MODE=V2_ONLY` rejetterait tout jeton issu du Core v1, donc ces comptes. L'espace suppose `V1_ONLY` ou `HYBRID` tant que ses identités n'existent pas dans Core v2.
- Les élèves de l'espace n'ont pas de fiche `Student` : les écrans `/dashboard/eleve` historiques ne leur sont pas destinés.
- L'exécution Python réelle exige un navigateur et l'accès à `cdn.jsdelivr.net`.
- Aucune notification (email/WhatsApp) n'est envoyée par l'espace.
- Le temps d'activité n'est jamais un indicateur pédagogique : la progression repose sur les étapes renseignées.

## Rollback

Voir `docs/espace/RUNBOOK.md`. En bref : restaurer la release applicative précédente ; **laisser les tables et colonnes en place** (inertes sans le code, elles contiennent des travaux d'élèves).
