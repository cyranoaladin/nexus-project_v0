import {
  curriculumVersionSchema,
  type CurriculumVersion,
} from '../schemas/curriculum';

const RAW_PHYSICS_CURRICULA: CurriculumVersion[] = [
  {
    id: 'fr-physics-troisieme-cycle4-2020',
    version: '2020.1',
    status: 'PUBLISHED',
    subject: 'PHYSICS_CHEMISTRY',
    level: 'TROISIEME',
    track: 'COLLEGE',
    subjectVariant: 'COMMON',
    effectiveFromAcademicYear: '2020-2021',
    officialSources: [{
      id: 'eduscol-cycle4-physics-2020',
      authority: 'EDUSCOL',
      title: 'Programme de physique-chimie du cycle 4 en vigueur en classe de troisième',
      uri: 'https://eduscol.education.gouv.fr/media/67722/download',
      publicationDate: '2020-07-30',
      bulletinReference: 'BO n° 31 du 30 juillet 2020',
    }],
  },
  {
    id: 'fr-physics-seconde-gt-2019',
    version: '2019.1',
    status: 'PUBLISHED',
    subject: 'PHYSICS_CHEMISTRY',
    level: 'SECONDE',
    track: 'GENERAL_TECHNOLOGICAL',
    subjectVariant: 'COMMON',
    effectiveFromAcademicYear: '2019-2020',
    officialSources: [{
      id: 'bo-special-2019-1-physics-seconde',
      authority: 'EDUSCOL',
      title: 'Programme de physique-chimie de seconde générale et technologique',
      uri: 'https://eduscol.education.gouv.fr/sites/default/files/document/spe630annexe1062947pdf-84140.pdf',
      publicationDate: '2019-01-22',
      bulletinReference: 'BO spécial n° 1 du 22 janvier 2019',
    }],
  },
  {
    id: 'fr-physics-premiere-speciality-2019',
    version: '2019.1',
    status: 'PUBLISHED',
    subject: 'PHYSICS_CHEMISTRY',
    level: 'PREMIERE',
    track: 'GENERAL',
    subjectVariant: 'SPECIALITY',
    effectiveFromAcademicYear: '2019-2020',
    officialSources: [{
      id: 'bo-special-2019-1-physics-premiere-speciality',
      authority: 'EDUSCOL',
      title: 'Programme de spécialité physique-chimie de première générale',
      uri: 'https://eduscol.education.gouv.fr/sites/default/files/document/spe632annexe1063162pdf-84152.pdf',
      publicationDate: '2019-01-22',
      bulletinReference: 'BO spécial n° 1 du 22 janvier 2019',
    }],
  },
  {
    id: 'fr-physics-terminale-speciality-2020',
    version: '2020.1',
    status: 'PUBLISHED',
    subject: 'PHYSICS_CHEMISTRY',
    level: 'TERMINALE',
    track: 'GENERAL',
    subjectVariant: 'SPECIALITY',
    effectiveFromAcademicYear: '2020-2021',
    officialSources: [{
      id: 'bo-special-2019-8-physics-terminale-speciality',
      authority: 'EDUSCOL',
      title: 'Programme de spécialité physique-chimie de terminale générale',
      uri: 'https://eduscol.education.gouv.fr/sites/default/files/document/spe246annexe1158897pdf-84155.pdf',
      publicationDate: '2019-07-25',
      bulletinReference: 'BO spécial n° 8 du 25 juillet 2019',
    }],
  },
];

export const PHYSICS_CURRICULA: readonly CurriculumVersion[] = Object.freeze(
  RAW_PHYSICS_CURRICULA.map((curriculum) => curriculumVersionSchema.parse(curriculum)),
);
