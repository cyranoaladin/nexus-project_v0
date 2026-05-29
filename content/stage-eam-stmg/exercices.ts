import type { DomainId, TrainingExercise } from "./types";

// SOURCE: EAM_entraienemnt, Annales_BAC_MATHS filtrées STMG, sujets zéro Éduscol.
const exerciseSeed: Record<DomainId, TrainingExercise[]> = {
  fonctions: [
    {
      id: "fonctions-marge",
      domainId: "fonctions",
      title: "Marge d’une boutique et second degré",
      statement: ["Une boutique modélise sa marge journalière par $M(x)=-2x^2+40x+120$, où $x$ est le nombre de remises de 5 € accordées."],
      questions: ["Calculer $M(0)$ et $M(10)$.", "Déterminer l’abscisse du sommet.", "Interpréter le maximum dans le contexte."],
      correction: [
        { title: "Rappel de cours", details: ["Pour un trinôme $ax^2+bx+c$, l’abscisse du sommet est $-\\frac{b}{2a}$.", "Si $a<0$, le sommet correspond à un maximum."] },
        { title: "Résolution", details: ["$M(0)=120$.", "$M(10)=-2\\times100+400+120=320$.", "$\\alpha=-\\frac{40}{2\\times(-2)}=10$."] },
        { title: "Méthode", details: ["La marge maximale est atteinte pour 10 remises et vaut 320 €.", "Sans calculatrice, on pose les carrés simples et on contrôle le signe de $a$."] },
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
  ],
  suites: [
    {
      id: "suites-epargne",
      domainId: "suites",
      title: "Épargne et intérêts composés",
      statement: ["Un élève place 800 € à un taux annuel de $5\\%$. On note $C_n$ le capital après $n$ années."],
      questions: ["Donner la nature de la suite.", "Écrire $C_n$ en fonction de $n$.", "Calculer $C_2$ sans calculatrice."],
      correction: [
        { title: "Rappel de cours", details: ["Une hausse de $5\\%$ correspond à une multiplication par $1{,}05$.", "Répéter la même évolution crée une suite géométrique."] },
        { title: "Résolution", details: ["$C_{n+1}=1{,}05C_n$, donc la suite est géométrique de raison $1{,}05$.", "$C_n=800\\times1{,}05^n$.", "$C_2=800\\times1{,}1025=882$ €."] },
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
      id: "statistiques-ajustement",
      domainId: "statistiques",
      title: "Ajustement affine d’un chiffre d’affaires",
      statement: ["Une droite d’ajustement du chiffre d’affaires mensuel est $y=4x+32$, avec $y$ en milliers d’euros et $x$ le rang du mois."],
      questions: ["Interpréter $4$ et $32$.", "Prévoir le chiffre d’affaires au mois $6$.", "Dire pourquoi il faut rester prudent."],
      correction: [
        { title: "Rappel de cours", details: ["Dans $y=ax+b$, $a$ est la pente et $b$ l’ordonnée à l’origine.", "Une droite d’ajustement donne une tendance, pas une certitude."] },
        { title: "Résolution", details: ["$4$ signifie environ +4 milliers d’euros par mois.", "$32$ est la valeur modélisée au rang $0$.", "Pour $x=6$, $y=4\\times6+32=56$, soit 56 000 €."] },
        { title: "Méthode", details: ["Toujours rappeler l’unité.", "Une prévision hors des données observées doit être formulée avec prudence."] },
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
  "algorithmique-information": [
    {
      id: "algo-prix",
      domainId: "algorithmique-information",
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
      domainId: "algorithmique-information",
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
