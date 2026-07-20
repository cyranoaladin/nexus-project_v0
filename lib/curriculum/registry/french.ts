import {
  curriculumVersionSchema,
  type CurriculumVersion,
} from '../schemas/curriculum';

const RAW_FRENCH_CURRICULA: CurriculumVersion[] = [
  {
    id: 'fr-french-troisieme-cycle4-2020',
    version: '2020.1',
    status: 'PUBLISHED',
    subject: 'FRENCH',
    level: 'TROISIEME',
    track: 'COLLEGE',
    subjectVariant: 'COMMON',
    effectiveFromAcademicYear: '2020-2021',
    officialSources: [{
      id: 'eduscol-cycle4-french-2020',
      authority: 'EDUSCOL',
      title: 'Programme de français du cycle 4 en vigueur en classe de troisième',
      uri: 'https://eduscol.education.gouv.fr/media/67722/download',
      publicationDate: '2020-07-30',
      bulletinReference: 'BO n° 31 du 30 juillet 2020',
    }],
  },
  {
    id: 'fr-french-seconde-gt-2019',
    version: '2019.1',
    status: 'PUBLISHED',
    subject: 'FRENCH',
    level: 'SECONDE',
    track: 'GENERAL_TECHNOLOGICAL',
    subjectVariant: 'COMMON',
    effectiveFromAcademicYear: '2019-2020',
    officialSources: [{
      id: 'bo-special-2019-1-french-seconde',
      authority: 'EDUSCOL',
      title: 'Programme de français de seconde générale et technologique',
      uri: 'https://eduscol.education.gouv.fr/sites/default/files/document/spe630annexe1062943pdf-84138.pdf',
      publicationDate: '2019-01-22',
      bulletinReference: 'BO spécial n° 1 du 22 janvier 2019',
    }],
  },
  {
    id: 'fr-french-premiere-general-2019',
    version: '2019.1',
    status: 'PUBLISHED',
    subject: 'FRENCH',
    level: 'PREMIERE',
    track: 'GENERAL',
    subjectVariant: 'COMMON',
    effectiveFromAcademicYear: '2019-2020',
    officialSources: [
      {
        id: 'bo-special-2019-1-french-premiere',
        authority: 'EDUSCOL',
        title: 'Programme de français de première de la voie générale',
        uri: 'https://eduscol.education.gouv.fr/sites/default/files/document/spe632annexe1063158pdf-84148.pdf',
        publicationDate: '2019-01-22',
        bulletinReference: 'BO spécial n° 1 du 22 janvier 2019',
      },
      {
        id: 'bo-2025-30-french-works-2026-2027',
        authority: 'MEN',
        title: 'Programme national d\'œuvres pour l\'année scolaire 2026-2027',
        uri: 'https://www.education.gouv.fr/bo/2025/Hebdo30/MENE2518792N',
        publicationDate: '2025-07-30',
        bulletinReference: 'BO n° 30 du 30 juillet 2025',
      },
    ],
  },
  {
    id: 'fr-french-terminale-transversal-2020',
    version: '2020.1',
    status: 'PUBLISHED',
    subject: 'FRENCH',
    level: 'TERMINALE',
    track: 'GENERAL',
    subjectVariant: 'TRANSVERSAL_EXPRESSION',
    effectiveFromAcademicYear: '2020-2021',
    officialSources: [{
      id: 'bo-2020-31-grand-oral',
      authority: 'MEN',
      title: 'Épreuve orale dite Grand oral de la classe terminale de la voie générale et technologique',
      uri: 'https://www.education.gouv.fr/bo/2020/Hebdo31/MENE2019312N',
      publicationDate: '2020-07-30',
      bulletinReference: 'BO n° 31 du 30 juillet 2020',
    }],
  },
];

export const FRENCH_CURRICULA: readonly CurriculumVersion[] = Object.freeze(
  RAW_FRENCH_CURRICULA.map((curriculum) => curriculumVersionSchema.parse(curriculum)),
);
