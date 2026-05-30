import type { DomainId, TrainingExercise } from "./types";

// SOURCE: EAM_entraienemnt, Annales_BAC_MATHS filtrées STMG, sujets zéro Éduscol.
const exerciseSeed: Record<DomainId, TrainingExercise[]> = {
  fonctions: [
    {
      id: "fonctions-marge",
      domainId: "fonctions",
      title: "Marge d’une boutique — forme factorisée",
      statement: ["Une boutique modélise sa marge par $M(x)=20(x-1)(5-x)$, où $x$ est un nombre de lots promotionnels."],
      questions: ["Donner les deux seuils où la marge est nulle.", "Déterminer l’axe de symétrie.", "Indiquer sur quel intervalle la marge est positive."],
      correction: [
        { title: "Rappel de cours", details: ["La forme $a(x-x_1)(x-x_2)$ donne directement les zéros $x_1$ et $x_2$.", "L’axe de symétrie est au milieu des deux racines quand la courbe est une parabole."] },
        { title: "Résolution", details: ["$M(x)=0$ pour $x=1$ ou $x=5$.", "Le milieu de $1$ et $5$ est $3$ : l’axe est $x=3$.", "La marge est positive entre les deux seuils, donc sur $]1;5[$."] },
        { title: "Méthode", details: ["On exploite la forme donnée, sans discriminant.", "Sans calculatrice, le tableau de signes d’un produit suffit."] },
      ],
    },
    {
      id: "fonctions-lecture",
      domainId: "fonctions",
      title: "Lecture graphique d’un bénéfice",
      statement: ["Une entreprise lit sur un graphique que le bénéfice est croissant sur $[0;4]$, décroissant sur $[4;8]$ et vaut 0 pour $x=1$ et $x=7$."],
      questions: ["Donner l’abscisse du maximum.", "Indiquer les intervalles où le bénéfice est positif.", "Expliquer ce que signifie une racine dans le contexte."],
      correction: [
        { title: "Rappel de cours", details: ["Une racine est un antécédent de $0$.", "La fonction est positive lorsque la courbe est au-dessus de l’axe des abscisses."] },
        { title: "Résolution", details: ["Le maximum est atteint en $x=4$ car la fonction croît puis décroît.", "Le bénéfice est positif entre les deux racines : sur $]1;7[$.", "Une racine correspond à un seuil de rentabilité."] },
        { title: "Méthode", details: ["Avant tout calcul, identifier les axes, les unités et les valeurs lues.", "Une lecture graphique donne souvent une réponse approchée : le préciser si nécessaire."] },
      ],
    },
    {
      id: "fonctions-cubique",
      domainId: "fonctions",
      title: "Fonction de degré 3 et racine cubique",
      statement: ["On considère $f(x)=0{,}5x^3-4$ dans un contexte de volume produit."],
      questions: ["Calculer $f(2)$.", "Résoudre $f(x)=0$.", "Interpréter l’équation $x^3=8$."],
      correction: [
        { title: "Rappel de cours", details: ["Une équation $x^3=c$ se résout avec la racine cubique $\\sqrt[3]{c}$.", "$2^3=8$ est un automatisme utile sans calculatrice."] },
        { title: "Résolution", details: ["$f(2)=0{,}5\\times8-4=0$.", "$f(x)=0$ donne $0{,}5x^3=4$, donc $x^3=8$.", "Ainsi $x=2$."] },
        { title: "Méthode", details: ["Identifier d’abord la puissance cubique.", "Vérifier mentalement avec les cubes usuels : $1,8,27,64$."] },
      ],
    },
  ],
  derivation: [
    {
      id: "derivation-tangente",
      domainId: "derivation",
      title: "Tangente et coût marginal",
      statement: ["Une entreprise a un coût $C$ tel que $C(2)=9$ et $C'(2)=4$."],
      questions: ["Donner le coefficient directeur de la tangente au point d’abscisse $2$.", "Écrire une équation de cette tangente.", "Interpréter $C'(2)$ dans le contexte."],
      correction: [
        { title: "Rappel de cours", details: ["$f'(a)$ est le coefficient directeur de la tangente en $a$.", "La tangente s’écrit $y=f'(a)(x-a)+f(a)$."] },
        { title: "Résolution", details: ["Le coefficient directeur vaut $4$.", "Une équation est $y=4(x-2)+9$.", "$C'(2)=4$ représente le coût marginal autour de $2$ unités."] },
        { title: "Méthode", details: ["Toujours relever $f(a)$ et $f'(a)$ séparément.", "Ne pas confondre coût total et coût marginal."] },
      ],
    },
    {
      id: "derivation-variations",
      domainId: "derivation",
      title: "Signe de la dérivée et variations",
      statement: ["On donne $f'(x)=3(x-1)(x-5)$ pour $x$ entre $0$ et $6$."],
      questions: ["Donner le signe de $f'$ sur $[0;1]$, $[1;5]$, $[5;6]$.", "En déduire les variations de $f$.", "Repérer la nature de l’extremum en $x=5$."],
      correction: [
        { title: "Rappel de cours", details: ["Le signe de $f'$ pilote les variations de $f$.", "Produit de deux facteurs : on repère les zéros puis les signes."] },
        { title: "Résolution", details: ["$f'$ est positive avant $1$, négative entre $1$ et $5$, positive après $5$.", "$f$ croît, puis décroît, puis croît.", "En $x=5$, $f'$ passe de $-$ à $+$ : minimum local."] },
        { title: "Méthode", details: ["Séparer l’étude du signe et la conclusion sur $f$.", "Écrire une phrase d’interprétation pour l’extremum."] },
      ],
    },
  ],
  suites: [
    {
      id: "suites-epargne",
      domainId: "suites",
      title: "Épargne par récurrence",
      statement: ["Un élève place 800 € à un taux annuel de $5\\%$. On note $C_n$ le capital après $n$ années."],
      questions: ["Écrire la relation de récurrence.", "Calculer $C_1$ puis $C_2$ sans calculatrice.", "Dire pourquoi la suite est croissante."],
      correction: [
        { title: "Rappel de cours", details: ["Une hausse de $5\\%$ correspond à une multiplication par $1{,}05$.", "En Première STMG, la relation de récurrence suffit pour modéliser."] },
        { title: "Résolution", details: ["$C_{n+1}=1{,}05C_n$ et $C_0=800$.", "$C_1=840$ puis $C_2=840\\times1{,}05=882$.", "La suite est croissante car on multiplie par un coefficient supérieur à $1$."] },
        { title: "Méthode", details: ["Toujours convertir le pourcentage en coefficient.", "Contrôler que le capital augmente : 882 est cohérent car supérieur à 800."] },
      ],
    },
    {
      id: "suites-remboursement",
      domainId: "suites",
      title: "Remboursement régulier",
      statement: ["Une dette de 1 200 € diminue de 90 € chaque mois. On note $D_n$ la dette après $n$ mois."],
      questions: ["Identifier la nature de la suite.", "Exprimer $D_n$.", "Déterminer le premier mois où la dette est inférieure ou égale à 300 €."],
      correction: [
        { title: "Rappel de cours", details: ["Une diminution constante correspond à une suite arithmétique.", "La forme est $D_n=D_0+nr$."] },
        { title: "Résolution", details: ["$D_0=1200$ et $r=-90$.", "$D_n=1200-90n$.", "$1200-90n\\le300$ donc $900\\le90n$, d’où $n\\ge10$."] },
        { title: "Méthode", details: ["Le signe de la raison doit refléter le contexte : une dette diminue, donc raison négative.", "Pour un seuil, garder le premier rang entier qui convient."] },
      ],
    },
  ],
  statistiques: [
    {
      id: "statistiques-ventes",
      domainId: "statistiques",
      title: "Ventes hebdomadaires",
      statement: ["Les ventes d’un produit sur sept jours sont : $18,24,21,30,27,24,31$."],
      questions: ["Calculer moyenne, médiane et étendue.", "Dire si la série est stable.", "Proposer un indicateur à suivre la semaine suivante."],
      correction: [
        { title: "Rappel de cours", details: ["La médiane se lit sur la série ordonnée.", "L’étendue mesure l’écart entre maximum et minimum."] },
        { title: "Résolution", details: ["Série ordonnée : $18,21,24,24,27,30,31$.", "Médiane : $24$. Moyenne : $175/7=25$.", "Étendue : $31-18=13$."] },
        { title: "Méthode", details: ["Comparer centre et dispersion évite une conclusion trop rapide.", "Ici les ventes tournent autour de 24–25 unités mais varient sensiblement."] },
      ],
    },
    {
      id: "statistiques-tableau-croise",
      domainId: "statistiques",
      title: "Tableau croisé et fréquences conditionnelles",
      statement: ["Dans une enquête, 40 clients sont en ligne, 60 en magasin. 30 clients en ligne et 42 en magasin sont satisfaits."],
      questions: ["Compléter les totaux du tableau.", "Calculer la fréquence de satisfaction parmi les clients en ligne.", "Comparer avec la fréquence parmi les clients en magasin."],
      correction: [
        { title: "Rappel de cours", details: ["Une fréquence conditionnelle se calcule avec le total de la catégorie condition.", "Ici on conditionne par le canal d’achat."] },
        { title: "Résolution", details: ["Le total est $100$ clients, dont $72$ satisfaits.", "En ligne : $30/40=0{,}75$, soit $75\\%$.", "En magasin : $42/60=0{,}70$, soit $70\\%$."] },
        { title: "Méthode", details: ["Identifier le bon dénominateur avant de calculer.", "Écrire une phrase de comparaison, pas seulement un nombre."] },
      ],
    },
  ],
  probabilites: [
    {
      id: "probabilites-service",
      domainId: "probabilites",
      title: "Satisfaction client",
      statement: ["60 % des clients achètent en ligne. Parmi eux, 90 % sont satisfaits. Parmi les autres clients, 75 % sont satisfaits."],
      questions: ["Construire mentalement l’arbre.", "Calculer $P(S)$.", "Calculer $P(L\\cap S)$."],
      correction: [
        { title: "Rappel de cours", details: ["Sur un chemin d’arbre, on multiplie.", "Pour obtenir un événement final, on additionne les chemins compatibles."] },
        { title: "Résolution", details: ["$P(L\\cap S)=0{,}60\\times0{,}90=0{,}54$.", "$P(\\overline L\\cap S)=0{,}40\\times0{,}75=0{,}30$.", "Donc $P(S)=0{,}54+0{,}30=0{,}84$."] },
        { title: "Méthode", details: ["Le résultat est une moyenne pondérée entre 75 % et 90 %.", "Cette vérification d’ordre de grandeur sécurise le calcul."] },
      ],
    },
    {
      id: "probabilites-bernoulli",
      domainId: "probabilites",
      title: "Deux épreuves indépendantes et Bernoulli",
      statement: ["Un service a une probabilité de succès $0{,}1$ à chaque appel. On observe deux appels indépendants."],
      questions: ["Calculer la probabilité d’un succès puis un échec.", "Calculer la probabilité d’exactement un succès.", "Expliquer pourquoi on additionne deux cas."],
      correction: [
        { title: "Rappel de cours", details: ["Indépendance : on multiplie sur un chemin.", "Exactement un succès sur deux appels correspond à deux chemins : succès-échec ou échec-succès."] },
        { title: "Résolution", details: ["$P(S puis \\bar S)=0{,}1\\times0{,}9=0{,}09$.", "$P(\\bar S puis S)=0{,}9\\times0{,}1=0{,}09$.", "Donc exactement un succès vaut $0{,}18$."] },
        { title: "Méthode", details: ["Lister les chemins avant de calculer.", "Les chemins sont incompatibles, donc on additionne."] },
      ],
    },
    {
      id: "probabilites-jeu",
      domainId: "probabilites",
      title: "Variable aléatoire et gain",
      statement: ["Un jeu rapporte 8 € avec probabilité $0{,}25$ et coûte 2 € sinon. On note $X$ le gain net."],
      questions: ["Donner les valeurs possibles de $X$.", "Calculer $E(X)$.", "Interpréter le résultat."],
      correction: [
        { title: "Rappel de cours", details: ["L’espérance est la moyenne pondérée des valeurs d’une variable aléatoire.", "Un gain net tient compte du coût."] },
        { title: "Résolution", details: ["Les gains nets sont $8$ et $-2$.", "$E(X)=8\\times0{,}25+(-2)\\times0{,}75=2-1{,}5=0{,}5$.", "Le gain moyen est de 0,50 € par partie."] },
        { title: "Méthode", details: ["Vérifier que les probabilités totalisent $1$.", "Une espérance positive n’assure pas un gain à chaque partie."] },
      ],
    },
  ],
  "algorithmique-tableur": [
    {
      id: "algo-prix",
      domainId: "algorithmique-tableur",
      title: "Prix, indice et algorithme",
      statement: ["Un prix de 120 € augmente de $8\\%$, puis on applique une remise de $15\\%$."],
      questions: ["Calculer le prix final.", "Calculer le taux global.", "Expliquer comment suivre les variables d’une boucle `while`."],
      correction: [
        { title: "Rappel de cours", details: ["Une hausse de $8\\%$ donne $1{,}08$.", "Une baisse de $15\\%$ donne $0{,}85$.", "Un taux global se calcule avec le produit des coefficients."] },
        { title: "Résolution", details: ["Coefficient global : $1{,}08\\times0{,}85=0{,}918$.", "Prix final : $120\\times0{,}918=110{,}16$ €.", "Taux global : $0{,}918-1=-0{,}082$, donc baisse de $8{,}2\\%$."] },
        { title: "Méthode", details: ["Faire un tableau avec les colonnes tour, prix, condition.", "À chaque tour, mettre à jour la variable puis tester à nouveau la condition."] },
      ],
    },
    {
      id: "algo-indices",
      domainId: "algorithmique-tableur",
      title: "Indices base 100",
      statement: ["Le chiffre d’affaires d’une PME passe de 80 000 € à 92 000 €. On utilise un indice base 100."],
      questions: ["Calculer l’indice final.", "Déduire le taux d’évolution.", "Écrire la formule tableur correspondante."],
      correction: [
        { title: "Rappel de cours", details: ["Un indice base 100 se calcule par $I=\\frac{V}{V_0}\\times100$.", "Le taux est $\\frac{V-V_0}{V_0}$."] },
        { title: "Résolution", details: ["$I=\\frac{92000}{80000}\\times100=1{,}15\\times100=115$.", "Le taux d’évolution est $+15\\%$.", "En tableur, on peut écrire `=B2/A2*100`."] },
        { title: "Méthode", details: ["Un indice supérieur à 100 traduit une hausse.", "Toujours relier l’indice au taux : 115 signifie 15 % de hausse."] },
      ],
    },
  ],
};

export const TRAINING_EXERCISES = Object.values(exerciseSeed).flat() satisfies TrainingExercise[];
