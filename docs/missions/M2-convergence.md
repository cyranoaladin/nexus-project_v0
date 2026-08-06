# MISSION CODEX M1 — Convergence des pipelines et parcours consultable

**Après le 3 août.** Ne pas lancer avant que M0 soit rendue et arbitrée.

---

```
=== RAPPEL CADRE ===
Instance unique. Qualité pédagogique irréprochable, zéro dette.
Décision d'architecture actée : le runtime retenu est le pipeline Assessment
(/api/assessments/**). Le pipeline historique (/bilan-pallier2-maths,
lib/bilan-generator.ts) est fermé au public et conservé comme référence
pédagogique. Le modèle de scoring retenu est computeScoringV2, pas V1.

INTERDIT PENDANT TOUTE LA MISSION : toucher à la configuration LLM, installer
un modèle, ajouter une clé OpenRouter. Le générateur sort du chemin critique en
M2, pas ici.

=== PHASE 1 — ANALYSE D'ÉCART, LECTURE SEULE ===

1. Modèle Assessment : produire la liste exacte des champs existants, et la
   liste des champs manquants pour porter :
     - le rattachement studentId (aujourd'hui absent, submit/route.ts:118)
     - la confiance déclarée par question
     - le cycle REPORT_PENDING_REVIEW → COACH_VALIDATED → PUBLISHED
     - la version de moteur et la version de banque ayant produit le résultat
   Pour chaque champ manquant : nullable ou non, valeur par défaut, impact sur
   les enregistrements existants.

2. computeScoring V1 : recenser TOUS les appelants. Pour chacun, dire si la
   bascule vers computeScoringV2 est un remplacement direct ou une refonte.
   Documenter précisément la perte des domaines prob_stats et algorithmic :
   à quel endroit exact du code la donnée disparaît-elle ?

3. Ownership : lire lib/security/ownership.ts et établir la chaîne
   d'autorisation complète exigée pour qu'un parent consulte un bilan. Dire ce
   qui manque, maillon par maillon, entre une soumission publique et cette
   chaîne.

4. Tunnel : cartographier le parcours réel depuis /bilan-gratuit jusqu'à un
   rapport consultable, en marquant chaque rupture avec fichier:ligne.

LIVRABLE : Verdict / Constats P0-P1-P2 / Plan d'action.
Aucune modification.

=== PHASE 2 — CORRECTIFS, un ticket par branche ===

Ordre imposé. Chaque ticket est autonome, testé, et livré avec son rapport.

M1.1 — Rattachement studentId
  /api/assessments/submit renseigne Assessment.studentId depuis la session
  serveur, jamais depuis le corps de la requête. Une soumission sans identité
  serveur vérifiable est refusée, pas rattachée par email.
  Tests : un parent voit le bilan de son enfant ; un autre parent reçoit 404,
  pas 403 ; une soumission anonyme n'est jamais rattachée par correspondance
  d'email.

M1.2 — Cycle de revue effectif
  app/api/assessments/[id]/result/route.ts cesse de rendre un rapport au seul
  état COMPLETED. Seul PUBLISHED est consultable par un parent ou un élève.
  COACH et ADMIN accèdent aux états antérieurs.
  Un échec de génération ne marque JAMAIS l'évaluation comme terminée : le
  comportement actuel de lib/assessments/generators/index.ts:143 est corrigé,
  l'état devient explicitement en échec.
  Tests : matrice complète statut × rôle, exhaustive, pas d'échantillon.

M1.3 — Bascule V2
  Le générateur reçoit computeScoringV2. Aucun domaine évalué ne peut être
  absent du rapport : ajouter un test qui échoue si le nombre de domaines en
  sortie diffère du nombre de domaines évalués. Ce test est le filet de
  sécurité de toute la mission.

M1.4 — Tunnel
  /bilan-gratuit conduit au questionnaire quand un pack PUBLISHED existe pour
  le niveau et la matière du demandeur, et vers une prise de rendez-vous sinon.
  La décision est lue dans le catalogue canonique, jamais codée en dur.
  Aucun CTA hors liste approuvée.

M1.5 — Confiance déclarée
  Chaque question du questionnaire recueille une confiance sur 4 niveaux, sans
  valeur médiane. Stockée par réponse. Non encore exploitée dans le rendu :
  c'est M2 qui l'utilise. L'objectif ici est de ne pas perdre la donnée.

CRITÈRES DE SORTIE :
  [ ] Un parent inscrit consulte le bilan de son enfant, et lui seul
  [ ] Aucun rapport non PUBLISHED n'est visible d'un parent ou d'un élève
  [ ] Aucun échec de génération n'est présenté comme un succès
  [ ] Aucun domaine évalué n'est absent du rapport, prouvé par test
  [ ] Migrations additives, produites mais NON appliquées en production
  [ ] lint, typecheck, test, build verts
```

---

## Notes pour Nexus, hors prompt

- **M1.3 est le ticket le plus important et le moins visible.** Un bilan qui omet
  silencieusement deux domaines évalués est pire qu'un bilan absent : il donne une image
  fausse et complète à la fois. Le test de comptage de domaines doit rester en place
  définitivement.
- M1.5 ne produit aucun effet visible. C'est volontaire : la donnée doit être collectée
  avant que M2 puisse produire les profils `ERREUR_CONFIANTE`. Ne pas la sacrifier
  sous prétexte qu'elle « ne sert pas encore ».
- Le choix `404` plutôt que `403` en M1.1 n'est pas cosmétique : `403` confirme l'existence
  d'un bilan pour un autre élève.
