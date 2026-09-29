# C2 standalone PDF.js et reprise bornée de v5 — design

## Date et périmètre

2026-09-29. Base `5aad152cff097470201b2379716adb96df6e6146`. Ce changement porte sur trois volets séparés dans une PR : (A) inclusion du moteur PDF.js réellement appelé par le runtime; (B) test fonctionnel de l’artefact standalone et précontrôle avant claim; (C) autorisation ADMIN auditée, idempotente et à usage unique pour une reprise d’extraction strictement ciblée.

## Cause à confirmer dans l’artefact

Le code lance un processus Node enfant et passe à `--eval` un import ESM bare de `pdfjs-dist`. Le traceur Next ne voit pas cet import dans une chaîne; un standalone peut donc omettre cette dépendance pourtant déclarée directement. Le build doit inclure explicitement le helper d’extraction et la fermeture de dépendances PDF.js verrouillée, puis valider le fichier NFT et l’extraction depuis une copie isolée du standalone.

## Conception

1. Extraire le code enfant ESM en un helper fichier versionné partagé par l’application et le test d’artefact. L’application le lance avec Node, entrée bornée et timeout existant. Ajouter une inclusion de tracing ciblée pour le helper et le package PDF.js; ne pas copier `node_modules` en bloc.
2. Ajouter un gate de release bloquant qui copie le standalone dans un répertoire temporaire sans dépendance parente ni `NODE_PATH`/préchargement, extrait un vrai PDF synthétique et vérifie plusieurs fragments. Une seconde copie jetable privée de PDF.js doit échouer pour démontrer que le test détecte l’omission.
3. Ajouter un précontrôle de disponibilité de l’extracteur avant toute réclamation de job. Si indisponible, le drain retourne explicitement l’indisponibilité, ne prend aucun bail et n’incrémente aucune tentative.
4. Ajouter un enregistrement de reprise unique par processing : snapshots exacts du processing/soumission/version/empreinte/sujet/dernière extraction/compteur, release corrigée égale à l’identité du serveur, acteur ADMIN, motif borné et operationId unique. Création et audit sont atomiques sous verrou du processing; une capability dédiée ADMIN protège l’API. Seul le cap historique exact (5) et l’erreur PDF.js observée peuvent être autorisés.
5. Le claim ordinaire garde le plafond global de cinq. Une reprise seulement lorsqu’un enregistrement `AUTHORIZED` exact est présent incrémente le compteur cumulatif à six et consomme l’autorisation dans la transaction `FOR UPDATE SKIP LOCKED`, en revalidant les snapshots sous verrou. Aucun nouvel essai après échec. Un bail expiré de cette tentative est clôturé explicitement par une extraction append-only `FAILED` et audit; les écritures tardives sont rejetées par un lease token unique.

## Invariants de sécurité

Pas de réinitialisation ou suppression de l’historique; pas de reprise d’un document rejeté/quarantiné, changé, obsolète, déjà autorisé, actuellement loué ou dont l’erreur ne correspond pas précisément à l’omission historique de `pdfjs-dist/legacy/build/pdf.mjs`. Une operationId rejouée avec payload différent, sur une autre cible ou après consommation est refusée; un replay strict renvoie la même autorisation. L’audit n’enregistre ni empreinte, ni token, ni PII. Aucun changement de ledger IA, antivirus, contenu source, release active ou configuration Preview dans la PR. La migration éventuelle est additive et la compatibilité avec l’ancienne release doit être vérifiée avant application à la Preview.

## Vérification

Tests rouges puis verts pour tracing/extraction standalone, indisponibilité sans claim, autorisation exacte/idempotente, refus RBAC et cible périmée, concurrence à deux workers, fencing des résultats tardifs, succès/échec/crash du seul essai supplémentaire. CI doit exécuter le build et le gate standalone. La qualification post-merge se fait sur clones jetables sans credential IA utilisable; elle ne génère aucun bilan.
