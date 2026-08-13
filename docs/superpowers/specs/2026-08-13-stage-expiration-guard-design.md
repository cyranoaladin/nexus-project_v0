# Fermeture et garde d’expiration des stages dynamiques

## Date

13 août 2026

## Contexte

Le stage dynamique `printemps-2026`, terminé le 25 avril 2026, est resté
`isVisible=true` et `isOpen=true` dans PostgreSQL. Le catalogue public, la
fiche, le formulaire, le sitemap et le POST d’inscription ne tenaient compte
que de ces drapeaux et jamais de `endDate`.

La fermeture opérationnelle est distincte du correctif applicatif : la ligne
de production est archivée par ses deux drapeaux, sans supprimer le stage ni
ses deux réservations `COMPLETED`.

## Décision

Un stage est expiré lorsque `endDate < now`. La frontière `endDate === now`
reste valide : la date de fin n’est alors pas encore dépassée.

La règle est centralisée dans une fonction pure acceptant explicitement
l’horloge. Les accès runtime lui transmettent leur instant de référence afin
que les tests restent déterministes.

La défense en profondeur couvre cinq frontières :

1. listes et détails publics : seuls les stages non expirés sont chargés ;
2. pages publiques : la fiche legacy exacte redirige en `301` vers `/stages`,
   tandis que l’inscription expirée répond `404` et ne monte aucun formulaire ;
3. sitemap : aucun stage expiré ni formulaire associé n’est émis ;
4. POST d’inscription : la sélection atomique exige `endDate >= now`, sinon
   elle répond `404` sans écrire ni notifier ;
5. administration : créer ou rouvrir un stage expiré est refusé avec `400`.

## Redirection et indexation

La seule fiche historique connue, `/stages/printemps-2026`, reçoit une
redirection exacte `301` vers `/stages`. Le statut est déclaré explicitement
dans `next.config.mjs` afin d’éviter les redirections Next `307/308` qui
préservent la méthode.

`/stages/printemps-2026/inscription` n’est pas redirigée : le getter public
échoue fermé et Next renvoie `404`/`noindex`. Le POST correspondant est
`/api/stages/printemps-2026/inscrire` et répond lui aussi `404`. Aucun POST ne
peut donc être rejoué vers `/stages`.

Les futurs stages expirés sont retirés des listes et du sitemap et leurs
routes génériques échouent fermées. Le `301` reste volontairement spécifique
à la fiche déjà indexable pour ne pas transformer l’existence de brouillons
cachés en oracle public.

## Source de vérité et seed

La source runtime reste PostgreSQL. Le seed n’est qu’un bootstrap, mais il doit
être sûr sur une base fraîche et idempotent sur une base existante. Son upsert
pour `printemps-2026` place donc `isVisible=false` et `isOpen=false` dans
`create` comme dans `update`.

Le canon tarifaire et le parcours campagne Pré-rentrée 2026 sont hors périmètre.

## Administration

Un import historique reste possible à condition d’être fermé. À la création,
un stage passé est accepté uniquement avec `isOpen=false`. Au PATCH, la
validation se fait sur l’état effectif combinant la ligne existante et le
payload : modifier un autre champ ne doit pas laisser ou remettre un stage
expiré ouvert.

## Tests

L’horloge de référence est `2026-08-13T12:00:00.000Z`.

- règle pure : passé, futur et frontière exacte ;
- liste/détail API : requête Prisma bornée par `endDate >= now` ;
- inscription : `404` avant toute recherche de doublon ou écriture ;
- sitemap : stage passé absent, stage futur présent ;
- administration : création et réouverture passées refusées, import fermé
  autorisé ;
- configuration : redirection exacte `301`, sans redirection de l’inscription ;
- E2E CI : fiche `301`, inscription/API expirées fermées, absence du sitemap,
  témoin futur encore disponible.

## Rollback

Le correctif code est réversible par revert de la PR. La fermeture de donnée
est réversible par un PATCH ciblé des deux drapeaux, mais ne doit pas être
annulée tant que le stage reste expiré. Aucune suppression de ligne ou de
réservation n’est prévue.
