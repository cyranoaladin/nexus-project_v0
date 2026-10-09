# Diagnostic E2E : parité du consommateur

La campagne c4349bcc a produit 26 réussites, un échec et trois tests non exécutés. Le parcours bilan mettait correctement en file le traitement, mais le conteneur ne déclarait pas DIAGNOSTIC_PROCESSING_WORKER_ENABLED : le scheduler opt-in ne démarrait pas. Aucun défaut PDF runtime n’était démontré par ce premier échec.

Le Compose jetable reprend les paramètres explicites de la lane HTTP CI : worker actif, poll 1000 ms et mode démonstration limité au seul élève synthétique fixe du test. Aucun réglage de production ni garde de préflight n’est modifié. Le contrat a échoué avant correction (1 échec, 16 réussites). La campagne navigateur doit être renouvelée sur le SHA du correctif ; le contrat seul ne prouve pas le parcours de bout en bout.
