# Journalisation des erreurs API : minimisation

2026-10-05. Base locale `08aed4053`.

Trois tests synthétiques ont reproduit la journalisation de messages/stacks d’exception, de détails ApiError et de messages/chemins Zod arbitraires : 3 échecs avant correction. Le gestionnaire central conserve uniquement code, statut, contexte de route et nombre de problèmes de validation. Les logs structurés du logger de requête continuent de porter leur corrélation. Aucun message, stack, détail ni valeur de validation de l’exception n’est transmis au logger par ce gestionnaire.

Après correction : 3 suites / 35 tests verts, y compris les contrats API existants. Les réponses publiques restent identiques : 500 générique pour les erreurs inattendues ; les routes restent responsables de construire des messages et détails publics sûrs pour leurs erreurs explicites et de validation.

Limites : cette correction ne couvre pas les appels logger/console indépendants du gestionnaire, ni un contexte fourni de manière dynamique par un appelant. Elle ne prouve pas la redaction de tous les endpoints. Aucune donnée réelle ni configuration de production utilisée.


## Renouvellement de contrats historiques

CI `c76d372eb…` et campagne complète locale sur code `118d628f8` : 11 assertions de `error-logging.test.ts` exigeaient les champs maintenant exclus. Résultat local : 1341 suites vertes / 1 rouge, 14873 tests verts / 11 rouges. Les assertions de journalisation ont été remplacées par les métadonnées conservées et une interdiction explicite des quatre champs sensibles sur tous les appels warn/error de cette suite. Les contrats de réponse ne sont pas affaiblis. Essai ciblé renouvelé : 4 suites / 51 tests verts. Une première nouvelle assertion afterEach supposait à tort les deux méthodes déjà espionnées : corrigée en installant les deux spies avant chaque test.
