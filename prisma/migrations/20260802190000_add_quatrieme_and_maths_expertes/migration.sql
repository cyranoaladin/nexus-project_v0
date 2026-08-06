-- A89.2/A89.3: additive enum support for the first Maths expertes pack and
-- Canonical Quatrieme passations. No table, column or row is changed.
ALTER TYPE "Subject" ADD VALUE IF NOT EXISTS 'MATHS_EXPERTES';
ALTER TYPE "GradeLevel" ADD VALUE IF NOT EXISTS 'QUATRIEME' BEFORE 'TROISIEME';
