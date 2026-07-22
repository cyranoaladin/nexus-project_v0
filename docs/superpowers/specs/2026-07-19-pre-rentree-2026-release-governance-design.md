# Pré-rentrée 2026 — design de gouvernance de validation

## Date

19 juillet 2026

## Contexte

Le lot public v5 canonique porte le statut `PDF_PACKAGE_READY_FOR_OWNER_REVIEW`. Le dossier privé reste `BLOCKED_BY_LEGAL_TERMS`, car la source de conditions particulières approuvées et la notice de confidentialité complète sont absentes.

Le prochain besoin n’est pas une nouvelle passe documentaire. Il faut rendre la revue propriétaire traçable, détecter automatiquement une approbation devenue obsolète et préparer les demandes juridiques sans créer de fausse source canonique.

## Décision

Mettre en place une gouvernance légère, locale et vérifiable. Elle se compose d’un manifest des artefacts soumis à revue, d’un modèle d’approbation humaine, d’un vérificateur déterministe et de demandes de revue juridique strictement non publiques.

Une approbation ne sera jamais générée automatiquement. Le système ne modifiera pas les statuts autorisés du lot documentaire et ne déclarera pas le pack complet prêt à diffuser.

## Alternatives écartées

### Application d’approbation complète

Une interface web, une base de données et une authentification seraient disproportionnées pour un lot documentaire isolé. Elles créeraient une surface de sécurité et une nouvelle source d’état sans valeur immédiate.

### Attente passive de la validation juridique

Le juridique bloque uniquement le dossier privé. La revue propriétaire du lot public peut avancer en parallèle et doit être préparée maintenant.

### Approbation par simple texte ou email non lié aux artefacts

Une approbation non liée aux hashes ne permet pas de savoir si les fichiers approuvés sont encore ceux présents dans le paquet. Cette approche est insuffisante.

## Architecture

### Manifest de revue

Le vérificateur construit un `review-manifest.json` déterministe depuis les artefacts effectivement soumis à revue :

- six PDF publics ;
- six HTML accessibles ;
- trois visuels sociaux et leurs textes alternatifs ;
- rapports contenu, PDF, visuel, social, accessibilité et final ;
- manifest de build et revue visuelle humaine.

Chaque entrée contient le chemin relatif, le SHA-256 et la taille. Le manifest reprend aussi `REPO_SHA`, `SNAPSHOT_SHA256`, `GENERATOR_SHA256`, le campaignId et la version documentaire. Aucun chemin ne peut sortir du paquet et les liens symboliques sont refusés.

### Modèle d’approbation propriétaire

Un modèle `owner-approval.template.json` est généré avec les hashes courants et `decision=PENDING`. Il ne constitue pas une approbation.

Une décision finale `APPROVED` ou `REJECTED` doit fournir :

- l’identité nominative de l’approbateur ;
- son rôle ;
- la date ISO 8601 ;
- une référence de signature ou de décision ;
- le SHA-256 exact du manifest de revue ;
- le SHA du dépôt, du snapshot et du générateur ;
- une liste d’observations explicite.

Le schéma JSON applique ces contraintes conditionnellement. Une approbation liée à un ancien manifest est `STALE` et ne peut pas être interprétée comme valide.

### Vérificateur

La commande :

```bash
python scripts/pre-rentree/verify_release_approvals.py \
  --package outputs-v5-canonical
```

recalcule les hashes, valide le paquet, charge l’éventuel `owner-approval.json`, puis écrit atomiquement sous `AUDIT/GOVERNANCE/` :

- `review-manifest.json` ;
- `owner-approval.template.json` ;
- `owner-approval.schema.json` ;
- `release-decision.json`.

Le rapport de décision expose `OWNER_REVIEW_DECISION=PENDING|APPROVED|REJECTED|STALE|INVALID`. Il recopie sans les élargir les statuts autorisés du lot public et privé. Il ne produit aucun booléen ou statut assimilable à une autorisation automatique de diffusion.

L’option `--require-owner-approval` retourne un code non nul tant que la décision n’est pas `APPROVED`. Le mode normal reste utilisable pour préparer le dossier en état `PENDING`.

### Demandes juridique et confidentialité

Deux documents internes `NON PUBLIC` sont placés dans `docs/operations/pre-rentree-2026/` :

- demande de validation des conditions particulières ;
- demande de validation de la notice de confidentialité.

Ils formulent les clauses comme des points à approuver, corriger ou refuser. Ils ne sont pas créés au chemin canonique attendu par la campagne et ne portent jamais `STATUS: APPROVED`.

### Checklist propriétaire

Une checklist opérationnelle guide la revue des six PDF, des six HTML et des visuels sociaux. Elle demande une décision explicite et renvoie au modèle JSON lié aux hashes.

## Flux de données

1. Le générateur canonique produit `outputs-v5-canonical/`.
2. Le vérificateur lit les manifests et artefacts en lecture seule.
3. Il calcule le manifest de revue et le modèle `PENDING`.
4. Le propriétaire examine les artefacts et crée manuellement `owner-approval.json`.
5. Le vérificateur recalcule tous les hashes.
6. Toute divergence rend la décision `STALE`.
7. Le juridique reste un flux externe ; aucun fichier privé n’est produit tant que les sources approuvées sont absentes.

## Gestion des erreurs

- paquet, manifest ou artefact obligatoire absent : échec bloquant ;
- hash PDF incohérent avec le manifest de build : échec bloquant ;
- chemin sortant du paquet ou lien symbolique : échec bloquant ;
- approbation absente : `PENDING` ;
- approbation invalide : `INVALID` ;
- hash d’approbation ancien : `STALE` ;
- décision explicite négative : `REJECTED` ;
- statut privé différent de `BLOCKED_BY_LEGAL_TERMS` sans source canonique approuvée : échec bloquant.

Les écritures sont atomiques et n’écrasent jamais `owner-approval.json`.

## Tests

Les tests automatisés couvrent :

- manifest déterministe et complet ;
- contrôle des hashes PDF ;
- refus des liens symboliques et traversées ;
- état sans approbation ;
- approbation valide ;
- approbation obsolète, rejetée ou mal formée ;
- non-écrasement de l’approbation humaine ;
- comportement de `--require-owner-approval` ;
- conservation stricte des statuts publics/privés existants ;
- absence de termes donnant une autorisation automatique de diffusion.

## Hors périmètre

- création ou approbation des conditions particulières ;
- création d’une notice de confidentialité juridiquement finalisée ;
- génération des PDF privés ;
- envoi d’email, signature électronique, interface web ou base de données ;
- push, merge ou déploiement.

## Critères d’acceptation

- le dossier de revue est produit en état `PENDING` sur le paquet actuel ;
- une modification d’un artefact invalide une approbation précédente ;
- une approbation ne peut être valide sans identité, date et référence ;
- les statuts restent `PDF_PACKAGE_READY_FOR_OWNER_REVIEW` et `BLOCKED_BY_LEGAL_TERMS` ;
- aucun document privé ni source juridique canonique n’est créé ;
- les tests, le typecheck et les contrôles existants restent verts.
