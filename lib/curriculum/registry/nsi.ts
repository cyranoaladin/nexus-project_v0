import {
  curriculumVersionSchema,
  type CurriculumVersion,
} from '../schemas/curriculum';

const RAW_NSI_CURRICULA: CurriculumVersion[] = [
  {
    id: 'fr-nsi-premiere-speciality-2019',
    version: '2019.1',
    status: 'PUBLISHED',
    subject: 'NSI',
    level: 'PREMIERE',
    track: 'GENERAL',
    subjectVariant: 'SPECIALITY',
    effectiveFromAcademicYear: '2019-2020',
    officialSources: [{
      id: 'bo-special-2019-1-nsi-premiere-speciality',
      authority: 'EDUSCOL',
      title: 'Programme de spécialité numérique et sciences informatiques de première générale',
      uri: 'https://eduscol.education.gouv.fr/sites/default/files/document/spe632annexe1063166pdf-84154.pdf',
      publicationDate: '2019-01-22',
      bulletinReference: 'BO spécial n° 1 du 22 janvier 2019',
    }],
  },
  {
    id: 'fr-nsi-terminale-speciality-2020',
    version: '2020.1',
    status: 'PUBLISHED',
    subject: 'NSI',
    level: 'TERMINALE',
    track: 'GENERAL',
    subjectVariant: 'SPECIALITY',
    effectiveFromAcademicYear: '2020-2021',
    officialSources: [{
      id: 'bo-special-2019-8-nsi-terminale-speciality',
      authority: 'EDUSCOL',
      title: 'Programme de spécialité numérique et sciences informatiques de terminale générale',
      uri: 'https://eduscol.education.gouv.fr/sites/default/files/document/spe246annexe1158903pdf-84157.pdf',
      publicationDate: '2019-07-25',
      bulletinReference: 'BO spécial n° 8 du 25 juillet 2019',
    }],
  },
];

export const NSI_CURRICULA: readonly CurriculumVersion[] = Object.freeze(
  RAW_NSI_CURRICULA.map((curriculum) => curriculumVersionSchema.parse(curriculum)),
);
