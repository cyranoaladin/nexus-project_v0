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

## État retenu dans la PR #74

L'option 2 est active, conformément à l'instruction de ne pas publier de statut non prouvé. Ce choix technique n'est pas un GO commercial ; la direction conserve l'arbitrage final, mais aucune restauration ne peut précéder la preuve.
