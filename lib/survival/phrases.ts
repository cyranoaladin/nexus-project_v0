import type { PhraseMagique } from './types';

export const PHRASES_MAGIQUES: PhraseMagique[] = [
  {
    id: 'phrase_1',
    context: 'Montrer qu une suite est arithmetique',
    template:
      'Je calcule la difference entre deux termes consecutifs : u1 - u0 = ___ . Cette difference est constante, donc la suite est arithmetique de raison r = ___ .',
    example:
      'Je calcule la difference entre deux termes consecutifs : u1 - u0 = 50. Cette difference est constante, donc la suite est arithmetique de raison r = 50.',
  },
  {
    id: 'phrase_2',
    context: 'Montrer qu une suite est geometrique',
    template:
      'Je calcule le quotient entre deux termes consecutifs : u1 / u0 = ___ . Ce quotient est constant, donc la suite est geometrique de raison q = ___ .',
    example:
      'Je calcule le quotient entre deux termes consecutifs : u1 / u0 = 1,10. Ce quotient est constant, donc la suite est geometrique de raison q = 1,10.',
  },
  {
    id: 'phrase_3',
    context: 'Calculer un terme suivant',
    template: 'On a u(n+1) = ___ x u(n) + ___ . Donc u1 = ___ x u0 + ___ = ___ .',
    example: 'On a u(n+1) = 1,1 x u(n) + 0. Donc u1 = 1,1 x 100 + 0 = 110.',
  },
  {
    id: 'phrase_4',
    context: 'Verifier qu une valeur est racine',
    template:
      'Je calcule f(___) en remplacant x par ___ dans l expression de f. Je trouve : f(___) = ___ . Donc ___ est bien une racine de f.',
    example:
      'Je calcule f(2) en remplacant x par 2 dans l expression de f. Je trouve : f(2) = 0. Donc 2 est bien une racine de f.',
  },
  {
    id: 'phrase_5',
    context: 'Conclure un calcul de probabilite simple',
    template:
      'Sur les ___ personnes au total, ___ correspondent a la condition. La probabilite vaut donc ___ / ___ = ___ .',
    example:
      'Sur les 200 personnes au total, 80 correspondent a la condition. La probabilite vaut donc 80 / 200 = 0,4.',
  },
  {
    id: 'phrase_6',
    context: 'Conclure une probabilite conditionnelle',
    template:
      'On regarde uniquement le groupe "___" qui contient ___ personnes. Parmi elles, ___ correspondent. La probabilite vaut donc ___ / ___ = ___ .',
    example:
      'On regarde uniquement le groupe "femmes" qui contient 80 personnes. Parmi elles, 30 correspondent. La probabilite vaut donc 30 / 80 = 0,375.',
  },
  {
    id: 'phrase_7',
    context: 'Conclure des variations',
    template:
      'La fonction f est croissante sur l intervalle [ ___ ; ___ ] et decroissante sur l intervalle [ ___ ; ___ ].',
    example:
      'La fonction f est croissante sur l intervalle [ 0 ; 2 ] et decroissante sur l intervalle [ 2 ; 5 ].',
  },
  {
    id: 'phrase_8',
    context: 'Conclure sur un extremum',
    template: 'Le maximum (ou minimum) est atteint pour x = ___ . Sa valeur est f(___) = ___ .',
    example: 'Le maximum est atteint pour x = 2. Sa valeur est f(2) = 12.',
  },
];

export function getPhraseMagique(id: string): PhraseMagique | undefined {
  return PHRASES_MAGIQUES.find((phrase) => phrase.id === id);
}
