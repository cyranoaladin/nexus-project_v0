// Historical paper-entry endpoint delegates to the shared family creation service.
export {
  createFamilyHandler as createPaperEntryFamilyHandler,
  PAPER_ENTRY_MAX_CHILDREN,
  type PaperEntryFamilyDependencies,
  type PaperEntryDuplicateCandidate,
} from '@/lib/families/create-family';
