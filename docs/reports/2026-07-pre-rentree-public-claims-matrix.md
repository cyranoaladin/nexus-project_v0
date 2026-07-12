# Pré-rentrée 2026 — matrice des engagements publics

## Date et périmètre

12 juillet 2026. Cette matrice couvre les promesses actives de la landing, de la homepage, du bilan prérempli, de `/stages` et de `/offres`. Elle ne transforme pas un service annuel Nexus en service inclus dans un pack de Pré-rentrée.

## Légende

- `INCLUDED` : livrable inclus et soutenu par le contrat de campagne.
- `INCLUDED_WITH_LIMIT` : inclus dans les limites explicites du stage collectif.
- `REQUIRES_OWNER_CONFIRMATION` : ne peut être confirmé publiquement sans preuve opérationnelle propriétaire.
- `NOT_INCLUDED` : hors des quatre packs.
- `REMOVE_FROM_PUBLIC_COPY` : formulation à retirer si elle réapparaît.

## Matrice

| Affirmation publique auditée | Page / composant | Service promis | Preuve contractuelle | Responsable opérationnel | Coût ou charge associé | Statut |
|---|---|---|---|---|---|---|
| « Un diagnostic des acquis permet d’identifier les priorités » | Landing, bloc Méthode | Positionnement initial au début du module | `content.method`, contrat produit, cinq séances par module | Enseignant du module | Temps de séance et préparation ; montant à confirmer | `INCLUDED_WITH_LIMIT` |
| « Travail guidé en groupe réduit » | Landing, Méthode et informations pratiques | Accompagnement collectif de 3 à 5 élèves | Manifeste `capacity`, pricing canonique et contrat produit | Enseignant du module | 10 h d’enseignement par cohorte-module | `INCLUDED` |
| « Exercices progressifs et correction explicite » | Landing, Méthode et programmes | Exercices et corrections pendant les séances | `content.method` et 60 séances versionnées | Enseignant du module | Temps de séance et préparation | `INCLUDED` |
| « Les exercices sont différenciés selon le profil déclaré » | Configurateur et résumé | Adaptation au profil au sein de la cohorte existante | Matrice profil × matière et variantes des 12 modules | Responsable pédagogique puis enseignant | Préparation différenciée à chiffrer | `INCLUDED_WITH_LIMIT` |
| « Synthèse des acquis observés et recommandations de travail » | Landing, Méthode | Bilan pédagogique de fin de module, sans promesse de rapport exhaustif | `content.method` et livrables des modules | Enseignant du module | Temps de bilan à confirmer | `INCLUDED_WITH_LIMIT` |
| « Supports de travail fournis par Nexus » | Informations pratiques et FAQ | Supports nécessaires aux séances | `content.practical.material` | Responsable pédagogique / logistique | Impression ou mise à disposition ; coût inconnu | `INCLUDED` |
| « Une à quatre matières » | Homepage et landing | Choix de 1 à 4 modules selon le pack | Pricing canonique et DTO landing | Administration / responsable pédagogique | Charge dépendant des cohortes réellement ouvertes | `INCLUDED` |
| Validation pédagogique requise pour une spécialité non déclarée ou non conservée | Configurateur, résumé et bilan | Revue humaine avant confirmation | Classifieur profil × matière et contrat de confirmation | Responsable pédagogique | Temps de qualification à chiffrer | `INCLUDED_WITH_LIMIT` |
| « Une demande peut être placée en liste d’attente » | FAQ | Enregistrement administratif d’une demande, sans confirmation de place | `content.faq`, capacité maximale 5 | Administration | Charge administrative inconnue | `INCLUDED_WITH_LIMIT` |
| « Un rattrapage peut être étudié (…) sans être garanti » | FAQ | Étude au cas par cas, sans droit au rattrapage | `content.faq`, analyse d’écart CGV | Responsable pédagogique / administration | Dépend d’une place et d’une ressource disponibles | `INCLUDED_WITH_LIMIT` |
| Matériel personnel : cahier, trousse, calculatrice concernée | Informations pratiques | Liste du matériel apporté par l’élève | `content.practical.material` | Famille | À la charge de la famille | `INCLUDED_WITH_LIMIT` |
| Matériel NSI/SNT et Physique-Chimie fourni et disponible | Programmes / organisation réelle | Équipement pédagogique spécialisé | Gates `GATE-NSI-001`, `GATE-PC-001`, `GATE-PC-002` | Responsable logistique / pédagogique | Inventaire et coût inconnus | `REQUIRES_OWNER_CONFIRMATION` |
| Suivi individualisé continu ou suivi annuel | Toute surface publique | Accompagnement au-delà du stage | Aucun engagement dans les quatre packs | — | Non chiffré | `NOT_INCLUDED` |
| Espace parent actif pendant le stage | Toute surface publique | Accès plateforme famille dédié | Aucun contrat de campagne | — | Non chiffré | `NOT_INCLUDED` |
| ARIA incluse | Toute surface publique | Assistant numérique / IA | Aucun entitlement dans les packs | — | Non chiffré | `NOT_INCLUDED` |
| Coaching individuel | Toute surface publique | Séance individuelle distincte | Aucun produit canonique dans la campagne | — | Non chiffré | `NOT_INCLUDED` |
| Cours d’urgence ou rattrapage garanti | Toute surface publique | Heures supplémentaires garanties | Explicitement exclu par la FAQ | — | Non chiffré | `REMOVE_FROM_PUBLIC_COPY` |
| Priorité de réservation ou place garantie par la pré-inscription | Toute surface publique | Blocage automatique d’une place | Contredit le processus de pré-inscription | — | Non applicable | `REMOVE_FROM_PUBLIC_COPY` |
| Résultat scolaire, passage ou note garantis | Toute surface publique | Garantie de résultat | Contrat produit : obligation de moyens uniquement | — | Non applicable | `REMOVE_FROM_PUBLIC_COPY` |

## Conclusion opérationnelle

Le frontend audité ne promet ni ARIA, ni espace parent, ni coaching individuel, ni suivi annuel, ni rattrapage garanti, ni priorité de réservation. Les supports et le travail collectif sont inclus. La disponibilité réelle des trois enseignants, des deux salles et des équipements NSI/SNT et Physique-Chimie reste une validation propriétaire préalable à toute confirmation de cohorte.
