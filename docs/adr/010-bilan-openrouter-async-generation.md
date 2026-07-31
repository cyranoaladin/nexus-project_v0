# ADR 010 — Génération asynchrone des bilans OpenRouter

## Date et statut

31 juillet 2026 — architecture autorisée, implémentation C2 non autorisée.

Cette ADR ne crée ni table Prisma, ni migration, ni worker, ni route et
n'active aucun appel métier.

## Contexte

Le scoring, la calibration, les preuves et la correction manuelle sont locaux,
déterministes et versionnés. OpenRouter ne rédigera que des brouillons JSON par
audience. Un appel réseau long ne peut donc ni être placé dans une transaction
Prisma, ni rendre synchrone une route de génération.

## Décision

Le futur flux C2 sera :

1. transaction courte : scellement du `ReportContextSnapshot`, création ou
   récupération idempotente du job et réservation budgétaire ;
2. commit ;
3. claim du job par lease bornée ;
4. appel OpenRouter hors transaction ;
5. validations locales de schéma, PII, audience et grounding ;
6. transaction courte : invocation immuable, révision `PENDING_REVIEW`, audit,
   réconciliation du budget et éventuelle outbox de notification ;
7. revue humaine distincte ;
8. publication manuelle d'une révision approuvée seulement.

Une indisponibilité fournisseur garde le scoring, l'authentification et les
bilans historiques disponibles. Elle produit un retry différé ou une dead
letter, jamais un bilan déterministe publié en substitution.

## Idempotence et provenance

La clé métier lie au minimum tentative, snapshot, audience, version de prompt,
schéma et politique modèle. Un replay de même clé et même checksum retourne le
même job. Un payload différent sous la même clé est un conflit.

Chaque invocation conserve les métadonnées sûres de chaque tentative. Une
révision pointe immuablement vers son invocation et son snapshot. Aucun prompt
brut, completion invalide, secret ou PII directe n'est stocké.

## Risque fournisseur

`LLM-PROVIDER-CONCENTRATION-001` est accepté pour un pilote asynchrone, pas pour
une publication automatique. Sévérité `P1_OPERATIONAL`, revue le 30 septembre
2026. Les contraintes `zdr=true`, `data_collection=deny` et
`require_parameters=true` ne sont jamais relâchées. OpenRouter choisit un
endpoint conforme ; Nexus ne pinne pas Azure.

## Activation et rollback

Le mode reste `DISABLED` par défaut. Le pilote exige un worker activé
séparément, un module approuvé et la publication automatique désactivée.
Le rollback applicatif désactive la génération, arrête les claims et interdit
les nouvelles publications ; les scores et données d'audit restent lisibles.
Le rollback DB éventuel sera compensatoire, jamais destructif.

## Conditions avant code C2

- #91 fusionnée et pile réduite ;
- politique parent v1.2 approuvée par l'owner après deux revues humaines ;
- attestation confidentialité valide ;
- contrat de ledger et de lease accepté ;
- migration conçue puis testée fresh et upgrade dans un lot explicitement
  autorisé.
