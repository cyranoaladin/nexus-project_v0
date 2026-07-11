# Pré-rentrée 2026 — matrice RBAC/ABAC et IDOR

## Sujet d'autorisation

```ts
type V2AuthorizationSubject = {
  userId: string | null;
  globalRole: UserRole | "VISITOR";
  studentId?: string;
  parentProfileId?: string;
  editionGrants: Array<{ editionId: string; role: PreRentreeStaffRole; permissions: string[]; validUntil: string | null }>;
};

type V2PolicyContext = {
  action: V2Action;
  resourceType: V2ResourceType;
  resourceId?: string;
  editionId?: string;
  studentId?: string;
  cohortId?: string;
  resourceState?: string;
  dataScope: "PUBLIC" | "OWN" | "ASSIGNED" | "EDITION" | "FINANCIAL" | "EXPORT";
};

type PolicyDecision = { allow: boolean; reasonCode: string; effectiveScope: string; audit?: boolean };
```

Les fonctions futures `authorizeV2(subject,context)` et `scopeV2Query(subject,resource,action)` sont pures quant à la décision. Le service charge les preuves dans la même transaction ou une lecture cohérente. Toute absence/erreur est un refus.

## Rôles métier

| Rôle attendu | Preuve |
|---|---|
| visiteur | aucune session ; routes explicitement publiques seulement |
| élève | `User.role=ELEVE`, `Student.userId=userId` |
| responsable légal | `User.role=PARENT`, `ParentProfile.userId=userId`, relation V2 `VERIFIED`, active et droit requis |
| coach | `User.role=COACH`, `CoachProfile.userId=userId`, affectation active à cohorte/séance |
| responsable pédagogique | grant V2 `PEDAGOGICAL_MANAGER` actif pour l'édition |
| assistant administratif | `User.role=ASSISTANTE` + grant V2 `ADMINISTRATIVE_ASSISTANT` actif |
| responsable financier | grant V2 `FINANCIAL_MANAGER` actif |
| administrateur | `User.role=ADMIN` ou grant `ADMINISTRATOR`, 2FA/contrôles renforcés selon politique existante |

Les grants évitent d'étendre immédiatement `UserRole` et séparent la portée V2. Ils ne peuvent élever un utilisateur sans commande admin auditée.

Les valeurs de `rights` et `permissions` sont des codes issus de registres TypeScript/Zod versionnés (`GuardianRightCode`, `PreRentreePermissionCode`) ; la DB conserve les codes pour l'évolutivité, mais toute valeur inconnue est refusée. Aucune route ou composant ne compare une chaîne locale libre.

## Matrice des actions

Légende : `P` public publié ; `O` propre élève/relation vérifiée ; `C` cohorte affectée ; `E` grant édition ; `F` permission financière ; `A` admin ; `—` interdit.

| Ressource/action | Visiteur | Élève | Responsable | Coach | Resp. pédago | Assistant | Finance | Admin |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| édition/module/cohorte publié : lire | P | P | P | P/C | E | E | E | A |
| édition : créer/modifier/archiver | — | — | — | — | — | — | — | A |
| édition/cohorte : publier/dépublier | — | — | — | — | validation E | — | — | A |
| module/variante/règle : lire interne | — | O limité | O limité | C | E | E limité | — | A |
| module/variante/règle : modifier/approuver | — | — | — | — | E | — | — | A |
| cohorte : créer/modifier | — | — | — | — | E pédagogique | E administratif limité | — | A |
| enseignant : affecter/qualifier | — | — | — | — | E | — | — | A |
| salle/équipement : affecter/valider | — | — | — | lecture C | lecture E | E si permission logistique | — | A |
| demande : créer/soumettre | public + rate limit | O | O enfant | — | — | E | — | A |
| demande : lire/modifier | token limité avant liaison | O | O enfant | — | E pédagogique minimisé | E | — | A |
| proposition : créer/émettre | — | — | — | — | — | E | lecture F | A |
| proposition : lire/accepter/refuser | token signé limité | O sans finance si politique | O + finance | — | — | E | F | A |
| inscription : créer/confirmer/annuler | — | — | annuler O selon politique | — | — | E selon workflow | lecture F | A |
| inscription : lire | — | O sans finance | O avec finance | C pédagogique minimisé | E | E | F | A |
| affectation/hold/waitlist : créer/transférer/promouvoir | — | — | demande explicite limitée | — | E arbitrage | E via service capacité | — | A |
| affectation/planning : lire | public agrégé | O | O | C | E | E | — | A |
| présence : lire | — | O | O si droit | C | E | E limité | — | A |
| présence : enregistrer/corriger | — | — | — | C | E | — | — | A |
| bilan/support : lire | — | O selon audience | O selon droit/audience | C | E | E limité | — | A |
| bilan/support : créer/modifier | — | — | — | C | E | — | — | A |
| paiement/facture/remboursement : lire | token facture dédié seulement | — par défaut | O + droit finance | — | — | E limité statut, aucun détail moyen | F | A |
| paiement : initier | — | — | O | — | — | E assisté | F | A |
| paiement : réconcilier/modifier | — | — | — | — | — | — | F | A |
| remboursement : demander | — | — | O | — | — | E enregistre demande | F traite | A |
| communication : lire | — | O reçue | O reçue | C pédagogique seulement | E | E | F si financière | A |
| communication : créer/envoyer | — | — | — | C via templates autorisés | E pédagogique | E | F financière | A |
| audit : lire | — | — | — | — | E limité arbitrages | — | F financier limité | A |
| export | — | export propre ciblé | export propre ciblé | liste C minimisée si permission | E explicite | E explicite | F explicite | A explicite |

## Préconditions ABAC impératives

### Responsable

```text
parentProfile.userId = subject.userId
AND relationship.parentProfileId = parentProfile.id
AND relationship.studentId = resource.studentId
AND relationship.verificationStatus = VERIFIED
AND validFrom <= civilDate(edition.timeZone)
AND (validUntil IS NULL OR validUntil >= civilDate)
AND revokedAt IS NULL
AND requiredRight IN relationship.rights
```

L'email ou le téléphone ne figure jamais dans cette décision. Une relation expirée/révoquée ne donne aucun accès, même si elle existait lors de l'inscription ; les engagements contractuels restent accessibles à un staff autorisé.

### Coach

```text
coachProfile.userId = subject.userId
AND assignment.coachId = coachProfile.id
AND assignment.cohortId = resource.cohortId
AND assignment.validationStatus = APPROVED
AND assignment.validFrom <= now
AND (validUntil IS NULL OR now < validUntil)
AND resource belongs to that cohort/student assignment
```

Le coach voit nom/prénom, parcours utile, présence et supports ; jamais email parent, téléphone, paiement, facture, remboursement ou notes familiales.

### Staff

Le grant doit viser l'édition, être actif et contenir la permission si l'action sort du rôle de base. Les mutations sensibles vérifient état de ressource et séparation des pouvoirs : pédagogie n'approuve pas un remboursement ; finance ne fusionne pas une variante ; assistant ne publie pas.

## Portée de requête et anti-IDOR

- Ne jamais charger par `id` puis « vérifier plus tard » si une requête peut inclure la portée.
- Utiliser `findFirst({where:{id,...scope}})` et retourner 404 hors portée.
- Les listes appliquent la portée avant pagination et comptage.
- Un ID opaque n'est pas un secret ni une preuve d'accès.
- Les objets imbriqués (document, paiement, séance, bilan) héritent par FK vérifiée, pas par paramètre client redondant.
- Les exports exigent permission `EXPORT_*`, filtres obligatoires, limite, audit et stockage temporaire protégé.

## Documents

`canReadPreRentreeDocument(subject, documentLink)` combine audience, portée ressource, relation/affectation active et état de publication. Le service résout un chemin canonique sous racine autorisée et sert un flux ou une URL signée courte. `localPath` n'apparaît jamais dans un DTO. Les liens facture existants restent un mécanisme legacy distinct.

## Actions sensibles et confirmation

Publication, annulation de cohorte confirmée, transfert, arbitrage, élévation de grant, réconciliation manuelle, remboursement, archivage et export massif exigent confirmation explicite, raison, `expectedVersion`, audit et parfois 2FA selon la politique globale. Aucun rôle pédagogique ne peut modifier l'argent.

## Tests IDOR bloquants

- parent A tente enfant de parent B par tous les IDs imbriqués ;
- parent avec relation `PROPOSED`, expirée ou révoquée ;
- enfant avec deux responsables et droits différents ;
- coach affecté à cohorte A tente cohorte B, document et élève commun historique ;
- coach/élève inspectent DTO et endpoints financiers ;
- assistant change `editionId` ou `studentId` dans payload ;
- finance tente modification pédagogique ;
- pagination/count ne révèle aucune ressource hors portée ;
- export sans permission/avec filtres élargis ;
- webhook sans secret/signature et replay.
