# Analyse exhaustive — PDF Seconde

Source : /home/alaeddine/Téléchargements/Nexus_Bilan_Septembre_2026_Seconde.pdf (8 pages). Extraction complète : extraction.txt ; rendus inspectés : page-1.png à page-8.png. Aucun fichier applicatif modifié.

Comparaison : lib/espace/bilan-bank.json ; bilan-data.ts ; bilan-work.ts ; bilan-display.ts ; bilan-profiles.ts ; components/espace/student/BilanWorkbench.tsx ; BilanFamilyReport.tsx. État source au 07/10/2026.

## Page 1 — cadre, parcours, attentes

Consignes intégrales à préserver sémantiquement : bilan sans note, comprendre progrès/difficultés/besoins pour préparer la suite ; réponses avec ses mots sur septembre uniquement ; droit de dire ce qui aide et ce qui doit changer ; difficulté et avis critique ne sont pas des fautes ; professeur lit et prépare une synthèse avec l’élève et pour les parents ; possibilité de préciser lors d’un échange individuel ; questionnaire pages 1–6 annoncé 30–35 min ; essais pages 7–8 proposés séparément par le professeur.

- Prénom/nom : déjà issu du compte affiché. Ne pas redemander ni permettre de changer l’identité par le bilan.
- Établissement et classe : absents du bilan, récupérer données existantes si fiables, sinon champ facultatif.
- Groupe : récupérer inscription existante, ne pas créer de groupes.
- Date du bilan : métadonnée automatique de réponse/transmission, préciser date si saisie papier ; pas besoin de duplication obligatoire.
- Début des séances Nexus : absent, champ facultatif (ne pas inférer 1er septembre pour tous).
- Nombre de séances suivies en septembre et absences ; case « Je ne me souviens pas » : absents, éventuellement nombres optionnels déclaratifs, ne pas les transformer en assiduité attestée.
- « Un livret, un exercice ou une activité dont je me souviens » : proche scope.other, conserver l’ID et préciser la consigne plutôt que doublonner.
- Attentes initiales, maximum 3 : comprendre le cours ; consolider les bases ; mieux réussir les contrôles ; savoir travailler seul ; reprendre confiance ; approfondir les mathématiques ; mieux organiser mon travail ; autre + texte. Absent comme question initiale (next.priorities concerne l’avenir, pas les attentes initiales).
- Attente la plus importante aujourd’hui : texte absent ; à distinguer attente initiale/priorité actuelle.
- Aisance pour commencer à travailler : à l’aise ; assez à l’aise ; souvent hésitant ; très inquiet ; cela dépend. Proche growth.confidence-now, déjà 6 options plus nuancées ; conserver anciennes options et sens, ne pas modifier rétroactivement.

## Page 2 — méthodes

Cadre : ce que l’élève fait réellement pendant et entre séances. Échelle par ligne J=jamais/presque, P=parfois, S=souvent, T=toujours/presque, NC=pas d’occasion/non concerné. Dix items :
1. M1 Relire consigne et repérer ce qu’on cherche. Seulement réaction ponctuelle dans methods.stuck ; manque fréquence spécifique.
2. M2 Garder trace du premier essai avant aide. Trace dans evidence mais manque habitude déclarée.
3. M3 Chercher propriété/méthode/exemple utile. Présent comme réaction dans stuck, fréquence absente.
4. M4 Pouvoir préciser où est la difficulté. block-example recueille exemple, fréquence absente.
5. M5 Expliquer étapes même résultat connu. Absent comme habitude.
6. M6 Vérifier calcul/unité/cohérence. checking proche ; options n’ont pas NC et « je ne sais pas vérifier » apporte autre nuance à préserver.
7. M7 Après erreur noter ce qui était faux et pourquoi. correction approche mais ne garantit ni note ni fréquence.
8. M8 Refaire plus tard exercice corrigé sans correction. practice/correction présents mais sans fréquence propre.
9. M9 S’entraîner entre séances sur ce qui a été décidé. frequency proche mais ni décision commune ni fréquence de cette habitude.
10. M10 Préparer questions et apporter documents. Absent.

Quand exercice résiste, 2 réactions max : relire/essayer autrement ; consulter aide/cours ; demander tout de suite une explication ; attendre correction ; passer puis revenir ; abandonner ; autre + texte. Existing methods.stuck est radio première réaction (semantique différente) et ne contient pas passer/revenir/attendre explicitement : ne pas convertir même ID de radio à multi ni remplacer anciennes valeurs. Une question distincte, ou reprendre radio existant avec options supplémentaires en gardant les anciennes + ajout spécifique manque, est préférable selon UX retenue.

- Habitude qui aide vraiment + exemple : absent (block-example trop étroit).
- Travail hors devoirs obligatoires : jamais / 1 fois / 2 fois / 3 fois ou plus / variable. frequency existant confond 2–3 et ne précise pas hors devoirs ; préserver ancien champ, nouvel item distinct si nouvelle échelle.
- Freins : temps, fatigue, ne sait quoi faire, ne comprend pas seul, organisation, rien particulier, autre. home-obstacle texte couvre mais pas choix structurés ; « rien » exclusif, autre + texte.
- Petite habitude à améliorer la semaine suivante : next.commitment proche, mais objectif méthodologique distinct absent.

## Page 3 — calcul littéral, arithmétique

Auto-positionnement déclaré, à préciser par exercices/échanges ; capacité à refaire aujourd’hui. Échelle NT non travaillé en septembre ; ? ne sait se situer ; D en difficulté ; A avec aide ; S seul exercice habituel ; E seul et explique. Existant mastery équivalent sauf D « je ne sais pas encore commencer » plus restrictif. Ne pas changer signification historique : conserver clés, éventuellement nouveau libellé « Je suis encore en difficulté (par exemple pour commencer) » uniquement si stratégie versionnée assumée ; préférer conserver pour compatibilité.

Calcul littéral entièrement absent : ajouter module conditionnel, sans affirmer réellement travaillé en septembre.
- L1 Traduire situation simple en expression.
- L2 Substituer valeur y compris négative.
- L3 Réduire expression/gérer parenthèses.
- L4 Développer distributivité simple/double.
- L5 Reconnaître/utiliser identité remarquable.
- L6 Factoriser facteur commun/identité remarquable.

Arithmétique :
- A1 multiples/diviseurs/critères : 2-divisors couvre traduction mais critères non explicites ; ajouter compétence critères, garder 2-divisors.
- A2 division euclidienne/reste : absent en seconde (présent seulement 3e), ajouter.
- A3 primalité/justification : 2-prime couvre déjà.
- A4 décomposition facteurs premiers : 2-factors couvre.
- A5 décomposition pour fraction irréductible : 2-fraction couvre calcul/simplifications interdites mais méthode par facteurs premiers distincte, ajouter compétence seconde dans arith.
- A6 divisibilité/parité : 2-parity couvre parité, ajouter justification divisibilité si nécessaire ; ne pas créer une compétence doublonnant exactement 2-parity.

Priorité de cette page + pourquoi : next.target-topic existant sans pourquoi ; enrichir hint en conservant ID ou champ raison distinct.

## Page 4 — nombres, exemples d’acquis et difficultés

Même échelle.
- E1 Reconnaître N,Z,D,Q,R : absent comme item explicite.
- E2 Classer dans plus petit ensemble : 2-sets-s existant mais combine simplification (E6).
- E3 Inclusions, ∈ et ∉ : absent.
- E4 Décimal/rationnel/irrationnel : absent comme item explicite.
- E5 Exact/approché : 2-exact existant.
- E6 Simplifier avant classer : 2-sets-s existant, garder cet ID.
- E7 Justifier affirmation/contre-exemple : 2-proof-s couvre exemples vs preuve, pas contre-exemple explicite. Ajouter item justifier/réfuter.
- Réussite précise septembre + exercice/situation + seul/aidé : growth.progress-example demande déjà cela en hint, option structurée autonomie de réussite peut compléter sans interpréter anciennes réponses.
- Difficulté persistante + déjà essayé : growth.persistent et methods.block-example partiels, ajouter « ce que tu as déjà essayé » au hint.
- Blocage 2max : comprendre mots, connaître cours, choisir méthode, calculer sans erreur, lire figure, rédiger/justifier, concentration, temps, oser essayer, ne sait pas. methods.blockers couvre tout sauf lire figure et ne sait pas encore (et propose aucune difficulté). Ajouter ces options sans supprimer existantes ; lecture de figure ne présume pas chapitre géométrie travaillé, préciser si pertinent. « Ne sait pas » exclusif.

## Page 5 — fonctionnement et progrès ressentis

Quatre évaluations qualitatives :
- Rythme trop lent/adapté/trop rapide/variable : experience.pace existant plus nuancé.
- Difficulté trop faible/adaptée/trop forte/variable : experience.level-fit existant plus nuancé.
- Quantité de travail faible/adaptée/forte/variable : absent.
- Temps recherche insuffisant/adapté/trop long/variable : experience.search-time mesure fréquence d’un temps suffisant, ne capte pas trop long/variable. Nouvel item qualitatif nécessaire, ne pas remplacer ancien champ.

Échelle accord : pas du tout, plutôt non, plutôt oui, tout à fait, NC/pas avis.
- Objectifs clairs : absent.
- Savoir utiliser livrets/retrouver aide : booklet couvre quand/usage, pas cette autonomie ; nouveau.
- Exercices répondent aux besoins : level-fit porte difficulté, besoin distinct ; nouveau.
- Explications/corrections aident comprendre : clarity existant fréquence, peut garder et ajouter impact des corrections s’il faut distinguer.
- Obtenir aide professeur : help-time existant, conserver.
- Question/se tromper sans gêne : ask parle dire non compris mais pas sécurité face erreur ; nouveau ou complément distinct.
- Groupe permet concentration : group et fatigue partiels ; concentration collective explicite peut compléter.

- Ce qui doit rester + pourquoi ; ce qui doit changer/essayer + pourquoi : format-feedback texte commun existant couvre conserver/améliorer mais pas raisons ni expérimentation explicites ; adapter hint ou deux champs supplémentaires sans supprimer ancien.
- Changement compréhension moins bonne/stable/meilleure/ne sait pas : absent.
- Autonomie moins/stable/meilleure/ne sait : autonomy-change couvre (aide inverse), conserver.
- Confiance moins/stable/meilleure/ne sait : confidence-change couvre plus variable.
- Exemple classe/maison expliquant choix : progress-example + transfer-example proches ; expliciter lien entre évolution et exemple, ne jamais assimiler ressenti à progrès démontré.

## Page 6 — besoins, deux objectifs, famille

Aides 3max + désigner plus utile : revoir base ; exemples expliqués ; plus temps recherche ; choisir méthode ; davantage entraînement ; rédiger justification ; retour précis sur erreurs ; défis ; quoi refaire entre séances ; parler individuellement. Existing teacher-help libre et priorities couvrent partiellement, manque choix structuré et hiérarchisation. Ajouter sélection max3 et priorité parmi les aides sélectionnées (validation crossfield si réalisée). Autre attente libre : next.free existant.

Objectif1 mathématique : compétence/notion visée (target-topic) ; action + moment (commitment,when) ; critère vérification progrès (absent). Conserver IDs existants, préciser intitulés d’objectif1.
Objectif2 méthode : habitude à installer (absent), action + aide nécessaire (support-needed proche mais objectif1 par contexte) ; ajouter champs propres. Ne pas forcer 2 objectifs si 1 suffit.
Date prochain point : absent dans réponses élèves (seulement trame enseignant libre) ; date souhaitée/proposée à confirmer, pas rendez-vous garanti.
Message aux parents sur travail : absent.
Aide famille : encourager ; organiser horaires ; laisser chercher avant aider ; vérifier plan travail ; autre+texte : absent.
Relecture : review.confirmed existe.
Souhait précision au professeur : libre existe indirectement, ajouter question oui/non/pas souhaité ou case non requise ; demander sujet facultatif. Ce n’est pas consentement à divulguer plus de données.

## Pages 7–8 — six nouveaux essais

Consignes à garder : annexe séparée, choix professeur sur notions réellement travaillées, 15–20min pour les2pages (adapter durée au choix réel), premier essai sans cours/calculatrice, recherche incomplète permise, pas score global, conserver essais. Ressenti avant confiant/partagé/inquiet/difficile à dire absent. Après chaque essai seul/aidé/non fait (existant aid+skipped), NT (géré par scope/mastery mais ne pas collecter essai NT), confiance faible/moyenne/forte absente.

2L1 Développer et réduire A=(2x−3)(x+4)−2x(x+1), calcul x=−1 via réduite puis initiale. Entièrement nouveau. Corrigé privé : A=3x−12, A(−1)=−15 ; contrôle initial (−5)×3−(−2)×0=−15.
2L2 Factoriser B=9x²−25 et C=(x+2)(3x−1)+4(x+2), expliquer choix. Nouveau. Corrigé : B=(3x−5)(3x+5) différence carrés ; C=(x+2)(3x+3)=3(x+2)(x+1), facteur commun. Dépend L5,L6 ; ne pas exiger identité remarquable pour tâche si elle n’a pas été travaillée.
2A1 Décomposer180et252 ; rendre180/252irréductible et justifier. Existing 2-arith-task décompose180 mais teste97 premier : ne pas remplacer cet ID. Nouveau : 180=2²×3²×5 ; 252=2²×3²×7 ;5/7 premiers distincts.
2A2 Somme2entiersimpairs toujours paire, justification générale pas exemples. Existing 2-proof-task n²+n pair a autreénoncé : nouveau ID. (2p+1)+(2q+1)=2(p+q+1), p,q entiers distincts possibles.
2E1 Pluspetitensemble−7;0,125;1/3;√49;√2 parmiN,Z,D,Q,R, justifier, convention0∈N. Existing2-sets-task prochesvaleursmais−3,2/5,etc : nouveau ID si conserver exactnouvelénoncé. Résultats Z,D,Q,N,R (√2 irrationnel).
2E2 Tout rationnel décimal vrai/faux ;0,333 exactement1/3 vrai/faux ;justifier. Nouveau ; faux1/3contreexemple, faux333/1000≠1/3 (999≠1000). Nécessite ensembles+exact/approché.
Aprèsessais : auto-positionnement à préciser : absent ; nouveau texte, surtout ne pas écraser déclarationinitiale.

## Intégration sûre et cohérente

1. Enrichissement additif, pas remplacement des7essais ni16compétences actuels ; garder thèmes numériques/puissances/racines absents duPDF. Ajouter calcul littéral conditionnel sourcedPDF page3 : présencePDF ne prouve pas abordéen septembre.
2. Conserver IDs et toutes valeurs d’options déjàenregistrées, notamment radio stuck,frequency,search-time ; nouvelle mesure=nouvel ID. Nouveau contenu optionnel ; ne pas réouvrir/transmettre automatiquement anciennescopies.
3. SourcePDF nouvelleclé ; référencepages parmodule/essai ; matricecouverture PDF→ID justifie dédoublonnage.
4. Questions communes3e/seconde dans banquecommune, contenusmaths seuls enseconde ; ne pas propager automatiquement nouveauxthèmes/durées àTerminalesNSI.
5. max2essais actuel : conserver sélectionavecprofesseur, ajouter6propositions mais ne pas forcer tous. L’énoncé « toutdocuments » n’oblige pas tousélèvesàtoutfaire ; toutespropositions doivent être présentes. Annexeplutôt finaprèsquestionnaire, ou lienpasser/revenirexplicitement.
6. Chaque nouvelle donnée doit être incluse save/reload, validator, relecture, vuesenseignant, exportJSON etrapportfamilial. Attention confidenceevidence ajout nécessite evidenceSchema.strict, typeEvidence, rendu etformatage. Surtout rétrocompatibilité anciennespreuves sanschampconfidence.
7. Besoinsprioritaires max3 puis priorité doit être unchoix sélectionné ; aucune difficulté/ne sait/rien exclusifs ; autresspécifiés champs texte distincts optionnels.
8. Identité/groupe/dates déjàfiables depuis compte/serveur, ne pas demander dePII redondantes ni âge/notes/adresses. Absences déclarées, pas sanctionnées.
9. Questionnaire pourra dépasser30–35min si tousnouveaux+anciens affichés. Regrouper questions complémentaires, limiter doublons, conserverfacultatif et sauvegarde. Ne pas afficher promesse durée30min fixe sans compteeffectif.
10. Anciennescopies soumisesdoivent rester lisibles sans sembler incomplètesàcausenouveauxitems : notion nouvelleversion/donnéesfacultatives et éventuellement versioncontenu. Pas migrations destructrices.

## Risques observés

- Échelle Dpapier « endifficulté » pluslarge que startweb « ne sais pas commencer » : onnepeut remapper sansnuance.
- PDF annexeavant/après ressenti nonprésent surweb ; scoreinterdit bienexistant.
- Rythme/quantité/temps/conditions différentesdimensions ; nepasfusionner leursoptions.
- Dateprochainpoint proposée sansconfirmationprofesseur.
- Ajout ducalcul littéral doit être présenté commeoptioneffectivementtravaillée, jamais acquisenseignéautomatiquement.
