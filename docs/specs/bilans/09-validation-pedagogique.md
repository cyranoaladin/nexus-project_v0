# Validation pédagogique d'un pack de bilan

## Objet

Cette procédure conditionne toute mise en service d'un pack. Un pack `DRAFT` peut être testé techniquement, mais il ne peut jamais atteindre le gateway métier ni être publié.

## Personne habilitée

La validation est réalisée par un enseignant nommé de la discipline concernée. La trace de revue mentionne son identité professionnelle et sa qualification dans la discipline.

## Périmètre de la revue

L'enseignant examine individuellement chaque item, sa formulation, sa réponse attendue, chacun de ses distracteurs et son explication. Il relit également chaque prompt d'agent, les règles de restitution par audience et les critères de validation automatique.

## Signature

La validation renseigne `review.validatedBy`, `review.validatedAt` et porte sur une version déterminée du pack. Le pack signé conserve les chemins et checksums exacts de tous ses prompts.

## Révocation automatique

Toute modification d'un item, d'un distracteur, d'une explication, d'un prompt ou d'un checksum annule la validation. La version du pack est alors incrémentée, son statut revient à `DRAFT` et les champs de validation redeviennent nuls.

## Trace conservée

La preuve comprend le pack signé et le paquet de revue aveugle issu de la recette technique. La revue d'un pack ne remplace pas la validation humaine de chaque rapport avant publication.
