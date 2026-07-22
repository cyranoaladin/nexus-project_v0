# Générateur documentaire Pré-rentrée 2026

## Prérequis

- version Node déclarée par le projet ;
- Python 3.12 ;
- `qpdf`, Poppler (`pdftotext`, `pdffonts`, `pdftoppm`) et les bibliothèques système WeasyPrint ;
- `npm ci` ;
- `python -m pip install -r scripts/pre-rentree/requirements.lock`.

## Contrat

Le compilateur TypeScript lit uniquement les sources canoniques et produit `generated/pre-rentree-2026/publication.snapshot.json`. Le renderer Python reçoit ce snapshot et ne résout aucune valeur métier depuis le HTML, un PDF antérieur ou le réseau.

## Commandes

Depuis la racine du dépôt, les commandes de premier niveau `npm run pre-rentree:*` couvrent nettoyage, snapshot, tests, build, audit, paquets et vérification. `npm run pre-rentree:ci` exécute la chaîne complète. Le build écrit sous `.artifacts/pre-rentree-2026/` avec staging et remplacement atomique ; l’audit produit un second build public et compare les empreintes avant packaging.

Le build complet utilise Chromium localement pour Axe, la capture bureau/mobile et la vérification de l’absence de débordement. Aucun appel réseau n’est nécessaire au rendu.

Après une inspection humaine réelle des rasters, de la planche de contact et des captures responsive, l’assistant peut consigner sa revue avec `python scripts/pre-rentree/record_assistant_visual_review.py --artifact-root .artifacts/pre-rentree-2026/build --evidence "planche de contact" --evidence "couverture et pages intérieures" --evidence "captures bureau et mobile"`. Cette commande refuse les contrôles automatisés en échec et ne modifie jamais le statut de revue propriétaire.

Le paquet de revue matérialise aussi les quatorze tests de positionnement, les soixante-dix évaluations rapides, les soixante-dix livrables, les kits de communication, un CRM vierge, onze gabarits anonymes et le modèle économique XLSX. Ces sorties ne sont jamais suivies dans Git et ne constituent pas une autorisation de publication ou de collecte nominative.

Le HTML accessible est la référence d’accessibilité. Le pipeline ne revendique pas une conformité PDF/UA faute de validation dédiée avec un outil approprié.
