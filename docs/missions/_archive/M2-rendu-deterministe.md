# OBSOLÈTE — voir ADR-0013

Cette mission est conservée comme trace de la décision antérieure. Elle ne doit pas être exécutée : l’ADR-0013 a renversé le retrait du LLM du chemin de production.

# MISSION CODEX M2 — Le générateur LLM sort du chemin critique

**Après M1.** C'est la mission qui rend le bilan publiable.

---

```
=== RAPPEL CADRE ===
Décision actée (ADR-0012) : le bilan est produit par un rendu DÉTERMINISTE.
Aucun appel à un modèle de langage sur le chemin de production d'un bilan.

Motif, établi par l'audit du 31 juillet : sur données synthétiques, le
générateur LLM a transformé une moyenne de 12/20 en 12/100, est passé du
singulier au pluriel, et a produit des recommandations non mesurables. Sur un
document lu par des parents comme un diagnostic, c'est disqualifiant.

Conséquence : la pseudonymisation et OpenRouter sortent du chemin critique.
Ils ne conditionnent plus le bilan. Ils ne concernent plus qu'un usage ARIA
ultérieur, hors périmètre.

=== TRAVAUX ===

M2.1 — Couche de scoring réussite × confiance
  Intégrer le moteur déterministe fourni (lib/positionnement/scoring.ts du kit)
  comme couche de scoring du pipeline Assessment. NE PAS créer un système
  parallèle : c'est une couche, branchée sur la banque de questions existante
  et sur la confiance collectée en M1.5.
  Le croisement produit quatre profils par item, puis par nœud :
    MAITRISE · MAITRISE_FRAGILE · LACUNE_CONSCIENTE · ERREUR_CONFIANTE
  ERREUR_CONFIANTE est l'indicateur le plus important du dispositif : l'élève
  ne sait pas qu'il ne sait pas, donc il ne révisera pas ce point.
  Les six cas dorés fournis sont contractuels. Toute modification impose une
  bascule d'ENGINE_VERSION et une justification en ADR.

M2.2 — Rendu déterministe des trois audiences
  lib/assessments/generators/index.ts cesse d'appeler un modèle. Le rapport est
  assemblé à partir d'un catalogue de fragments versionné, en réutilisant la
  structure de sélection fournie (lib/positionnement/restitution.ts).
  Élève : tutoiement, forces, priorités, micro-plan de 5 actions. Aucun score.
  Parent : vouvoiement, points d'appui, priorités, ce qui sera fait, étape
  suivante. Aucun score, aucun pourcentage, aucun nom d'enseignant.
  Nexus : tout, brut.
  Le contenu est structuré (JSON), jamais du HTML ou du Markdown pré-rendu :
  c'est ce qui garantit que le web et le PDF ne divergent pas.

M2.3 — Garde éditoriale en CI
  Intégrer data/positionnement/lexique-interdit.json et le test associé.
  Il vérifie sur chaque bilan généré, pour les trois audiences :
    - aucun terme prohibé par AGENTS.md
    - aucune séquence interprétable comme un score dans les audiences élève et
      parent — c'est la règle qui aurait intercepté « 12/100 »
    - aucun nom d'enseignant
  Ce test est bloquant en CI. Il n'est jamais désactivé, jamais mis en skip.

M2.4 — Retrait contrôlé du générateur LLM
  Le code du générateur n'est pas supprimé : il est retiré du chemin d'appel et
  marqué comme non utilisé, avec un commentaire renvoyant à l'ADR. Aucune
  variable d'environnement LLM n'est requise pour produire un bilan. Vérifier
  par un test que le pipeline complet s'exécute avec toutes les variables
  Ollama et OpenRouter absentes.

CRITÈRES DE SORTIE :
  [ ] Un bilan complet est produit sans aucune variable d'environnement LLM
  [ ] Les six cas dorés passent, non modifiés
  [ ] 100 % de couverture de branches sur la couche de scoring
  [ ] Garde éditoriale verte sur 3 audiences × tous les cas
  [ ] Aucune donnée nominative ne sort du serveur, prouvé par absence d'appel
      sortant dans le chemin de génération
  [ ] lint, typecheck, test, build verts
```

---

## Le point à ne pas céder

Il y aura une tentation de garder le LLM « juste pour la formulation ». Elle doit être refusée
tant que la garde éditoriale n'a pas tourné sur plusieurs centaines de sorties réelles.

L'argument n'est pas que le modèle écrit mal. C'est qu'il écrit **bien** — de façon fluide,
assurée, plausible — tout en se trompant sur une donnée vérifiable. Un texte maladroit se
repère ; un texte fluide et faux passe la relecture. C'est précisément ce qui s'est produit
avec « 12/100 » : la phrase est correcte en français, elle est simplement fausse.

Une reformulation assistée reste possible plus tard : hors chemin critique, désactivée par
défaut, et sous revue humaine tracée avant diffusion.
