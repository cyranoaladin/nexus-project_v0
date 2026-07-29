# Triage des findings de `scripts/marketing/public-content-audit.mjs`

Date : 2026-07-29
Méthode : exécution locale contre un serveur `next dev` (jamais la production), 39 pages publiques statiques découvertes, 2 non atteignables en local (`/admin/directeur`, `/programme/maths-1ere-stmg` — nécessitent probablement une session ou des données de seed). 34 findings bruts sur 37 pages atteignables. **Aucun contenu n'a été modifié — rapport seul, per H4.**

## Bonne nouvelle d'abord : zéro finding P0

**Aucune** des 4 catégories les plus graves n'a produit de résultat : promesse de résultat garanti, taux de réussite chiffré, "150+ mentions" ou "500+ élèves" non sourcés, "Essayer gratuitement" sans accès gratuit, compte à rebours, nom d'enseignant publié — **0 occurrence sur les 37 pages atteignables.**

## H1 — liste complète, groupée par règle

### Catégorie `siege-centre-confusion` (Centre Urbain Nord sur page commerciale) — 21 occurrences, **1 seule cause racine**

Toutes les 21 occurrences partagent le texte exact et le contexte suivant, à l'identique : `"...contact@nexusreussite.academy Centre Urbain Nord, Tunis..."` — c'est le panneau de contact rapide mobile de `CorporateNavbar.tsx` (déjà identifié dans une mission antérieure comme utilisant `LEGAL.addresses.siege.city` au lieu de l'adresse pédagogique Mutuelleville), rendu à l'identique sur chaque page qui inclut ce composant.

Pages concernées (21) : `/`, `/accompagnement-scolaire`, `/bilan-gratuit`, `/bilan-pallier2-maths`, `/candidat-libre-bac-francais`, `/contact`, `/famille`, `/grand-oral`, `/maths-1ere`, `/notre-centre`, `/offres`, `/plateforme-aria`, `/preparation-bac-francais-tunis`, `/pre-rentree`, `/programme/maths-1ere`, `/programme/maths-terminale`, `/recommandation`, `/ressources`, `/reussir-eaf`, `/stages`, `/stages/pre-rentree-2026`.

Exceptions notables : `/equipe` et `/lamis` n'affichent pas le texte — vérifié (`grep CorporateNavbar app/equipe/page.tsx app/lamis/page.tsx` → aucune correspondance) : ces deux pages n'incluent simplement pas `CorporateNavbar`. Ce n'est pas un manque de couverture, c'est cohérent.

**Règle enfreinte** : AGENTS.md §2, « Les pages commerciales et pédagogiques doivent mettre en avant Mutuelleville pour les cours, stages, rendez-vous pédagogiques et accompagnement en présentiel. »

### Catégorie `delai-non-instrumente` — 13 occurrences brutes, **8 occurrences réelles distinctes**

Deux textes réels différents :

1. **« Réponse sous 24 h ouvrées. »** — bloc CTA/footer partagé, **1 seul composant**, apparaissant sur 6 pages : `/bilan-gratuit`, `/candidat-libre-bac-francais`, `/grand-oral`, `/`, `/preparation-bac-francais-tunis`, `/reussir-eaf`.
2. **« Être rappelé(e) sous 24 h »** — CTA de rappel spécifique, apparaissant sur 2 pages : `/bilan-gratuit` (qui porte donc les DEUX textes, ce sont deux éléments distincts sur la même page) et `/contact`.

**Règle enfreinte** : nouvelle catégorie demandée — promesse de délai jamais mesurée ni instrumentée dans le code (aucun SLA, aucune métrique de suivi trouvée associée à ce texte).

### Autres catégories : 0 occurrence

`resultat-garanti`, `essai-gratuit-sans-acces`, `urgence-artificielle`, `nom-enseignant-publie` : aucune correspondance sur les 37 pages atteignables.

## H2 — classement en trois niveaux

| Niveau | Contenu | Compte |
|---|---|---|
| **P0** (promesse de résultat, garantie, taux de réussite, chiffre non sourcé, essai gratuit sans accès) | Aucun | **0** |
| **P1** (confusion siège/centre, délai non instrumenté, rareté non adossée) | Centre Urbain Nord (1 cause racine, 21 pages) + délai non instrumenté (2 textes distincts, 8 occurrences) | **2 causes racines, 29 occurrences de page** |
| **P2** (le reste) | — | **0** |

## H3 — faux positifs : combien, pourquoi

**5 des 34 findings bruts (~15 %) sont des doublons de comptage, pas de nouvelles occurrences** : sur `/candidat-libre-bac-francais`, `/grand-oral`, `/`, `/preparation-bac-francais-tunis`, `/reussir-eaf`, les motifs `/r[ée]ponse\s+(?:sous|en)\s+\d+.../ ` et `/\bsous\s+24\s*h.../` capturent tous deux la **même phrase unique** (« Réponse sous 24 h ouvrées. »), car le second motif, générique, matche aussi comme sous-chaîne à l'intérieur du premier. Ce n'est pas un faux positif au sens « accuse à tort » — le texte signalé est réel — mais c'est un défaut de méthode : la même occurrence est comptée deux fois sous deux libellés de motif différents, gonflant le total de 8 occurrences réelles à 13 brutes.

**Correctif appliqué** (le jour même, sur ce script — aucun contenu marketing modifié) : `scripts/marketing/public-content-audit.mjs` déduplique désormais par plage de caractères chevauchante avant de compter une occurrence. Re-exécuté après correctif : **29 findings** (21 siège/centre + 8 délai), au lieu de 34 — confirmé par une seconde exécution locale contre le même serveur `next dev`. Sans ce correctif, l'auditeur aurait gonflé artificiellement ses propres rapports — exactement le risque « un auditeur qui crie trop finit ignoré » signalé pour `--artifacts`.

En dehors de ce défaut de dédoublonnage, aucun faux positif au sens strict n'a été trouvé dans les 34 findings : chaque texte signalé existe réellement, à l'endroit indiqué.

## H4 — rien corrigé

Aucun contenu n'a été modifié. Les deux causes racines (panneau de contact mobile, formulation de délai) restent des décisions pour le propriétaire — reformulation, confirmation d'un SLA réel, ou acceptation en l'état.
