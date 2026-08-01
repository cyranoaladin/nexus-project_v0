# MISSION CODEX M0 — Périmètre public émetteur de bilans

**À coller tel quel dans Codex.** Lecture seule d'abord. Aucune modification sans que
la phase 1 ait été rendue et arbitrée.

---

```
=== RAPPEL CADRE ===
Instance unique. Gel actif. Qualité pédagogique irréprochable, zéro dette.
Référence : audit du 31 juillet sur origin/main b7f9aace. Production 11e0dce.

RÈGLE D'ORDONNANCEMENT ABSOLUE, valable pour toute la mission :
Ne PAS modifier OLLAMA_URL, ne PAS installer de modèle, ne PAS ajouter de clé
OpenRouter, ne PAS corriger lib/ollama-client.ts. L'échec « fetch failed » en
production est actuellement le seul garde-fou empêchant l'émission de bilans
erronés. Le réparer avant d'avoir retiré le générateur LLM du chemin critique
publierait un texte contenant, sur données réelles, une moyenne de 12/20
transformée en 12/100 et un basculement au pluriel.

=== PHASE 1 — LECTURE SEULE, à rendre avant toute modification ===

Objectif : établir la liste EXHAUSTIVE des chemins par lesquels un visiteur non
authentifié, ou un parent authentifié, peut aujourd'hui déclencher la production
ou l'affichage d'un bilan non validé pédagogiquement.

1. Inventorier toutes les routes (pages et API) atteignables sans session, et
   toutes celles atteignables avec une session PARENT, qui aboutissent à :
   a) l'exécution de lib/bilan-generator.ts
   b) l'exécution de lib/assessments/generators/index.ts
   c) l'affichage d'un rapport déjà stocké
   Pour chacune : chemin, fichier, ligne, condition d'accès réelle.

2. Pour chacune de ces routes, déterminer par la lecture du code ce qui se
   produirait si OLLAMA_URL devenait correct et le modèle présent. Autrement
   dit : quelles routes deviendraient émettrices de bilans du jour au lendemain
   sur une simple correction de configuration ? C'est le résultat le plus
   important de cette phase.

3. Vérifier l'état de /bilan-pallier2-maths en PRODUCTION, en lecture seule :
   la page répond-elle publiquement ? Le formulaire est-il soumissible ? Que
   renvoie l'API en l'état actuel ? Ne rien soumettre de réel : lire le code et
   les journaux, pas la base.

4. Localiser la promesse « un bilan sera envoyé par email » signalée dans
   l'audit : fichier, ligne, composant, condition d'affichage. Déterminer
   précisément si un envoi existe quelque part dans le code, ou si la promesse
   est intégralement fausse.

5. Établir la liste des Assessment déjà en base par statut, en agrégat
   uniquement, sans donnée nominative : combien de COMPLETED existent
   aujourd'hui, dont combien avec LLM_GENERATION_FAILED, dont combien
   consultables par un parent.

LIVRABLE PHASE 1, format imposé :
  Verdict
  Constats P0 / P1 / P2 (avec fichier:ligne pour chacun)
  Tableau des routes émettrices et de leur exposition
  Plan d'action
NE modifier aucun fichier. NE rien déployer. NE rien merger.

=== PHASE 2 — sur autorisation explicite seulement ===

À n'engager qu'après validation écrite du plan d'action de la phase 1.
Branche dédiée : fix/m0-fermeture-surface-bilan, rebasée sur origin/main.

A. Rendre inatteignable toute route identifiée en 1 comme émettrice de bilan
   non validé. Méthode privilégiée, par ordre de préférence :
     1. garde serveur explicite renvoyant 404, avec motif journalisé
     2. retrait de l'entrée de navigation
   Ne PAS supprimer de fichier, ne PAS réécrire le pipeline. La fermeture doit
   être un seul point de contrôle, lisible, réversible en une ligne.

B. Retirer toute promesse d'envoi de bilan par email non honorée par le code.
   Remplacer par une formulation exacte de ce qui se passe réellement.
   Aucun CTA hors de la liste approuvée.

C. Ajouter dans l'espace parent une carte d'état honnête pour les familles
   inscrites aux stages : intitulé, nature du bilan, modalité réelle
   (présentiel ou visioconférence), et une prise de contact. Aucune date
   inventée : les valeurs viennent d'une source unique, jamais codées en dur.

CRITÈRES DE SORTIE, tous obligatoires :
  [ ] Aucune route publique ou parent ne peut déclencher lib/bilan-generator.ts
      ni lib/assessments/generators/index.ts
  [ ] Aucune promesse d'envoi non honorée ne subsiste dans le code
  [ ] Aucun rapport existant n'est rendu consultable qui ne l'était pas avant
  [ ] lint, typecheck, test, build verts
  [ ] Aucun débordement horizontal en 375 px sur les écrans touchés
  [ ] Diff intégralement lisible en une lecture ; si le diff dépasse
      ~150 lignes, le périmètre a dérivé : s'arrêter et le signaler

INTERDITS DE CETTE MISSION :
  - toute modification de configuration LLM
  - toute modification de lib/bilan-generator.ts ou des generators
  - toute migration Prisma
  - tout déploiement
  - toute suppression de fichier
```

---

## Notes pour Nexus, hors prompt

- La phase 1 est utile même si vous refusez la phase 2 : elle vous dit exactement ce qui
  partirait en production le jour où quelqu'un « répare le LLM ».
- Le point 2 de la phase 1 est le cœur de la mission. Le reste est du recensement.
- Le seuil de 150 lignes de diff est un garde-fou volontaire : il empêche M0 de se transformer
  en refonte pendant un week-end de gel.
