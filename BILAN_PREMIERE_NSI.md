# BILAN — Entrée en Première (NSI)
## Cahier de conception du questionnaire + rendu (HTML KaTeX & PDF LaTeX)

### 0) Finalité & principes
- **But** : vérifier **uniquement** les **pré-requis SNT (Seconde)** et bases de programmation/algorithmique acquises au collège pour **réussir la NSI de Première**.  
- **Jamais** de notions propres au programme de Première (BD relationnelles, automates, récursivité avancée…), mais cadrage pédagogique **aligné** sur les rubriques de NSI 1re pour motiver les pré-requis (données/encodage, types construits, tables, IHM Web, archi & OS, réseau, algorithmes, Python).  
- **Livrables** : (1) QCM pondéré + mini-exercices, (2) profil domaines + radar, (3) bilan texte, (4) PDF XeLaTeX avec radar PNG.

> Réfs : Vade-mecum SNT/NSI (enjeux, posture, sécurité des usages, 25–50% machine) et **Programme NSI Première** (compétences, rubriques, démarche projet). *(Citations conservées dans le cahier parent.)*

### 1) Domaines évalués (pré-requis)
1. **Python basics** (types de base, listes, dict, boucles, conditions, compréhensions simples)  
2. **Données & encodage** (bit/octet, binaire↔hex, UTF-8, texte)  
3. **Web/HTTP** (GET vs POST, HTTPS/TLS, URL, formulaires simples)  
4. **Internet & réseaux** (rôle IP/TCP, DNS, routage par paquets)  
5. **Tables CSV** (lecture, filtrage, tri simple, “jointure” par clé au sens basique)  
6. **Logique & notions algorithmiques** (¬, ∧, ∨, XOR, De Morgan, complexité asymptotique intuitive)  
7. **IHM Web** (HTML structure, CSS style, gestion d’événements JS simple)  
8. **Hygiène numérique** (2FA, cookies tiers, bonnes pratiques)

### 2) Structure & barème
- **32 QCM + 3 mini-exercices** (pondération 1 / 2 / 3–4).  
- Scores **par domaine** + **global** ; seuils : Faible <50 %, Moyen 50–74 %, Solide ≥75 %.  
- Mini-exercices = mise en œuvre courte (Python, CSV, sécurité Web).

### 3) Données & formats
- `data/qcm_seconde_for_premiere_nsi.json` (fourni).  
- Schéma item :  
  ```json
  { "id":"...", "domain":"...", "type":"mcq|short|numeric", "difficulty":"A|B|C", "weight":1|2|3|4,
    "prompt_latex":"...", "choices":[...], "answer_latex":"...", "explanation_latex":"..." }
`data/pedago_survey_nsi_premiere.json` (pour la première partie du volet 2)
`data/pedago_survey_commun.json` (pour la deuxième partie du volet 2)
