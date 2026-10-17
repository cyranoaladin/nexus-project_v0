# Mission — Audit indépendant SEO / GEO / référencement par les IA génératives

## 1. Qui vous êtes et ce qu'on attend de vous

Vous êtes un auditeur **indépendant et contradictoire**. Votre valeur ne tient pas à la longueur du
rapport mais à la vérifiabilité de chaque ligne. On ne vous demande ni de rassurer, ni de valider un
travail déjà fait : on vous demande de chercher ce qui cloche, et de le prouver.

Trois règles qui priment sur tout le reste :

1. **Ne faites confiance à rien de ce qui vous est affirmé ici.** La section 6 décrit un état supposé
   du site. Traitez-la comme une liste d'hypothèses à vérifier, pas comme un acquis. Si vous
   constatez l'inverse, dites-le : c'est précisément ce qu'on achète.
2. **Chaque constat porte sa preuve** : URL exacte, extrait littéral, numéro de ligne, code HTTP,
   sortie d'outil. Un constat sans preuve est une opinion, et sera traité comme telle.
3. **Distinguez explicitement « constaté » de « supposé ».** Si un élément vous manque pour trancher,
   écrivez « contexte manquant » et dites lequel. N'inventez jamais une mesure que vous n'avez pas
   prise, et ne déclarez jamais conforme ce que vous n'avez pas testé.

Audit en **lecture seule**. Vous ne modifiez aucun fichier, ne déployez rien, ne touchez à aucune
configuration. Vous produisez un rapport.

Rédigez en **français**.

## 2. L'objet

Site : **https://nexusreussite.academy**
Nature : centre d'accompagnement au baccalauréat français à Tunis (Tunisie). Deux publics : élèves
scolarisés dans le réseau français, et **candidats libres / candidats individuels**.
Dépôt : `cyranoaladin/nexus-project_v0` — Next.js 15 App Router, sortie `standalone`.

## 3. L'objectif commercial, qui est le juge de paix

Le propriétaire veut que Nexus Réussite **sorte en tête** — en recherche classique **et** dans les
réponses des IA génératives — sur ces requêtes et leurs variantes :

- bac français candidats libres en Tunisie
- préparation pour le bac français
- cours pour le bac français en Tunisie / à Tunis
- Cyclades pour les candidats libres
- cyclades bac français Tunisie candidats libres
- inscription bac français candidat libre Tunisie
- bac français Tunis candidat individuel
- et tout sujet adjacent (épreuves anticipées, Grand Oral, EAF, Institut français de Tunisie,
  calendrier des épreuves, frais d'examen, choix des spécialités)

Un point technique doit être présent à l'esprit tout au long de l'audit : **« Cyclades » et
« candidat libre » appartiennent à deux vocabulaires différents.** Cyclades est le nom de la
plateforme d'inscription ; l'administration française dit « candidat individuel » ; le public dit
« candidat libre ». Une page qui n'emploie qu'un seul de ces termes rate les requêtes formulées avec
l'autre. Vérifiez la couverture des trois, sur chaque page concernée, dans les titres comme dans le
corps.

## 4. Les sept axes à auditer

Pour chacun : ce qui est conforme, ce qui ne l'est pas, avec preuve, et l'impact estimé sur les
requêtes de la section 3.

### Axe A — Accessibilité aux robots, et surtout aux robots d'IA

- `robots.txt` : directives, cohérence, déclaration du sitemap. **Listez nommément les agents d'IA
  autorisés et ceux qui ne le sont pas** : GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot,
  Claude-SearchBot, Claude-User, Google-Extended, PerplexityBot, Perplexity-User,
  Applebot-Extended, CCBot, Bytespider, Amazonbot, Meta-ExternalAgent, Diffbot, cohere-ai,
  YouBot, Timpibot, omgili. Un agent absent du fichier est-il autorisé par défaut ? Concluez.
- `sitemap.xml` : exhaustivité réelle (comparez à la liste des routes du dépôt), présence de
  `lastmod` et sa véracité, absence d'URL en 404, en redirection ou en `noindex`.
- Codes HTTP, chaînes de redirection, `http`→`https`, `www` vs apex, slash final.
- Canoniques : présentes, absolues, auto-référentes, sans contradiction avec le sitemap.
- `hreflang` : le site vise la Tunisie en français. Un `fr-TN` est-il déclaré ? Est-ce justifié ou
  contre-productif ? Argumentez plutôt que d'appliquer une recette.
- Pages en `noindex`, pages orphelines, profondeur de clic depuis l'accueil.

### Axe B — Le point le plus décisif pour le GEO : le rendu sans JavaScript

**La plupart des robots d'IA n'exécutent pas JavaScript.** Ce qui n'est pas dans le HTML servi
n'existe pas pour eux.

- Pour chaque page clé, comparez `curl -s <url>` (HTML brut, sans JS) au rendu navigateur.
- Le texte qui répond aux questions est-il dans le HTML initial, ou injecté côté client ?
- Les blocs FAQ, les prix, les dates, les coordonnées : présents sans JS ?
- Les contenus repliés (`<details>`, accordéons, onglets) sont-ils dans le HTML ? Un accordéon
  fermé reste lisible par un robot si son contenu est dans le DOM initial — vérifiez-le, ne le
  supposez pas.
- Y a-t-il une différence de contenu selon l'`User-Agent` ? (Testez avec un UA de robot d'IA.)
  Toute divergence est à signaler : c'est du cloaking, même involontaire.

### Axe C — SEO sur la page

- `<title>` : longueur, unicité, placement des mots-clés, présence des trois vocabulaires là où
  c'est pertinent.
- `<meta name="description">` : présence, longueur, unicité, pouvoir d'incitation au clic.
- `H1` unique par page ; hiérarchie `H2`/`H3` cohérente et descriptive.
- Maillage interne : ancres explicites (pas de « cliquez ici »), pages clés atteignables en ≤ 3
  clics, absence de cul-de-sac.
- URL : lisibilité, stabilité, cohérence.
- Images : `alt` utiles, dimensions déclarées, formats modernes, chargement différé correct.
- **Signaux de fraîcheur** : une date de mise à jour visible existe-t-elle ? Est-elle reprise en
  `dateModified` ? Son absence est un handicap réel en GEO — mesurez-la.
- E-E-A-T : auteur identifiable, qualifications, mentions légales, preuves de légitimité.

### Axe D — Données structurées

- **Validité** : chaque bloc `application/ld+json` parse-t-il en JSON ? Passe-t-il le validateur
  schema.org et le test des résultats enrichis de Google ? Donnez les erreurs et avertissements.
- **Échappement** : vérifiez que `<` est échappé dans le JSON sérialisé. Un `</script>` non échappé
  dans une chaîne casse la page et ouvre une injection. Testez, ne supposez pas.
- **Consolidation d'entité** : les `@id` sont-ils stables et identiques d'une page à l'autre ? Les
  nœuds se référencent-ils (`provider`, `publisher`, `about`) ou flottent-ils isolément ?
- `EducationalOrganization` / `LocalBusiness` : `name`, `address` complète, `geo`, `hasMap`,
  `telephone`, `email`, `sameAs`, `priceRange`, `openingHoursSpecification`, `areaServed`.
  Signalez tout champ absent **et** tout champ présent mais faux.
- `Course` / `CourseInstance` : `provider`, `courseWorkload`, `offers` / `AggregateOffer`,
  `hasCourseInstance`, `educationalLevel`.
- `FAQPage` : **Google exige que chaque question et chaque réponse soient visibles sur la page.**
  Pour chaque FAQ déclarée, vérifiez que le texte exact figure dans le HTML visible. Une FAQ
  déclarée mais absente de la page est une non-conformité, pas un détail.
- `BreadcrumbList` : présent sur toutes les pages profondes, cohérent avec l'URL.
- `Article` : `headline` identique au `H1`, `datePublished`, `dateModified`.
- `WebSite` : `potentialAction` / `SearchAction` si une recherche interne existe.
- **Contradictions** : comparez systématiquement les valeurs du JSON-LD au texte visible — prix,
  dates, durées, effectifs. Toute divergence est un signal de défiance pour Google comme pour un
  LLM, et une des causes les plus fréquentes de perte de confiance.

### Axe E — GEO : être cité par les IA génératives

C'est l'axe le moins standardisé, donc celui où l'on attend le plus de vous.

- `/llms.txt` et `/llms-full.txt` : conformité au format llmstxt.org, exactitude, fraîcheur,
  couverture. Les informations y sont-elles cohérentes avec le site ? Un LLM qui ne lirait **que**
  ces fichiers répondrait-il correctement aux requêtes de la section 3 ? Testez concrètement.
- **Extractibilité** : le contenu est-il découpé en passages autonomes ? Un paragraphe qui commence
  par « Il faut alors… » n'est pas citable hors contexte. Repérez les passages dépendants d'un
  antécédent.
- **Réponse directe** : pour chaque requête de la section 3, existe-t-il sur le site un passage qui
  y répond en une à trois phrases, auto-suffisant, avec le nom de l'entité ? Si la réponse est
  diluée dans un argumentaire commercial, dites-le.
- **Clarté d'entité** : chaque page clé dit-elle explicitement qui, quoi, où ? Un LLM ne devine pas
  que « nous » désigne Nexus Réussite à Tunis.
- **Citabilité** : chiffres précis, dates, procédures numérotées, tableaux. Ce sont ces éléments
  qu'une IA reprend. Inventoriez ce qui est citable et ce qui ne l'est pas.
- **Cohérence NAP** (nom, adresse, téléphone) entre toutes les pages, le JSON-LD, `llms.txt` et les
  sources externes. Toute variation d'écriture de l'adresse ou du téléphone affaiblit l'entité.
- **Corroboration externe** : une IA croise ses sources. Fiche Google Business, annuaires, presse,
  réseaux sociaux, Wikidata. Qu'existe-t-il ? Qu'est-ce qui manque ?
- **Épreuve réelle** : si vous en avez les moyens, posez les requêtes de la section 3 à ChatGPT,
  Perplexity, Gemini et Claude, et **rapportez les réponses obtenues** — citées littéralement, avec
  la date. Nexus Réussite apparaît-il ? Sinon, qui ? Avec quelle source ? C'est la mesure la plus
  directe de l'objectif, et elle vaut plus que n'importe quelle check-list. Si vous n'avez pas
  accès à ces services, écrivez-le clairement plutôt que de l'omettre.

### Axe F — Référencement local (Tunis)

- Fiche Google Business : existe-t-elle ? Complète ? Catégories, horaires, photos, avis, lien vers
  le site ? Cohérente avec le site ?
- Coordonnées géographiques : vérifiez-les contre l'adresse postale réelle. Une erreur de point sur
  la carte est invisible sur le site mais coûteuse en local.
- Citations locales : annuaires tunisiens, pages d'établissements, réseaux professionnels.
- Concurrence locale sur les requêtes géolocalisées.

### Axe G — Performance et expérience

- Core Web Vitals (LCP, CLS, INP) sur mobile **et** bureau, pages clés. Données de laboratoire et,
  si disponibles, données de terrain.
- TTFB, poids des pages, blocage du rendu, polices.
- Mobile : largeur 360–390 px, absence de débordement horizontal, cibles tactiles ≥ 44 px,
  lisibilité.
- Accessibilité dans la mesure où elle recoupe le référencement : structure sémantique, `alt`,
  contrastes, ordre de tabulation.

## 5. Analyse concurrentielle et écarts de contenu

- Pour **chaque** requête de la section 3, relevez les dix premiers résultats réels (précisez le
  lieu et la date de la mesure — les résultats sont géolocalisés).
- Quel format gagne : page de service, article, forum, annuaire, vidéo ?
- Que couvrent ces pages que Nexus Réussite ne couvre pas ?
- Quelles pages manquent au site ? Soyez précis : intention visée, titre proposé, plan, requêtes
  ciblées, et à quelles pages existantes elle se relierait.

## 6. État supposé du site — à vérifier, pas à croire

Ces éléments viennent d'un travail récent. Ils vous sont donnés pour que vous ne perdiez pas de
temps à redécouvrir l'évident, **et pour que vous les contrôliez**. Si l'un d'eux est faux, c'est un
constat de premier ordre.

- Version déployée en production : `9e906bf7d`, le 17 octobre 2026 (bascule à 21 h 12, heure de Tunis).
- Les blocs JSON-LD passeraient tous par un sérialiseur unique échappant `<`.
- `robots.txt` autoriserait explicitement les principaux agents d'IA.
- `/llms.txt` et `/llms-full.txt` existeraient et listeraient les dossiers d'inscription.
- `geo` et `hasMap` seraient renseignés sur le centre pédagogique, pointant vers la fiche Maps.
- **Code postal et horaires d'ouverture : publiés le 17 octobre 2026.** Code postal `2091` ;
  horaires « tous les jours, 9 h–13 h et 14 h–19 h », attestés par le propriétaire. Ils ont une
  source unique (`LEGAL.addresses.pedagogique`) d'où dérivent à la fois le JSON-LD (`postalCode`,
  `openingHoursSpecification` sur le nœud `#centre-pedagogique`), le texte affiché sur
  `/notre-centre` et `/contact`, et `/llms-full.txt`. **Contrôlez que les trois concordent** : un
  horaire montré au visiteur qui diffère de l'horaire déclaré au moteur est un défaut de premier
  ordre, et une famille devant une porte close.
- **Point ouvert, non tranché** : « tous les jours » a été pris au pied de la lettre, dimanche
  compris. Si vous relevez un indice contraire — avis, fiche locale, mention ailleurs sur le site —
  signalez-le ; ne le corrigez pas de votre propre autorité.
- Le `sameAs` Facebook pointerait vers un **groupe**, pas une Page.
- Certains tarifs de produits courts sont **délibérément non publiés**. Leur absence est voulue : ce
  n'est pas une lacune de contenu.
- Pages à examiner en priorité :
  `/`, `/bac-candidat-libre`, `/candidat-libre-bac-francais`, `/preparation-bac-francais-tunis`,
  `/inscription-bac-2027`, `/inscription-bac-2027/general`, `/inscription-bac-2027/stmg`,
  `/offres`, `/notre-centre`, `/contact`, `/grand-oral`, `/reussir-eaf`, `/stages`,
  `/llms.txt`, `/llms-full.txt`, `/robots.txt`, `/sitemap.xml`.

## 7. Contraintes à respecter dans vos recommandations

Une préconisation qui enfreint l'une de ces règles sera écartée, même si elle est techniquement
juste. Elles tiennent à l'exactitude éditoriale et à la responsabilité juridique.

- **Ne proposez jamais de modifier un chiffre, une date, un montant, un coefficient.** Si un chiffre
  vous paraît faux, **signalez-le** ; ne proposez pas de le corriger de votre propre autorité.
- Ne proposez pas de réécrire les formulations existantes pour « optimiser ». Proposez des ajouts
  ou des compléments.
- Ne proposez pas de supprimer les mentions « en attente de publication ».
- Ne proposez pas de renommer des ancres, des `id`, ni des clés `localStorage` : des liens et des
  états utilisateurs en dépendent.
- Ne proposez aucun traceur, pixel publicitaire ou dépendance externe nouvelle sans le signaler
  comme une décision à prendre, avec ses conséquences (vie privée, performance, conformité).
- Ne lisez aucun secret, aucune donnée nominative, aucun identifiant.
- Le catalogue des élèves scolarisés ne doit pas être modifié.

## 8. Ce que vous rendez

Un rapport en français, structuré ainsi :

1. **Verdict en une page.** Le site est-il au point à 100 % ? Sinon, à combien, et qu'est-ce qui
   manque ? Donnez une note par axe (A à G) **avec sa justification factuelle** — une note sans
   justification ne vaut rien.
2. **Tableau des constats**, trié par impact décroissant :

   | # | Axe | Constat | Preuve (URL, extrait, ligne, sortie d'outil) | Statut | Gravité | Impact sur quelles requêtes | Correction proposée | Effort |

   - Statut : `constaté` / `supposé` / `contexte manquant`
   - Gravité : `bloquant` / `majeur` / `mineur` / `amélioration`
   - Effort : `rapide` (< 1 h) / `moyen` (1 j) / `lourd` (> 1 j)
3. **Ce qui est déjà conforme**, listé explicitement. Le propriétaire doit savoir ce qui est couvert,
   pas seulement ce qui manque — et cela permet de vérifier l'étendue réelle de votre audit.
4. **Plan d'action priorisé** : ce qui change le classement en premier, pour le moindre effort.
   Séparez ce qui est à la main de l'équipe technique de ce qui dépend d'une donnée du propriétaire
   (fiche Google Business, horaires, code postal, Page Facebook).
5. **Résultats bruts des épreuves IA** (axe E) : les requêtes posées, les réponses obtenues citées
   littéralement, la date et l'outil utilisé.
6. **Méthode et limites** : outils employés, versions, dates et lieu des mesures, et ce que vous
   n'avez **pas** pu vérifier. Cette section est obligatoire. Un audit qui ne dit pas ses angles
   morts n'est pas vérifiable.

## 9. Deux pièges à éviter

- **Ne confondez pas « présent » et « efficace ».** Un `FAQPage` déclaré mais dont les réponses ne
  sont pas visibles sur la page ne sert à rien. Un `llms.txt` qui existe mais contredit le site
  nuit. Jugez l'effet, pas la case cochée.
- **Ne récitez pas une check-list générique.** On ne veut pas « ajoutez des données structurées » :
  on veut « sur telle URL, tel nœud manque tel champ, voici la ligne, voici la conséquence sur telle
  requête ». Tout conseil qui pourrait s'appliquer tel quel à n'importe quel site sera ignoré.
