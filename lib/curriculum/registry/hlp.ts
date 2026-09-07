import {
  curriculumVersionSchema,
  type CurriculumVersion,
} from '../schemas/curriculum';

const RAW_HLP_CURRICULA: CurriculumVersion[] = [
  {
    id: 'fr-hlp-premiere-speciality-2019',
    version: '2019.1',
    status: 'PUBLISHED',
    subject: 'HLP',
    level: 'PREMIERE',
    track: 'GENERAL',
    subjectVariant: 'SPECIALITY',
    effectiveFromAcademicYear: '2019-2020',
    officialSources: [{
      id: 'bo-special-2019-1-hlp-premiere-speciality',
      authority: 'EDUSCOL',
      title: "Programme d'enseignement de spécialité d'humanités, littérature et philosophie de la classe de première de la voie générale",
      uri: 'https://www.education.gouv.fr/bo/19/Special1/MENE1901578A.htm',
      publicationDate: '2019-01-22',
      bulletinReference: 'BO spécial n° 1 du 22 janvier 2019',
    }],
  },
  {
    id: 'fr-hlp-terminale-speciality-2020',
    version: '2020.1',
    status: 'PUBLISHED',
    subject: 'HLP',
    level: 'TERMINALE',
    track: 'GENERAL',
    subjectVariant: 'SPECIALITY',
    effectiveFromAcademicYear: '2020-2021',
    officialSources: [{
      id: 'bo-special-2019-8-hlp-terminale-speciality',
      authority: 'EDUSCOL',
      title: "Programme de l'enseignement de spécialité d'humanités, littérature et philosophie de la classe terminale de la voie générale",
      uri: 'https://www.education.gouv.fr/bo/19/Special8/MENE1921255A.htm',
      publicationDate: '2019-07-25',
      bulletinReference: 'BO spécial n° 8 du 25 juillet 2019',
    }],
  },
];

export const HLP_CURRICULA: readonly CurriculumVersion[] = Object.freeze(
  RAW_HLP_CURRICULA.map((curriculum) => curriculumVersionSchema.parse(curriculum)),
);
