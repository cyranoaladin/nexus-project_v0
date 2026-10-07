# Analyse exhaustive PDF troisième — 7 octobre 2026

Source : /home/alaeddine/Téléchargements/Nexus_Bilan_Septembre_2026_Troisieme.pdf (8 pages, toutes extraites et inspectées visuellement).
Comparaison : lib/espace/bilan-bank.json, bilan-data.ts, bilan-work.ts, bilan-profiles.ts, components/espace/student/BilanWorkbench.tsx.
Aucun code applicatif modifié. L'extraction littérale complète est jointe après l'analyse ; le seul élément textuel absent de l'extraction, les mesures de la figure 3T, est transcrit ci-dessous.

## Matrice de couverture page par page

### Page 1 — cadre, parcours, attentes
- Consignes : bilan sans note ; progrès/difficultés/besoins ; septembre seulement ; réponses personnelles ; critique et difficulté autorisées ; professeur prépare synthèse avec élève et parents ; échange individuel possible. Existant : sans note, septembre seul, synthèse familiale, droit de passer déjà présents ; expliciter accueil de la critique et demande individuelle.
- Durée : questionnaire pages 1–6 =30–35 min ; annexe p7–8 proposée séparément. Existant durée 30 min mais essais en étape 3 avant méthodes. Adapter ordre ou annoncer explicitement étape facultative à réaliser séparément avec professeur ; ne pas demander six essais obligatoires.
- Identité prénom/nom, établissement/classe, groupe, date bilan, date début Nexus, séances septembre suivies, absences, « Je ne me souviens pas ». Seul studentName/level affiché actuellement. Nom/groupe/date connus doivent être préremplis plutôt que recollectés ; établissement/classe/début/assiduité peuvent rester facultatifs. Le nombre d'absences auto-déclaré n'est pas une donnée administrative validée.
- Souvenir livret/exercice/activité : couvert par scope.other, conserver et clarifier.
- Attentes initiales max3 : comprendre cours, consolider bases, mieux réussir contrôles, savoir travailler seul, reprendre confiance, approfondir maths, mieux organiser travail, autre+texte. Absentes sous forme explicite : ajouter.
- Attente actuelle prioritaire (texte) : partiellement next.target-topic/teacher-help, mais temporalité différente => champ dédié.
- Mise au travail actuelle : à l'aise / assez à l'aise / souvent hésitant / très inquiet / cela dépend. Proche growth.confidence-now, sans équivalence stricte ; conserver ancien champ et apporter nouvelle formulation ou champ distinct, sans recodage arbitraire.

### Page 2 — méthodologie
Échelle nouvelle commune M1–M10 : Jamais ou presque / Parfois / Souvent / Toujours ou presque / Pas d'occasion ou non concerné. Ne pas convertir les anciennes réponses en cette échelle.
- M1 relire consigne/repérer recherche (absent comme fréquence ; stuck couvre réaction partielle).
- M2 trace premier essai avant aide (absent).
- M3 propriété/méthode/exemple utile (practice/stuck partiels).
- M4 nommer précisément blocage (absent).
- M5 expliquer étapes même résultat connu (absent).
- M6 vérifier calcul/unité/cohérence (checking voisin ; enrichir sans invalider anciennes options).
- M7 noter erreur et pourquoi (correction voisin mais pratique différente).
- M8 refaire plus tard sans correction (practice/correction voisins, fréquence absente).
- M9 entraînement entre séances sur décision (frequency voisin, intention absente).
- M10 préparer questions/documents (absent).
- Réactions face difficulté max2 : relire/essayer autrement ; aide/cours ; explication immédiate ; attendre correction ; passer puis revenir ; abandonner ; autre+texte. Existant stuck radio « première réaction » n'est pas équivalent. Nouveau champ max2 préférable pour conservation historique.
- Habitude aidante + exemple (texte) : block-example voisin mais positif à expliciter.
- Travail hors devoirs obligatoires fréquence : jamais / 1 fois /2 fois /3 ou+ /varie. Existant frequency mélange devoirs et reprise ; ne pas changer sens ancien, ajouter champ hors-devoirs ou préciser documenter compatibilité.
- Freins travail : temps, fatigue, ne sais pas quoi faire, ne comprends pas seul, organisation, rien, autre. Actuellement home-obstacle texte : ajouter choix structurés + autre ; rien exclusif.
- Petite habitude à améliorer semaine suivante : commitment proche ; rattacher objectif méthodologique spécifique.

### Page 3 — 12 compétences
Échelle PDF NT non travaillé septembre / ? ne sait pas se situer / D difficulté / A aide / S seul exercice habituel / E seul et explique. L'existant a notworked,unsure,start,help,alone,explain. « start=ne sait pas encore commencer » est plus restrictif que difficulté ; conserver signification historique, adapter affichage clairement sans prétendre equivalence D.
- F1 simplifier + irréductibilité : 3-reduce-s et 3-irreducible couvrent complètement.
- F2 addition/soustraction fractions : 3-operations global ; ajouter détail.
- F3 multiplication/division fractions : idem.
- F4 signes/priorités fractions : 3-operations couvre, expliciter signes sans supprimer ID.
- A1 multiple/diviseur/critères : 3-criteria partiel (2,3,5,9), ajouter reconnaissance multiple/diviseur.
- A2 effectuer/interpréter division euclidienne : 3-div-s vérification partielle ; ajouter ou enrichir en préservant ancienne lecture.
- A3 premier et décomposition : 3-prime et 3-factors couvrent.
- A4 diviseurs communs pour partage : 3-lots-s contrôle des quantités seulement ; ajouter choix diviseurs et maximalité.
- L1 valeur expression/substitution ; L2 réduction termes semblables ; L3 développement et signes ; L4 facteur commun : tous absents, nouveau module calcul littéral, 4 compétences, scope non présumé.
- Priorité compétence de cette page et pourquoi : next.target-topic partiel, ajouter le pourquoi dans consigne ou champ indépendant.

### Page 4 — 7 compétences, réussites, difficultés
- G1 reconnaître similitude par angles ; G2 correspondances sommets/côtés : 3-geo-s regroupe en général ; détails utiles à ajouter sans retirer global.
- G3 coefficient similitude pour longueur : 3-scale parle distinction longueurs/aires ; ajouter calcul longueur.
- T1 conditions Thalès ; T2 rapports bon ordre ; T3 calcul longueur ; T4 réciproque/parallélisme : absents, nouveau module Thalès, 4 compétences, travail à confirmer.
- Réussite précise + exercice/situation + seul/avec aide : growth.progress-example contient cette consigne, mais condition structurée absente.
- Difficulté persistante + ce que déjà essayé : growth.persistent omet essais tentés ; compléter consigne ou champ.
- Blocages max2 : mots / cours / méthode / calcul / lire figure / rédaction-justification / concentration / temps / oser / ne sait pas encore. methods.blockers couvre tous sauf lire figure et ne sait pas encore. Ajouter options sans supprimer « aucune difficulté précise » ; inconnue et aucune exclusives.

### Page 5 — expérience séance et évolution
4 appréciations (une réponse chacune) : rythme trop lent/adapté/trop rapide/variable (pace plus détaillé couvre) ; difficulté trop faible/adaptée/trop forte/variable (level-fit couvre) ; quantité trop faible/adaptée/trop forte/variable (absente) ; temps recherche insuffisant/adapté/trop long/variable (search-time fréquence ne couvre pas « trop long » ; nouveau champ).
7 accords échelle Pas du tout/Plutôt non/Plutôt oui/Tout à fait/NC ou pas d'avis : objectifs clairs (absent) ; utiliser livrets/retrouver aide (booklet usage ne couvre pas maîtrise) ; exercices répondent besoins (level-fit difficulté différente) ; explications ET corrections utiles (clarity partiel) ; accès aide professeur (help-time couvre autre échelle) ; question/erreur sans gêne (ask partiel) ; groupe favorise concentration (group partiel).
Textes conserver+pourquoi et changer/essayer+pourquoi : format-feedback combine, peut enrichir hint ou ajouter séparés sans perdre l'ancien.
Évolution compréhension / autonomie / confiance (moins/stable/mieux/inconnu). Autonomie et confiance déjà présentes avec options nuancées ; compréhension absente.
Exemple classe/maison expliquant choix : growth.transfer-example et progress-example couvrent globalement ; clarifier lien à évolution.

### Page 6 — besoins, objectifs et parents
- Aides max3 puis aide prioritaire parmi choisies : base, exemples expliqués, temps recherche, choix méthode, entraînement, rédaction justification, retour précis erreurs, défis, quoi refaire entre séances, échange individuel. next.teacher-help texte et priorities max2 ne remplacent pas ce choix d'aides. Ajouter multi max3 + priorité radio liée à sélection (ou texte explicite contrôlé) ; impossible choisir priorité hors des aides sélectionnées.
- Autre attente/non demandé : next.free couvre.
- Objectif maths : réussite/notion (target-topic), action et moment (commitment+when), indicateur de progrès (absent).
- Objectif méthode : habitude à installer (absent comme objectif séparé), action et aide (support-needed trop général).
- Date prochain point : absente ; formulation « date envisagée, à confirmer ensemble » si élève seul, ne pas promettre rendez-vous automatique.
- Message parents ce qu'ils doivent comprendre : absent.
- Aide parents : encourager / horaires / laisser chercher avant aide / vérifier plan / autre+texte : absent. Ne pas imposer max3 inexistant PDF ; au plus nombre d'options ou toutes.
- Confirmation relecture : review.confirmed existe.
- Demande préciser point professeur : absente (free permet oral mais pas indicateur explicite), ajouter radio oui/non/à voir ou case facultative.

### Pages 7–8 — 6 essais nouveaux (aucun identique aux 8 anciens)
Cadre : annexe séparée après questionnaire ; 15–20 min les deux pages ; sans cours/calculatrice premier essai ; professeur choisit seulement notions travaillées ; recherche incomplète conservée ; aucun score global. Conserver max2 essais choisis avec professeur de l'app, rendre les six disponibles selon scope. La durée 15–20 min est à adapter au choix effectif, pas promesse fixe pour les 14 essais réunis.
Ressenti préalable : confiant / partagé / inquiet / difficile à dire (absent).
Après chaque essai : Seul / Avec aide / Non fait ; NT si notion non travaillée ; confiance faible/moyenne/forte. App distingue Aucune aide/Indice/Guidage/Inconnu + skipped, mais n'a pas confiance. Ajouter métadonnée confidence facultative validée ; conserver anciennes clés answer/retry/aid/skipped. NT est déjà exclu par scope/mastery, pas besoin d'imposer tâche NT.
- 3F : A=5/6−(3/4)×(2/3), étapes et irréductible. Réponse 1/3. Nouveau ID ; associer opérations/simplification, garder ancien essai fraction du reste.
- 3A : 84 crayons/126 gommes ; max lots identiques sans reste + composition + maximalité. Réponse PGCD=42, 2 crayons/3 gommes. Différent de 3-lots (72/48, possibilités18/24) et 3-reduce-task (mêmes84/126 mais fraction), nouveau ID obligatoire.
- 3L : B=3(2x−5)−2(x+1), développer réduire puis x=−2 ; C=5x+15 factoriser. Réponses B=4x−17, B(−2)=−25, C=5(x+3). Nouveau module littéral.
- 3G : ABC angles A40° B65°, DEF D40° E65°, AB4 DE6 AC5 ; similitude, sommets, DF. Réponse 3eangles75°, A↔D B↔E C↔F ; k=1,5 ; DF7,5cm. Nouveau ID, garder essai aires.
- 3T : M∈[AB], N∈[AC], MN∥BC. MESURES DANS IMAGE SEULEMENT : AM=3cm, AB=6cm, AN=4cm, BC=10cm. Rapports AM/AB=AN/AC=MN/BC=1/2 ; AC8cm ; MN5cm. Inclure données texte accessible, figure SVG possible. Attention figure source approximative non à l'échelle.
- 3R : A,M,B alignés cet ordre ; A,N,C cet ordre ; AM3 AB5 AN4,2 AC7 ; parallèles? Oui 3/5=4,2/7=0,6 puis réciproque et ordre. Nouveau module Thalès.
Corrections strictement serveur enseignant, ne pas ajouter réponses aux données publiques.

## Contraintes d'intégration/conservation
1. Ne supprimer aucun module/skill/task ancien : puissances, logique, aires, fraction du reste et carré parfait absents PDF restent pertinents d'après livrets initiaux.
2. Ajouter IDs stables nouveaux aux compétences/questions/tâches. Ne pas réutiliser 3-lots/3-geo-task pour nouveaux nombres : les anciennes réponses seraient faussement associées.
3. Ne changer ni type ni options acceptées des anciennes questions. Un radio devenu multi invaliderait bilan-work. Pas de recodage auto entre échelles différentes.
4. Anciennes copies soumises restent immuables, annotations et versions conservées ; idéalement garder snapshot de définition/version, ou au minimum distinguer questions ajoutées non demandées à l'époque. Ne pas rouvrir automatiquement ni transformer absence en échec.
5. Si ajout étapes avant scope/mastery/evidence, supprimer indices codés en dur 0/1/2 dans Workbench (go(0),go(1),availableIndexes.includes(2)) et gérer currentStep historique. Solution plus petite : conserver ordre+IDs existants, ajouter sections sans casser currentStep ; annexe à planifier explicitement.
6. Version3e/2nde peut évoluer sans modifier Terminale ni scope de ses questionnaires, puisque sections communes bank ne sont pas celles Terminale. Toutefois UI partagée : conditionner nouvelles consignes de durée/essais au niveau.
7. Mise à jour evidenceSchema strict, UI evidenceOf et relecture, bilan-display/rapport/export ensemble si confidence ajoutée ; tester roundtrip anciens+nouvelles copies, conservation données et validation options/max.
8. Éviter 100 cartes longues : mêmes échelles peuvent se grouper visuellement de façon accessible en desktop et cartes compactes mobile ; conserver champs distincts et opt-out.
9. Limiter parcours aux thèmes réellement travaillés ; PDF n'est pas preuve que littéral/Thalès furent vus en septembre.

## Extraction intégrale du PDF (forme texte, complétée pour la figure plus haut)
NEXUS RÉUSSITE / MATHÉMATIQUES / TROISIÈME




Mon bilan de septembre 2026
Mathématiques en troisième
Ce bilan sert à comprendre tes progrès, tes difficultés et tes besoins pour préparer la suite avec ton
professeur. Il ne donne pas de note.
Réponds avec tes mots, en pensant aux séances de septembre uniquement. Tu peux dire ce qui t’a aidé et
ce qui doit changer. Une difficulté ou un avis critique n’est pas une faute.
Ton professeur lira tes réponses et préparera une synthèse avec toi et pour tes parents. Tu peux
demander à préciser un point lors d’un échange individuel.
À compléter : pages 1 à 6, environ 30 à 35 minutes. Les essais des pages 7 et 8 sont proposés
séparément par le professeur.

Mon parcours en septembre
Prénom et nom : ........................................................................................................
Établissement et classe : ........................................... Groupe : ...............................
Date du bilan : .................................... Début de mes séances Nexus : .......................
Séances de septembre suivies : .......... Absences : .......... □ Je ne me souviens pas
Un livret, un exercice ou une activité dont je me souviens




Mes attentes
En venant chez Nexus, je souhaitais surtout… Coche au maximum trois réponses.
□ comprendre le cours □ consolider les bases □ mieux réussir les contrôles
□ savoir travailler seul □ reprendre confiance □ approfondir les mathématiques
□ mieux organiser mon travail □ autre : ...................................................................
Aujourd’hui, mon attente la plus importante est




Pour me mettre au travail en mathématiques, je me sens actuellement…
□ à l’aise □ assez à l’aise □ souvent hésitant □ très inquiet □ cela dépend




                                                                                                               Septembre 2026 • Bilan élève | 1
NEXUS RÉUSSITE / MATHÉMATIQUES / TROISIÈME



Mes façons de travailler
Pense à ce que tu fais réellement, pendant les séances et entre deux séances.

Entoure une réponse par ligne : J = jamais ou presque ; P = parfois ; S = souvent ; T = toujours ou presque ; NC
= pas d’occasion ou non concerné.

 Mes habitudes                                                                                                                     Fréquence
 M1 Je relis la consigne et repère ce que je dois chercher.                                                                     J P S T NC
 M2 Je laisse une trace de mon premier essai avant de demander de l’aide.                                                       J P S T NC
 M3 Je cherche une propriété, une méthode ou un exemple utile.                                                                  J P S T NC
 M4 Quand je bloque, je peux dire précisément où se situe la difficulté.                                                        J P S T NC
 M5 J’explique les étapes, même quand je connais déjà le résultat.                                                              J P S T NC
 M6 Je vérifie un calcul, une unité ou la cohérence de ma réponse.                                                              J P S T NC
 M7 Après une erreur, je note ce qui était faux et pourquoi.                                                                    J P S T NC
 M8 Je refais plus tard un exercice corrigé sans regarder la correction.                                                        J P S T NC
 M9 Entre deux séances, je m’entraîne sur ce qui a été décidé.                                                                  J P S T NC
 M10 Je prépare mes questions et j’apporte les documents nécessaires.                                                           J P S T NC



Quand un exercice me résiste
Coche tes deux réactions les plus fréquentes.
□ je relis et j’essaie autrement □ je consulte une aide ou le cours
□ je demande tout de suite une explication □ j’attends la correction
□ je passe à une autre question puis je reviens □ j’abandonne
□ autre : ...................................................................................................................
Une habitude qui m’aide vraiment à progresser et un exemple




Entre deux séances
En général, je retravaille les mathématiques hors des devoirs obligatoires :
□ jamais □ une fois par semaine □ deux fois □ trois fois ou plus □ cela varie
Ce qui limite ce travail : □ temps □ fatigue □ je ne sais pas quoi faire
□ je ne comprends pas seul □ organisation □ rien de particulier □ autre
Une petite habitude que je pourrais améliorer dès la prochaine semaine




                                                                                                                           Septembre 2026 • Bilan élève | 2
NEXUS RÉUSSITE / MATHÉMATIQUES / TROISIÈME



Où j’en suis en mathématiques
Il s’agit de ton point de vue. Les exercices et les échanges permettront de le préciser.

Pour chaque ligne, entoure une réponse. Pense à ce que tu peux refaire aujourd’hui.
NT = non travaillé en septembre • ? = je ne sais pas me situer
D = je suis en difficulté • A = je réussis avec une aide
S = je réussis seul dans un exercice habituel • E = je réussis seul et j’explique ma démarche

Fractions
Ce que je pense savoir faire                                                                 Ma réponse
F1 Simplifier une fraction et expliquer son irréductibilité.                               NT ? D A S E
F2 Additionner ou soustraire deux fractions.                                               NT ? D A S E
F3 Multiplier ou diviser deux fractions.                                                   NT ? D A S E
F4 Respecter les signes et les priorités dans un calcul avec fractions.                    NT ? D A S E



Arithmétique
Ce que je pense savoir faire                                                                 Ma réponse
A1 Reconnaître un multiple, un diviseur et utiliser les critères.                          NT ? D A S E
A2 Effectuer ou interpréter une division euclidienne.                                      NT ? D A S E
A3 Reconnaître un nombre premier et décomposer un entier.                                  NT ? D A S E
A4 Choisir des diviseurs communs pour résoudre un partage.                                 NT ? D A S E



Calcul littéral
Ce que je pense savoir faire                                                                 Ma réponse
L1 Calculer la valeur d’une expression pour une valeur donnée.                             NT ? D A S E
L2 Réduire une expression en regroupant les termes semblables.                             NT ? D A S E
L3 Développer un produit en respectant les signes.                                         NT ? D A S E
L4 Factoriser une expression en repérant un facteur commun.                                NT ? D A S E


La compétence de cette page que je souhaite travailler en priorité et pourquoi




                                                                                      Septembre 2026 • Bilan élève | 3
NEXUS RÉUSSITE / MATHÉMATIQUES / TROISIÈME



Mes acquis et mes difficultés
Complète ton auto-positionnement, puis appuie tes réponses sur des exemples.

Pour chaque ligne, entoure une réponse. Pense à ce que tu peux refaire aujourd’hui.
NT = non travaillé en septembre • ? = je ne sais pas me situer
D = je suis en difficulté • A = je réussis avec une aide
S = je réussis seul dans un exercice habituel • E = je réussis seul et j’explique ma démarche

Triangles semblables et théorème de Thalès
 Ce que je pense savoir faire                                                                           Ma réponse
 G1 Reconnaître des triangles semblables grâce aux angles.                                          NT ? D A S E
 G2 Associer les sommets et les côtés correspondants.                                               NT ? D A S E
 G3 Utiliser le coefficient de similitude pour calculer une longueur.                               NT ? D A S E
 T1 Repérer et écrire les conditions d’application de Thalès.                                       NT ? D A S E
 T2 Écrire les rapports de longueurs dans le bon ordre.                                             NT ? D A S E
 T3 Calculer une longueur avec le théorème de Thalès.                                               NT ? D A S E
 T4 Utiliser la réciproque pour justifier un parallélisme.                                          NT ? D A S E


Une réussite précise de septembre dont je suis satisfait




Exercice ou situation : .................................. □ réussi seul □ réussi avec une aide
Une difficulté précise qui persiste et ce que j’ai déjà essayé




Quand cela bloque, c’est surtout… Coche au maximum deux réponses.
□ comprendre les mots □ connaître le cours □ choisir une méthode
□ calculer sans erreur □ lire la figure □ rédiger ou justifier
□ rester concentré □ gérer le temps □ oser essayer □ je ne sais pas encore




                                                                                                  Septembre 2026 • Bilan élève | 4
NEXUS RÉUSSITE / MATHÉMATIQUES / TROISIÈME



Mon avis sur les séances
Tes réponses servent à ajuster le travail. Choisis librement ce qui correspond à ton expérience.

 Ce que j’observe                                  Une réponse à entourer
 Le rythme des séances                             trop lent / adapté / trop rapide / variable
 La difficulté des exercices                       trop faible / adaptée / trop forte / variable
 La quantité de travail proposée                   trop faible / adaptée / trop forte / variable
 Le temps pour chercher seul                       insuffisant / adapté / trop long / variable


Pour les phrases suivantes : Non = pas du tout ; Peu = plutôt non ; Oui = plutôt oui ; Tout = tout à fait ; NC = non
concerné ou pas d’avis.

 Mon expérience                                                                Ma réponse
 Les objectifs de mon travail sont clairs.                                     Non Peu Oui Tout NC
 Je sais utiliser les livrets et retrouver une aide.                           Non Peu Oui Tout NC
 Les exercices choisis répondent à mes besoins.                                Non Peu Oui Tout NC
 Les explications et les corrections m’aident à comprendre.                    Non Peu Oui Tout NC
 Je peux obtenir l’aide du professeur quand j’en ai besoin.                    Non Peu Oui Tout NC
 Je peux poser une question ou me tromper sans gêne.                           Non Peu Oui Tout NC
 Le fonctionnement du groupe me permet de me concentrer.                       Non Peu Oui Tout NC


Ce que je souhaite conserver dans les séances et pourquoi




Ce que je souhaite changer ou essayer et pourquoi




Ce qui change pour moi
Depuis le début de septembre, en mathématiques… Entoure une réponse par ligne.

 Aspect                                Mon ressenti
 Ma compréhension                      moins bonne / stable / meilleure / je ne sais pas
 Mon autonomie                         moins grande / stable / meilleure / je ne sais pas
 Ma confiance                          moins grande / stable / meilleure / je ne sais pas


Un exemple en classe ou à la maison qui explique mon choix




                                                                                           Septembre 2026 • Bilan élève | 5
NEXUS RÉUSSITE / MATHÉMATIQUES / TROISIÈME



Mes besoins et mes prochains pas
Choisis des priorités réalistes. Les objectifs seront précisés avec ton professeur.

Ce dont j’ai besoin
Coche au maximum trois aides et entoure celle qui serait la plus utile.
□ revoir une notion de base □ disposer d’exemples expliqués
□ avoir plus de temps pour chercher □ être aidé à choisir une méthode
□ m’entraîner davantage □ apprendre à rédiger une justification
□ recevoir un retour plus précis sur mes erreurs □ relever davantage de défis
□ savoir quoi refaire entre deux séances □ parler individuellement au professeur
Une autre attente ou quelque chose qui n’a pas été demandé




Mon premier objectif en mathématiques
Ce que je veux réussir à faire et la notion concernée



L’action précise que je vais essayer et à quel moment



Comment nous vérifierons que j’ai progressé




Mon deuxième objectif dans ma façon de travailler
L’habitude que je veux installer



L’action prévue et l’aide dont j’ai besoin



Date de notre prochain point : .....................................................

Pour préparer le bilan avec mes parents
Ce que j’aimerais que mes parents comprennent de mon travail




Pour m’aider, ils pourraient : □ m’encourager □ m’aider à organiser mes horaires
□ me laisser chercher avant d’aider □ vérifier avec moi mon plan de travail
□ autre : ...................................................................................................................
□ J’ai relu mes réponses. □ Je souhaite préciser un point avec mon professeur.




                                                                                                                                Septembre 2026 • Bilan élève | 6
NEXUS RÉUSSITE / MATHÉMATIQUES / TROISIÈME



Quelques essais pour préciser mon bilan
Annexe proposée par le professeur après le questionnaire • 15 à 20 minutes pour les deux pages

Sans cours ni calculatrice au premier essai. Le professeur choisit les questions portant sur des notions
travaillées. Tu peux laisser une recherche incomplète. Aucun score global ne sera calculé.
Mon ressenti avant ces essais : □ confiant □ partagé □ inquiet □ difficile à dire
Après chaque essai : entoure Seul, Avec aide ou Non fait. Si tu n’as pas travaillé la notion, écris NT. Garde tes
essais, même incomplets.

Essai 3F Calculer avec des fractions
Calcule et donne le résultat sous forme de fraction irréductible. Écris les étapes.
   5 3 2
A = − ×
   6 4 3




Conditions : Seul / Avec aide / Non fait   •   Confiance après l’essai : faible / moyenne / forte

Essai 3A Organiser un partage
On répartit 84 crayons et 126 gommes dans des lots identiques, sans reste. Quel est le plus grand nombre
de lots possible ? Donne leur composition et justifie que ce nombre est maximal.




Conditions : Seul / Avec aide / Non fait   •   Confiance après l’essai : faible / moyenne / forte

Essai 3L Transformer une expression
Développe et réduis B = 3(2x − 5) − 2(x + 1). Calcule ensuite B pour x = −2.
Factorise C = 5x + 15.




Conditions : Seul / Avec aide / Non fait   •   Confiance après l’essai : faible / moyenne / forte




                                                                                          Septembre 2026 • Bilan élève | 7
NEXUS RÉUSSITE / MATHÉMATIQUES / TROISIÈME



Quelques essais en géométrie
Annexe • suite • Justifie les propriétés que tu utilises.

Essai 3G Relier deux triangles semblables
Dans ABC, les angles en A et B mesurent 40° et 65°. Dans DEF, les angles en D et E mesurent 40° et 65°.
On sait AB = 4 cm, DE = 6 cm et AC = 5 cm.
Explique pourquoi les triangles sont semblables, indique les sommets correspondants et calcule DF.




Conditions : Seul / Avec aide / Non fait   •   Confiance après l’essai : faible / moyenne / forte

Essai 3T Utiliser le théorème de Thalès
M appartient à [AB], N appartient à [AC] et (MN) est parallèle à (BC). Écris les rapports utiles, puis calcule
AC et MN. La figure est un schéma.




Conditions : Seul / Avec aide / Non fait   •   Confiance après l’essai : faible / moyenne / forte

Essai 3R Justifier un parallélisme
Dans une autre figure, A, M, B sont alignés dans cet ordre ; A, N, C sont alignés dans cet ordre. AM = 3
cm, AB = 5 cm, AN = 4,2 cm et AC = 7 cm.
Les droites (MN) et (BC) sont-elles parallèles ? Justifie.




Conditions : Seul / Avec aide / Non fait   •   Confiance après l’essai : faible / moyenne / forte




                                                                                          Septembre 2026 • Bilan élève | 8
