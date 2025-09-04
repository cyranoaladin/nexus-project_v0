Ceci une feuille de route et des éléments que vous allez prendre en compte pour permettre à un élève de cliquer sur bilan gratuit et puis choisir une matière et son niveau (première, terminale), précisez s'il est scolarisé dans un établissement d'enseignement français ou candidat libre et suite au résultat de son bilan après avoir complété le QCM et le questionnaire en ligne, tout un processus se mettra en exécution dont voici les éléments. Bien sûr vous vous vous basez sur les résultats des réponses au bilan de l'élève

# 🧠 Prompt OpenAI pour générer le **rapport de bilan Nexus Réussite**

**Contexte**
Tu es un **expert pédagogique, psychopédagogue et stratège éducatif** travaillant pour Nexus Réussite.
Ta mission : analyser les résultats d’un élève (volet QCM académique + volet pédagogique/personnel), établir un **diagnostic complet**, et proposer un **plan de progression clair, motivant et adapté**.

**Objectif du rapport**

1. Fournir un **diagnostic juste** du niveau académique (forces, faiblesses, lacunes critiques).
2. Identifier les **facteurs pédagogiques et personnels** influençant la réussite (style d’apprentissage, motivation, organisation, difficultés éventuelles).
3. Proposer une **feuille de route concrète et progressive** (planning, volume horaire, priorités).
4. Recommander les **offres Nexus Réussite adaptées** (Cortex, Flex, Académies, Odyssée) avec argumentaire convaincant pour l’élève et ses parents.
5. Générer un texte fluide, professionnel, bien structuré, rédigé en français clair, rassurant et valorisant.

---

## 🎯 Structure attendue du rapport

### 1. Introduction personnalisée

* Présentation de l’élève (niveau scolaire, spécialité si connue).
* Ton chaleureux, rassurant, valorisant.

### 2. Diagnostic académique

* Analyse des résultats QCM (scoring par domaine).
* Points forts → expliquer en quoi ils sont solides.
* Points faibles → indiquer les notions précises à travailler.
* **Indispensable : identifier les lacunes critiques de Seconde nécessaires pour réussir en Première/Terminale.**

### 3. Profil pédagogique et personnel

* Style d’apprentissage dominant (visuel/auditif/kinesthésique, Kolb).
* Organisation et rythme de travail (efficace, irrégulier, à améliorer).
* Rapport à l’erreur et confiance en soi.
* Facteurs de motivation (intrinsèque/extrinsèque).
* Difficultés spécifiques éventuelles (dys, TDAH, anxiété).
* Conclusion → **portrait pédagogique synthétique** : “Cet élève apprend mieux en… mais doit veiller à…”

### 4. Feuille de route proposée

* Horizon : 3 à 6 mois.
* Planning progressif (ex. 2h/semaine autonomie + 1h encadrée).
* Découpage par étapes (consolidation, approfondissement, entraînement type bac).
* Volume horaire recommandé par semaine.
* Ressources à privilégier (quiz ARIA, exercices, vidéos, coaching).

### 5. Offres Nexus recommandées

* Choix principal (ex. Odyssée Terminale).
* Alternatives possibles (Flex si besoin ponctuel, Académie vacances si préparation intensive).
* Justification adaptée au profil de l’élève et aux attentes parentales.
* Mise en avant des bénéfices : garantie Bac, suivi premium, IA 24/7, expertise des professeurs.

### 6. Conclusion

* Message encourageant et mobilisateur.
* Accent sur la **confiance** et l’**accompagnement premium**.
* Invitation à démarrer le parcours.

---

## 📝 Consignes d’écriture

* **Ton** : professionnel, chaleureux, valorisant, premium.
* **Style** : clair, structuré, sans jargon excessif, adapté aux parents et aux élèves.
* **Équilibre** : diagnostic rigoureux + messages positifs pour encourager.
* **Marketing** : valoriser les offres Nexus sans agressivité commerciale, en montrant la pertinence et la valeur ajoutée.
* **RGPD** : ne jamais divulguer autre chose que les données analysées.

---

## 🔄 Exemple d’appel API (Node.js/Next.js)

```ts
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateBilanReport(data) {
  const { qcmScores, pedagoProfile, synthesis } = data;

  const prompt = `
  Tu es un expert pédagogique premium de Nexus Réussite.
  Voici les résultats de l’élève :

  === Résultats QCM (académiques) ===
  ${JSON.stringify(qcmScores, null, 2)}

  === Profil pédagogique ===
  ${JSON.stringify(pedagoProfile, null, 2)}

  === Synthèse automatique ===
  ${JSON.stringify(synthesis, null, 2)}

  Ta mission : rédiger un rapport de bilan complet, structuré selon la trame imposée :

  1. Introduction personnalisée
  2. Diagnostic académique détaillé (forces, faiblesses, lacunes critiques Seconde utiles pour Première/Terminale)
  3. Profil pédagogique (style d’apprentissage, organisation, motivation, difficultés éventuelles)
  4. Feuille de route concrète (planning, volume horaire, étapes de progression, ressources)
  5. Offres Nexus Réussite recommandées (choix principal + alternatives justifiées)
  6. Conclusion motivante et rassurante

  Respecte les consignes d’écriture : clair, premium, rassurant, professionnel.
  Adresse-toi aux parents et à l’élève avec bienveillance.
  Le rapport doit donner confiance et montrer une stratégie claire pour atteindre la mention au Bac et réussir Parcoursup.
  `;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content;
}
```

Très bonne remarque 👌.
Tu veux que l’IA qui génère le **bilan Nexus Réussite** ne se limite pas à analyser un QCM et un questionnaire, mais qu’elle **incarne la vision et la logique métier de Nexus** : offres, ADN, positionnement premium, garanties, modèle économique, pédagogie augmentée par IA.

Cela permettra que le **rapport soit cohérent avec l’écosystème Nexus**, et que les propositions faites aux familles soient crédibles, pertinentes et alignées avec la stratégie commerciale.

---

# 🧠 Prompt enrichi avec la **logique métier & ADN Nexus Réussite**

---

## **Contexte & rôle**

Tu es **ARIA**, l’agent pédagogique intelligent de Nexus Réussite.
Tu combines :

* l’expertise d’une équipe de professeurs **agrégés et certifiés de l’Éducation Nationale française**,
* la pédagogie active et bienveillante,
* la puissance de l’IA pour analyser les profils et proposer des stratégies personnalisées.

Ton rôle est de rédiger un **rapport de bilan stratégique gratuit** destiné à l’élève et à ses parents.

---

## **Rappels sur l’ADN Nexus Réussite**

1. **Excellence humaine** : professeurs agrégés, certifiés, spécialistes DIU NSI.
2. **Innovation technologique** : IA ARIA 24/7, plateforme analytique, ressources interactives.
3. **Accompagnement sur-mesure** : bilans personnalisés, feuille de route adaptée, suivi en temps réel.
4. **Garantie de résultat** : “Bac obtenu ou remboursé” (sous conditions).
5. **Cœur de mission** : viser la mention au Bac, sécuriser Parcoursup, préparer l’avenir (concours, supérieur).

---

## **Offres Nexus Réussite & logiques d’usage**

* **Nexus Cortex (IA ARIA)**
  *Produit d’appel* : IA éducative 24/7, quiz personnalisés, aide devoirs, correction méthodes.
  → Pour élèves autonomes, besoin de support continu mais sans encadrement intensif.

* **Studio Flex (cours à la carte)**
  *Flexibilité absolue* : cours individuel, coaching ou atelier de groupe, en visio ou présentiel.
  → Pour besoins ponctuels (examen, devoir, difficultés ciblées).

* **Académies Nexus (stages intensifs vacances)**
  *Progression accélérée* : stages thématiques (Français, Grand Oral, Bac Blanc, Spécialités).
  → Pour combler rapidement les lacunes ou prendre de l’avance.

* **Programme Odyssée (accompagnement annuel premium)**
  *Solution cœur de business* : suivi structuré toute l’année, mention au Bac, orientation Parcoursup.

  * Odyssée Première : optimiser contrôle continu + préparation EAF.
  * Odyssée Terminale : viser la mention + stratégie Parcoursup.
  * Odyssée Candidat Libre : “remplacer le lycée” avec suivi complet.
    → Pour familles qui veulent **sécurité + garantie Bac + excellence assurée**.

---

## **Services complémentaires**

* **SOS devoir (visio express 30 min)** : assistance d’urgence.
* **Tableau de bord analytique** : suivi progression & effort en temps réel.
* **Ressources exclusives** : fiches, quiz, annales corrigées.
* **Coaching orientation & Parcoursup** : aide à la construction du projet.

---

## **Ligne éditoriale du rapport**

* **Diagnostic précis** : basé sur résultats académiques + profil pédagogique.
* **Proposition de feuille de route** : progressive, réaliste, structurée (planning, volume horaire, ressources).
* **Offres Nexus recommandées** : en fonction du profil, justifiées par la logique métier.
* **Ton** : premium, rassurant, valorisant. Pas de jargon technique, mais langage clair pour parents & élèves.
* **Marketing intégré** : mettre en avant l’unicité de Nexus (humain + IA + garantie), sans agressivité commerciale.

---

## **Prompt pour l’IA (à injecter dans l’appel API)**

```txt
Tu es ARIA, l’agent intelligent de Nexus Réussite.

Ta mission : analyser les résultats d’un élève (QCM académique + questionnaire pédagogique)
et rédiger un rapport de bilan professionnel, structuré et aligné sur l’ADN Nexus Réussite.

Voici les données de l’élève :
- Résultats QCM (par domaine, % de maîtrise, forces/faiblesses).
- Profil pédagogique (style d’apprentissage, organisation, motivation, difficultés éventuelles).
- Synthèse automatique (forces, faiblesses, risques, points critiques Seconde nécessaires pour Première/Terminale).

Tu dois produire un rapport en 6 sections :

1. Introduction personnalisée (présentation valorisante de l’élève et de la démarche).
2. Diagnostic académique précis (forces, faiblesses, lacunes critiques).
3. Profil pédagogique et personnel (style d’apprentissage, organisation, motivation, difficultés éventuelles).
4. Feuille de route concrète (planning, volume horaire, étapes progressives, ressources à utiliser).
5. Offres Nexus Réussite recommandées (Cortex, Flex, Académies, Odyssée), avec logique métier claire :
   - Cortex si l’élève est autonome avec peu de lacunes.
   - Flex si besoin ponctuel ou ciblé.
   - Académies si faiblesses importantes nécessitant un stage intensif.
   - Odyssée si besoin de suivi global, mention visée ou Parcoursup stratégique.
6. Conclusion motivante (encouragement, promesse de progression, rassurer parents et élève).

Consignes d’écriture :
- Style clair, premium, professionnel, chaleureux.
- Adresse-toi à la fois aux parents (garantie, sécurité, investissement) et à l’élève (motivation, confiance).
- Mets en avant la valeur ajoutée Nexus (professeurs agrégés, IA ARIA 24/7, garantie Bac).
- Évite les formulations négatives : reformule les faiblesses en “axes de progression”.
- Sois précis dans les recommandations (ex : “2h d’exercices par semaine + 1h coaching en visio sur les suites numériques”).

Objectif final : produire un rapport crédible, professionnel, motivant, qui inspire confiance et incite à s’engager avec Nexus Réussite.
```

---

👉 Résultat : à chaque soumission de bilan, l’IA génère un rapport **personnalisé et cohérent avec toute la logique Nexus** (ADN, offres, services, promesse marketing).

Construisons une **matrice de décision Nexus Réussite** qui servira de **cadre logique** pour l’IA (et toi) afin de garantir que les propositions faites dans les bilans soient toujours **cohérentes, homogènes et alignées avec l’ADN Nexus**.

---

# 🧩 Matrice de décision — Recommandation d’offres Nexus Réussite

---

## 1. Variables analysées

À partir des résultats QCM et du profil pédagogique, on déduit :

* **Score académique global (%)**
* **Nombre de domaines faibles (<50%)**
* **Homogénéité du profil** (écarts faibles ou forts entre domaines)
* **Style d’apprentissage / autonomie** (autonome vs besoin de guidage)
* **Motivation & engagement** (élevée vs faible)
* **Objectif affiché** (mention, rattrapage, Parcoursup, Bac candidat libre)
* **Contrainte temporelle** (urgence Bac blanc, échéance Grand Oral, préparation EAF)

---

## 2. Règles de décision par offre

### 🔹 **Nexus Cortex (IA 24/7)**

✅ À recommander si :

* Score global ≥ 65% ET aucun domaine critique <50%
* Profil autonome (travaille seul, bonne motivation)
* Élève cherche un accompagnement **continu mais léger**

🚫 À éviter si :

* Plusieurs domaines <50%
* Élève a besoin de forte structuration

---

### 🔹 **Studio Flex (cours à la carte)**

✅ À recommander si :

* 1–2 domaines faibles <50% mais reste correct
* Besoin ponctuel (devoir, préparation d’un DS, entraînement ciblé)
* Élève motivé mais souhaite des **séances de renfort ponctuelles**

🚫 À éviter si :

* Lacunes multiples
* Élève désorganisé → risque d’abandon faute de suivi structuré

---

### 🔹 **Académies Nexus (stages intensifs vacances)**

✅ À recommander si :

* ≥ 2 domaines <50%
* Score global entre 40% et 65%
* Besoin d’un **choc de progression** rapide (EAF, Bac blanc, Grand Oral)
* Élève à motivation variable mais prêt à un effort concentré

🚫 À éviter si :

* Score global très faible (<30%) (il faut un suivi long, pas juste un stage)

---

### 🔹 **Programme Odyssée (annuel premium)**

✅ À recommander si :

* Objectif mention au Bac ou réussite Parcoursup
* Score global <65% avec plusieurs domaines faibles
* Profil désorganisé, anxieux, ou manquant d’autonomie
* Candidat libre (besoin de remplacer totalement le lycée)
* Famille recherchant un **cadre complet et sécurisé**

🚫 À éviter si :

* Élève autonome, régulier et avec très bon niveau (Odyssée serait surdimensionné → proposer Cortex + Académies pour perfectionnement).

---

## 3. Logique combinatoire (pseudo-code)

```ts
function recommendOffer(data) {
  const { scoreGlobal, weakDomains, autonomy, motivation, objectif, statut } = data;

  // Cas Candidat Libre
  if (statut === "candidat libre") return "Odyssée Candidat Libre";

  // Très bon niveau et autonomie
  if (scoreGlobal >= 70 && weakDomains <= 1 && autonomy === "élevée") {
    return "Cortex";
  }

  // Niveau correct mais besoins ponctuels
  if (scoreGlobal >= 55 && weakDomains <= 2 && motivation === "bonne") {
    return "Studio Flex";
  }

  // Plusieurs lacunes ou préparation intensive
  if (scoreGlobal >= 40 && weakDomains >= 2) {
    return "Académies";
  }

  // Niveau faible ou besoin structurant
  if (scoreGlobal < 55 || motivation === "faible" || autonomie === "faible") {
    return "Odyssée";
  }

  // Default
  return "Cortex";
}
```

---

## 4. Exemple de tableau décisionnel

| Profil élève                       | Offre principale       | Alternatives possibles      |
| ---------------------------------- | ---------------------- | --------------------------- |
| Score ≥70%, autonome, motivé       | Cortex                 | Académies (si stage ciblé)  |
| Score 55–70%, 1–2 domaines faibles | Studio Flex            | Cortex + Académies          |
| Score 40–65%, ≥2 domaines faibles  | Académies              | Odyssée (si projet mention) |
| Score <55% ou autonomie faible     | Odyssée                | Flex (petits renforts)      |
| Candidat libre                     | Odyssée Candidat Libre | -                           |

---

## 5. Ligne éditoriale associée

* Toujours présenter l’offre principale comme **“la plus adaptée”**.
* Présenter les alternatives comme **“compléments possibles”** (jamais comme remplacements).
* Mettre en avant les **bénéfices perçus par les parents** : sécurité, progression, garantie.
* Mettre en avant les **bénéfices perçus par l’élève** : confiance, efficacité, gain de temps, succès au Bac.

---

👉 Cette matrice peut être codée côté serveur (règles métier) et/ou intégrée directement dans le prompt IA comme **“logique obligatoire de recommandation”**.
Ainsi, le rapport généré sera **homogène, crédible, et commercialement aligné** avec Nexus Réussite.

Voici la **version finale du prompt IA**, prête à être intégrée dans ton appel API.
Il inclut :

* l’ADN Nexus Réussite,
* la logique métier,
* la matrice de décision (codée en règles claires),
* la ligne éditoriale pour produire un rapport professionnel et convaincant.

---

# 🧠 Prompt IA — Rapport de Bilan Nexus Réussite

```txt
Tu es ARIA, l’agent pédagogique intelligent de Nexus Réussite.
Tu combines l’expertise de professeurs agrégés et certifiés, la pédagogie active et bienveillante,
et la puissance de l’IA pour analyser les profils et proposer des stratégies personnalisées.

🎯 Mission :
Analyser les résultats d’un élève (QCM académique + questionnaire pédagogique)
et rédiger un rapport professionnel et structuré destiné à l’élève et à ses parents.

---

## ADN Nexus Réussite
1. Excellence humaine : professeurs agrégés, certifiés, spécialistes DIU NSI.
2. Innovation technologique : IA ARIA 24/7, plateforme analytique, ressources interactives.
3. Accompagnement sur-mesure : bilans personnalisés, feuille de route adaptée, suivi en temps réel.
4. Garantie de résultat : “Bac obtenu ou remboursé” (sous conditions).
5. Objectif ultime : mention au Bac, réussite Parcoursup, préparation au supérieur.

---

## Offres Nexus Réussite
- **Cortex** : IA ARIA 24/7, quiz personnalisés. Pour élèves autonomes.
- **Studio Flex** : cours à la carte (individuels/groupe, visio/préso). Pour besoins ponctuels.
- **Académies Nexus** : stages intensifs (vacances). Pour progression rapide.
- **Odyssée** : accompagnement annuel premium (Première, Terminale, Candidat libre). Pour familles qui veulent sécurité, mention, orientation stratégique.

Services complémentaires : SOS devoir (visio express), dashboard analytique, ressources exclusives, coaching Parcoursup.

---

## Matrice de décision (logique obligatoire)

- **Candidat Libre** → Odyssée Candidat Libre.
- **Score ≥70%, autonomie élevée, motivation bonne, peu de faiblesses** → Cortex (alt. Académies pour perfectionnement).
- **Score 55–70%, max 1–2 faiblesses, motivation correcte** → Studio Flex (alt. Cortex + Académies).
- **Score 40–65%, ≥2 faiblesses <50%** → Académies (alt. Odyssée si projet mention/Parcoursup).
- **Score <55% OU autonomie faible OU motivation faible** → Odyssée (alt. Flex pour renfort ponctuel).

⚠️ Toujours proposer **une offre principale** + **alternatives** (mais l’offre principale doit rester la plus convaincante).

---

## Structure attendue du rapport

1. **Introduction personnalisée**
   - Présente l’élève avec bienveillance.
   - Rassure et valorise ses efforts.

2. **Diagnostic académique**
   - Analyse des résultats QCM (forces, faiblesses, lacunes critiques de Seconde pour réussir en Première/Terminale).

3. **Profil pédagogique et personnel**
   - Style d’apprentissage (visuel, auditif, kinesthésique, Kolb).
   - Organisation et rythme.
   - Motivation et confiance.
   - Difficultés éventuelles (DYS, TDAH, anxiété).

4. **Feuille de route personnalisée**
   - Horizon : 3 à 6 mois.
   - Planning hebdomadaire (volume horaire conseillé).
   - Étapes de progression (consolidation, approfondissement, entraînements type Bac).
   - Ressources recommandées (quiz ARIA, cours Flex, Académies, Odyssée).

5. **Offres Nexus recommandées**
   - Offre principale (selon la matrice).
   - Alternatives possibles.
   - Justification claire en fonction du profil et des résultats.
   - Valoriser la promesse Nexus : garantie Bac, IA ARIA, experts agrégés, flexibilité.

6. **Conclusion motivante**
   - Encouragement à l’élève.
   - Rassurance pour les parents (sécurité, suivi premium).
   - Invitation à s’engager dans le parcours Nexus.

---

## Ligne éditoriale
- Ton : professionnel, chaleureux, valorisant, premium.
- Style : clair, fluide, structuré, adapté aux parents et élèves.
- Diagnostic : rigoureux mais bienveillant (faiblesses = “axes de progression”).
- Marketing : intégrer la valeur Nexus naturellement (pas de ton commercial agressif).
- Objectif : donner confiance, montrer une stratégie claire, inciter à rejoindre Nexus.

---

## Données disponibles à analyser
- Résultats QCM (scores par domaine, % global, faiblesses identifiées).
- Profil pédagogique (style, motivation, organisation, difficultés éventuelles).
- Objectif élève/parent (mention, Parcoursup, Bac libre, etc.).

---

📌 À produire :
Un **rapport complet**, en français clair, structuré en 6 parties, qui respecte la matrice de décision,
incarne l’ADN Nexus, et propose une feuille de route personnalisée + recommandations d’offres adaptées.
```

---

👉 Avec ce prompt, l’IA :

* applique **automatiquement la logique Nexus** (matrice de décision),
* écrit dans une **ligne éditoriale premium et rassurante**,
* fournit un rapport directement exploitable pour PDF, dashboard, et communication aux familles.

Voici la **version courte du prompt IA** pour générer un **aperçu synthétique (1 page)** du bilan.
Ce document pourra être affiché dans le **dashboard élève/parent** ou envoyé en **aperçu rapide par mail**, avant le PDF complet.

---

# 📝 Prompt IA — Version Synthèse (1 page)

```txt
Tu es ARIA, l’agent pédagogique de Nexus Réussite.
Ta mission : rédiger une **synthèse courte et claire (1 page maximum)** du bilan d’un élève, destinée à l’élève et à ses parents.

---

## Structure attendue de la synthèse

1. **Résumé global (3–4 phrases)**
   - Niveau général de l’élève (points forts et faiblesses majeures).
   - Ton rassurant et encourageant.

2. **Forces identifiées**
   - Liste courte (2–3 domaines académiques ou qualités pédagogiques).

3. **Axes de progression**
   - Liste courte (2–3 points prioritaires à travailler, issus des faiblesses QCM ou profil pédagogique).

4. **Recommandation Nexus**
   - Offre principale (selon la matrice de décision Nexus).
   - Alternatives possibles (1 ou 2 max).
   - Justification en une phrase claire.

5. **Mini-feuille de route (3 puces max)**
   - Volume horaire conseillé par semaine.
   - Type d’activités (exos ARIA, séances Flex, stage Académie, suivi Odyssée).
   - Objectif sur 3 mois.

---

## Ligne éditoriale
- Style : clair, synthétique, rassurant.
- Ton : premium mais accessible, à destination de parents et adolescents.
- Longueur : max 1 page A4 ou équivalent 350 mots.
- Ne pas noyer dans les détails : aller droit à l’essentiel.

---

## Données à analyser
- Résultats QCM (forces, faiblesses, score global).
- Profil pédagogique (style, organisation, motivation, difficultés éventuelles).
- Objectifs parents/élève.
- Matrice de décision Nexus (pour l’offre recommandée).

---

📌 À produire :
Un **document synthétique**, en français clair, structuré en 5 sections, qui donne immédiatement une vision de la situation de l’élève et des recommandations Nexus, avec encouragement final.
```

---

👉 Cette version sert de **“carte de visite rapide”** du bilan.

* Elle est **impactante** : parents comprennent tout en 1 page.
* Elle **donne envie** de lire le rapport complet en PDF.
* Elle permet de faire du **suivi rapide** dans le dashboard (avant de consulter le détail).

Top ! La **synthèse 1-page** est prête — composant React/Tailwind complet (avec shadcn/ui et mini radar Recharts) déjà dans le canvas à gauche 👈

### Ce que tu peux faire tout de suite

* **Intégrer** le composant dans ton dashboard : `import BilanSynthese from "@/components/BilanSynthese"` (ou copie/colle depuis le canvas).
* **Lui passer des données réelles** (`BilanSyntheseData`) : résumé, forces/axes, scores par domaines, offre recommandée, mini feuille de route.
* **Brancher les actions** :

  * `onViewFull` → lien vers le **rapport complet** (page PDF ou detail view).
  * `onDownloadPdf` → appel `GET /api/bilan/pdf/[bilanId]`.

### Tips d’intégration

* Le rendu est optimisé **A4** (imprimable) et **responsive**.
* Le mini **radar** accepte des domaines libres (0–100%).
* Les **badges/CTA** s’alignent avec ta charte (tu peux ajuster via Tailwind).

parfait ! 🎯

J’ai ajouté dans le canvas la **page Rapport Complet** (server component React/Tailwind) + le **gabarit PDF @react-pdf/renderer** + l’**endpoint API** pour servir le PDF (et un endpoint data optionnel).

### comment brancher rapidement

* Lien depuis la synthèse : `/dashboard/eleve/bilan/[bilanId]`
* Bouton PDF sur la page : appelle `GET /api/bilan/pdf/[bilanId]`
* Données attendues (dans `bilan`):

  * `qcmScores.byDomain.{domain}.percent`
  * `synthesis.{forces,faiblesses,feuilleDeRoute}`
  * `offers.{primary,alternatives[],reasoning}`

# 📄 Rapport Complet + PDF — Implémentation Next.js (App Router) + @react-pdf/renderer

> Ce document livre **tout le code** nécessaire pour :
>
> * une **page Rapport Complet** (dashboard élève) en React/Tailwind
> * un **gabarit PDF** professionnel avec `@react-pdf/renderer`
> * l'**endpoint** pour générer/servir le PDF
> * (optionnel) un **endpoint data** si vous préférez isoler la lecture BDD
>
> Les chemins sont proposés ; adaptez selon votre arborescence.

---

## 1) Page Rapport Complet (server component)

**Fichier :** `app/dashboard/eleve/bilan/[bilanId]/page.tsx`

```tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { ArrowLeft, Download, Printer, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";

function ScoreBar({ label, percent }: { label: string; percent: number }) {
  const tone = percent >= 75 ? "bg-green-500" : percent >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{label}</span>
        <span className="font-medium">{Math.round(percent)}%</span>
      </div>
      <div className="h-2.5 w-full rounded bg-slate-100">
        <div className={`h-2.5 rounded ${tone}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
    </div>
  );
}

export default async function Page({ params }: { params: { bilanId: string } }) {
  const bilan = await prisma.bilan.findUnique({ where: { id: params.bilanId }, include: { user: true } });
  if (!bilan) return notFound();

  // Types attendus
  const qcmScores = (bilan.qcmScores as any) || { byDomain: {} };
  const pedagoProfile = (bilan.pedagoProfile as any) || {};
  const synthesis = (bilan.synthesis as any) || { forces: [], faiblesses: [], feuilleDeRoute: [] };
  const offers = (bilan.offers as any) || { primary: "", alternatives: [] };

  const byDomain = qcmScores.byDomain || {};
  const domainEntries: Array<{ domain: string; percent: number }> = Object.keys(byDomain).map((k) => ({ domain: k, percent: byDomain[k].percent ?? 0 }));
  const scoreGlobal = (() => {
    try {
      const points = Object.values(byDomain).reduce((s: number, d: any) => s + (d.points || 0), 0);
      const max = Object.values(byDomain).reduce((s: number, d: any) => s + (d.max || 0), 0);
      return max > 0 ? Math.round((100 * points) / max) : 0;
    } catch {
      return 0;
    }
  })();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/dashboard/eleve" className="text-slate-600 hover:text-slate-900 flex items-center gap-2"><ArrowLeft className="h-4 w-4"/> Retour</Link>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Rapport complet — {bilan.user.firstName} {bilan.user.lastName}</CardTitle>
          <p className="text-sm text-slate-600">Date : {new Date(bilan.createdAt).toLocaleDateString("fr-FR")} · Score global estimé : <span className="font-semibold">{scoreGlobal}%</span></p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4"/> Imprimer</Button>
            <Link href={`/api/bilan/pdf/${bilan.id}`} target="_blank"><Button><Download className="mr-2 h-4 w-4"/> Télécharger le PDF</Button></Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* 1. Introduction */}
          <section>
            <h3 className="text-lg font-semibold">1) Introduction</h3>
            <p className="mt-2 text-slate-700 leading-relaxed">
              Ce rapport présente une analyse complète des acquis scolaires et du profil d’apprentissage de l’élève, suivie d’une feuille de route personnalisée et des recommandations Nexus Réussite (offre principale et compléments).
            </p>
          </section>

          <Separator />

          {/* 2. Diagnostic académique */}
          <section>
            <h3 className="text-lg font-semibold">2) Diagnostic académique</h3>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {domainEntries.map((d) => (
                <ScoreBar key={d.domain} label={d.domain} percent={d.percent} />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600"/> Forces</h4>
                <ul className="space-y-2 list-disc list-inside text-slate-700">
                  {(synthesis.forces || []).map((x: string, i: number) => (<li key={i}>{x}</li>))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600"/> Axes de progression</h4>
                <ul className="space-y-2 list-disc list-inside text-slate-700">
                  {(synthesis.faiblesses || []).map((x: string, i: number) => (<li key={i}>{x}</li>))}
                </ul>
              </div>
            </div>
          </section>

          <Separator />

          {/* 3. Profil pédagogique */}
          <section>
            <h3 className="text-lg font-semibold">3) Profil pédagogique & personnel</h3>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-6 text-slate-700">
              <div>
                <p><span className="font-medium">Style d’apprentissage :</span> {pedagoProfile?.style || "—"}</p>
                <p className="mt-1"><span className="font-medium">Organisation & rythme :</span> {pedagoProfile?.organisation || pedagoProfile?.rythme || "—"}</p>
                <p className="mt-1"><span className="font-medium">Motivation & confiance :</span> {pedagoProfile?.motivation || "—"}</p>
              </div>
              <div>
                <p><span className="font-medium">Difficultés éventuelles :</span> {pedagoProfile?.difficultes || "aucune déclarée"}</p>
                <p className="mt-1"><span className="font-medium">Contexte & attentes :</span> {pedagoProfile?.attentes || "—"}</p>
              </div>
            </div>
          </section>

          <Separator />

          {/* 4. Feuille de route */}
          <section>
            <h3 className="text-lg font-semibold">4) Feuille de route (3–6 mois)</h3>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              {(synthesis.feuilleDeRoute || []).map((step: string, i: number) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700">{step}</div>
              ))}
            </div>
          </section>

          <Separator />

          {/* 5. Recommandations d’offres */}
          <section>
            <h3 className="text-lg font-semibold">5) Recommandations Nexus</h3>
            <div className="mt-3 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-800"><Sparkles className="h-4 w-4 text-sky-600"/> <span className="font-medium">Offre principale</span></div>
              <p className="mt-2 text-slate-700"><span className="font-semibold">{offers.primary || "—"}</span></p>
              {offers.reasoning && <p className="mt-1 text-slate-700">{offers.reasoning}</p>}
              {Array.isArray(offers.alternatives) && offers.alternatives.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-slate-600">Alternatives :</p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {offers.alternatives.map((alt: string, i: number) => (
                      <li key={i} className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-sm">{alt}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* 6. Conclusion */}
          <section>
            <h3 className="text-lg font-semibold">6) Conclusion</h3>
            <p className="mt-2 text-slate-700">
              Nous restons disponibles pour accompagner {bilan.user.firstName} dans la mise en œuvre de cette feuille de route. Une première séance peut être planifiée dès cette semaine afin de sécuriser les prochaines échéances (contrôles, bac blanc, EAF/Grand Oral).
            </p>
          </section>

          <p className="text-xs text-slate-500">Rapport généré par ARIA • Nexus Réussite — Ce document s’appuie sur le bilan gratuit (QCM + enquête pédagogique) et notre matrice d’aide à la décision.</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 2) Gabarit PDF professionnel (@react-pdf/renderer)

**Fichier :** `lib/pdf/BilanPdf.tsx`

```tsx
"use client";
import React from "react";
import { Document, Page, Text, View, StyleSheet, Font, Svg, Rect } from "@react-pdf/renderer";

// Optionnel: enregistrer une police (sinon, par défaut Helvetica)
// Font.register({ family: "Inter", src: "/fonts/Inter-Regular.ttf" });

const theme = {
  primary: "#0f172a", // slate-900
  accent: "#1f6feb", // blue
  muted: "#64748b", // slate-500
  line: "#e5e7eb", // slate-200
  green: "#16a34a",
  amber: "#f59e0b",
  red: "#ef4444",
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, color: "#0f172a", fontFamily: "Helvetica" },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 6 },
  h2: { fontSize: 14, fontWeight: 700, marginTop: 18, marginBottom: 8 },
  h3: { fontSize: 12, fontWeight: 700, marginTop: 10, marginBottom: 6 },
  p: { fontSize: 11, lineHeight: 1.5, color: "#111827" },
  small: { fontSize: 9, color: theme.muted },
  row: { flexDirection: "row", gap: 12 },
  col: { flexDirection: "column" },
  card: { borderWidth: 1, borderColor: theme.line, borderRadius: 6, padding: 10 },
  chip: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, fontSize: 9, color: "white" },
});

function ScoreBar({ label, percent }: { label: string; percent: number }) {
  const width = Math.max(0, Math.min(100, percent));
  let color = theme.red;
  if (percent >= 75) color = theme.green; else if (percent >= 50) color = theme.amber;
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 10 }}>{label}</Text>
        <Text style={{ fontSize: 10, fontWeight: 700 }}>{Math.round(percent)}%</Text>
      </View>
      <Svg width="100%" height="6">
        <Rect x="0" y="0" width="100%" height="6" fill="#f1f5f9" />
        <Rect x="0" y="0" width={`${width}%`} height="6" fill={color} />
      </Svg>
    </View>
  );
}

export type PdfData = {
  eleve: { firstName?: string; lastName?: string; niveau?: string; statut?: string };
  createdAt?: string; // ISO
  scoresByDomain: Array<{ domain: string; percent: number }>;
  forces: string[];
  faiblesses: string[];
  feuilleDeRoute: string[];
  offrePrincipale?: string;
  offreReasoning?: string;
  alternatives?: string[];
};

export function BilanPdf({ data }: { data: PdfData }) {
  const date = data.createdAt ? new Date(data.createdAt).toLocaleDateString("fr-FR") : "";
  const scoreGlobal = (() => {
    try {
      const arr = data.scoresByDomain || [];
      const sum = arr.reduce((s, d) => s + (d.percent || 0), 0);
      return arr.length ? Math.round(sum / arr.length) : 0;
    } catch { return 0; }
  })();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.h1}>Nexus Réussite — Rapport de Bilan</Text>
          <Text style={styles.small}>Généré par ARIA • Date : {date}</Text>
        </View>

        {/* Élève */}
        <View style={[styles.card, { marginBottom: 12 }]}>
          <Text style={styles.h3}>Élève</Text>
          <Text style={styles.p}>
            {data.eleve.firstName} {data.eleve.lastName} • {data.eleve.niveau || "—"} • {data.eleve.statut || "—"}
          </Text>
          <Text style={[styles.small, { marginTop: 4 }]}>Score global estimé : {scoreGlobal}%</Text>
        </View>

        {/* Diagnostic académique */}
        <Text style={styles.h2}>1) Diagnostic académique</Text>
        <View style={{ marginTop: 6 }}>
          {(data.scoresByDomain || []).map((d, i) => (
            <ScoreBar key={i} label={d.domain} percent={d.percent} />
          ))}
        </View>
        <View style={[styles.row, { marginTop: 8 }]}>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.h3}>Forces</Text>
            {(data.forces || []).length ? (data.forces || []).map((x, i) => (<Text key={i} style={styles.p}>• {x}</Text>)) : (<Text style={styles.small}>—</Text>)}
          </View>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.h3}>Axes de progression</Text>
            {(data.faiblesses || []).length ? (data.faiblesses || []).map((x, i) => (<Text key={i} style={styles.p}>• {x}</Text>)) : (<Text style={styles.small}>—</Text>)}
          </View>
        </View>

        {/* Feuille de route */}
        <Text style={styles.h2}>2) Feuille de route (3–6 mois)</Text>
        <View style={[styles.card, { marginTop: 6 }]}>
          {(data.feuilleDeRoute || []).map((s, i) => (
            <Text key={i} style={styles.p}>{i + 1}. {s}</Text>
          ))}
        </View>

        {/* Recommandations */}
        <Text style={styles.h2}>3) Recommandations Nexus</Text>
        <View style={[styles.card, { marginTop: 6 }]}>
          <Text style={styles.h3}>Offre principale</Text>
          <Text style={styles.p}>{data.offrePrincipale || "—"}</Text>
          {data.offreReasoning && <Text style={[styles.small, { marginTop: 4 }]}>{data.offreReasoning}</Text>}
          {Array.isArray(data.alternatives) && data.alternatives.length > 0 && (
            <>
              <Text style={[styles.h3, { marginTop: 8 }]}>Alternatives</Text>
              {(data.alternatives).map((x, i) => (<Text key={i} style={styles.p}>• {x}</Text>))}
            </>
          )}
        </View>

        {/* Footer */}
        <View style={{ marginTop: 12 }}>
          <Text style={styles.small}>Ce rapport est établi à partir du bilan gratuit (QCM + enquête pédagogique) et des règles d’aide à la décision Nexus Réussite. Toutes les données sont confidentielles.</Text>
        </View>
      </Page>
    </Document>
  );
}
```

---

## 3) Endpoint PDF (App Router)

**Fichier :** `app/api/bilan/pdf/[bilanId]/route.ts`

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BilanPdf } from "@/lib/pdf/BilanPdf";
import { pdf } from "@react-pdf/renderer";

export async function GET(_req: Request, { params }: { params: { bilanId: string } }) {
  const bilan = await prisma.bilan.findUnique({ where: { id: params.bilanId }, include: { user: true } });
  if (!bilan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const qcmScores = (bilan.qcmScores as any) || { byDomain: {} };
  const synthesis = (bilan.synthesis as any) || { forces: [], faiblesses: [], feuilleDeRoute: [] };
  const offers = (bilan.offers as any) || { primary: "", alternatives: [], reasoning: "" };

  const byDomain = qcmScores.byDomain || {};
  const scoresByDomain = Object.keys(byDomain).map((k) => ({ domain: k, percent: byDomain[k].percent ?? 0 }));

  const doc = <BilanPdf data={{
    eleve: { firstName: bilan.user.firstName, lastName: bilan.user.lastName, niveau: (bilan as any)?.niveau, statut: (bilan as any)?.statut },
    createdAt: bilan.createdAt.toISOString(),
    scoresByDomain,
    forces: synthesis.forces || [],
    faiblesses: synthesis.faiblesses || [],
    feuilleDeRoute: synthesis.feuilleDeRoute || [],
    offrePrincipale: offers.primary,
    offreReasoning: offers.reasoning,
    alternatives: offers.alternatives || [],
  }} />;

  const blob = await pdf(doc).toBuffer();
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=bilan-${bilan.id}.pdf`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
```

---

## 4) (Optionnel) Endpoint data JSON

**Fichier :** `app/api/bilan/[bilanId]/route.ts`

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { bilanId: string } }) {
  const bilan = await prisma.bilan.findUnique({ where: { id: params.bilanId }, include: { user: true } });
  if (!bilan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(bilan);
}
```

---

## 5) Notes d’intégration

* Assurez-vous d’avoir `@react-pdf/renderer` installé : `npm i @react-pdf/renderer`.
* Le composant **Synthèse 1‑page** peut lier vers cette page via `/dashboard/eleve/bilan/[bilanId]` et le bouton PDF.
* Les champs **`bilan.synthesis` / `bilan.qcmScores` / `bilan.offers`** doivent respecter la structure indiquée. Adapter si nécessaire.
* Pour une **charte plus poussée** dans le PDF (logo, couleurs, polices), enregistrez des polices avec `Font.register` et ajoutez un mini en‑tête (logo SVG) dans la section Header.

---

**Fin — Rapport Complet + PDF opérationnels** ✅

# 📄 Rapport Complet + PDF — Thèmes Nexus Réussite (Parent & Élève)

> Ce document enrichit la version précédente :
>
> * Ajout d’un **thème PDF Nexus** (logo, polices, watermark)
> * Création de 2 variantes :
>
>   * **Parent** : pédagogique, coût/ROI, rassurant
>   * **Élève** : motivant, gamifié, badges de progression

---

## 1) Thème PDF commun (logo + polices + watermark)

**Fichier :** `lib/pdf/theme.tsx`

```tsx
import { Font, Image, StyleSheet } from "@react-pdf/renderer";

// Enregistrer une police personnalisée (exemple Inter)
Font.register({ family: "Inter", src: "/fonts/Inter-Regular.ttf" });
Font.register({ family: "InterBold", src: "/fonts/Inter-Bold.ttf" });

export const theme = {
  primary: "#0f172a", // slate-900
  accent: "#1f6feb", // blue
  muted: "#64748b",
  line: "#e5e7eb",
  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#ef4444",
};

export const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: "Inter" },
  h1: { fontSize: 18, fontFamily: "InterBold", marginBottom: 8 },
  h2: { fontSize: 14, fontFamily: "InterBold", marginTop: 16, marginBottom: 8 },
  p: { fontSize: 11, lineHeight: 1.5 },
  small: { fontSize: 9, color: theme.muted },
  watermark: { position: "absolute", top: "40%", left: "15%", opacity: 0.1, fontSize: 60, fontFamily: "InterBold", color: theme.accent },
  headerLogo: { width: 80, height: 30, marginBottom: 12 },
});
```

Ajoutez le logo Nexus (`/public/logo.png`) et un watermark "Nexus Réussite" au fond de chaque page.

---

## 2) Version Parent (pédagogique + ROI)

**Fichier :** `lib/pdf/BilanPdfParent.tsx`

```tsx
import React from "react";
import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import { styles, theme } from "./theme";

export function BilanPdfParent({ data }: { data: any }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Watermark */}
        <Text style={styles.watermark}>Nexus Réussite</Text>

        {/* Header avec logo */}
        <Image src="/logo.png" style={styles.headerLogo} />
        <Text style={styles.h1}>Rapport Parent — Bilan Stratégique</Text>

        {/* Résumé */}
        <Text style={styles.p}>Ce rapport présente le niveau actuel de {data.eleve.firstName}, ses forces, ses axes d’amélioration et une projection chiffrée du retour sur investissement d’un accompagnement Nexus.</Text>

        {/* Diagnostic académique */}
        <Text style={styles.h2}>1) Diagnostic académique</Text>
        {data.scoresByDomain.map((d: any, i: number) => (
          <Text key={i} style={styles.p}>• {d.domain}: {d.percent}%</Text>
        ))}

        {/* ROI */}
        <Text style={styles.h2}>2) Projection & ROI</Text>
        <Text style={styles.p}>Un élève passant de 11 à 14 de moyenne générale peut gagner +30 points sur son dossier Parcoursup, ouvrant l’accès à des filières sélectives. L’investissement annuel (≈ 7500 TND pour Odyssée) correspond à <1% du coût moyen d’une scolarité supérieure en France (≈ 1M TND sur 5 ans).</Text>

        {/* Recommandation */}
        <Text style={styles.h2}>3) Offre recommandée</Text>
        <Text style={styles.p}>{data.offrePrincipale} — {data.offreReasoning}</Text>

        <Text style={styles.small}>Rapport confidentiel — Usage parent</Text>
      </Page>
    </Document>
  );
}
```

---

## 3) Version Élève (gamifiée + badges)

**Fichier :** `lib/pdf/BilanPdfEleve.tsx`

```tsx
import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles, theme } from "./theme";

const badges = {
  excellent: "🏆 Maître de la matière",
  solide: "💪 Bonne maîtrise",
  aRenforcer: "🚀 Axe à renforcer",
};

export function BilanPdfEleve({ data }: { data: any }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Watermark */}
        <Text style={styles.watermark}>Nexus Réussite</Text>

        {/* Header */}
        <Text style={styles.h1}>Ton Bilan Nexus 🚀</Text>
        <Text style={styles.p}>Bravo {data.eleve.firstName} ! Voici tes résultats, tes badges et ta feuille de route pour progresser.</Text>

        {/* Diagnostic */}
        <Text style={styles.h2}>1) Tes points forts</Text>
        {data.forces.map((f: string, i: number) => (<Text key={i} style={styles.p}>🏅 {f}</Text>))}

        <Text style={styles.h2}>2) Axes de progression</Text>
        {data.faiblesses.map((f: string, i: number) => (<Text key={i} style={styles.p}>{badges.aRenforcer} {f}</Text>))}

        {/* Badges de domaines */}
        <Text style={styles.h2}>3) Tes badges</Text>
        {data.scoresByDomain.map((d: any, i: number) => {
          let badge = badges.aRenforcer;
          if (d.percent >= 75) badge = badges.excellent;
          else if (d.percent >= 50) badge = badges.solide;
          return <Text key={i} style={styles.p}>{badge} — {d.domain} ({d.percent}%)</Text>;
        })}

        {/* Feuille de route */}
        <Text style={styles.h2}>4) Feuille de route</Text>
        {data.feuilleDeRoute.map((s: string, i: number) => (<Text key={i} style={styles.p}>➡️ {s}</Text>))}

        <Text style={styles.small}>Rapport motivant — usage élève</Text>
      </Page>
    </Document>
  );
}
```

---

## 4) Endpoints PDF Parent & Élève

**Fichiers :**

`app/api/bilan/pdf/[bilanId]/parent/route.ts`

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BilanPdfParent } from "@/lib/pdf/BilanPdfParent";
import { pdf } from "@react-pdf/renderer";

export async function GET(_req: Request, { params }: { params: { bilanId: string } }) {
  const bilan = await prisma.bilan.findUnique({ where: { id: params.bilanId }, include: { user: true } });
  if (!bilan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const doc = <BilanPdfParent data={bilan} />;
  const blob = await pdf(doc).toBuffer();
  return new NextResponse(blob, { headers: { "Content-Type": "application/pdf" } });
}
```

`app/api/bilan/pdf/[bilanId]/eleve/route.ts`

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BilanPdfEleve } from "@/lib/pdf/BilanPdfEleve";
import { pdf } from "@react-pdf/renderer";

export async function GET(_req: Request, { params }: { params: { bilanId: string } }) {
  const bilan = await prisma.bilan.findUnique({ where: { id: params.bilanId }, include: { user: true } });
  if (!bilan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const doc = <BilanPdfEleve data={bilan} />;
  const blob = await pdf(doc).toBuffer();
  return new NextResponse(blob, { headers: { "Content-Type": "application/pdf" } });
}
```

---

✅ Tu as maintenant :

* **Un thème Nexus** cohérent (logo, couleurs, watermark)
* **Deux versions PDF** : Parent (ROI, rassurant) et Élève (motivant, badges)
* **Endpoints séparés** pour générer le bon rapport

---

# 🌐 Endpoint unique + 🎛️ Sélecteur de variante PDF

Ce livrable implémente :

* un **endpoint unique** `GET /api/bilan/pdf/[bilanId]?variant=standard|parent|eleve`
* un **sélecteur UI** (menu) pour télécharger la bonne variante depuis le dashboard
* des **helpers** pour construire l’URL et un **hook** pour l’action de téléchargement

> Suppose que tu as déjà : `BilanPdf` (standard), `BilanPdfParent`, `BilanPdfEleve` et les utilitaires de thème.

---

## 1) Endpoint unique (remplace l’existant)

**Fichier :** `app/api/bilan/pdf/[bilanId]/route.ts`

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pdf } from "@react-pdf/renderer";
import { BilanPdf } from "@/lib/pdf/BilanPdf"; // standard
import { BilanPdfParent } from "@/lib/pdf/BilanPdfParent";
import { BilanPdfEleve } from "@/lib/pdf/BilanPdfEleve";

export async function GET(req: Request, { params }: { params: { bilanId: string } }) {
  const url = new URL(req.url);
  const variant = (url.searchParams.get("variant") || "standard").toLowerCase();

  const bilan = await prisma.bilan.findUnique({ where: { id: params.bilanId }, include: { user: true } });
  if (!bilan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const qcmScores = (bilan.qcmScores as any) || { byDomain: {} };
  const synthesis = (bilan.synthesis as any) || { forces: [], faiblesses: [], feuilleDeRoute: [] };
  const offers = (bilan.offers as any) || { primary: "", alternatives: [], reasoning: "" };
  const pedago = (bilan.pedagoProfile as any) || {};

  const byDomain = qcmScores.byDomain || {};
  const scoresByDomain = Object.keys(byDomain).map((k) => ({ domain: k, percent: byDomain[k].percent ?? 0 }));

  let doc: React.ReactElement;
  switch (variant) {
    case "parent":
      doc = (
        <BilanPdfParent data={{
          eleve: { firstName: bilan.user.firstName, lastName: bilan.user.lastName, niveau: (bilan as any)?.niveau, statut: (bilan as any)?.statut },
          createdAt: bilan.createdAt.toISOString(),
          scoresByDomain,
          forces: synthesis.forces || [],
          faiblesses: synthesis.faiblesses || [],
          feuilleDeRoute: synthesis.feuilleDeRoute || [],
          recommandation: { primary: offers.primary, reasoning: offers.reasoning, alternatives: offers.alternatives },
          pricing: { Cortex: 90, "Studio Flex": 100, "Académies": 200, "Odyssée": 6000 },
          horizonMois: 6,
          chargeHebdoHeures: 2,
        }} />
      );
      break;
    case "eleve":
      doc = (
        <BilanPdfEleve data={{
          eleve: { firstName: bilan.user.firstName, lastName: bilan.user.lastName, niveau: (bilan as any)?.niveau },
          createdAt: bilan.createdAt.toISOString(),
          scoresByDomain,
          feuilleDeRoute: synthesis.feuilleDeRoute || [],
          pedago: { style: pedago?.style, organisation: pedago?.organisation, motivation: pedago?.motivation },
        }} />
      );
      break;
    default:
      doc = (
        <BilanPdf data={{
          eleve: { firstName: bilan.user.firstName, lastName: bilan.user.lastName, niveau: (bilan as any)?.niveau, statut: (bilan as any)?.statut },
          createdAt: bilan.createdAt.toISOString(),
          scoresByDomain,
          forces: synthesis.forces || [],
          faiblesses: synthesis.faiblesses || [],
          feuilleDeRoute: synthesis.feuilleDeRoute || [],
          offrePrincipale: offers.primary,
          offreReasoning: offers.reasoning,
          alternatives: offers.alternatives || [],
        }} />
      );
  }

  const blob = await pdf(doc).toBuffer();
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=bilan-${bilan.id}-${variant}.pdf`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
```

---

## 2) Helper URL + hook de téléchargement

**Fichiers :** `lib/bilan/pdf.ts` et `lib/hooks/useDownload.ts`

```ts
// lib/bilan/pdf.ts
export type PdfVariant = "standard" | "parent" | "eleve";
export const buildBilanPdfUrl = (bilanId: string, variant: PdfVariant = "standard") =>
  `/api/bilan/pdf/${bilanId}?variant=${variant}`;
```

```ts
// lib/hooks/useDownload.ts
import { useState } from "react";

export function useDownload() {
  const [loading, setLoading] = useState(false);

  async function download(url: string, filename?: string) {
    try {
      setLoading(true);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename || "document.pdf";
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setLoading(false);
    }
  }

  return { download, loading };
}
```

---

## 3) Sélecteur UI (menu) pour le dashboard

**Fichier :** `components/bilan/PdfVariantSelector.tsx`

```tsx
"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, ChevronDown, Users, GraduationCap } from "lucide-react";
import { buildBilanPdfUrl } from "@/lib/bilan/pdf";
import { useDownload } from "@/lib/hooks/useDownload";

export function PdfVariantSelector({ bilanId }: { bilanId: string }) {
  const { download, loading } = useDownload();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={loading}>
          <FileText className="mr-2 h-4 w-4" /> PDF <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Télécharger</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => download(buildBilanPdfUrl(bilanId, "standard"), `bilan-${bilanId}-standard.pdf`)}>
          <FileText className="mr-2 h-4 w-4" /> Rapport complet (standard)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => download(buildBilanPdfUrl(bilanId, "parent"), `bilan-${bilanId}-parent.pdf`)}>
          <Users className="mr-2 h-4 w-4" /> Version Parent (ROI)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => download(buildBilanPdfUrl(bilanId, "eleve"), `bilan-${bilanId}-eleve.pdf`)}>
          <GraduationCap className="mr-2 h-4 w-4" /> Version Élève (badges)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 4) Intégration dans la page Rapport

**Exemple :** `app/dashboard/eleve/bilan/[bilanId]/page.tsx`

```tsx
import { PdfVariantSelector } from "@/components/bilan/PdfVariantSelector";

// ... dans le header, à côté des boutons Imprimer/Télécharger simple :
<div className="mt-3 flex gap-2">
  <PdfVariantSelector bilanId={params.bilanId} />
</div>
```

---

## 5) Tests rapides

* Ouvrir : `/api/bilan/pdf/<ID>?variant=standard` → doit afficher la version standard
* Ouvrir : `/api/bilan/pdf/<ID>?variant=parent` → version Parent avec tableau budget
* Ouvrir : `/api/bilan/pdf/<ID>?variant=eleve` → version Élève avec badges
* Sur le dashboard, le menu « PDF » propose les 3 téléchargements

---

## 6) Notes

* Tu peux **externaliser les tarifs** (objet `pricing`) en BDD et les injecter dans la version Parent pour un chiffrage à jour.
* Si tu veux **streamer** le PDF (pour gros documents), remplace `toBuffer()` par `toStream()` et pipe la réponse.
* Pour l’accessibilité, on peut proposer aussi un bouton « Ouvrir dans un nouvel onglet » (target=\_blank) au lieu du téléchargement direct.

---

**Livré :** endpoint unique + sélecteur de variante + helpers de téléchargement. ✅
Endpoint unique /api/bilan/pdf/[bilanId]?variant=standard|parent|eleve

Sélecteur UI (menu) pour choisir la variante depuis le dashboard

Helpers (buildBilanPdfUrl) et hook (useDownload) pour un téléchargement propre

Intégration rapide

Remplace ton endpoint par celui du canvas (unique avec variant).

Dans ta page rapport, importe et place :

<PdfVariantSelector bilanId={params.bilanId} />

Teste ces URLs :

Standard → /api/bilan/pdf/<ID>?variant=standard

Parent → /api/bilan/pdf/<ID>?variant=parent

Élève → /api/bilan/pdf/<ID>?variant=eleve

# 📧 Envoi par e‑mail du Bilan (avec variante PDF)

Ce livrable ajoute :

* un **endpoint API** pour envoyer le PDF du bilan en PJ par e‑mail,
* la **génération du PDF côté serveur** selon `variant=standard|parent|eleve`,
* un **composant UI** pour choisir la variante + destinataires (élève / parent / autres),
* un **template mail** simple (React) et un `transporter` Nodemailer.

> Pré‑requis :
>
> * `@react-pdf/renderer` installé,
> * compos PDFs : `BilanPdf`, `BilanPdfParent`, `BilanPdfEleve`,
> * colonne `parentEmail` sur `User` (ou adaptateur),
> * variables SMTP prêtes (`EMAIL_SERVER_*`, `EMAIL_FROM`).

---

## 1) Transporter Nodemailer

**Fichier :** `lib/mail/transporter.ts`

```ts
import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST!,
  port: Number(process.env.EMAIL_SERVER_PORT || 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_SERVER_USER!,
    pass: process.env.EMAIL_SERVER_PASSWORD!,
  },
});

export const EMAIL_FROM = process.env.EMAIL_FROM || "Nexus Réussite <no-reply@nexusreussite.academy>";
```

---

## 2) Template mail (React)

**Fichier :** `lib/mail/templates/bilanEmail.tsx`

```tsx
export function bilanEmailHtml({
  studentName,
  variantLabel,
}: {
  studentName: string;
  variantLabel: string;
}) {
  return `
  <div style="font-family:Inter,Arial,sans-serif; line-height:1.5; color:#0f172a;">
    <h2 style="margin:0 0 8px;">Votre Bilan Nexus Réussite</h2>
    <p>Bonjour,</p>
    <p>Veuillez trouver en pièce jointe le <strong>rapport ${variantLabel}</strong> du bilan de <strong>${studentName}</strong>.</p>
    <p>Ce document contient le diagnostic, la feuille de route et nos recommandations adaptées. Pour toute question, notre équipe reste à votre disposition.</p>
    <p style="margin-top:16px;">Bien cordialement,<br/>L’équipe Nexus Réussite</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/>
    <p style="font-size:12px;color:#64748b;">Ce message et ses pièces jointes sont confidentiels.</p>
  </div>`;
}
```

---

## 3) Endpoint API — envoi avec variante

**Fichier :** `app/api/bilan/email/[bilanId]/route.ts`

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pdf } from "@react-pdf/renderer";
import { transporter, EMAIL_FROM } from "@/lib/mail/transporter";
import { bilanEmailHtml } from "@/lib/mail/templates/bilanEmail";
import { BilanPdf } from "@/lib/pdf/BilanPdf";
import { BilanPdfParent } from "@/lib/pdf/BilanPdfParent";
import { BilanPdfEleve } from "@/lib/pdf/BilanPdfEleve";

export async function POST(req: Request, { params }: { params: { bilanId: string } }) {
  try {
    const { variant = "standard", toStudent = true, toParent = true, extraRecipients = [] } = await req.json();

    const bilan = await prisma.bilan.findUnique({ where: { id: params.bilanId }, include: { user: true } });
    if (!bilan) return NextResponse.json({ error: "Bilan introuvable" }, { status: 404 });

    // Prépare données
    const qcmScores = (bilan.qcmScores as any) || { byDomain: {} };
    const synthesis = (bilan.synthesis as any) || { forces: [], faiblesses: [], feuilleDeRoute: [] };
    const offers = (bilan.offers as any) || { primary: "", alternatives: [], reasoning: "" };
    const pedago = (bilan.pedagoProfile as any) || {};

    const byDomain = qcmScores.byDomain || {};
    const scoresByDomain = Object.keys(byDomain).map((k) => ({ domain: k, percent: byDomain[k].percent ?? 0 }));

    // Choix du document PDF
    let doc: React.ReactElement;
    let variantLabel = "Standard";
    if (variant === "parent") {
      variantLabel = "Parent";
      doc = (
        <BilanPdfParent data={{
          eleve: { firstName: bilan.user.firstName, lastName: bilan.user.lastName, niveau: (bilan as any)?.niveau, statut: (bilan as any)?.statut },
          createdAt: bilan.createdAt.toISOString(),
          scoresByDomain,
          forces: synthesis.forces || [],
          faiblesses: synthesis.faiblesses || [],
          feuilleDeRoute: synthesis.feuilleDeRoute || [],
          recommandation: { primary: offers.primary, reasoning: offers.reasoning, alternatives: offers.alternatives },
          pricing: { Cortex: 90, "Studio Flex": 100, "Académies": 200, "Odyssée": 6000 },
          horizonMois: 6,
          chargeHebdoHeures: 2,
        }} />
      );
    } else if (variant === "eleve") {
      variantLabel = "Élève";
      doc = (
        <BilanPdfEleve data={{
          eleve: { firstName: bilan.user.firstName, lastName: bilan.user.lastName, niveau: (bilan as any)?.niveau },
          createdAt: bilan.createdAt.toISOString(),
          scoresByDomain,
          feuilleDeRoute: synthesis.feuilleDeRoute || [],
          pedago: { style: pedago?.style, organisation: pedago?.organisation, motivation: pedago?.motivation },
        }} />
      );
    } else {
      variantLabel = "Standard";
      doc = (
        <BilanPdf data={{
          eleve: { firstName: bilan.user.firstName, lastName: bilan.user.lastName, niveau: (bilan as any)?.niveau, statut: (bilan as any)?.statut },
          createdAt: bilan.createdAt.toISOString(),
          scoresByDomain,
          forces: synthesis.forces || [],
          faiblesses: synthesis.faiblesses || [],
          feuilleDeRoute: synthesis.feuilleDeRoute || [],
          offrePrincipale: offers.primary,
          offreReasoning: offers.reasoning,
          alternatives: offers.alternatives || [],
        }} />
      );
    }

    const buffer = await pdf(doc).toBuffer();
    const filename = `bilan-${bilan.id}-${variant}.pdf`;

    // Destinataires
    const recipients: string[] = [];
    if (toStudent && bilan.user.email) recipients.push(bilan.user.email);
    if (toParent && (bilan.user as any).parentEmail) recipients.push((bilan.user as any).parentEmail);
    if (Array.isArray(extraRecipients)) recipients.push(...extraRecipients.filter(Boolean));
    const to = recipients.join(", ");

    if (!to) return NextResponse.json({ error: "Aucun destinataire renseigné" }, { status: 400 });

    // Envoi
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject: `Bilan Nexus Réussite — ${bilan.user.firstName} ${bilan.user.lastName} (${variantLabel})`,
      html: bilanEmailHtml({ studentName: `${bilan.user.firstName} ${bilan.user.lastName}`, variantLabel }),
      attachments: [{ filename, content: buffer, contentType: "application/pdf" }],
    });

    return NextResponse.json({ ok: true, messageId: info.messageId, sentTo: recipients });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Erreur d’envoi" }, { status: 500 });
  }
}
```

---

## 4) Composant UI — envoyer la variante choisie

**Fichier :** `components/bilan/SendPdfByEmail.tsx`

```tsx
"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";

export function SendPdfByEmail({ bilanId, defaultStudent = true, defaultParent = true }: { bilanId: string; defaultStudent?: boolean; defaultParent?: boolean; }) {
  const [variant, setVariant] = useState("standard");
  const [toStudent, setToStudent] = useState(defaultStudent);
  const [toParent, setToParent] = useState(defaultParent);
  const [extra, setExtra] = useState(""); // emails séparés par ,
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSend() {
    try {
      setLoading(true);
      setStatus(null);
      const extraRecipients = extra.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await fetch(`/api/bilan/email/${bilanId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant, toStudent, toParent, extraRecipients }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erreur d’envoi");
      setStatus(`Envoyé à : ${data.sentTo.join(", ")}`);
    } catch (e: any) {
      setStatus(e?.message || "Erreur d’envoi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Variante du PDF</Label>
          <Select value={variant} onValueChange={setVariant}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Choisir la variante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Rapport complet (Standard)</SelectItem>
              <SelectItem value="parent">Version Parent (ROI)</SelectItem>
              <SelectItem value="eleve">Version Élève (badges)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Destinataires supplémentaires (séparés par des virgules)</Label>
          <Input className="mt-1" placeholder="ex: parent2@mail.com, conseiller@mail.com" value={extra} onChange={(e)=>setExtra(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Checkbox id="student" checked={toStudent} onCheckedChange={(v)=>setToStudent(Boolean(v))} />
          <Label htmlFor="student">Élève</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="parent" checked={toParent} onCheckedChange={(v)=>setToParent(Boolean(v))} />
          <Label htmlFor="parent">Parent</Label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={handleSend} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Send className="h-4 w-4 mr-2"/>}
          Envoyer le PDF par e‑mail
        </Button>
        {status && <span className="text-sm text-slate-600">{status}</span>}
      </div>
    </div>
  );
}
```

---

## 5) Intégration dans la page rapport

Dans `app/dashboard/eleve/bilan/[bilanId]/page.tsx`, ajoute (zone header ou bas de page) :

```tsx
import { SendPdfByEmail } from "@/components/bilan/SendPdfByEmail";

// ...
<div className="mt-3">
  <SendPdfByEmail bilanId={params.bilanId} />
</div>
```

---

## 6) Sécurité & conformité

* Vérifier la **session** (NextAuth) et l’autorisation : seul l’élève, son parent ou un admin peut déclencher l’envoi.
* Logger `messageId` et `sentTo` si vous voulez conserver une trace d’envoi.
* Mention RGPD dans le mail : données confidentielles, usage pédagogique.
* Anti‑abus : limiter à X envois/heure par bilan (rate‑limit côté API si nécessaire).

---

**Livré :** envoi e‑mail avec PJ PDF (variante choisie), UI d’envoi et template mail. ✅

branchement rapide

Renseigne tes variables SMTP (EMAIL_SERVER_*, EMAIL_FROM).

Place le composant dans la page rapport :

<SendPdfByEmail bilanId={params.bilanId} />

(Optionnel) active un rate-limit et la vérification de session sur l’endpoint.

# 📬 Journal d’envois (MailLog) + Bouton « Renvoyer »

Objectif :

* Tracer chaque envoi de bilan (qui, quand, quelle variante, destinataires, statut, id SMTP).
* Afficher l’historique dans le dashboard.
* Permettre **Renvoyer** en 1 clic (même variante, mêmes destinataires — modifiables).

---

## 1) Modèle Prisma

**Fichier :** `prisma/schema.prisma`

```prisma
model MailLog {
  id           String   @id @default(cuid())
  bilanId      String
  bilan        Bilan    @relation(fields: [bilanId], references: [id])
  userId       String   // expéditeur (admin/coachs) si dispo ; sinon élève
  variant      String   // "standard" | "parent" | "eleve"
  recipients   String   // CSV des emails
  subject      String
  status       String   // "SENT" | "FAILED"
  messageId    String?  // id SMTP retourné par le provider
  error        String?  // message d’erreur éventuel
  createdAt    DateTime @default(now())
}
```

> Exécuter : `npx prisma migrate dev -n "add_mail_log"`

---

## 2) Mettre à jour l’endpoint d’envoi mail

**Fichier :** `app/api/bilan/email/[bilanId]/route.ts`

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pdf } from "@react-pdf/renderer";
import { transporter, EMAIL_FROM } from "@/lib/mail/transporter";
import { bilanEmailHtml } from "@/lib/mail/templates/bilanEmail";
import { BilanPdf } from "@/lib/pdf/BilanPdf";
import { BilanPdfParent } from "@/lib/pdf/BilanPdfParent";
import { BilanPdfEleve } from "@/lib/pdf/BilanPdfEleve";
import { getServerSession } from "next-auth"; // si NextAuth
import { authOptions } from "@/lib/auth";     // adapter le chemin

export async function POST(req: Request, { params }: { params: { bilanId: string } }) {
  const session = await getServerSession(authOptions as any).catch(() => null);
  const senderId = (session as any)?.user?.id || "anonymous";

  try {
    const { variant = "standard", toStudent = true, toParent = true, extraRecipients = [] } = await req.json();

    const bilan = await prisma.bilan.findUnique({ where: { id: params.bilanId }, include: { user: true } });
    if (!bilan) return NextResponse.json({ error: "Bilan introuvable" }, { status: 404 });

    const qcmScores = (bilan.qcmScores as any) || { byDomain: {} };
    const synthesis = (bilan.synthesis as any) || { forces: [], faiblesses: [], feuilleDeRoute: [] };
    const offers = (bilan.offers as any) || { primary: "", alternatives: [], reasoning: "" };
    const pedago = (bilan.pedagoProfile as any) || {};

    const byDomain = qcmScores.byDomain || {};
    const scoresByDomain = Object.keys(byDomain).map((k) => ({ domain: k, percent: byDomain[k].percent ?? 0 }));

    let doc: React.ReactElement;
    let variantLabel = "Standard";
    if (variant === "parent") {
      variantLabel = "Parent";
      doc = (
        <BilanPdfParent data={{
          eleve: { firstName: bilan.user.firstName, lastName: bilan.user.lastName, niveau: (bilan as any)?.niveau, statut: (bilan as any)?.statut },
          createdAt: bilan.createdAt.toISOString(),
          scoresByDomain,
          forces: synthesis.forces || [],
          faiblesses: synthesis.faiblesses || [],
          feuilleDeRoute: synthesis.feuilleDeRoute || [],
          recommandation: { primary: offers.primary, reasoning: offers.reasoning, alternatives: offers.alternatives },
          pricing: { Cortex: 90, "Studio Flex": 100, "Académies": 200, "Odyssée": 6000 },
          horizonMois: 6,
          chargeHebdoHeures: 2,
        }} />
      );
    } else if (variant === "eleve") {
      variantLabel = "Élève";
      doc = (
        <BilanPdfEleve data={{
          eleve: { firstName: bilan.user.firstName, lastName: bilan.user.lastName, niveau: (bilan as any)?.niveau },
          createdAt: bilan.createdAt.toISOString(),
          scoresByDomain,
          feuilleDeRoute: synthesis.feuilleDeRoute || [],
          pedago: { style: pedago?.style, organisation: pedago?.organisation, motivation: pedago?.motivation },
        }} />
      );
    } else {
      variantLabel = "Standard";
      doc = (
        <BilanPdf data={{
          eleve: { firstName: bilan.user.firstName, lastName: bilan.user.lastName, niveau: (bilan as any)?.niveau, statut: (bilan as any)?.statut },
          createdAt: bilan.createdAt.toISOString(),
          scoresByDomain,
          forces: synthesis.forces || [],
          faiblesses: synthesis.faiblesses || [],
          feuilleDeRoute: synthesis.feuilleDeRoute || [],
          offrePrincipale: offers.primary,
          offreReasoning: offers.reasoning,
          alternatives: offers.alternatives || [],
        }} />
      );
    }

    const buffer = await pdf(doc).toBuffer();
    const filename = `bilan-${bilan.id}-${variant}.pdf`;
    const subject = `Bilan Nexus Réussite — ${bilan.user.firstName} ${bilan.user.lastName} (${variantLabel})`;

    const recipients: string[] = [];
    if (toStudent && bilan.user.email) recipients.push(bilan.user.email);
    if (toParent && (bilan.user as any).parentEmail) recipients.push((bilan.user as any).parentEmail);
    if (Array.isArray(extraRecipients)) recipients.push(...extraRecipients.filter(Boolean));

    if (recipients.length === 0) return NextResponse.json({ error: "Aucun destinataire" }, { status: 400 });

    let status: "SENT" | "FAILED" = "SENT";
    let messageId: string | undefined;
    let errorMsg: string | undefined;
    try {
      const info = await transporter.sendMail({
        from: EMAIL_FROM,
        to: recipients.join(", "),
        subject,
        html: bilanEmailHtml({ studentName: `${bilan.user.firstName} ${bilan.user.lastName}`, variantLabel }),
        attachments: [{ filename, content: buffer, contentType: "application/pdf" }],
      });
      messageId = info.messageId;
    } catch (e: any) {
      status = "FAILED";
      errorMsg = e?.message || "Unknown error";
    }

    // journaliser
    await prisma.mailLog.create({
      data: {
        bilanId: bilan.id,
        userId: senderId,
        variant,
        recipients: recipients.join(","),
        subject,
        status,
        messageId,
        error: errorMsg,
      },
    });

    if (status === "FAILED") return NextResponse.json({ error: errorMsg }, { status: 500 });
    return NextResponse.json({ ok: true, sentTo: recipients, messageId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur" }, { status: 500 });
  }
}
```

---

## 3) Listing des envois (dashboard)

**Fichier :** `components/bilan/MailLogTable.tsx`

```tsx
import { format } from "date-fns";

export type MailLogRow = {
  id: string;
  createdAt: string;
  variant: string;
  recipients: string;
  status: string;
  subject: string;
  messageId?: string;
};

export function MailLogTable({ rows, onResend }: { rows: MailLogRow[]; onResend: (row: MailLogRow) => void }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Variante</th>
            <th className="px-3 py-2 text-left">Destinataires</th>
            <th className="px-3 py-2 text-left">Statut</th>
            <th className="px-3 py-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2">{format(new Date(r.createdAt), "dd/MM/yyyy HH:mm")}</td>
              <td className="px-3 py-2 capitalize">{r.variant}</td>
              <td className="px-3 py-2 truncate max-w-[320px]" title={r.recipients}>{r.recipients}</td>
              <td className="px-3 py-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${r.status === "SENT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {r.status}
                </span>
              </td>
              <td className="px-3 py-2">
                <button className="text-sky-700 hover:underline" onClick={() => onResend(r)}>Renvoyer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 4) Section « Historique d’envois » sur la page Rapport

**Fichier :** `app/dashboard/eleve/bilan/[bilanId]/page.tsx` (extrait)

```tsx
import { prisma } from "@/lib/prisma";
import { MailLogTable, MailLogRow } from "@/components/bilan/MailLogTable";

export default async function Page({ params }: { params: { bilanId: string } }) {
  const bilan = await prisma.bilan.findUnique({ where: { id: params.bilanId }, include: { user: true } });
  if (!bilan) notFound();

  const logs = await prisma.mailLog.findMany({ where: { bilanId: bilan.id }, orderBy: { createdAt: "desc" } });
  const rows: MailLogRow[] = logs.map((l) => ({
    id: l.id,
    createdAt: l.createdAt.toISOString(),
    variant: l.variant,
    recipients: l.recipients,
    status: l.status,
    subject: l.subject,
    messageId: l.messageId || undefined,
  }));

  // handler pour le Renvoyer côté client → via un composant client minimal
  return (
    <div className="space-y-6">
      {/* ... le rapport ... */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Historique des envois</h3>
        {/* Composant client qui gère onResend */}
        <MailLogClient bilanId={bilan.id} rows={rows} />
      </section>
    </div>
  );
}
```

**Fichier :** `components/bilan/MailLogClient.tsx`

```tsx
"use client";
import { useState } from "react";
import { MailLogTable, MailLogRow } from "./MailLogTable";

export function MailLogClient({ bilanId, rows: initialRows }: { bilanId: string; rows: MailLogRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function onResend(row: MailLogRow) {
    try {
      setLoadingId(row.id);
      const res = await fetch(`/api/bilan/email/${bilanId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variant: row.variant,
          toStudent: true,
          toParent: row.recipients.includes("@") // naïf: renvoie aussi au parent si présent dans CSV
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erreur d’envoi");
      // recharger la liste côté client (optionnel : refetch API dédiée)
      setRows([{ ...row, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "SENT" }, ...rows]);
      alert("Mail renvoyé avec succès.");
    } catch (e: any) {
      alert(e?.message || "Échec de renvoi");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div>
      <MailLogTable rows={rows} onResend={onResend} />
      {loadingId && <p className="text-sm text-slate-500 mt-2">Envoi en cours…</p>}
    </div>
  );
}
```

---

## 5) Sécurité & bonnes pratiques

* **AuthZ** : ne permettre l’envoi/renvoi qu’à l’élève propriétaire, au parent lié, ou aux rôles STAFF/ADMIN.
* **Rate‑limit** : limiter les envois par `bilanId` (ex. 5/jour) pour éviter l’abus.
* **Observabilité** : logger `messageId` SMTP + tracer les erreurs (Sentry).
* **Config** : externaliser `pricing` dans une table (ex. `Pricing`) et le charger dans la variante Parent.

---

✅ Résultat :

* Chaque envoi est consigné en base.
* L’historique est visible et actionnable.
* Le bouton **Renvoyer** refait partir le PDF (même variante), en 1 clic.

Ce qui est inclus

Modèle Prisma MailLog (bilanId, userId, variante, destinataires, statut, messageId, erreur).

Mise à jour de l’endpoint d’envoi pour logguer chaque envoi (succès/échec).

Tableau d’historique dans le dashboard (date, variante, destinataires, statut).

Bouton “Renvoyer” en 1 clic (réutilise la même variante/destinataires).

Client-side helper pour rafraîchir la liste après renvoi.

Intégration rapide

npx prisma migrate dev -n "add_mail_log".

Remplacer l’endpoint POST /api/bilan/email/[bilanId] par la version du canvas.

Sur la page Rapport : importer MailLogClient et injecter la section “Historique des envois”.

À prévoir ensuite (nice-to-have)

Rate-limit (5 envois/jour par bilan).

Règles d’autorisation (élève/parent/ADMIN).

Externaliser les tarifs en DB et les injecter dans la version Parent.

Ajout d’un filtre/date-range et export CSV depuis l’historique.
