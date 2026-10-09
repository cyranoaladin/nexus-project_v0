# Confidentialité des preuves Playwright

Les traces brutes contiennent des cookies et restent privées. Les workflows publient désormais uniquement un rapport JSON reconstruit par allowlist, lié au HEAD exact. Les erreurs, sorties, URLs, titres libres et pièces jointes arbitraires ne sont pas publiés. Les statuts, retries, annotations critiques et identifiants de requirements restent vérifiables ; une erreur conserve son cardinal et ne devient jamais une réussite.

Seule exception : les 32 captures PNG des fixtures synthétiques ARIA mobile E018–E021. Leur nom, contexte et format sont contrôlés ; les chunks de métadonnées libres sont refusés, les octets restent inchangés et le contrôleur visuel vérifie encore les dimensions et CRC. Toute pièce jointe exclue bloque la qualification visuelle.

Le wrapper ARIA refuse un dossier de preuve existant avant tout appel Docker. Chaque exécution utilise un projet Compose distinct et conserve les diagnostics bruts dans un nouveau dossier privé. Le publisher refuse écrasement, symlinks de destination et changement de HEAD.

Preuves locales : 43 tests gouvernance ciblés et 80 tests de contrats ARIA passent. Un test RED démontrait auparavant la suppression de preuves existantes ; il passe après correction. Ces résultats concernent le lot local et ne constituent pas une CI distante ni une qualification production. Les campagnes navigateur doivent être renouvelées sur le commit final.
