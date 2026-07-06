# Lot 1-quater — Routes publiques sensibles

## Routes revues

| Route | Statut après lot | Décision |
| --- | --- | --- |
| `/api/assessments/submit` | P1 | Zod + rate limit présents ; reste public sensible tant que token/session non arbitré |
| `/api/bilan-gratuit` | P1 | Sortie durcie par lots précédents ; dette produit/RGPD car création de comptes inactifs |
| `/api/bilan-gratuit/dismiss` | P2 | Payload optionnel strict, auth parent |
| `/api/stages/[stageSlug]/inscrire` | P1 | Params/body Zod + rate limit ; reste public sensible |
| `/api/student/activate` | P1 | Activation publique sensible par token |
| `/api/lamis/teacher-report` | P1 | Zod + rate limit ; statut public pédagogique à requalifier |

## Réserves

Les routes publiques sensibles ne doivent pas être déclarées OK par statique. Elles requièrent une décision produit/RGPD et, pour certaines, token signé/session ou mécanisme anti-abus renforcé.
