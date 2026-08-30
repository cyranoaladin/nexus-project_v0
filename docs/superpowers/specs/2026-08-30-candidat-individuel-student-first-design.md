# Candidat individuel - sélection élève en premier

## Date

2026-08-30

## Contexte

Le parcours impose actuellement de sélectionner un responsable avant de rechercher un élève. Or chaque élève Nexus possède déjà un responsable canonique. L'équipe doit pouvoir choisir l'élève directement sans saisir ni deviner un identifiant technique.

## Décision

- La recherche élève est disponible dès l'ouverture de l'étape Identité.
- Le clic sur un élève appelle une mutation staff dédiée qui relit l'élève et son responsable canonique côté serveur.
- Cette mutation réutilise ou crée le `ContactLead` du responsable avec le mécanisme CRM audité existant.
- La réponse installe atomiquement dans l'interface le vrai `studentId` et le vrai `contactLeadId`.
- Le CTA vers le profil reste gouverné par l'invariant `contactLeadId + studentId` et par la validation de cohérence existante.
- Si le responsable est absent, fusionné, sans email exploitable ou ambigu, la résolution échoue fermée avec un message humain.
- Le parcours responsable puis élève reste supporté. Si l'élève est choisi en premier, son responsable canonique devient autoritatif.

## Contrat API

`POST /api/assistante/candidat-individuel/identity/resolve`

Corps strict : `{ "studentId": "..." }`. Aucun `userId`, email, parent ou `contactLeadId` fourni par le client n'est accepté.

Réponse succès :

```json
{
  "success": true,
  "student": { "studentId": "...", "userId": "...", "user": {}, "responsible": {} },
  "contactLead": { "id": "...", "name": "...", "email": "...", "phone": "..." }
}
```

La route est réservée aux rôles `ADMIN` et `ASSISTANTE`. Elle ne modifie pas le schéma et n'expose aucune donnée famille publique.

## Sécurité et métier

- Aucun état public du pipeline n'est ajouté.
- Aucun module deferred n'est modifié.
- Aucun identifiant utilisateur n'est substitué à `studentId`.
- Le `ContactLead` est résolu par email normalisé sous verrou transactionnel existant.
- Une résolution partielle n'active jamais le CTA.

## Rollback

Revenir à la release immuable `4a66f248c-candidat-v1-nullable-fix-20260830T120436Z`; aucune action DB n'est requise.
