cahier de conception & implémentation
0) Finalité & principes

But : diagnostiquer, uniquement sur le programme de Première, le niveau de maîtrise des pré-requis indispensables pour une Terminale (spécialité) sereine : dérivation/variations, exponentielle/log, modélisation par fonctions, suites & récurrence, géométrie plane repérée, proba-stats descriptives, logique.

Livrables :

Questionnaire (ci-dessus) + mini-exercices pondérés,

Profil par domaines + radar,

Bilan texte (diagnostic + plan de remédiation),

PDF LaTeX (XeLaTeX) + HTML LaTeX (KaTeX).

Pourquoi ces pré-requis : ils conditionnent l’entrée en Terminale spécialité (analyse approfondie, combinatoire/dénombrement, proba plus exigeantes, géométrie de l’espace). Pour des trajectoires Complémentaires/Expertes, ils sécurisent la modélisation & le calcul qui seront exploités plus loin.

1) Structure du questionnaire & barème

40 Q + 3 mini-exercices ; 70 pts.

Poids renforcé (2–3) sur : variations/dérivation, expo/log, suites récurrentes (pré-requis prioritaires Terminale).

Aucun contenu de Terminale (pas d’intégrales, de complexes, de matrices, d’espace).

2) Schémas & fichiers
/data/qcm_premiere_for_terminale_maths.json     # ce fichier
/data/pedago_survey_maths_terminale.json    # pour la première partie du volet 2
/data/pedago_survey_commun.json    # pour la deuxième partie du volet 2
/lib/scoring/math_qcm_scorer.ts                 # ré-usage (Seconde→Première) adapté domaines
/lib/pdf/templates/bilan_terminale_maths.tex    # gabarit XeLaTeX (copie adaptée Première→Terminale)
/server/graphics/radar/buildRadarPng.ts         # identique


3) Rendu HTML & PDF

HTML : KaTeX (@matejmazur/react-katex, remark-math, rehype-katex) — rendu propre SSR.

PDF : gabarit bilan_terminale_maths.tex (XeLaTeX), insertion `radar
