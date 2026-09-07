import {
  curriculumVersionSchema,
  type CurriculumVersion,
} from '../schemas/curriculum';

/**
 * DGEMC (droit et grands enjeux du monde contemporain) — two real,
 * non-overlapping programme versions, not one:
 *
 * - 2019 (arrêté du 19 juillet 2019, BO spécial n° 8 du 25 juillet 2019):
 *   optional teaching for Terminale voie GÉNÉRALE only.
 * - 2022 (arrêté du 15 avril 2022 modifiant l'arrêté du 19 juillet 2019,
 *   Légifrance JORFTEXT000045742756, BO n° 15 du 14 avril 2022): amends the
 *   title and Article 1 to replace "voie générale" with "voies générale et
 *   technologique" — a real scope change, not a content-only revision.
 *   Effective from the 2022 rentrée.
 *
 * The 2019 version is kept here as historical evidence with an explicit
 * `effectiveToAcademicYear`, never rewritten in place. The CURRENT canonical
 * course (`opt-dgemc-terminale` in `data/curriculum/v1/courses.json`) points
 * its `programmeSelector` at the 2022 (current) version's dimensions —
 * `track: GENERAL_TECHNOLOGICAL` — reflecting the programme as amended.
 */
const RAW_DGEMC_CURRICULA: CurriculumVersion[] = [
  {
    id: 'fr-dgemc-terminale-option-2019',
    version: '2019.1',
    status: 'PUBLISHED',
    subject: 'DGEMC',
    level: 'TERMINALE',
    track: 'GENERAL',
    subjectVariant: 'OPTION',
    effectiveFromAcademicYear: '2020-2021',
    effectiveToAcademicYear: '2021-2022',
    officialSources: [{
      id: 'bo-special-2019-8-dgemc-terminale-option',
      authority: 'EDUSCOL',
      title: "Programme de l'enseignement optionnel de droit et grands enjeux du monde contemporain de la classe terminale de la voie générale (version initiale)",
      uri: 'https://www.education.gouv.fr/bo/19/Special8/MENE1921266A.htm',
      publicationDate: '2019-07-25',
      bulletinReference: 'BO spécial n° 8 du 25 juillet 2019',
    }],
  },
  {
    id: 'fr-dgemc-terminale-option-2022',
    version: '2022.1',
    status: 'PUBLISHED',
    subject: 'DGEMC',
    level: 'TERMINALE',
    track: 'GENERAL_TECHNOLOGICAL',
    subjectVariant: 'OPTION',
    effectiveFromAcademicYear: '2022-2023',
    officialSources: [{
      id: 'legifrance-2022-dgemc-terminale-option-amendment',
      authority: 'LEGIFRANCE',
      title: "Arrêté du 15 avril 2022 modifiant l'arrêté du 19 juillet 2019 fixant le programme de l'enseignement optionnel de droit et grands enjeux du monde contemporain de la classe terminale de la voie générale",
      uri: 'https://www.legifrance.gouv.fr/jorf/texte_jo/JORFTEXT000045742756',
      publicationDate: '2022-04-15',
      bulletinReference: 'BO n° 15 du 14 avril 2022',
    }],
  },
];

export const DGEMC_CURRICULA: readonly CurriculumVersion[] = Object.freeze(
  RAW_DGEMC_CURRICULA.map((curriculum) => curriculumVersionSchema.parse(curriculum)),
);
