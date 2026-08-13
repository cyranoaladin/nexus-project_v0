-- Anti-doublon de foyer (saisie papier) — correspondance de nom robuste.
--
-- Le pré-filtre de recherche des foyers candidats comparait les noms avec
-- `ILIKE` exact : insensible à la casse, mais PAS aux accents ni à la
-- ponctuation. Une variante comme « ben-rhouma » ou « Bén Rhouma » n'était
-- donc jamais remontée, et un doublon se créait silencieusement.
--
-- On dote la recherche d'une clé de nom normalisée, calculée par une fonction
-- IMMUTABLE et matérialisée dans un index d'expression partiel (parents
-- actifs uniquement). Choix de l'index d'expression plutôt qu'une colonne
-- stockée : même déterminisme et même performance, mais SANS colonne à
-- maintenir en cohérence sur chaque écriture (aucun trigger, aucun chemin
-- d'écriture applicatif à modifier, aucun backfill — l'index se peuple depuis
-- les colonnes existantes). La même fonction sert à la construction de
-- l'index ET à la requête : aucune dérive possible.

-- Normalisation d'un composant de nom : pli des accents latins (translate,
-- insensible à la locale, contrairement à un lower() seul), minuscules,
-- apostrophes/traits d'union ramenés à un espace, espaces multiples réduits.
CREATE OR REPLACE FUNCTION nexus_normalize_name_part(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        lower(
          translate(
            coalesce(value, ''),
            'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÑñÇçŸÿ',
            'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuNnCcYy'
          )
        ),
        '[''’`\-]+', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    )
  )
$$;

-- Clé de foyer : prénom et nom normalisés séparément puis joints par une
-- tabulation. Le séparateur préserve la frontière entre les deux champs, pour
-- que « Ali Ben » + « Salah » ne colle pas à « Ali » + « Ben Salah ».
CREATE OR REPLACE FUNCTION nexus_household_name_key(first_name text, last_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT nexus_normalize_name_part(first_name) || E'\t' || nexus_normalize_name_part(last_name)
$$;

-- Index d'expression partiel : seuls les parents actifs (non fusionnés) sont
-- des cibles de rattachement, ce qui garde l'index petit et la recherche
-- rapide. La requête filtre exactement sur ce prédicat pour l'exploiter.
CREATE INDEX IF NOT EXISTS "users_household_name_key_idx"
ON "users" (nexus_household_name_key("firstName", "lastName"))
WHERE "role" = 'PARENT' AND "mergedIntoUserId" IS NULL;
