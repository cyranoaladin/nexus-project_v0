# Analyse des écarts

| Domaine | Actuel | Cible | Écart / priorité |
|---|---|---|---|
| Produit | six chaînes et portails spécialisés | dashboards + chaîne unique | majeur, P1 convergence |
| Famille | plusieurs enfants/parent, un parent/enfant | N–N vérifié, permissions/révocation | majeur, P1 avant parent |
| Affectation | profil + assignment partiel | règle année/voie/spécialités/curricula snapshotée | majeur |
| Tentative | JSON monolithique, pas de reprise générique | attempt/réponses itemisées, autosave/idempotence | majeur |
| Scoring | plusieurs moteurs, agrégats | run/snapshot/evidence versionnés | majeur |
| Sémantique | NSP parfois incorrect, statuts limités | taxonomie explicite | **P0 qualité** |
| Sécurité questions | solutions dans bundle client | projection question sans correction | **P0 intégrité** |
| Ownership | guards hétérogènes | principal/session + scope DB uniforme | **P0 sécurité** |
| Audience | 3 champs/GET mélangé, bool global | version/publication par audience | **P0/P1 privacy** |
| Async | fire-and-forget ou jobs sans lease | outbox, claim, retry, DLQ | **P0 fiabilité** |
| RAG | Chroma confirmé mais contrats/config divergents | backend décidé, corpus versionné/cité | P1 |
| LLM | Markdown libre + PII, fournisseurs multiples | JSON/evidence/citations/minimisation/fallback | P1 |
| PDF | local/à la demande/multiples moteurs | artefact privé durable versionné | P1 |
| Curriculum | maths partiel, horizon ouvert, non runtime | registre complet borné snapshoté | **P0 horizon**, P1 couverture |
| Revue | booléens/statuts spécialisés | HumanReview versionnée | P1 |
| Publication | `isPublished` global | publication audience et révocation | P1 |
| Observabilité | logs/stats fragmentaires | corrélation, métriques, audit, alertes | P1 |
| Production | PM2 + services Docker, docs divergentes | runbook/topologie uniques | P1 |
| Tests | nombreux mocks, DB/E2E séparés | pyramid + Postgres IDOR/concurrence/fournisseurs contract | P0 sécurité, P1 reste |

## Exigences non couvertes

Physique-Chimie, Français, NSI/SNT et variantes Maths ne disposent pas du registre complet ni des banques canoniques. Les 15 diagnostics initiaux ne sont pas publiables. Il n'existe pas de parcours générique « Mon diagnostic de rentrée », de publication parent indépendante, de guardian link multi-responsables, de preuve itemisée ni de fallback complet testé bout en bout.

## Dette à ne pas importer

- pgvector et worker monolithique du prototype NSI sans ADR ;
- notation par LLM des copies comme score canonique ;
- fichiers JSON statiques PII et matching nom/email des prototypes Maths ;
- second portail ou base ;
- `Bilan` étendu jusqu'à devenir une table universelle mélangeant tous les agrégats ;
- enum unique de tous les états du workflow ;
- PDF local considéré durable.

## Critères de fermeture

Chaque écart se ferme par code + test proportionné + preuve d'exploitation : P0 IDOR sur PostgreSQL réel, invariants DB, concurrence de claim, contrat de projection d'audience, corpus/checksums, fallback RAG/LLM/PDF et restore drill. Le passage d'un test mocké ne suffit pas à fermer un finding d'ownership ou de transaction.
