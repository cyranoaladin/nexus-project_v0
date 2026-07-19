# Pré-rentrée 2026 — checklist propriétaire

> NON PUBLIC — document interne de revue, sans valeur d’approbation tant que `owner-approval.json` n’est pas complété et validé par le vérificateur.

## Références à relever

- [ ] `REPO_SHA` contrôlé.
- [ ] `SNAPSHOT_SHA256` contrôlé.
- [ ] `GENERATOR_SHA256` contrôlé.
- [ ] `reviewManifestSha256` copié sans modification depuis `owner-approval.template.json`.
- [ ] Aucun hash n’a été saisi ou recalculé manuellement.

## PDF publics

- [ ] `NexusReussite_PreRentree2026_Essentiel_PUBLIC.pdf`
- [ ] `NexusReussite_PreRentree2026_Planning_PUBLIC.pdf`
- [ ] `NexusReussite_PreRentree2026_Programme_Seconde_PUBLIC.pdf`
- [ ] `NexusReussite_PreRentree2026_Programme_Premiere_PUBLIC.pdf`
- [ ] `NexusReussite_PreRentree2026_Programme_Terminale_PUBLIC.pdf`
- [ ] `NexusReussite_PreRentree2026_Tarifs_PUBLIC.pdf`

Pour chaque PDF :

- [ ] titre, version, date, campaignId, classification et sourceRepoSha visibles ;
- [ ] aucun texte coupé, chevauché, orphelin ou illisible ;
- [ ] footer et compteur corrects sur chaque page ;
- [ ] URL, téléphone, email et QR corrects ;
- [ ] aucune note interne, promesse ou condition non approuvée.

## HTML accessibles

- [ ] `NexusReussite_PreRentree2026_Essentiel_PUBLIC.html`
- [ ] `NexusReussite_PreRentree2026_Planning_PUBLIC.html`
- [ ] `NexusReussite_PreRentree2026_Programme_Seconde_PUBLIC.html`
- [ ] `NexusReussite_PreRentree2026_Programme_Premiere_PUBLIC.html`
- [ ] `NexusReussite_PreRentree2026_Programme_Terminale_PUBLIC.html`
- [ ] `NexusReussite_PreRentree2026_Tarifs_PUBLIC.html`

Pour chaque HTML :

- [ ] ordre de lecture et hiérarchie des titres cohérents ;
- [ ] en-têtes de tableaux explicites ;
- [ ] navigation clavier et focus visibles ;
- [ ] liens utilisables ;
- [ ] langue française et texte sélectionnable.

## Visuels sociaux

- [ ] `NexusReussite_PreRentree2026_Feed_1080x1350_PUBLIC.png`
- [ ] `NexusReussite_PreRentree2026_Story_1080x1920_PUBLIC.png`
- [ ] `NexusReussite_PreRentree2026_Flyer_NB_1080x1350_PUBLIC.png`
- [ ] `NexusReussite_PreRentree2026_VisuelsSociaux_AltText_PUBLIC.json`
- [ ] aucune coupe, débordement ou texte trop petit ;
- [ ] variante N&B compréhensible sans la couleur ;
- [ ] textes alternatifs fidèles et sans nouvelle affirmation métier.

## Contenu métier

- [ ] 12 modules et 60 séances présents.
- [ ] Seconde : initiation informatique, algorithmique et SNT, jamais EDS NSI.
- [ ] Première : profils Maths EDS/hors EDS et EAF générale/technologique corrects.
- [ ] Terminale : spécialités conservées et options de mathématiques correctes.
- [ ] Physique-Chimie présentée comme théorique et méthodologique, sans promesse de laboratoire.
- [ ] adaptation au profil déclaré visible dans les brochures.
- [ ] planning vérifié par classe et semaine.
- [ ] prix `480 / 900 / 1 350 / 1 800`.
- [ ] acomptes `140 / 270 / 410 / 540`, sans mention de 30 %.
- [ ] CTA exact : « Se pré-inscrire ou demander un conseil ».
- [ ] pré-inscription sans paiement, sans réservation de place ni contrat formé.
- [ ] dossier privé absent et statut juridique bloqué clairement indiqué.

## Décision

- [ ] Copier `outputs-v5-canonical/AUDIT/GOVERNANCE/owner-approval.template.json` vers `owner-approval.json`.
- [ ] Choisir explicitement `APPROVED` ou `REJECTED`.
- [ ] Renseigner l’identité, le rôle, la date et la référence de décision.
- [ ] Consigner chaque réserve dans `findings`; ne pas approuver avec une réserve non résolue.
- [ ] Relancer le vérificateur et conserver `release-decision.json`.

La décision propriétaire ne débloque pas le dossier privé et ne remplace pas une validation juridique.
