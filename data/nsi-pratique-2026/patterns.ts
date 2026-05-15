import type { NsiPattern } from './types';

export const nsiPatterns: NsiPattern[] = [
  {
    id: 1,
    title: 'Parcours avec accumulateur conditionnel',
    whenToUse: 'Compter, sommer, faire une moyenne sur un sous-ensemble.',
    mnemonic: 'Filtre, somme, compte, divise — None si zéro.',
    code: `def moyenne_conditionnelle(donnees, champ, valeur):\n    total = 0\n    compteur = 0\n    for element in donnees:\n        if element[champ] == valeur:\n            total += element['salaire']\n            compteur += 1\n    if compteur == 0:\n        return None\n    return total / compteur`,
    relatedSubjects: [1, 2, 6, 9, 10, 15, 16, 17, 18, 19, 20],
    traps: [
      'Division par zéro si aucun élément ne correspond',
      'Oublier le cas None quand le compteur est nul',
    ],
  },
  {
    id: 2,
    title: 'Filtrer sans modifier la liste initiale',
    whenToUse: 'Purger, sélectionner, retirer les éléments extrêmes.',
    mnemonic: 'Ne supprime jamais pendant que tu parcours — construis une nouvelle liste.',
    code: `def filtrer(liste, condition_a_garder):\n    resultat = []\n    for x in liste:\n        if condition_a_garder(x):\n            resultat.append(x)\n    return resultat\n\n# Forme compacte (compréhension)\ndef filtrer_compact(liste):\n    return [x for x in liste if 20 <= x['temperature'] <= 25]`,
    relatedSubjects: [1, 4, 6, 7, 10, 12, 18],
    traps: [
      'Modifier la liste pendant le parcours (remove dans une boucle for)',
      'Oublier de construire une nouvelle liste',
    ],
  },
  {
    id: 3,
    title: 'Dictionnaire de listes (regroupement par clé)',
    whenToUse: 'Regrouper des mesures par plante, des consultations par animal, des mouvements par catégorie.',
    mnemonic: 'Initialise toutes les clés vides — puis remplis.',
    code: `def regrouper(elements, cles_connues, cle_du_groupe):\n    groupes = {cle: [] for cle in cles_connues}\n    for element in elements:\n        cle = element[cle_du_groupe]\n        if cle in groupes:\n            groupes[cle].append(element)\n    return groupes`,
    relatedSubjects: [4, 17, 19, 20],
    traps: [
      "KeyError si la clé n'est pas initialisée",
      'Oublier de tester if cle in groupes',
    ],
  },
  {
    id: 4,
    title: 'Récursivité sur dictionnaire imbriqué',
    whenToUse: 'JSON imbriqué (empreinte carbone, arbre de catégories).',
    mnemonic: 'Dict → descends. Nombre → traite. False seulement à la fin.',
    code: `def total_recursif(d):\n    resultat = 0\n    for valeur in d.values():\n        if isinstance(valeur, dict):\n            resultat += total_recursif(valeur)\n        else:\n            resultat += valeur\n    return resultat\n\ndef existe_valeur_aberrante(d, seuil):\n    for valeur in d.values():\n        if isinstance(valeur, dict):\n            if existe_valeur_aberrante(valeur, seuil):\n                return True\n        else:\n            if valeur > seuil:\n                return True\n    return False  # False UNIQUEMENT à la fin`,
    relatedSubjects: [5],
    traps: [
      'return False dans la boucle arrête la recherche trop tôt',
      'Oublier isinstance → TypeError sur un sous-dictionnaire',
      "Ne pas retourner le résultat de l'appel récursif",
    ],
  },
  {
    id: 5,
    title: 'k plus proches voisins (KNN)',
    whenToUse: 'Prédiction (habitat du renard, salaire équitable).',
    mnemonic: 'Distances → tri → k premiers → vote ou moyenne.',
    code: `from math import sqrt\n\ndef distance(a, b):\n    return sqrt(sum((a[c] - b[c])**2 for c in ['critere1', 'critere2']))\n\ndef k_plus_proches(nouveau, donnees, k):\n    distances = []\n    for item in donnees:\n        distances.append((distance(nouveau, item), item))\n    distances.sort(key=lambda t: t[0])\n    return distances[:k]\n\ndef vote_majoritaire(voisins, attribut):\n    oui = sum(1 for d, item in voisins if item[attribut])\n    return oui > len(voisins) / 2`,
    relatedSubjects: [2, 11],
    traps: [
      "Accéder au tuple : voisin['champ'] au lieu de voisin[1]['champ']",
      'Tri sans key=lambda → TypeError si distances égales',
      'Majorité >= k/2 (large) vs > k/2 (stricte)',
    ],
  },
  {
    id: 6,
    title: 'Lecture CSV avec conversions de types',
    whenToUse: 'Renards, ballon-sonde, budget, météo.',
    mnemonic: 'CSV → tout est str → je convertis ce qui se calcule.',
    code: `import csv\n\ndef importer(chemin):\n    elements = []\n    with open(chemin, encoding='utf-8') as f:\n        lecteur = csv.DictReader(f, delimiter=';')\n        for ligne in lecteur:\n            element = {\n                'id': int(ligne['id']),\n                'poids': float(ligne['poids']),\n                'nom': ligne['nom'],\n                'date': ligne['date_arrivee']\n            }\n            elements.append(element)\n    return elements`,
    relatedSubjects: [12, 13, 16, 17],
    traps: [
      'Oublier int() ou float() → comparaisons sur chaînes',
      'Délimiteur ; (français) vs , (anglo-saxon)',
      "Virgule décimale : .replace(',', '.') avant float()",
    ],
  },
  {
    id: 7,
    title: 'Recherche du minimum/maximum avec égalités',
    whenToUse: 'Ballon-sonde (toutes les altitudes au minimum), Leitner (toutes les cartes au niveau minimal).',
    mnemonic: 'Trouve le min — puis filtre tous ceux qui l\'atteignent.',
    code: `def tous_les_minima(elements, cle):\n    if not elements:\n        return []\n    valeur_min = min(e[cle] for e in elements)\n    return [e for e in elements if e[cle] == valeur_min]`,
    relatedSubjects: [10, 13, 14, 21],
    traps: [
      'Renvoyer seulement le premier minimum au lieu de tous',
      'Liste vide → min() lève ValueError',
    ],
  },
  {
    id: 8,
    title: 'Validation d\'une trame binaire avant décodage',
    whenToUse: 'QR code, transmission DEMETER, BCD.',
    mnemonic: 'Valide d\'abord, décode ensuite. Et garde les zéros initiaux.',
    code: `LONGUEUR_TRAME = 32\n\ndef est_valide(trame):\n    return len(trame) == LONGUEUR_TRAME and all(c in '01' for c in trame)\n\ndef bin_vers_dec(bits):\n    valeur = 0\n    for b in bits:\n        valeur = valeur * 2 + int(b)\n    return valeur\n\ndef dec_vers_bin_8bits(n):\n    return format(n, '08b')`,
    relatedSubjects: [3, 8, 22, 23],
    traps: [
      'Décoder avant de valider → ValueError sur trame corrompue',
      "bin(n) renvoie '0b...' avec préfixe et sans zéros initiaux",
      "Utiliser format(n, '08b') pour conserver les 8 bits",
    ],
  },
];
