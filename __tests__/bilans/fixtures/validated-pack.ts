import rawPack from '@/data/bilans/banks/maths-terminale-v1.json';
import { buildValidatedPack } from '@/lib/bilans/validators/contracts';

export const VALIDATED_PACK_FIXTURE = buildValidatedPack({
  slug: 'fixture-non-publiable-v0',
  version: 1,
  status: 'VALIDATED',
  review: {
    validatedBy: 'FIXTURE — JAMAIS UN ENSEIGNANT',
    validatedAt: '1970-01-01T00:00:00.000Z',
  },
  scoring: { domains: rawPack.scoring.domains },
  reporting: {
    rag: rawPack.reporting.rag,
    promptFiles: rawPack.reporting.promptFiles,
    outputSchemas: rawPack.reporting.outputSchemas,
  },
  validation: rawPack.validation,
});
