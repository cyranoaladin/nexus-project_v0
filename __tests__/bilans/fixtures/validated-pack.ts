import entryPack from '@/data/bilans/banks/entree-terminale-maths-v1.json';
import endPack from '@/data/bilans/banks/maths-terminale-bilan-v1.json';
import { buildValidatedPack } from '@/lib/bilans/validators/contracts';

function fixtureFrom(pack: typeof entryPack | typeof endPack) {
  return buildValidatedPack({
    slug: 'fixture-non-publiable-v0',
    version: 1,
    status: 'VALIDATED',
    review: {
      validatedBy: 'FIXTURE — JAMAIS UN ENSEIGNANT',
      validatedAt: '1970-01-01T00:00:00.000Z',
    },
    scoring: { domains: pack.scoring.domains },
    reporting: {
      rag: pack.reporting.rag,
      promptFiles: pack.reporting.promptFiles,
      outputSchemas: pack.reporting.outputSchemas,
    },
    validation: pack.validation,
  });
}

export const VALIDATED_PACK_FIXTURE = fixtureFrom(endPack);
export const ENTRY_VALIDATED_PACK_FIXTURE = fixtureFrom(entryPack);
