# Checklist Go Live — DNB Dernière ligne droite v2
## Résultat : ✅ GO LIVE READY (vérifié le 2026-06-17)

## Structure et déploiement
- [x] `index.html` déposé dans `/srv/nexusreussite/docs_DNB/derniere-ligne-droite/`
- [x] Page accessible en HTTPS : `https://nexusreussite.academy/docs_DNB/derniere-ligne-droite/`
- [x] SHA256 local identique au SHA256 déployé (`5377ab13…`)
- [x] Aucune ressource 404 (vérifié E2E)
- [x] Favicon présent

## JavaScript — aucune erreur console
- [x] Console DevTools vide au chargement (vérifié E2E : 0 erreur)
- [x] Console vide après interaction complète (parcours 30 étapes)
- [x] Pas de `undefined` ou `NaN` affiché dans l'UI

## Saisie du nom élève
- [x] Modale s'affiche au premier chargement
- [x] Nom vide → message d'erreur visible, pas de démarrage (vérifié E2E étape 6-7)
- [x] Nom valide → modale fermée, chip affiché (vérifié E2E étape 9-10)
- [x] Accents acceptés : "Élève Test", "Ben Rhouma" (vérifié E2E + unit)
- [x] Espaces acceptés : "Neil ZAYANE" (vérifié E2E + unit)

## Sauvegarde et restauration
- [x] Progression sauvegardée automatiquement (indicateur "Sauvegardé" vérifié E2E)
- [x] Rechargement → nom et progression restaurés (vérifié E2E étape 25-28)
- [x] Deux élèves → deux états indépendants (vérifié E2E multi-élève)
- [x] Changer d'élève → historique du premier intact (vérifié E2E multi-élève étape 7-8)
- [x] JSON corrompu → reset propre, pas de crash (vérifié E2E robustesse)
- [x] schemaVersion incompatible → migration propre (vérifié unit + E2E)
- [x] localStorage indisponible → bannière + page utilisable (vérifié E2E)
- [x] QuotaExceededError géré (vérifié unit + check statique)

## Quiz et autocorrection
- [x] 10 automatismes corrigés — toutes les réponses vérifiées (vérifié unit 30 tests)
- [x] Mission pourcentages : 64 / 57,6 / 28 acceptés
- [x] Mission PGCD/PPCM : sélecteur + 18 / 4 / 5
- [x] Mission algèbre : 2(x+6), équations, fonctions, Scratch
- [x] Mission géométrie : 10 cm, 48π, sinus
- [x] Réponse vide → incorrect (vérifié unit)
- [x] Réponse avec virgule française → acceptée (vérifié unit)

## Flashcards
- [x] 8 cartes affichées
- [x] Retournement (flip) fonctionne (vérifié E2E étape 15)
- [x] "Je maîtrise" → compteur mis à jour (vérifié E2E)
- [x] État restauré après reload

## Rédactions papier
- [x] 4 tâches cochables
- [x] Cocher → XP + compteur
- [x] "Voir un modèle" → modèle affiché
- [x] Cases cochées restaurées après reload

## Bilan final
- [x] "Générer le bilan" → bloc visible avec nom élève (vérifié E2E étape 20)
- [x] Bilan contient : nom, date, score, XP, badges, modules, réponses papier (vérifié E2E étape 21)
- [x] Exportation JSON avec nom dans le filename (vérifié E2E étape 23)
- [x] Exportation CSV valide (vérifié E2E étape 24)
- [x] Copie texte pour le professeur (vérifié E2E étape 22)

## Reset
- [x] Bouton reset → dialog de confirmation affiché (vérifié E2E étape 29)
- [x] Annuler → rien ne change
- [x] Confirmer → XP remis à 0 (vérifié E2E étape 30)
- [x] Reset élève 1 n'efface pas élève 2 (vérifié E2E multi-élève + unit)

## Accessibilité
- [x] aria-modal sur la modale (vérifié check statique)
- [x] aria-live sur toast XP (vérifié check statique)
- [x] aria-label sur les inputs de quiz (vérifié check statique)
- [x] Dialog de confirmation avant reset (vérifié E2E)
- [x] Indicateur "✓ Sauvegardé" visible après activité (vérifié E2E)
- [x] focus-visible CSS (vérifié check statique + E2E)

## Responsive
- [x] Mobile 390px : aucun débordement horizontal (vérifié E2E 3 projets)
- [x] Mobile : boutons ≥ 36px (vérifié E2E)
- [x] Mobile : flashcards lisibles (vérifié E2E)
- [x] Mobile : input réponse > 100px (vérifié E2E)
- [x] Tablet 768px : page utilisable (vérifié E2E Tablet Chromium)

## Mode impression
- [x] topbar masquée (`@media print`)
- [x] `.only-print` / `.no-print` présents (vérifié check statique)
- [x] Nom élève dans l'en-tête imprimé (`printStudentName`)

## Sécurité et données
- [x] Aucune requête externe (vérifié check statique — 0 CDN)
- [x] Données stockées uniquement en local
- [x] Phrase explicative dans le bilan sur les limites localStorage

## Tests automatisés
- [x] `npm run check` → 60/60 ✅
- [x] `npm run test:unit` → 165/165 ✅
- [x] `npm run test:e2e` → 63/63 ✅ (Desktop + Mobile + Tablet Chromium)

## Documentation
- [x] `README_DEPLOIEMENT.md` à jour avec phrase obligatoire localStorage
- [x] `CHECKLIST_GO_LIVE.md` cochée
- [x] `TEST_REPORT.md` créé avec toutes les preuves
