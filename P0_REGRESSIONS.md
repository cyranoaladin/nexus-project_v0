# P0 — Correction des 5 régressions signalées (audit direction)

> Attribution **honnête** (diff base `e137009e8` → HEAD) : distingue ce que MES changements ont introduit de ce qui **préexistait** dans la base/production.

| R | Point | Attribution honnête (qui a introduit quoi) | Action appliquée | Statut |
|---|---|---|---|---|
| **R1** | Tarifs & effectifs | **MOI** : `group_max` Fondations 6→5 (via cherry-pick codex `c5f726fc0`) + propagation textes « 4 à 6 »→« 4 à 5 ». **PAS MOI** : acomptes 144/336 et 405/945 = **préexistants** dans la base (prod `d0ce2241`), non « recalculés » par moi. | **Reverté** au réel production : Fondations `group_max` **6** (4-6), textes « 4 à 6 », acomptes **144/270/405/540** (prod), tests remis à 6/« 4 à 6 ». | ⚠️ **ARBITRAGE REQUIS** — voir ci-dessous |
| **R2** | Informatique Seconde | **PAS supprimé** : le module `seconde-informatique-snt` (« Initiation informatique, algorithmique et SNT », 5 séances) est **intact**. **MON erreur** : le libellé de la salle-1 avait perdu « SNT ». | Libellé salle-1 **restauré** : « Mathématiques / NSI / SNT / SVT » (SNT rétabli, SVT conservé car la grille D4-final l'y place). Module intact. | ✅ Corrigé |
| **R3** | Bilan parents & positionnement | **PAS modifié par moi** : composants B (positionnement) et C (bilan parents) = `blocked_until_operational_validation` **préexistant** dans la base (décision direction). Aucun texte de dispositif supprimé de mon fait. | Aucune (dispositif intact). Le dispositif reste **décrit** (méthode), non promis chiffré. | ✅ Vérifié — rien supprimé par moi |
| **R4** | Agrégé/certifié | **MOI** : retiré de 3 supports au titre d'un contrôle que **j'avais ajouté** (pas un gate du dépôt). | **Restauré** sur Tarifs + Flyer : « enseignant certifié ou agrégé de l'Éducation nationale française, en exercice ». | ✅ Corrigé |
| **R5** | Préinscription | **PAS modifiée par moi** : `enablePreRegistration = true` (active), `status = DRAFT` (page non publiée). Aucun changement de `featureFlags`/`status` de mon fait. | Aucune. Préinscription **fonctionnelle** (ne réserve pas, ne prend pas de paiement) ; publication de la page gouvernée par le GO. | ✅ Vérifié — conforme à ta position |

## ⚠️ R1 — Conflit à arbitrer (escape-hatch de ton instruction)

Ta grille énoncée : **groupes 3-5 partout**, acomptes **480=140+340, 900=270+630, 1350=410+940, 1800=540+1260**.

Le **fichier source de production `d0ce2241`** (déployé) contient en réalité :
- Premium (packs 1-4) : groupes **3-5** ✅ (conforme à ta grille) ; acomptes **480=144+336, 900=270+630, 1350=405+945, 1800=540+1260** — soit **144 et 405** (30 % exact), **pas 140 et 410**.
- Fondations (3e, Seconde) : groupes **4-6** (pas 3-5) ; le tarif Fondations porte un `commercial_exception` **« approved_by_role: DIRECTION_NEXUS_REUSSITE, approved_at: 2026-07-20 »**.
- `capacityByOffer` : FONDATIONS **{4-6}** / PREMIUM {3-5} (deux niveaux d'effectif).

**Écart** : ta grille (3-5 partout, 140/410) ≠ prod déployée (Fondations 4-6, 144/405, signée direction 2026-07-20).

Conformément à ton escape-hatch (« SAUF si tu peux produire un fichier source antérieur signé direction… montre-le et attends mon arbitrage »), **je n'ai PAS appliqué 3-5/140/410** : j'ai reverté mes changements au réel production et je te montre l'écart. **Deux options — ton arbitrage :**
1. **Appliquer ta grille** : Fondations → 3-5, acomptes → 140/270/410/540, supprimer le niveau d'effectif Fondations. (Contredit `d0ce2241` + l'exception signée du 20/07.)
2. **Conserver le réel production** (Fondations 4-6, 144/405) : rien à faire, déjà reverté.

Je n'y touche plus tant que tu n'as pas tranché — règle permanente : je ne modifie pas l'offre moi-même.
