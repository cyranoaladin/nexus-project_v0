# N1 — correctif adresse (technique) et N2 — « Réponse sous 24h » (décision propriétaire)

Date : 2026-07-29

## N1 — Centre Urbain Nord / Mutuelleville — corrigé, vérifié

Branche : `fix/navbar-mobile-contact-panel-address` (poussée, non fusionnée, non déployée).

**Correctif** : `components/layout/CorporateNavbar.tsx:533`, panneau de contact rapide du menu mobile — remplacé `Centre Urbain Nord, {LEGAL.addresses.siege.city}` (littéral en dur) par `{LEGAL.addresses.pedagogique.full}` (déjà égal à `"Mutuelleville, Tunis"` dans `lib/legal.ts`, source canonique, aucune nouvelle chaîne en dur).

**Vérification par l'auditeur, avant/après, avec un faux positif corrigé au passage** :

- Avant correctif : 21 occurrences de `siege-centre-confusion`, toutes avec le même contexte (le panneau mobile bugué).
- Après correctif seul (script d'audit non modifié) : **15 occurrences restaient** — pas le bug d'origine, mais le bloc « Coordonnées » de `CorporateFooter.tsx`, qui affiche **correctement** les deux adresses, distinctement labellisées (« Siège social administratif » / « Centre d'accompagnement pédagogique »). C'était un faux positif de l'auditeur, pas un défaut du site — exactement la présentation qu'AGENTS.md §2 exige.
- Motif `siege-centre-confusion` affiné (`docs/audits/...`, commit sur `feat/bilan-gratuit-audit`) : ne signale plus une mention de « Centre Urbain Nord » si « Mutuelleville » apparaît dans une fenêtre de 200 caractères autour — ce qui couvre exactement la présentation à deux blocs du footer.
- Après les deux correctifs (navbar + motif d'audit) : **0 occurrence de `siege-centre-confusion`** sur les 37 pages, vérifié par exécution réelle contre un serveur local.

Le siège reste intact dans le bloc légal du footer (`CorporateFooter.tsx:110`) et sur `/contact` (`ADMIN_ADDRESS = LEGAL.addresses.siege.full`) — non touchés. Test de non-régression ajouté : `__tests__/components/corporate-navbar.test.tsx`, nouveau cas asserte Mutuelleville présent, Centre Urbain Nord absent dans le panneau mobile. 5/5 tests navbar passent.

## N2 — « Réponse sous 24 h » — décision propriétaire, rien touché

8 occurrences réelles confirmées (voir triage précédent), deux textes distincts :
1. « Réponse sous 24 h ouvrées. » — bloc CTA/footer partagé, 6 pages.
2. « Être rappelé(e) sous 24 h » — CTA de rappel, `/bilan-gratuit` et `/contact`.

**Fait à rappeler** : aujourd'hui, **aucune notification staff ne part** lorsqu'une demande de bilan arrive via `/api/bilan-gratuit` — l'e-mail envoyé est `sendWelcomeParentEmail` au *parent*, pas une alerte interne à l'équipe (confirmé dans l'audit initial de la mission Bilan gratuit ; le mécanisme de notification interne, `captureContactLead()`, n'est utilisé aujourd'hui que dans le lot HOTFIX de la branche `fix/bilan-gratuit-account-enumeration`, pour le seul cas « compte existant »). La promesse « réponse sous 24h » n'est donc pas seulement non mesurée — **rien dans le système ne déclenche activement le compte à rebours qu'elle sous-entend.**

**Deux issues, avec leur coût** :

a. **La promesse devient mesurable** (Lot A2, hors périmètre de ce lot) — construire une interface staff affichant un délai de première réponse par demande entrante, mesuré depuis la soumission jusqu'au premier contact humain enregistré. Coût : nouvelle fonctionnalité, nouveau champ de suivi (probablement sur `ContactLead` ou équivalent), une interface staff à concevoir, un SLA réel à définir et faire respecter opérationnellement. Ne peut pas être fait sans le Lot A1 (capture de lead) déjà en attente de validation.

b. **La promesse disparaît des CTA en attendant** — retirer « Réponse sous 24 h ouvrées » et « Être rappelé(e) sous 24 h » des deux composants concernés jusqu'à ce que (a) existe. Coût : correctif de texte à très faible risque technique, mais c'est une décision commerciale (retirer un argument de réassurance visible sur 6+ pages), pas un correctif de bug — hors périmètre de ce que cet audit peut trancher seul.

Rien modifié. Décision au propriétaire.
