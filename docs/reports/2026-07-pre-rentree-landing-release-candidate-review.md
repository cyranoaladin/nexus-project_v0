# Revue release candidate — Landing Pré-rentrée 2026

## Date et statut

12 juillet 2026, fuseau `Africa/Tunis`.

SHA audité : `01d989eb0ac2dc96bd84001858c584cc61c97503`.

Branche de revue : `review/pre-rentree-2026-landing-rc`.

Verdict technique de la landing : fonctionnellement prête. Verdict de preview : `BLOCKED_BY_RUNTIME_SECURITY` tant que Next.js `15.5.12` n'est pas mis à niveau vers une version corrigée et revalidée. L'audit runtime signale notamment des vulnérabilités hautes de déni de service sans authentification et de contournement Middleware/Proxy sur les applications App Router ; l'ensemble des avis Next.js observés exige au minimum `15.5.18`.

## Périmètre

La revue couvre les 58 fichiers modifiés entre le contrat `8db358926` et la landing `01d989eb0` : page canonique, redirection, configurateur, résumé, planning, programmes, tarifs, FAQ, conditions, préremplissage bilan, WhatsApp, analytics, accès publics, SEO, sitemap, tests et documents actifs. Elle n'étend pas l'architecture, Prisma, le paiement, les dashboards ou les API.

## Données produit et planning

- 12 modules : 4 par niveau et 6 par semaine.
- 60 séances de deux heures : 5 séances consécutives par module, sur 10 jours de cours.
- Aucun cours les 22 et 23 août.
- Charge maximale vérifiée : 4 heures par élève et par jour, 6 heures par rôle enseignant et par jour, 2 salles simultanées.
- Aucune collision de niveau, de salle logique ou de ressource Mathématiques/NSI.
- Les 45 configurations non vides niveau × combinaison de matières ont été vérifiées par test : dates de présence, horaires, séances, volume et pack.

## Tarifs et conditions commerciales

Les quatre packs sont résolus depuis le catalogue canonique, sans montant dans les composants : 10/20/30/40 heures, respectivement 480/900/1 350/1 800 TND par élève, avec acomptes 140/270/410/540 TND et soldes 340/630/940/1 260 TND. Aucune remise automatique, Carte Nexus, promotion, disponibilité, prix barré ou paiement en ligne n'est appliqué.

La page indique : ouverture à trois élèves, maximum cinq, décision le 10 août à 18:00, pré-inscription non confirmante, absence de blocage sans acompte, remboursement intégral si Nexus n'ouvre pas, report après accord écrit, aucune conversion automatique en cours individuel et conditions communiquées avant confirmation. L'alignement contractuel final des conditions de campagne avec les CGV reste une validation propriétaire préalable à confirmation commerciale.

## Revue pédagogique

Les 12 modules et 60 séances ont été relus. La progression sur cinq séances est réalisable sans promesse de couverture annuelle ni garantie de résultat. Les terminologies Seconde, Première et Terminale sont cohérentes avec les profils déclarés.

Corrections effectuées dans les sources de contenu :

- clarification dans le hero de l'initiation informatique, algorithmique et SNT en Seconde ;
- suppression d'une formulation pouvant laisser croire à des groupes Maths Première séparés automatiquement ;
- adaptation de la séance EAF Première à la voie déclarée : dissertation ou contraction de texte ;
- explicitation de la validation pédagogique des variantes Maths et EAF.

## Conversion et contact

- Les liens « Consulter le programme » ouvrent désormais le module du niveau réellement sélectionné, sans lien interactif imbriqué dans un choix.
- Le préremplissage bilan valide strictement programme, pack, niveau, matières et profil ; il refuse les incohérences et ne lit aucun prix de l'URL.
- Le profil et le contexte normalisés sont visibles, modifiables et conservés par l'API existante, sans nouvelle API ni donnée libre issue de l'URL.
- Le message WhatsApp utilise la source de contact officielle et des libellés parents, sans identifiant de pack interne, PII ni numéro codé dans un composant.
- L'adresse pédagogique est résolue depuis la source légale canonique.

## SEO, analytics et accessibilité

- Un H1, title et description contractuels, canonical unique, OpenGraph/Twitter et `FAQPage` exacts.
- Route canonique présente une fois dans le sitemap ; route courte absente et redirigée en 308.
- La page view est émise une fois. Les sélections de voie, profil Maths/EAF, spécialités et option de Mathématiques émettent des codes normalisés sans PII.
- Fieldsets, legends, accordéons, onglets, `aria-live`, focus et cibles tactiles vérifiés.
- Les onglets planning et programmes déplacent maintenant effectivement le focus avec les flèches, Home et End.
- Analyse axe E2E : aucune violation sérieuse ou critique.
- Parcours utilisable à 200 %, 390 px et 320 px, sans débordement horizontal.

## Performance

La route reste statique et majoritairement rendue serveur. Aucun fetch client du catalogue, import client du pricing canonique ou du manifeste brut, nouvelle dépendance ou chargement réseau en cascade n'a été introduit.

- Taille route : `9.84 kB`.
- First Load JS : `137 kB`.
- Écart par rapport au build d'implémentation : environ `+0.29 kB` sur la route, First Load JS inchangé.
- Dépendances principales : runtime partagé Next.js/React, configurateur, planning/programmes, analytics typé et helper WhatsApp existants.

## Résultats visuels

Les captures desktop 1440×1000, tablette 768×1024, mobile 390×844, mobile 320×800, hero, configurateur vide/deux/quatre matières, trois plannings, programme, FAQ et CTA final ont été régénérées dans `/tmp/nexus-pre-rentree-2026-evidence` et inspectées. Aucun chevauchement, texte tronqué, contenu masqué ou scroll horizontal n'a été observé. La densité mobile est élevée mais reste lisible et actionnable ; aucune refonte n'est justifiée avant preview.

## Tests et preuves

Commandes exécutées avec code de sortie préservé :

- `npm ci` : 0 ;
- `npm run typecheck` : 0 ;
- tests ciblés campagne/pricing/prefill/composants/analytics : 0, 171 tests ;
- E2E Chromium Pré-rentrée : 0, 11 tests, aucun skip ;
- `npm run build` avec secret éphémère : 0, 144 pages statiques ;
- serveur standalone et smoke HTTP : pages ciblées 200, redirection courte 308 ;
- `npm audit --omit=dev --json` : 1, 17 vulnérabilités runtime déclarées, dont 9 hautes, 7 modérées et 1 faible ;
- `git diff --check` : 0.

Les derniers gates globaux sont consignés dans le rapport final de l'agent après exécution sur le commit documentaire.

## Défauts corrigés

- P0 : aucun défaut fonctionnel propre à la landing trouvé.
- P1 : mauvais module possible après clic depuis Première/Terminale ; contexte de profil perdu au bilan ; formulation pédagogique ambiguë ; navigation clavier incomplète ; message WhatsApp trop technique.
- P2 campagne : adresse rendue depuis une source canonique ; couverture explicite des 45 configurations ; analytics des profils pédagogiques complété ; documents historiques marqués comme supersédés.

## Défauts non bloquants et risques

- Les coûts enseignants et salles restent `OWNER_INPUT_REQUIRED` ; la pré-inscription peut rester ouverte, mais pas la confirmation automatique ni le paiement.
- Les conditions commerciales de campagne doivent être validées par le propriétaire avant toute confirmation de place.
- Les captures du programme ouvert incluent la barre de navigation fixe dans leur cadrage d'élément ; le rendu réel et le parcours ne masquent pas le titre.
- Les advisories indirectes `nodemailer`, `tar`, `prisma`, `ws` et `form-data` n'ont pas de chemin exploitable identifié dans cette landing statique. Elles restent à traiter dans la maintenance dépendances.
- Next.js `15.5.12` est directement concerné par des avis élevés App Router accessibles sans authentification. Aucune correction automatique n'a été appliquée afin de respecter le périmètre et d'éviter une régression non validée.

## Conditions de preview

1. Mettre Next.js à niveau vers une version corrigée compatible, au minimum `15.5.18` pour les avis observés, sans `npm audit fix` automatique.
2. Rejouer typecheck, lint, tests globaux, E2E Pré-rentrée, build et smokes sur cette mise à niveau.
3. Obtenir la validation propriétaire courte ci-dessous. Les points enseignants/salles peuvent rester non confirmés uniquement si le parcours demeure strictement en pré-inscription.

## Checklist de validation propriétaire

- [ ] Dates validées.
- [ ] Horaires validés.
- [ ] Matières validées.
- [ ] Tarifs validés.
- [ ] Adresse validée.
- [ ] WhatsApp validé.
- [ ] Enseignants disponibles, ou page maintenue en pré-inscription.
- [ ] Salles disponibles, ou page maintenue en pré-inscription.
- [ ] Conditions commerciales validées.
- [ ] Visuels validés.

## Rollback

Les corrections RC sont isolées en trois commits maximum sur `review/pre-rentree-2026-landing-rc`. Aucun commit antérieur n'est réécrit. Le rollback consiste à ne pas intégrer ces commits ; aucun état distant, schéma ou donnée n'a été modifié.
