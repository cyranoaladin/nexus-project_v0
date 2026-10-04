# Journalisation des erreurs API : minimisation

2026-10-05. Base locale `08aed4053`.

Trois tests synthétiques ont reproduit la journalisation de messages/stacks d’exception, de détails ApiError et de messages/chemins Zod arbitraires : 3 échecs avant correction. Le gestionnaire central conserve uniquement code, statut, contexte de route et nombre de problèmes de validation. Les logs structurés du logger de requête continuent de porter leur corrélation. Aucun message, stack, détail ni valeur de validation de l’exception n’est transmis au logger par ce gestionnaire.

Après correction : 3 suites / 35 tests verts, y compris les contrats API existants. Les réponses publiques restent identiques : 500 générique pour les erreurs inattendues ; les routes restent responsables de construire des messages et détails publics sûrs pour leurs erreurs explicites et de validation.

Limites : cette correction ne couvre pas les appels logger/console indépendants du gestionnaire, ni un contexte fourni de manière dynamique par un appelant. Elle ne prouve pas la redaction de tous les endpoints. Aucune donnée réelle ni configuration de production utilisée.
