# Candidat individuel - cloture du gate live P1-A

## Date

2026-08-31

## Perimetre

Deux traces humaines ont ete executees sur la production `ca2b86`, avec le
meme compte staff, le meme dossier et le meme runtime serveur :

- profil Chrome 152 normal apres hard reload ;
- profil Chrome 152 prive, sans extension.

Le rapport ne conserve aucune identite, valeur de champ, cookie, token ou
corps de requete.

## Resultats communs

- recherche eleve : HTTP 200 ;
- evenement souris recu par une option React ;
- resolution d'identite : HTTP 200 ;
- carte eleve visible ;
- CTA Profil active ;
- navigation humaine jusqu'au Profil : PASS ;
- Service Worker : absent ;
- Cache Storage : vide ;
- chunk candidat et chunks essentiels : identiques entre les deux traces.

## Classification

`P1_A = CLIENT_ENVIRONMENT_PROVEN`

`CLIENT_CONTEXT_DEPENDENCY = PROVEN`

`PERSISTENT_APPLICATION_DEFECT = NOT_REPRODUCED`

`STALE_CLIENT_BUNDLE = STRONGLY_SUPPORTED_BUT_NOT_PROVEN`

`TRANSIENT_NETWORK_RSC_STATE = POSSIBLE`

`EXACT_PRE_RELOAD_MECHANISM = UNPROVEN`

Le fonctionnement apres hard reload dans le profil normal et dans un contexte
prive propre prouve une dependance au contexte client anterieur. L'absence de
fingerprint de l'onglet avant son hard reload interdit toutefois de conclure
qu'un bundle obsolete etait la cause exacte.

## Decision

P1-A ne bloque plus le hardening final. Cette conclusion n'autorise ni build
final, ni tag, ni artefact, ni cutover avant fermeture et qualification de tous
les gates restants.

