# Fermeture publique de la campagne de pré-rentrée expirée

## Contexte et décision
Le 5 septembre 2026, l’accueil promeut encore le 17 août alors que la campagne canonique couvre le 17–28 août. PUBLIC_READY contrôle la publication, sans expiration temporelle. La page institutionnelle existe déjà : elle devient directement visible sans inventer une campagne de remplacement.

## Portée
L’injection du DTO campagne dans app/page.tsx est retirée. La gate existante est fermée dans ses deux sources canoniques : READY_FOR_OWNER_GO, autorisation de publication OPEN. Ce statut technique signifie qu’un nouveau GO est requis ; aucune nouvelle campagne n’est annoncée. Les promotions sur offres, stages et accompagnement disparaissent via leur getter existant. Les routes HTML, API et PDF de campagne répondent 404/noindex ; la campagne sort du sitemap. Sources, tarifs et fichiers restent conservés pour consultation privée. Les programmes génériques annuels sont inchangés.

## Provenance
Base distante main : 1abb89f40440536764da120ce0312b49053c8db0. Ce commit ne diffère du code exécuté 995ad8a6d322a0ebe3de3c76d4fd53e1abbf42e9 que par release-manifest.json. Un nouveau build doit régénérer le manifeste avec le SHA de ce correctif et son véritable outil de build ; le manifeste suivi dans Git décrit l’ancien artefact, jamais le nouvel artefact avant construction.

## Vérifications
Test RED observé : le bandeau est encore présent sur HomePage. GREEN : accueil sans bandeau, Hero et CTA institutionnels conservés ; rendu direct du composant de campagne et contrat DTO toujours testés. E2E adaptés : absence de promotion/analytics, navigation, accessibilité, mobile ; le branche fermée vérifie les huit pages prioritaires, absence de liens campagne, API fermées et sitemap. Les résultats complets de build et smokes sont consignés séparément avec l’artefact.

## Rollback
Conserver l’ancien répertoire immuable et son runtime. En cas d’échec des smokes, rétablir son lien current sous verrou puis redémarrer le launcher PM2 nexus-prod et vérifier les endpoints. Aucun rollback de données : ce correctif n’en modifie aucune.
