# Parité de la fixture E2E standalone

## Causes observées

La campagne auth de l'image 61ef71c a terminé avec 584 réussites, huit échecs
et quatre tests non exécutés. Deux échecs diagnostic concernent la lecture du
sujet PDF avant dépôt : l'application répond FILE_NOT_FOUND, sans preuve d'un
défaut PDFJS. Le runner écrit la fixture sous sa propre racine documentaire,
alors que l'application lit un volume distinct.

Les six échecs vidéo attendent l'initialisation Jitsi. L'origine publique était
définie à l'exécution du serveur seulement ; Next compile cette configuration
dans le bundle navigateur. Une variable du conteneur ne répare pas le bundle.

## Correction et limites

Le runner et l'application partagent explicitement le même volume et la même
racine documentaire. L'image E2E compile l'origine Jitsi `.test` utilisée par
le runtime isolé ; les tests interceptent cette origine sans appel réel.

Le niveau HTTP de la fixture configure AV disabled avec E2E_DISPOSABLE_STACK=1,
comme le job CI existant. Cette exemption ne vaut pas preuve d'antivirus :
le niveau moteur réel reste distinct et production refuse ce mode sans le
marqueur jetable. Aucune configuration de production n'est changée.

## Tests

Deux nouveaux contrats échouent sur les deux écarts, puis les deux suites
bootstrap/ARIA passent, soit 31 tests. Une première commande utilisait
jest.config.unit.js et ne découvrait aucun test ; la reproduction RED et le
résultat GREEN proviennent de jest.unit.config.js, configuration canonique.
La validation des parcours navigateur sur une nouvelle image reste requise.
