cahier de conception & implémentation
0) Finalité & principes

But : diagnostiquer, uniquement sur le programme de Seconde, la maîtrise des pré-requis pour réussir la Première Physique-Chimie : mesures & incertitudes, constitution/transformations de la matière, mouvement & interactions, ondes & signaux, bases microscopiques.

Livrables : (1) questionnaire ci-dessus (40+3) ; (2) profil domaines + radar ; (3) bilan texte (forces/faiblesses/plan d’action) ; (4) PDF LaTeX (XeLaTeX) + HTML (KaTeX).

Raison : ces bases conditionnent les attendus de Première (suivi d’évolution d’un système, bilans de matière simples, énergie, statique des fluides, aspects énergétiques électriques, ondes). On n’évalue pas de notions Première (ex. Coulomb, avancement avancé, titrage) dans le QCM.

1) Périmètre évalué (Seconde → pré-requis Première)

Constitution de la matière : corps purs/mélanges, solutions, concentration en masse.

Transformations : changements d’état, combustion, dissolution ionique, réactif limitant simple, bilan d’atomes.

Mouvement & interactions : vecteurs, vitesse moyenne, principe d’inertie, poids.

Ondes & signaux : nature du son, vitesse dans l’air, fréquence, décibels (qualitatif), applications.

Mesures & incertitudes : histogramme, moyenne, écart-type (sens), choix de verrerie, écriture du résultat.

Chimie microscopique : ions, cations/anions, stabilité des gaz nobles, notations usuelles.
(Tous explicitement dans le référentiel Seconde ; l’utilisation du référentiel Première sert à prioriser sans être interrogé.)

2) Données & fichiers
/data/qcm_seconde_for_premiere_pc.json     # (ce fichier)
/data/pedago_survey_pc_premiere.json    # (pour la première partie du volet 2)
/data/pedago_survey_commun.json     # (pour la deuxième partie du volet 2)

/lib/scoring/pc_qcm_scorer.ts              # agrégats domaines + seuils
/server/graphics/radar/buildRadarPng.ts    # Chart.js → PNG (PDF)
/lib/pdf/templates/bilan_premiere_pc.tex   # XeLaTeX (élève/parent/nexus)

3) Rendu HTML (LaTeX propre) & PDF

HTML : katex + @matejmazur/react-katex + remark-math + rehype-katex.

npm i katex @matejmazur/react-katex remark-math rehype-katex

import 'katex/dist/katex.min.css';
import TeX from '@matejmazur/react-katex';
export const Latex = ({children,block=false}:{children:string;block?:boolean}) =>
  block ? <TeX block>{children}</TeX> : <TeX>{children}</TeX>;


PDF : template XeLaTeX ; insertion du radar.png ; texte structuré ; sanitize-latex pour champs libres.

4) Scoring & niveaux

Score question = weight si juste, sinon 0.

Scores domaine (%) = points obtenus / points max domaine.

Seuils : <50% faible ; 50–74% moyen ; ≥75% solide.

Sorties : JSON { domains:[...], global:{percent, level} }, radar (labels/données 0–100).

5) Workflow produit

Init : /bilan/initier → crée Bilan(status=PENDING) (matière=PC, niveau=Première).

Questionnaire : récup. qcm_seconde_for_premiere_pc.json (+ Volet 2 “pédagogique commun” si non déjà saisi, réutilisable).

Soumission : POST /api/bilan/[id]/submit-answers → calcule scores, indices Volet 2, radar.png, reportText/summaryText (IA), stocke.

Restitution : page résultats (radar HTML + synthèse + CTA PDF/Email).

PDF : GET /api/bilan/pdf/[id]?variant=standard|parent|eleve|nexus.

6) Endpoints (Next.js)

GET /api/bilan/questionnaire-structure → charge Volet 1/2.

POST /api/bilan/[id]/submit-answers → scoring + indices + offres (si logique commerciale) + génération textes.

POST /api/bilan/generate-report-text|generate-summary-text → RAG/IA (dev: gpt-4o-mini, prod: gpt-4o).

GET /api/bilan/pdf/[id] → compile XeLaTeX (radar inclus).

7) UX

Question par bloc, LaTeX en affichage bloc, options aérées, navigation clavier, autosave, prévention abandon.

Résultats : radar, forces/faiblesses par domaine, plan d’action (fiches/TP conseillés), CTA PDF/email.

8) Tests

Unitaires : normalisation barèmes, calcul %, seuils, sérialisation .tex.

Intégration : endpoints GET/POST (structures, agrégats, PDF=200).

E2E : parcours complet déterministe (Playwright).

Qualité contenu : relecture prof (PC) + chef de projet (UX).

9) Sécurité & déploiement

RBAC : élève/parent/coach/admin ; logs sans PII.

Rate-limit : submit-answers, generate*, pdf.

CI : tests unit/int/E2E + job XeLaTeX (cache TeXlive) ; variables d’env. validées (Zod).

10) Check-list d’acceptation

 0 question hors Seconde (PC).

 Pondération renforcée sur pré-requis clés (dissolution/concentration, réactif limitant, inertie, son, incertitudes).

 LaTeX propre en HTML (KaTeX) et intact en PDF (XeLaTeX).

 Radar généré + inséré.

 Bilan texte complet + plan d’action.

 Tests verts ; secrets non versionnés.
