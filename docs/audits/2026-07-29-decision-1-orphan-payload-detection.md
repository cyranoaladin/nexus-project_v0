# Décision 1 — inversion de `--rendered` : ce qui marche, ce qui ne marche pas

Date : 2026-07-29

## Ce qui a été tenté

`--rendered` (et `public-content-audit.mjs`) ne cherchaient que des mots connus à l'avance — ils avaient raté `rationale` faute de le chercher. Décision 1 demandait l'inverse : détecter tout champ présent dans la charge d'hydratation, jamais affiché nulle part, sans connaître son nom à l'avance.

**Implémenté** dans `scripts/marketing/public-content-audit.mjs` : extraction des paires `"clé":"valeur"` de la charge de flux RSC (`self.__next_f.push(...)`), comparaison de chaque valeur contre le texte visible réellement rendu de la page.

## Trois itérations, chacune honnêtement mesurée

1. **Inversion totale (toute sous-chaîne entre guillemets)** : 5649 findings sur 37 pages. Inutilisable — matche des données de tracé SVG (`"d":"m21 21-4.34..."`), des artefacts de sérialisation du protocole RSC (`,0,0,0,0,true]]`), des chemins internes webpack. Le format RSC est un protocole structuré, pas du JSON simple — le parser correctement nécessiterait un vrai parseur du protocole, pas une regex.
2. **Approche intermédiaire (clé:valeur, clé en forme d'identifiant)** — exactement ce que le point 1.2 anticipait. 1191 findings. Deux catégories de bruit identifiées et corrigées, chacune avec preuve :
   - `content` (balises `<meta>`) — un attribut, jamais un nœud de texte visible par nature. Exclu.
   - Échappements Unicode JS (`&` pour `&`) non décodés dans la charge, alors que le texte visible utilise l'entité HTML `&amp;` — décodage ajouté. Confirmé sur `/mentions-legales` : « STE M&M ACADEMY SUARL » ne matchait qu'à cause de ce défaut de décodage, pas d'une vraie fuite.
   - Texte du gestionnaire "page introuvable" partagé par Next.js sur **toutes** les pages (mécanisme de navigation client rapide) — exclu comme exception documentée et datée, même mécanisme que pour `--artifacts`.
3. **Après ces trois corrections** : **759 findings.**

## Validation du principe : `rationale` retrouvé sans le nommer

```
$ node scripts/marketing/public-content-audit.mjs --base-url http://127.0.0.1:3916
orphan-payload-string: /offres: "rationale: "Loss-leader assumé par décision Shark..."
```

**Confirmation directe** : la détection inversée retrouve la fuite déjà connue (`rationale`) sans que son nom ait été inscrit dans aucun motif — exactement l'objectif de la Décision 1.

## Ce qui ne marche pas, et pourquoi ce n'est pas un défaut de réglage

Les 759 findings restants se répartissent ainsi :

| Page | Findings | Nature |
|---|---|---|
| `/stages/pre-rentree-2026` (+ `/pre-rentree`, même page via redirect) | 308×2 | Catalogue de modules pédagogiques (titres/objectifs de séances SVT, Maths, etc.) — contenu réel, destiné à devenir public, transmis pour un composant interactif (sélecteur/accordéon) qui ne l'affiche qu'après une action de l'utilisateur |
| `/recommandation` | 44 | Titres/matières des offres du configurateur — même nature : données d'un assistant interactif, révélées progressivement, pas au premier rendu |
| Autres pages avec compteurs 8-21 | ~90 | Variantes du même phénomène (préparations, candidat libre, etc.) |

**Limite honnête, pas un manque de réglage** : ces contenus sont réels, non sensibles, et légitimement transmis pour une interaction progressive (accordéon, assistant pas-à-pas) — un simple `fetch()` d'une page ne peut pas distinguer « donnée jamais affichée » de « donnée affichée seulement après un clic » sans piloter un navigateur réel à travers toutes les interactions possibles (un investissement d'ingénierie sans commune mesure avec ce lot — proche de ce qu'un test Playwright complet ferait, pas un script de scan).

**Limite supplémentaire découverte** : la détection ne capture que les valeurs de type chaîne (`"clé":"valeur"`). `pack_product_ids` (un TABLEAU de chaînes, `["pre2026-pack-1", ...]`) n'a pas cette forme et **n'est pas retrouvé par cette détection** — seul le motif nommé (`internalTokenPatterns`) le trouve. L'inversion ne remplace donc pas les motifs nommés existants ; elle les complète.

## Décision 1.4 — couverture partielle, documentée, non branchée

Conformément à l'alternative explicitement prévue : **pas de branchement en CI**, ni bloquant ni dans le job non bloquant existant. Documenté dans l'inventaire des auditeurs comme outil de diagnostic manuel, à exécuter ponctuellement par un humain qui trie les résultats — exactement la démarche suivie ici pour distinguer `rationale` (réel) du catalogue de modules (bénin, interactif). Retenu tel quel dans `scripts/marketing/public-content-audit.mjs`, disponible pour un futur audit manuel, jamais automatique.
