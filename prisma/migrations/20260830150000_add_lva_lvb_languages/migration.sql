-- Additive-only extension of the existing Subject enum for the six
-- languages offered as LVA/LVB by the candidat-individuel workflow.
ALTER TYPE "Subject" ADD VALUE IF NOT EXISTS 'ARABE';
ALTER TYPE "Subject" ADD VALUE IF NOT EXISTS 'ITALIEN';
ALTER TYPE "Subject" ADD VALUE IF NOT EXISTS 'RUSSE';
ALTER TYPE "Subject" ADD VALUE IF NOT EXISTS 'ALLEMAND';
