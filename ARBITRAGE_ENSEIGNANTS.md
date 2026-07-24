# Arbitrage éditorial — statut des enseignants

## Règle déclenchée

Le gate `qualifications` est ouvert : aucune preuve individuelle contrôlée ne permet encore d'affirmer publiquement un statut « certifié » ou « agrégé ». La règle appliquée est donc : aucun nom, diplôme ou statut enseignant non prouvé dans les supports commerciaux.

## État des suppressions

| Fichier / sortie | Formulation retirée ou désactivée | Formulation active |
|---|---|---|
| `app/HomePageClient.tsx` — preuves | « Enseignants agrégés et certifiés, spécialistes de l'épreuve » | « Enseignants expérimentés, en exercice dans le système français » |
| `app/HomePageClient.tsx` — FAQ | « Nos enseignants sont agrégés et certifiés de l'enseignement français à l'étranger… » | Expérience dans le système français ; affectation conditionnée aux compétences et disponibilités contrôlées |
| `app/equipe/layout.tsx` — description, keywords, OpenGraph | « professeurs Agrégés et Certifiés » | « enseignants expérimentés, en exercice dans le système français » |
| `tools/pdf-generator/generate_all_pdfs.py` — programme | « enseignant certifié ou agrégé de l'Éducation nationale française, en exercice » | `ENSEIGNANT_STATUT_PUBLIE` |
| `tools/pdf-generator/generate_all_pdfs.py` — dossier/flyer | « enseignants certifiés ou agrégés… » | « enseignants expérimentés, en exercice dans le système français » |
| PDF régénérés et supports dérivés | Toute mention certifié/agrégé | Formulation active prudente ci-dessus |

La variante historique n'est pas détruite :

`ENSEIGNANT_STATUT_COMMERCIAL = "enseignants certifiés ou agrégés de l'Éducation nationale française, en exercice"`

Elle reste désactivée dans le générateur et n'est injectée dans aucun support.

## Options de direction

1. **Restaurer après preuve** : contrôler individuellement le statut des personnes effectivement affectées, enregistrer la preuve, lever le gate `qualifications`, puis régénérer les supports sur un SHA identifié.
2. **Maintenir la formulation prudente** : conserver « Enseignants expérimentés, en exercice dans le système français ».

## Décision direction — R4 (2026-07-23)

**Option 1 retenue sur le support commercial de vente (Tarifs).** La mention **« enseignants certifiés ou agrégés de l'Éducation nationale française, en exercice »** est **rétablie** : c'est le différenciateur central de Nexus, revendiqué par la direction, qui assume la responsabilité de la preuve.

Le **Planning** (document opérationnel : salles, créneaux, organisation) garde la formulation prudente « enseignants expérimentés, en exercice dans le système français ». Le **Flyer** ne porte aucune mention de statut (format factuel minimal ; il ne l'a jamais portée historiquement — son absence n'est pas une régression).

Distinction actée (corrige la confusion d'origine) :
- Le **STATUT** certifié/agrégé est une **qualification collective** de l'équipe. Il ne nomme personne → compatible avec l'anonymat nominatif maintenu.
- Le **NOM** d'un enseignant reste **interdit** en public (rôles abstraits).
- Le filtre fautif était le test `assert "enseignants certifiés" not in ...` (`test_legacy_pdf_generator_contract.py`), qui bannissait la phrase de statut comme « claim non prouvé » : c'est le **filtre** qui a été corrigé (inversé pour vérifier la présence), pas le contenu.
- Le gate `teacher_qualification_evidence` porte sur l'affectation **individuelle**, pas sur la mention collective : il ne la bloque pas.

**Périmètre site marketing général** (HomePageClient, equipe, stages, premium) : ces surfaces portaient « Agrégés et Certifiés » avant dégradation (« remove fabricated trust claims / fail closed »). Leur restauration relève de la **même décision** mais constitue un périmètre distinct — **en attente d'arbitrage direction** avant application (impact production + tests e2e).

Tracé : `content/pre-rentree-2026/publication-decisions.owner.json → decisions.teacherStatusStatement`, `DEBTS.md`.
