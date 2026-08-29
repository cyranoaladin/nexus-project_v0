# Candidat individuel V1 - Design d'integration production

## Contexte

Le runtime candidat individuel qualifie existe dans l'historique `feec4a427` / RC2 `e96fa67c2`. Le baseline retenu est le merge production `dc5a06b52595f91cf06838112820233c0a290fcc`, qui contient PR180 et la filiation canonique requise. Son arbre `c0b3b72671bdd546d96b3737c706ac9dd2cddd19` est strictement identique a l'arbre de l'actuel `origin/main` `9570ced0` (`git diff` vide); le contenu courant de main est donc preserve sans perdre la provenance production. Les historiques ont diverge depuis `1641a69d`; un merge global risquerait de reintroduire des changements sans rapport et des artefacts interdits.

## Decision d'integration

Construire la release depuis `dc5a06b525`. Transplanter depuis `e96fa67c2` uniquement les fichiers candidat individuel absents du baseline, reprendre les dix migrations additives, puis fusionner manuellement les seuls hunks candidat dans les fichiers partages. Tout blob repris depuis `feec4a427` doit d'abord etre prouve identique a RC2. Les chemins PR180 restent ceux du baseline et sont verifies par ancestry, empreinte, tests source et artefact.

Le commit T3B1 `35841bd3c` est exclu. `MOD_MATHS_COMPLEMENTAIRES`, `MOD_DGEMC`, `MOD_LCA`, `MOD_EAF_DESCRIPTIF`, `SVC_BACS_BLANCS` et `SVC_SECOND_GROUPE` restent deferred, non selectionnables et non facturables.

## Experience staff

Le workspace devient `Simulateur de devis - Candidat individuel`, reserve aux roles ADMIN et ASSISTANTE et au flag `ACTIVE_INTERNAL`.

Le parcours comporte cinq etapes:

1. Eleve & responsable: recherche, selection et rattachement via les APIs existantes, sans saisie d'identifiant technique.
2. Profil candidat: controles humanises pour niveau, session, parcours, specialites, langues et dispenses. Le JSON support reste dans `Options avancees`, replie par defaut.
3. Besoins & accompagnements: cartes de matiere et effectif par matiere. Individuel envoie 1, Duo envoie 2, Petit groupe exige un entier reel superieur ou egal a 3. Aucun effectif n'est invente.
4. Proposition financiere: total annuel, acompte, mensualite et nombre de mensualites proviennent du devis serveur. React ne recalcule ni prix ni marge. Le gate de marge est humanise dans une zone staff discrete.
5. Devis: synthese, actions conditionnelles de brouillon, publication, lien famille, rotation et PDF.

Un rail de synthese est sticky sur grand ecran et redevient un bloc normal sur tablette/mobile. Les transitions d'etape gerent `aria-current`, focus du titre, `aria-live`, erreurs en francais et cibles clavier/tactiles.

## Flux et invariants

Le profil peut etre simule avant rattachement d'identite, mais la publication et le lien famille exigent `contactLeadId` et `studentId`. Toute modification apres simulation invalide le resultat. Les prix SOLO/DUO sont ceux retournes par la creation serveur du brouillon; les totaux de simulation groupe ne sont jamais presentes comme definitifs apres un changement d'effectif.

Le token famille reste genere cote serveur, persiste uniquement sous forme de hash, retourne ponctuellement, rotatif et non logge. La vue famille et le PDF n'exposent jamais marge, politique de cout, raisons internes, codes `MOD_*`, enums bruts ni diagnostics techniques.

Les gates reglementaires, P3, `GROUP_PENDING`, marge (`<30`, `30-40`, `>=40`), provenance de cout, remise non cumulative avec marge recalculee et zero TND restent ceux du moteur existant et ont chacun une regression explicite.

## Activation

Le default reste `OFF`. Apres deploiement et smoke reel, l'etat vise est `ACTIVE_INTERNAL` via l'API admin auditee si elle est automatisable. `ACTIVE_PUBLIC` et `ACTIVE_PUBLIC_PERCENTAGE` restent rejetes. Aucun sitemap, CTA public, `/devis-bac` ou preview public n'est ajoute.

## Verification

TDD sur le runtime transplante, puis sur le workspace. Tous les gates et le build utilisent Node `v22.23.1`. Gates: Prisma, TypeScript, lint, unitaires, DB, gel V1, PR180 (auth, racine absente/illisible/vide, empreinte/contenu, sortie sanitisée), scanners source/artefact, build standalone, E2E candidat, screenshots desktop/mobile inspectes. Production: backup lisible, diff exact des migrations, `migrate deploy`, release immuable avec runtime Node embarque, cutover atomique, restart de `nexus-prod` uniquement, health local/public, smoke OFF, activation interne auditee, smoke authentifie et observation des logs sans secret ni URL famille tokenisee.
