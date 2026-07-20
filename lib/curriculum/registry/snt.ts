import {
  curriculumVersionSchema,
  type CurriculumVersion,
} from '../schemas/curriculum';

const RAW_SNT_CURRICULA: CurriculumVersion[] = [
  {
    id: 'fr-snt-readiness-troisieme-2020',
    version: '2020.1',
    status: 'PUBLISHED',
    subject: 'SNT',
    level: 'TROISIEME',
    track: 'COLLEGE',
    subjectVariant: 'SNT_READINESS',
    effectiveFromAcademicYear: '2020-2021',
    officialSources: [{
      id: 'eduscol-cycle4-technology-2020',
      authority: 'EDUSCOL',
      title: 'Socle commun et programme de technologie du cycle 4 préparant à la SNT',
      uri: 'https://eduscol.education.gouv.fr/media/67722/download',
      publicationDate: '2020-07-30',
      bulletinReference: 'BO n° 31 du 30 juillet 2020',
    }],
  },
  {
    id: 'fr-snt-seconde-gt-2019',
    version: '2019.1',
    status: 'PUBLISHED',
    subject: 'SNT',
    level: 'SECONDE',
    track: 'GENERAL_TECHNOLOGICAL',
    subjectVariant: 'COMMON',
    effectiveFromAcademicYear: '2019-2020',
    officialSources: [{
      id: 'bo-special-2019-1-snt-seconde',
      authority: 'EDUSCOL',
      title: 'Programme de sciences numériques et technologie de la classe de seconde générale et technologique',
      uri: 'https://eduscol.education.gouv.fr/sites/default/files/document/spe631annexe1062955pdf-84142.pdf',
      publicationDate: '2019-01-22',
      bulletinReference: 'BO spécial n° 1 du 22 janvier 2019',
    }],
  },
];

export const SNT_CURRICULA: readonly CurriculumVersion[] = Object.freeze(
  RAW_SNT_CURRICULA.map((curriculum) => curriculumVersionSchema.parse(curriculum)),
);
