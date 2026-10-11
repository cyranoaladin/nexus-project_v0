# Moteur générique de composition des diagnostics Nexus

Restauré le 2026-09-17 après un incident d'exposition publique du contenu opérationnel
(2026-09-16 — voir `SECURITY_AGENT_RULES.md` et le dépôt privé
`nexus-diagnostics-private`, `incident/2026-09-public-assessment-exposure/`). L'ancien
moteur, retiré avec le contenu, servait un catalogue d'instruments V2 et un schéma où la
lettre A/B/C/D d'un QCM était écrite à la rédaction — un défaut réel qui avait produit
sept bonnes réponses sur « A » sur huit QCM d'un même pilote. Ce moteur est une
réécriture propre, pas un cherry-pick : seule la logique de composition
authentiquement générique (gabarit LaTeX, contournement du bug de police WOFF/XeLaTeX,
compilation en trois passes) a été reprise ; la lecture du contenu est entièrement
neuve, pour le nouveau contrat sémantique.

## Ce dossier ne contient et ne doit jamais contenir

Aucun item réel, aucune banque réelle, aucune clé réelle, aucun support réel, aucune
correction coach réelle, aucun assemblage réel. Le contenu opérationnel vit
exclusivement dans `nexus-diagnostics-private`. Le scanner
`scripts/security/check-assessment-confidentiality.mjs` (racine du dépôt) refuse tout
contenu qui ressemblerait à un item vivant, y compris sous le nouveau schéma
(`options[]` + `correct_option_id`) — testé contre ce dossier avant chaque commit.

## Contrat de contenu

`schemas/diagnostics-content.schema.json` décrit ce que ce moteur sait rendre : un
« form » (instrument, version, form_id, sections, items typés QCM/réponse
courte/tâche ouverte/production). Un item QCM porte des options sémantiques sans
position — `scripts/qcm_position_assembler.py` assigne les lettres A/B/C/D par
round-robin déterministe au moment du rendu, jamais à la rédaction.

Testé exclusivement contre `__tests__/fixtures/diagnostic-demo/` (racine du dépôt), une
fixture entièrement fictive (univers non scolaire, aucune ressemblance avec un
contenu réel). `docs/diagnostics-engine/tests/test_render_form.py` exerce QCM,
réponse courte, tâche ouverte, production à grille, support extrait/code, absence de
fuite côté candidat, présence de la clé côté coach, reproductibilité octet à octet.

## Utilisation avec du contenu réel

Ce moteur seul ne peut construire qu'un PDF de démonstration à partir de la fixture
synthétique (`PUBLIC_ENGINE_ALONE_CAN_BUILD_LIVE_FORM=NO`, vérifié par
`test_moteur_seul_ne_construit_que_la_fixture`). Une release réelle combine :

```
ENGINE_COMMIT    — le commit de ce dépôt public au moment du build
CONTENT_COMMIT   — le commit de nexus-diagnostics-private fournissant le form.json
BANK_VERSION     — version sémantique de la banque privée utilisée
FORM_ID          — FORM_A, FORM_B, etc.
RELEASE_ID       — identifiant de la release
```

Le moteur public seul ne suffit jamais à reconstruire une release : il lui manque
toujours `CONTENT_COMMIT`. C'est volontaire.

## Compilation

```
python3 scripts/render_form.py <form.json> --out candidat.pdf --icone <image.png>
python3 scripts/render_form.py <form.json> --out coach.pdf --icone <image.png> --coach
```

Nécessite `xelatex`, `pandoc` n'est pas utilisé par ce chemin de composition (LaTeX
direct). `fc-match`/`fontconfig` doivent connaître Lato, EB Garamond et DejaVu Sans
Mono pour un rendu fidèle au gabarit ; à défaut, XeLaTeX replie sur des polices par
défaut sans échouer.
