# AGENTS.md — Nexus Réussite

> Instructions de travail pour Codex et tout agent de développement intervenant sur `nexus-project_v0`.
>
> Ce dépôt est la production de Nexus Réussite. Traiter toute modification comme une modification de produit réel : pédagogique, commercial, juridique, technique et opérationnel.

---

## 1. Rôle attendu de l’agent

Tu agis comme un **lead senior full-stack / frontend / produit / qualité / marketing** pour Nexus Réussite.

Ton objectif n’est pas seulement de “faire passer le build”. Tu dois produire un site :

- fiable en production ;
- cohérent avec le business model ;
- clair pour les familles ;
- sobre, premium et crédible ;
- conforme aux contraintes d’un service éducatif destiné à des mineurs ;
- maintenable par un humain après ton intervention.

Tu dois refuser implicitement les corrections superficielles qui masquent une dette sans la traiter. Toute correction doit être fondée sur le code, le rendu réel, les tests et la cohérence produit.

---

## 2. Faits métier non négociables

### Identité

- Nom commercial : **Nexus Réussite**.
- Domaine principal : `https://nexusreussite.academy`.
- Positionnement : accompagnement académique premium pour élèves du système français à Tunis.
- Public principal : familles, parents, élèves scolarisés, candidats libres, élèves préparant brevet, bac français, bac, spécialités, NSI, mathématiques, français, méthodologie.
- Ton : exigeant, sobre, professionnel, pédagogique, rassurant.

### Coordonnées publiques

- Téléphone / WhatsApp : `+216 99 19 28 29`.
- WhatsApp : `https://wa.me/21699192829`.
- Email générique : `contact@nexusreussite.academy`.
- Email pédagogique : `pedagogie@nexusreussite.academy` si contexte pédagogique ou responsable pédagogique.

### Adresses

Ne jamais confondre :

- **Siège social administratif** : Centre Urbain Nord, Tunis.
- **Centre d’accompagnement pédagogique** : Mutuelleville, Tunis.

Règle d’affichage :

- Les pages commerciales et pédagogiques doivent mettre en avant **Mutuelleville** pour les cours, stages, rendez-vous pédagogiques et accompagnement en présentiel.
- Les mentions légales, documents administratifs et factures peuvent mentionner le **Centre Urbain Nord** comme siège social.
- La page contact doit afficher les deux blocs distinctement : “Siège social administratif” et “Centre d’accompagnement pédagogique”.

---

## 3. Promesse marketing canonique

La promesse doit être claire et défendable :

> Nexus Réussite accompagne les élèves du système français à Tunis avec des groupes réduits, une méthode structurée, des bilans individualisés, une plateforme numérique et un suivi parent clair.

À privilégier :

- “groupes réduits” ;
- “méthode structurée” ;
- “bilan individualisé” ;
- “suivi parent” ;
- “enseignants qualifiés” ;
- “progression mesurable” ;
- “cadre de travail exigeant” ;
- “préparation aux attendus du système français”.

À éviter ou supprimer sauf preuve juridique et commerciale validée :

- “100 % Bac ou remboursé” ;
- “garantie réussite” ;
- “garantie mention” ;
- “taux de réussite 98 %” sans source ;
- “150+ mentions” sans source ;
- “500+ élèves suivis” sans source ;
- toute promesse de résultat scolaire garanti ;
- tout discours anxiogène excessif sur l’échec ou le bac.

Reformulation recommandée :

- Remplacer “garantie réussite” par “engagement de moyens, méthode et suivi”.
- Remplacer “100 % bac ou remboursé” par “diagnostic initial, plan de travail, bilans réguliers et ajustements pédagogiques”.
- Remplacer “professeur IA qui ne dort jamais” par “assistant pédagogique disponible pour compléter le travail humain”.

---

## 4. Pages publiques prioritaires

Les pages publiques suivantes sont critiques pour le go-live et les campagnes :

- `/`
- `/offres`
- `/recommandation`
- `/bilan-gratuit`
- `/stages`
- `/plateforme-aria`
- `/accompagnement-scolaire`
- `/contact`

Avant de modifier l’une de ces pages, vérifier :

1. le rendu actuel en production ;
2. le fichier source réellement utilisé ;
3. les composants importés ;
4. les données JSON utilisées ;
5. les CTA ;
6. le rendu mobile ;
7. les métadonnées SEO ;
8. les risques d’incohérence avec les autres pages.

Chaque page doit avoir :

- un H1 unique ;
- un CTA principal clair ;
- un CTA secondaire WhatsApp ou bilan ;
- une proposition de valeur compréhensible en moins de 10 secondes ;
- une version mobile sans débordement horizontal ;
- aucun contenu obsolète ;
- aucun lien principal vers une page cassée ;
- aucune promesse excessive ;
- une cohérence visuelle avec le reste du site.

---

## 5. Priorités front publiques actuelles

Quand la mission concerne le front public, traiter en premier :

### P0 — bloquant go-live

- `/recommandation` doit répondre 200, sans erreur interne, et le wizard doit fonctionner.
- `/bilan-gratuit` doit être un tunnel de demande de bilan, pas une création de compte trop agressive en première intention.
- `/stages` doit être alignée 2026/2027 et ne plus mettre en avant des dates obsolètes du printemps 2026.
- `/offres` doit afficher le catalogue 2026/2027 et utiliser la source de vérité canonique.
- Les adresses doivent distinguer siège social et centre pédagogique.
- Les promesses “garantie réussite / 100 % / mention garantie” doivent être supprimées ou reformulées.

### P1 — qualité go-live

- Harmoniser le design entre `lux-*`, `marketing-*`, `brand-*`, `surface-*`, `nexus-*`.
- Améliorer les CTA et la narration de conversion.
- Vérifier le responsive mobile.
- Vérifier SEO, titres, descriptions, OpenGraph.
- Ajouter des tests Playwright smoke sur les pages publiques.

### P2 — consolidation

- Réduire les composants dupliqués.
- Archiver proprement les anciennes pages/campagnes.
- Documenter les décisions produit dans `docs/audits/` ou `docs/adr/`.

---

## 6. Sources de vérité techniques

### Pricing

La source canonique des prix, acomptes, échéanciers et règles commerciales est :

- `data/pricing.canonical.json`

Le loader canonique est :

- `lib/pricing.ts`

Règles :

- Ne pas importer directement `data/pricing.canonical.json` dans les pages ou composants.
- Utiliser les getters de `lib/pricing.ts`.
- Ne pas hardcoder de prix TND dans les composants si le montant existe dans la source canonique.
- Si une page contient encore des prix hardcodés, décider si c’est une archive ou migrer vers la source canonique.
- Toute nouvelle offre doit être ajoutée à la source canonique, pas dispersée dans plusieurs composants.

### Pages et composants publics

Fichiers fréquents :

- `app/page.tsx`
- `app/HomePageClient.tsx`
- `app/offres/page.tsx`
- `app/offres/layout.tsx`
- `app/recommandation/page.tsx`
- `app/recommandation/RecommandationClient.tsx`
- `components/premium/RecommendationWizard.tsx`
- `app/bilan-gratuit/page.tsx`
- `app/stages/page.tsx`
- `app/stages/_components/NexusStagesPage.tsx`
- `app/plateforme-aria/page.tsx`
- `app/accompagnement-scolaire/page.tsx`
- `app/contact/page.tsx`
- `components/layout/CorporateNavbar.tsx`
- `components/layout/CorporateFooter.tsx`
- `components/sections/homepage/content.ts`
- `app/globals.css`
- `tailwind.config.mjs`
- `lib/theme/tokens.js`

### Prototypes et archives

Le dépôt peut contenir des sources concurrentes ou anciennes :

- `academic-luxury-design/`
- `src/static-pages/`
- `Nexus_Reussite_Accueil.html`
- `data/offres-nexus.json`
- `public/offres-nexus.json`
- anciens dossiers d’audit et captures.

Ne pas les traiter comme sources de vérité sans preuve. S’ils servent de référence visuelle, le signaler explicitement. S’ils sont obsolètes, ne pas les réactiver silencieusement.

---

## 7. Design system et direction visuelle

Direction recommandée :

- premium sobre ;
- bleu nuit / ivoire / doré discret ;
- vert réservé aux validations, confirmations ou WhatsApp ;
- violet réservé à ARIA/IA si nécessaire ;
- pas de mélange excessif de gradients.

Règles UI :

- Conserver une hiérarchie claire : eyebrow, H1/H2, sous-titre, preuves, CTA.
- Limiter les badges marketing. Trop de badges réduisent la crédibilité.
- Éviter les animations qui ralentissent la compréhension ou cassent le mobile.
- Ne pas introduire de nouvelle palette sans l’intégrer aux tokens.
- Ne pas créer de nouveaux composants si un composant premium existant peut être corrigé et réutilisé.
- Toujours vérifier les contrastes texte/fond.

CTA recommandés :

- “Demander un bilan gratuit”
- “Trouver ma formule”
- “Voir les offres et tarifs”
- “Pré-inscription”
- “Écrire sur WhatsApp”
- “Être conseillé”

CTA à éviter :

- “Sécuriser mon Bac” si associé à une promesse excessive ;
- “Garantie réussite” ;
- “100 % garanti” ;
- “Essayer gratuitement” si l’accès gratuit réel n’existe pas.

---

## 8. Règles par page

### Homepage `/`

Objectif : expliquer Nexus rapidement et orienter vers bilan/offres/recommandation.

Structure cible :

1. Héros clair : promesse + 2 CTA.
2. Pour qui : élèves scolarisés, candidats libres, familles cherchant un cadre.
3. Méthode Nexus : diagnostic, groupe réduit, entraînement, bilan, suivi parent.
4. Offres 2026/2027 : repères tarifaires, sans surcharge.
5. Stages de prérentrée et stages annuels.
6. Plateforme / ARIA comme complément, pas comme promesse principale.
7. Preuves prudentes : groupes réduits, suivi, bilans, enseignants qualifiés.
8. CTA final.

### `/offres`

Objectif : catalogue clair, transparent, crédible.

Doit afficher :

- Catalogue 2026/2027.
- Tarifs en TND.
- Groupes de 5 maximum.
- Seuil d’ouverture.
- Acompte et échéancier si applicable.
- CTA pour être conseillé.

Ne doit pas afficher :

- prix mensuels obsolètes 150/450/750 si non présents dans la source canonique actuelle ;
- anciennes offres non validées ;
- fausse urgence ;
- garanties absolues.

### `/recommandation`

Objectif : mini-sélecteur de formule sans erreur.

Règles :

- Normaliser les valeurs de niveau avec celles de `pricing.canonical.json`.
- Afficher un état vide propre.
- Ne jamais planter si aucune offre ne correspond.
- Les recommandations doivent pointer vers une action réelle : bilan, WhatsApp, offres.

### `/bilan-gratuit`

Objectif : conversion bas-friction.

Règles :

- Ne pas demander un mot de passe comme première promesse publique.
- Présenter d’abord le bilan : diagnostic, priorités, orientation.
- Demander uniquement les informations nécessaires au premier contact.
- La création de compte peut être différée après qualification ou confirmation.
- Consentement clair pour les données et contact.

### `/stages`

Objectif : préinscription stages 2026/2027.

Règles :

- Mettre en avant : prérentrée août 2026, Toussaint, hiver/février, printemps, sprint final.
- Ne pas afficher de dates précises non confirmées.
- Ne pas mettre en avant des dates obsolètes du printemps 2026.
- Message canonique : “Les dates précises sont communiquées selon le niveau, l’établissement et la formule recommandée.”

### `/plateforme-aria`

Objectif : expliquer ARIA sans surpromesse.

Règles :

- ARIA complète l’accompagnement humain, elle ne le remplace pas.
- Clarifier différence entre ARIA, Masterium, plateforme EAF.
- Ne pas promettre une disponibilité ou un accès gratuit si non prouvé par le produit.
- Ajouter garde-fous pédagogiques : relire, comprendre, travailler avec méthode.

### `/accompagnement-scolaire`

Objectif : page service sérieuse, non fantaisiste.

Règles :

- Supprimer chiffres non prouvés.
- Supprimer garanties de résultat.
- Harmoniser avec le catalogue réel.
- Mettre l’accent sur méthode, groupes réduits, suivi, bilans.

### `/contact`

Objectif : contact clair et exact.

Règles :

- Bloc “Centre d’accompagnement pédagogique” = Mutuelleville.
- Bloc “Siège social administratif” = Centre Urbain Nord.
- Google Maps doit correspondre au bon bloc affiché.
- Les rendez-vous pédagogiques doivent être présentés “sur confirmation”.

---

## 9. Sécurité, données et mineurs

Le produit manipule des données de mineurs, parents, bilans, documents et conversations pédagogiques. Toujours minimiser les données collectées.

Règles :

- Ne pas afficher de PII dans les logs.
- Ne pas introduire de collecte inutile dans les formulaires publics.
- Ne pas exposer de chemins locaux, tokens, emails complets ou payloads sensibles dans les erreurs client.
- Ne pas demander de mot de passe si le parcours peut être initié sans compte.
- Tout formulaire public doit avoir validation, anti-spam/rate-limit côté API et message d’erreur sobre.

---

## 10. Production et SSH

Production :

- Domaine : `https://nexusreussite.academy`
- Serveur : `root@88.99.254.59`
- Chemin probable : `/var/www/nexus-project_v0`

Règles strictes :

- Ne jamais déployer sans demande explicite.
- Ne jamais faire de commande destructive en production sans validation explicite.
- Ne jamais afficher le contenu de `.env`, secrets, tokens ou credentials.
- Toujours commencer en lecture seule.
- Toujours consigner l’état initial.

Commandes de lecture recommandées :

```bash
pwd
git status --short
git rev-parse HEAD
git log -1 --oneline
git remote -v
node -v
npm -v
docker ps
docker compose ps
ls -la
```

Vérifications HTTP minimales :

```bash
curl -I https://nexusreussite.academy/
curl -I https://nexusreussite.academy/offres
curl -I https://nexusreussite.academy/recommandation
curl -I https://nexusreussite.academy/bilan-gratuit
curl -I https://nexusreussite.academy/stages
curl -I https://nexusreussite.academy/plateforme-aria
curl -I https://nexusreussite.academy/accompagnement-scolaire
curl -I https://nexusreussite.academy/contact
```

---

## 11. Workflow obligatoire avant modification

Pour toute mission :

1. Lire ce fichier `AGENTS.md`.
2. Identifier les fichiers concernés.
3. Lire l’état actuel avant modification.
4. Repérer les sources de vérité.
5. Vérifier le rendu réel si la mission touche au frontend public.
6. Faire les changements les plus petits compatibles avec une vraie correction.
7. Ne pas multiplier les abstractions sans besoin.
8. Ajouter ou adapter les tests pertinents.
9. Lancer les vérifications.
10. Produire un rapport final factuel.

Ne jamais :

- modifier “au feeling” sans lire le code existant ;
- corriger une page en cassant une autre ;
- ajouter une nouvelle source de pricing ;
- laisser un CTA vers une page cassée ;
- laisser une promesse marketing non prouvée ;
- ignorer le mobile ;
- masquer les erreurs de build ou de test.

---

## 12. Tests et quality gates

Commandes standards :

```bash
npm run lint
npm run typecheck
npm run test -- --runInBand
npm run build
```

Si disponible pour les pages publiques :

```bash
npx playwright test
```

Smoke public minimal attendu :

- `/` répond 200 et affiche un H1.
- `/offres` répond 200 et affiche le catalogue 2026/2027.
- `/recommandation` répond 200 et le wizard fonctionne.
- `/bilan-gratuit` répond 200 et affiche le formulaire ou tunnel de bilan.
- `/stages` répond 200 et ne met pas en avant de dates obsolètes.
- `/plateforme-aria` répond 200.
- `/accompagnement-scolaire` répond 200.
- `/contact` répond 200 et distingue les deux adresses.

Si une commande échoue :

- indiquer la commande exacte ;
- résumer l’erreur ;
- préciser si l’échec est nouveau ou préexistant ;
- ne pas déclarer la tâche terminée sans l’indiquer.

---

## 13. Documentation attendue

Pour les missions significatives, créer ou mettre à jour un fichier dans :

- `docs/audits/`
- ou `docs/adr/`

Format recommandé :

```md
# Titre

## Date

## Contexte

## Problèmes observés

## Décisions prises

## Fichiers modifiés

## Tests exécutés

## Résultats

## Risques restants

## Rollback
```

---

## 14. Format de réponse final attendu de l’agent

Toujours terminer par :

```md
## Résumé
- ...

## Fichiers modifiés
- ...

## Vérifications exécutées
- [x] ...
- [ ] ... avec raison

## Points de vigilance
- ...

## Recommandation suivante
- ...
```

Si la mission est un audit sans modification, fournir :

```md
## Verdict

## Constats P0

## Constats P1

## Constats P2

## Plan d’action recommandé

## Prompt de correction si demandé
```

---

## 15. Définition de terminé

Une tâche est terminée seulement si :

- le problème initial est traité ;
- les incohérences induites sont traitées ;
- le build n’est pas cassé ;
- les tests pertinents ont été lancés ou l’impossibilité est documentée ;
- les pages publiques critiques ne régressent pas ;
- la solution est maintenable ;
- le rapport final est honnête.

Une tâche n’est pas terminée si :

- un TODO critique reste sans traitement ;
- une page publique principale retourne une erreur ;
- une source de vérité est contournée ;
- une ancienne campagne obsolète reste mise en avant ;
- les adresses sont encore confondues ;
- une promesse marketing excessive reste visible ;
- une erreur de test est passée sous silence.
