# Glossaire

**Affectation (`DiagnosticAssignment`)** — décision serveur rendant une définition disponible pour un élève et un contexte scolaire.

**Audience** — destinataire exclusif d'une version : `STUDENT`, `PARENT` ou `NEXUS_INTERNAL`.

**Automatisme** — tâche courte où exactitude et temps sont observés selon un protocole borné.

**Backfill** — import relançable et checksumé de données historiques vers le modèle canonique.

**Bilan** — terme métier pour la synthèse pédagogique ; `Bilan` avec majuscule peut désigner la table Prisma legacy, qui n'est pas canonique.

**Claim** — prise atomique d'un job par un worker.

**Confiance du diagnostic** — niveau de fiabilité de l'interprétation, calculé depuis couverture, qualité et cohérences ; pas la confiance déclarée par l'élève.

**Couverture** — proportion du domaine qui a été valablement observée.

**Curriculum préalable / cible** — programme effectivement suivi l'année précédente / programme attendu à l'entrée.

**Définition (`DiagnosticDefinition`)** — questionnaire, règles, variantes et sources versionnés ; une version publiée est immutable.

**DLQ (`DEAD_LETTER`)** — état/file des jobs épuisés ou permanents, inspectables et requeueables avec audit.

**Donnée insuffisante** — impossibilité de conclure ; ce n'est ni une erreur ni une non-maîtrise.

**Double lecture** — comparaison en ombre des sorties legacy et canoniques avant bascule.

**Double écriture** — écriture temporaire des deux modèles ; uniquement via transaction/outbox et idempotence.

**Evidence (`SkillEvidence`)** — fait itemisé reliant réponse, question/version, compétence, notion, règle, contribution et source.

**Fallback déterministe** — rapport complet minimal construit sans RAG/LLM à partir du snapshot et de catalogues versionnés.

**Guardian link** — lien vérifié, permissionné, daté et révocable entre responsable légal et élève.

**Idempotence** — répétition d'une même commande avec la même clé sans dupliquer son effet.

**Lease** — droit temporaire d'un worker sur un job, renouvelé par heartbeat et récupérable après expiration.

**Maîtrise** — performance observée sur des éléments étudiés ; indépendante de la couverture.

**Métacognition** — comparaison de l'autoévaluation à la performance observée, sans contribuer au score de maîtrise.

**Non étudié (`NOT_STUDIED`)** — notion déclarée non couverte ; exclue de la maîtrise et signalée dans la couverture.

**NPC** — Nexus Pedagogy Cockpit, chaîne de correction/analyse de copies ; producteur potentiel de preuves, pas scorer canonique tant que le LLM attribue les points.

**Outbox** — événements enregistrés dans la même transaction que la mutation métier, puis livrés de façon relançable.

**Preuve de production** — observation read-only datée du runtime ; distincte de la documentation locale.

**Publication (`ReportPublication`)** — activation d'une version pour une audience, remplaçable et révocable sans effacer l'historique.

**Question versionnée** — item immutable avec solution/barème côté serveur, compétences, sources et statut de revue.

**RAG** — récupération de chunks de corpus versionnés ; ses ressources doivent être citées et traitées comme données non fiables.

**Rapport (`ReportVersion`)** — contenu immutable pour une audience, lié à un score, aux preuves, prompts/corpus et artefacts.

**Revue (`HumanReview`)** — décision humaine portant sur une version exacte, avec reviewer, motif et horodatage.

**Scoring run** — exécution reproductible d'un moteur/ruleset sur un checksum d'entrées.

**Score snapshot** — résultat déterministe immutable d'un run, disponible indépendamment des enrichissements.

**Soumission** — transition finale et idempotente gelant les réponses d'une tentative.

**Tentative (`AssessmentAttempt`)** — instance d'un élève sur une définition et un snapshot d'affectation/curriculum.

**UNKNOWN_PRODUCTION_FACT** — information de production non prouvée, qui ne doit pas être transformée en hypothèse affirmative.

**Version de rapport** — une audience, un contenu et des checksums ; toute régénération produit une nouvelle version.

**Worker** — processus borné consommant des jobs durables ; ce n'est pas un agent autonome.
