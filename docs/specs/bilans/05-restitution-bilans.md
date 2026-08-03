# 05 — Restitution : les trois bilans

## §1. Principe

Un même `PositioningResult` produit **trois objets distincts**, pas trois mises en forme du même texte.
Ce ne sont pas trois niveaux de détail : ce sont trois destinataires avec trois besoins différents.

La génération est **déterministe et templatée**. Aucun appel LLM. La sélection des blocs
est faite par `lib/positionnement/restitution.ts` à partir des structures du moteur ;
les formulations viennent d'un catalogue de fragments versionné.

## §2. Bilan `ELEVE`

**Ton** : tutoiement, sobre, sans flatterie ni dramatisation. L'élève est traité comme quelqu'un
de capable qui a besoin d'informations exploitables.

**Contient**

1. Ce qui est solide — jusqu'à 3 nœuds de profil `MAITRISE`, formulés en compétences,
   pas en chapitres. « Tu sais isoler une inconnue dans une équation du premier degré. »
2. Ce sur quoi porter l'effort — les `PRIORITY_NODES_MAX` premiers nœuds prioritaires
   (spec 02 §9), chacun avec la `shortCorrection` de l'item le plus discriminant du nœud.
3. Micro-plan — 5 actions maximum, chacune : un verbe d'action, un objet précis,
   une durée réaliste. Rattachées quand c'est possible à une séance identifiée du stage.
4. Si `CALIBRATION_A_TRAVAILLER` — un bloc dédié sur la vérification et le contrôle de
   vraisemblance, présenté comme une compétence à acquérir, jamais comme un défaut.

**Ne contient pas** : `globalScore`, `groupBand`, comparaison à d'autres élèves,
classement, pourcentage global, appréciation de valeur sur la personne.

**Traitement particulier des `ERREUR_CONFIANTE`** : ne jamais écrire « tu étais sûr et tu t'es trompé ».
Formulation retenue : « Ce point a l'air acquis mais il ne l'est pas encore — c'est exactement
le type d'écart qui coûte cher en devoir surveillé. »

## §3. Bilan `PARENT`

**Ton** : vouvoiement, professionnel, exigeant, rassurant. Aucun ressort anxiogène.

**Contient**

1. Cadre — date de passation, matière, durée, nature du test. Une phrase disant explicitement
   qu'il s'agit d'un **positionnement**, pas d'une évaluation notée ni d'un pronostic.
2. Points d'appui — 2 à 3, qualitatifs.
3. Priorités observées — 2 à 3, formulées comme des repères diagnostiques, pas comme des
   manques ni comme un programme déjà arrêté.
4. Construction du stage — le format annoncé est fixe : cinq séances de deux heures en
   groupe réduit. Le contenu, l'ordre et la profondeur ne sont déterminés qu'après croisement
   des diagnostics du groupe constitué. Aucun module n'est annoncé comme décidé à l'avance.
5. Réserve de fiabilité, si `COUVERTURE_INSUFFISANTE` ou `PASSATION_EXPRESS` : mention explicite
   que le test n'a pas été mené à son terme et que les conclusions sont partielles.
6. Étape suivante — un CTA parmi la liste approuvée uniquement : « Être conseillé »,
   « Demander un bilan gratuit », « Écrire sur WhatsApp », « Voir les offres et tarifs ».

**Ne contient pas** : aucun score brut, aucun pourcentage, aucune bande de groupe, aucun nom
d'enseignant, aucun tarif écrit en dur (si un tarif apparaît, il vient des getters de `lib/pricing.ts`),
aucune projection de note ou de mention, aucune promesse de résultat.

Le document individuel `PARENT` ne remplace pas le plan de groupe. Le quatrième livrable
`GROUPE`, strictement interne à Nexus, agrège les FactSheets de trois à cinq élèves du même
pack et distribue les neuf nœuds sur 600 minutes de contenu. Il porte les noms et profils des
élèves et n'est transmis ni aux parents ni aux élèves.

**Interdits de formulation, testés automatiquement** : « garanti », « assuré »,
« 100 % », « taux de réussite », « rattrapage impossible », « il est urgent »,
« sans quoi », « risque d'échec », « professeur IA ». Liste complète :
`data/positionnement/lexique-interdit.json`.

## §4. Bilan `NEXUS` (interne)

Ton technique, brut, non diffusable.

Contient l'intégralité : `globalScore`, `calibrationIndex`, `coverage`, tous les nœuds avec
score et profil, tous les items avec réponse, confiance et temps, `flags`, `groupBand`,
`engineVersion`, `testVersion`.

Plus deux blocs d'aide à la décision :

- **Calibration de groupe** — bande recommandée, nœuds partagés avec les autres passations
  du même niveau et de la même session, pour composer des groupes homogènes.
- **Points de vigilance opérationnels** — passation express, couverture faible, temps aberrants,
  suspicion de passation par un tiers.

## §5. Pipeline PDF

Réutilise la **chaîne éditoriale unifiée existante** : source unique alimentant à la fois le site
et le pipeline PDF. Aucune seconde chaîne créée pour ce chantier.

```
PositioningResult ──restitution.ts──> BilanPayload (JSON structuré, sans HTML)
                                            │
                        ┌───────────────────┴───────────────────┐
                   rendu web (RSC)                      rendu PDF (chaîne existante)
```

`BilanPayload` est du contenu structuré, jamais du HTML ni du Markdown pré-rendu :
c'est ce qui garantit que le web et le PDF ne divergent pas.

Charte : navy sombre / ivoire / or discret. Vert réservé à la validation et à WhatsApp.
**Violet réservé à ARIA** — donc absent d'un bilan de positionnement, qui n'est pas un produit ARIA.

## §6. Revue humaine

`REQUIRE_HUMAN_REVIEW_PARENT = true` par défaut. Un bilan `PARENT` non revu n'est pas diffusable.
La revue est un acte tracé (`reviewedBy`, `reviewedAt`), pas une case cochée globalement.

Revue **obligatoire quelle que soit la configuration** si `COUVERTURE_INSUFFISANTE`
ou `PASSATION_EXPRESS` est levé.

## §7. Position d'ARIA

ARIA **complète** l'accompagnement humain, ne le remplace jamais.
Sur ce chantier : ARIA n'intervient ni dans le scoring, ni dans la rédaction des bilans.
Une éventuelle reformulation assistée reste hors périmètre, désactivée par défaut,
et resterait soumise à revue humaine avant diffusion.
ARIA ≠ Masterium. La plateforme EAF (`eaf.nexusreussite.academy`) est un système distinct,
sans interaction avec ce chantier.
