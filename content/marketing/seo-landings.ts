import type { Metadata } from 'next';
import { PREPARATION_LINKS, type PreparationLink } from './preparation-links';

export type OfferRef = {
  type: 'annual' | 'ponctuel' | 'pack';
  id: string;
};

export type NicheSection = {
  heading: string;
  body?: string[];
  bullets?: string[];
};

export type RelatedLink = {
  href: PreparationLink['href'];
  label: string;
  description?: string;
};

export type SeoLandingContent = {
  path: PreparationLink['href'];
  title: string;
  intro: string;
  jsonLdName: string;
  primaryCtaHref: '/bilan-gratuit';
  metadata: Metadata;
  sections: NicheSection[];
  relatedLinks: RelatedLink[];
  offerRefs: OfferRef[];
  faq: { question: string; answer: string }[];
};

function metadata(path: PreparationLink['href'], title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: `https://nexusreussite.academy${path}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
    },
  };
}

function relatedLinksFor(path: PreparationLink['href']): RelatedLink[] {
  return PREPARATION_LINKS.filter((link) => link.href !== path);
}

export const seoLandings = {
  '/candidat-libre-bac-francais': {
    path: '/candidat-libre-bac-francais',
    title: 'Candidat libre au bac français en Tunisie',
    intro:
      'Passer le bac français en candidat libre depuis la Tunisie demande un cadre précis : le candidat individuel ne dispose pas de contrôle continu et doit organiser les démarches administratives, les épreuves ponctuelles, les épreuves anticipées et les épreuves terminales. Nexus Réussite accompagne cette préparation avec une méthode structurée, des entraînements en conditions, un suivi parent lisible et une cellule d’appui Cyclades selon la formule retenue.',
    jsonLdName: 'Préparation au bac français en candidat libre en Tunisie',
    primaryCtaHref: '/bilan-gratuit',
    metadata: metadata(
      '/candidat-libre-bac-francais',
      'Candidat libre au bac français en Tunisie | Nexus Réussite',
      'Préparer le bac français en candidat libre depuis la Tunisie : modalités A/B, coefficients session 2027, Cyclades, IFT, EAF, spécialités et Grand Oral.',
    ),
    sections: [
      {
        heading: 'Comprendre le statut de candidat individuel',
        body: [
          'Un candidat libre, appelé officiellement candidat individuel, n’est pas scolarisé dans un établissement sous contrat ni au CNED en scolarité réglementée. Le diplôme obtenu a la même valeur que celui d’un candidat scolarisé, mais l’organisation de l’année est différente : aucun livret scolaire ne vient alimenter la note finale.',
          'La conséquence est structurante pour la préparation : le candidat individuel est évalué sur l’ensemble du diplôme. Les épreuves terminales et anticipées représentent 60 points, tandis que les 40 points normalement issus du contrôle continu sont remplacés par des évaluations ponctuelles organisées au niveau académique. Ce cadre impose une planification plus rigoureuse, car chaque matière évaluée doit être préparée comme une épreuve réelle.',
        ],
      },
      {
        heading: 'Modalités A/B : un choix qui cadence l’année',
        body: [
          'Lors de l’inscription, le candidat choisit une modalité de passation pour les évaluations ponctuelles. Ce choix est global, non discipline par discipline, et il doit être confirmé selon les consignes de la session, l’académie de rattachement et les informations transmises par l’Institut français de Tunisie.',
        ],
        bullets: [
          'Modalité A : les évaluations ponctuelles sont regroupées en fin de terminale, sur le programme du cycle terminal selon les disciplines.',
          'Modalité B : une partie des évaluations est passée dès la fin de première, puis le reste en terminale.',
          'Pour une famille, ce choix change le calendrier de travail : un élève de première en modalité B doit déjà être prêt pour plusieurs épreuves en fin d’année.',
        ],
      },
      {
        heading: 'Coefficients de référence pour la session 2027',
        body: [
          'La structure de référence pour les cohortes accompagnées aujourd’hui est celle de la session 2027 : épreuve anticipée de mathématiques intégrée au baccalauréat et Grand Oral coefficient 8. Les coefficients doivent toujours être revérifiés dans la convocation et les textes de session, mais ils donnent un cadre solide pour hiérarchiser le travail.',
        ],
        bullets: [
          'Français écrit et oral en fin de première : coefficient 5 chacun.',
          'Mathématiques anticipées : coefficient 2.',
          'Deux spécialités conservées en terminale : coefficient 16 chacune.',
          'Philosophie : coefficient 8. Grand Oral : coefficient 8.',
          'Évaluations ponctuelles : histoire-géographie, LVA, LVB, enseignement scientifique et EPS coefficient 6 ; EMC coefficient 2 ; spécialité abandonnée en première coefficient 8.',
        ],
      },
      {
        heading: 'Points de vigilance propres aux candidats libres',
        body: [
          'Certaines règles changent le travail concret. En NSI, physique-chimie et SVT, le candidat individuel est généralement dispensé des épreuves pratiques : la note de spécialité repose alors sur l’écrit, ramené sur 20. En français, le descriptif de lectures et de textes n’est pas fourni par un professeur de classe : il doit être construit, organisé et présenté dans un format conforme aux attentes de l’oral.',
          'Les inscriptions passent généralement par Cyclades et par le circuit indiqué par l’Institut français de Tunisie. Les dates, pièces justificatives, frais éventuels, modalités EPS et options doivent être confirmés chaque année. Nexus Réussite accompagne l’organisation et la préparation, sans se substituer à l’inscription officielle ni à la convocation.',
        ],
      },
      {
        heading: 'L’accompagnement Nexus Réussite',
        body: [
          'L’objectif n’est pas de remplacer le travail personnel, mais de donner un cadre stable : diagnostic initial, choix de la modalité, priorisation des matières, planning, entraînements et bilans. Les parcours peuvent être en ligne, mixtes ou complétés par des stages selon le niveau, les spécialités, les contraintes familiales et le calendrier de l’élève.',
          'Les familles disposent d’un suivi parent clair, de corrections appuyées sur les attendus des épreuves, d’épreuves blanches selon la formule et d’un accès aux ressources numériques prévues au catalogue. Le bilan gratuit sert à vérifier le statut, la modalité, les spécialités et le format le plus cohérent avant toute inscription.',
        ],
      },
    ],
    relatedLinks: relatedLinksFor('/candidat-libre-bac-francais'),
    offerRefs: [
      { type: 'annual', id: '1re-libre-essentiel' },
      { type: 'annual', id: '1re-libre-accomp' },
      { type: 'annual', id: 'term-libre-online' },
      { type: 'annual', id: 'term-libre-mixte' },
      { type: 'annual', id: 'term-libre-premium' },
      { type: 'pack', id: 'pass-candidat-libre' },
    ],
    faq: [
      {
        question: 'Un candidat libre passe-t-il le même diplôme ?',
        answer:
          'Oui. Le diplôme est le même. La différence tient à l’évaluation : le candidat individuel ne dispose pas de contrôle continu et passe des évaluations ponctuelles pour les enseignements concernés.',
      },
      {
        question: 'La modalité A ou B peut-elle être changée après inscription ?',
        answer:
          'Le choix est généralement définitif une fois l’inscription confirmée. Il faut donc le vérifier soigneusement avec les informations de la session et l’accompagnement administratif disponible.',
      },
      {
        question: 'Nexus remplace-t-il l’inscription officielle ?',
        answer:
          'Non. Nexus accompagne l’organisation et la préparation, mais l’inscription officielle relève du candidat, de sa famille, de Cyclades et des consignes communiquées pour la session.',
      },
      {
        question: 'Comment préparer le français en candidat libre ?',
        answer:
          'Le point sensible est le descriptif de l’oral : il faut construire une liste de textes et de lectures conforme au programme, puis s’entraîner à l’explication linéaire, à la grammaire et à l’entretien.',
      },
      {
        question: 'Peut-on préparer à distance depuis la Tunisie ?',
        answer:
          'Oui, certaines formules sont en ligne ou mixtes. Le bilan gratuit permet de vérifier le format adapté à la situation familiale, au calendrier et aux spécialités choisies.',
      },
    ],
  },
  '/preparation-bac-francais-tunis': {
    path: '/preparation-bac-francais-tunis',
    title: 'Préparer le bac français à Tunis',
    intro:
      'Nexus Réussite accompagne les élèves du système français à Tunis, scolarisés ou candidats libres, avec une méthode structurée : diagnostic, groupes réduits, entraînements, corrections, bilans et suivi parent. Cette page sert de point d’entrée vers les préparations clés du bac français : EAF, Grand Oral, spécialités, stages et parcours candidat libre.',
    jsonLdName: 'Préparation au bac français à Tunis',
    primaryCtaHref: '/bilan-gratuit',
    metadata: metadata(
      '/preparation-bac-francais-tunis',
      'Préparer le bac français à Tunis | Nexus Réussite',
      'Accompagnement bac français à Tunis : méthode, groupes réduits, EAF, Grand Oral, spécialités, candidats libres, présentiel à Mutuelleville et formules en ligne.',
    ),
    sections: [
      {
        heading: 'Un cadre de travail pour les familles à Tunis',
        body: [
          'La préparation du bac français ne se résume pas à quelques révisions en fin d’année. Entre les épreuves anticipées, les spécialités, le tronc commun, la philosophie et le Grand Oral, les familles ont besoin d’un cadre lisible pour savoir quoi travailler, dans quel ordre et avec quel niveau d’exigence.',
          'Nexus Réussite construit ce cadre autour d’un diagnostic initial, de groupes réduits, de corrections régulières et d’un suivi parent clair. Les cours en présentiel et les rendez-vous pédagogiques se déroulent à Mutuelleville, sur confirmation, tandis que certaines formules permettent un suivi en ligne ou mixte pour les familles éloignées ou les candidats libres.',
        ],
      },
      {
        heading: 'Les grandes étapes du bac français',
        body: [
          'En première, l’élève prépare l’épreuve anticipée de français : écrit de 4 heures et oral de 20 minutes après préparation. À partir de la session 2027, l’épreuve anticipée de mathématiques est intégrée à la note du baccalauréat. En terminale, les deux spécialités conservées, la philosophie et le Grand Oral structurent la fin de parcours.',
          'Pour les élèves scolarisés, le contrôle continu reste un enjeu de régularité. Pour les candidats libres, les enseignements normalement évalués en contrôle continu sont remplacés par des évaluations ponctuelles. Le même diplôme est visé, mais l’organisation de l’année et la pression sur les épreuves sont différentes.',
        ],
      },
      {
        heading: 'Élève scolarisé ou candidat libre : deux logiques',
        bullets: [
          'Élève scolarisé : consolider les acquis, progresser dans les spécialités, préparer les épreuves terminales et maintenir une trajectoire régulière.',
          'Candidat libre : couvrir tout le programme, anticiper les évaluations ponctuelles, construire le descriptif EAF et sécuriser l’organisation administrative.',
          'Famille à Tunis : choisir entre présentiel, distanciel ou formule mixte selon le calendrier, la localisation, les spécialités et le niveau d’autonomie.',
        ],
      },
      {
        heading: 'Méthode Nexus Réussite',
        body: [
          'Le point de départ est un bilan : niveau actuel, matières prioritaires, statut de l’élève, objectifs, contraintes de temps et échéances d’examen. À partir de ce diagnostic, l’équipe propose un parcours : accompagnement annuel, module ciblé, stage intensif ou pass.',
          'La méthode met l’accent sur les attendus officiels : travailler les consignes, structurer les copies, s’entraîner à l’oral, apprendre à relire et à corriger ses erreurs. Les outils numériques et ARIA complètent le suivi humain ; ils ne remplacent pas l’accompagnement pédagogique.',
        ],
      },
      {
        heading: 'Choisir la bonne porte d’entrée',
        body: [
          'Les familles qui préparent le français de première peuvent commencer par la page dédiée à l’EAF. Les élèves de terminale qui doivent construire leurs deux questions peuvent consulter la préparation Grand Oral. Les candidats individuels doivent lire le parcours candidat libre, car leurs modalités d’examen, d’inscription et de calendrier diffèrent sensiblement.',
          'Le bilan gratuit permet ensuite de transformer ces repères en plan de travail concret. Il ne s’agit pas de promettre un résultat, mais de clarifier les priorités, les risques, les points forts et le format d’accompagnement le plus adapté.',
        ],
      },
    ],
    relatedLinks: relatedLinksFor('/preparation-bac-francais-tunis'),
    offerRefs: [
      { type: 'annual', id: '1re-double-secu' },
      { type: 'annual', id: 'term-duo' },
      { type: 'annual', id: 'term-excellence' },
      { type: 'annual', id: 'term-libre-mixte' },
      { type: 'pack', id: 'pass-intensifs-term' },
      { type: 'pack', id: 'pass-candidat-libre' },
    ],
    faq: [
      {
        question: 'La page concerne-t-elle aussi les candidats libres ?',
        answer:
          'Oui. Elle sert de hub général, puis renvoie vers la page candidat libre pour les modalités propres aux candidats individuels.',
      },
      {
        question: 'Les cours ont-ils lieu à Mutuelleville ?',
        answer:
          'Les cours en présentiel et rendez-vous pédagogiques se déroulent au centre d’accompagnement pédagogique de Mutuelleville, sur confirmation.',
      },
      {
        question: 'Le Grand Oral est-il préparé séparément ?',
        answer:
          'Il peut être travaillé dans un parcours annuel, un pass ou un module dédié, selon le niveau de l’élève et l’avancement des deux questions.',
      },
      {
        question: 'Comment éviter une formule mal choisie ?',
        answer:
          'Le bilan gratuit sert à identifier les matières prioritaires, le statut de l’élève, le calendrier et le volume de travail réaliste avant de recommander une formule.',
      },
      {
        question: 'ARIA remplace-t-il le suivi humain ?',
        answer:
          'Non. ARIA complète le travail humain par des ressources et des exercices, mais l’accompagnement repose sur une méthode, des corrections et des bilans.',
      },
    ],
  },
  '/reussir-eaf': {
    path: '/reussir-eaf',
    title: 'Réussir l’EAF : épreuves anticipées de français',
    intro:
      'L’EAF se prépare en première, mais elle compte durablement dans le baccalauréat : écrit coefficient 5, oral coefficient 5. La réussite repose sur une méthode régulière : lire les œuvres, comprendre les textes, construire des plans, maîtriser l’expression écrite et s’entraîner à l’explication orale dans le format attendu.',
    jsonLdName: 'Préparation aux épreuves anticipées de français',
    primaryCtaHref: '/bilan-gratuit',
    metadata: metadata(
      '/reussir-eaf',
      'Réussir l’EAF : épreuves anticipées de français | Nexus Réussite',
      'Préparer l’EAF : écrit de français, oral, commentaire, dissertation, explication linéaire, grammaire, descriptif candidat libre et entraînements.',
    ),
    sections: [
      {
        heading: 'Deux épreuves de français en fin de première',
        body: [
          'L’épreuve anticipée de français comporte un écrit de 4 heures et un oral de 20 minutes après 30 minutes de préparation. Chaque partie compte coefficient 5. L’enjeu ne se limite donc pas à « aimer lire » : il faut maîtriser une méthode, savoir mobiliser les œuvres et produire une analyse claire.',
          'Le programme s’organise autour de grands objets d’étude : roman et récit, poésie, théâtre, littérature d’idées. Les œuvres changent selon les sessions, ce qui impose de vérifier le programme de l’année et d’adapter les entraînements aux textes réellement étudiés.',
        ],
      },
      {
        heading: 'L’écrit : commentaire ou dissertation',
        body: [
          'Le jour de l’écrit, le candidat choisit entre le commentaire d’un texte et la dissertation sur une œuvre au programme. Le commentaire évalue la capacité à comprendre un texte, à repérer ses mouvements, à analyser les procédés et à organiser une interprétation. La dissertation demande une problématique, une progression argumentative et des exemples précis issus de l’œuvre.',
          'Dans les deux cas, la copie doit être structurée, lisible et argumentée. Les erreurs les plus fréquentes sont connues : paraphrase, catalogue de procédés, absence de problématique, exemples insuffisamment exploités, conclusion trop rapide ou langue imprécise. Un entraînement efficace consiste à corriger ces points dans la durée, copie après copie.',
        ],
      },
      {
        heading: 'L’oral : explication linéaire, grammaire, entretien',
        body: [
          'L’oral dure 20 minutes. Le candidat présente d’abord une explication linéaire d’un texte, répond à une question de grammaire, puis présente une œuvre choisie et échange avec l’examinateur. Cette épreuve demande une parole structurée, mais aussi une compréhension personnelle des textes.',
          'La préparation ne doit pas se limiter à apprendre des fiches. Il faut savoir annoncer un projet de lecture, découper le texte en mouvements, justifier les procédés, répondre avec précision et tenir l’entretien sans réciter mécaniquement.',
        ],
        bullets: [
          'Explication linéaire : suivre le texte pas à pas et faire apparaître sa progression.',
          'Question de grammaire : analyser précisément un passage, sans réponse vague.',
          'Entretien : défendre une lecture personnelle, argumentée et reliée à l’œuvre.',
        ],
      },
      {
        heading: 'Spécificité candidat libre : le descriptif',
        body: [
          'Pour un candidat individuel, le descriptif est un point central. Il ne reçoit pas automatiquement la liste de textes fournie par un professeur de classe : il doit construire un descriptif conforme au programme, cohérent, exploitable à l’oral et présenté dans le format attendu.',
          'Ce travail doit être anticipé. Le choix des textes, la répartition par objet d’étude, la préparation de l’œuvre présentée à l’entretien et la conformité administrative ne peuvent pas être improvisés à quelques semaines de l’épreuve.',
        ],
      },
      {
        heading: 'La préparation Nexus Réussite',
        body: [
          'Nexus Réussite combine méthode écrite, entraînement oral et corrections. Les élèves travaillent les textes, la dissertation, le commentaire, la grammaire et la prise de parole. Les candidats libres peuvent être accompagnés sur la constitution du descriptif et la préparation de l’entretien.',
          'Selon la formule, le parcours inclut des entraînements en conditions, des corrections sur attendus officiels, des bilans de progression et des ressources numériques. Le bilan gratuit permet de déterminer si l’élève a besoin d’un module ciblé, d’un accompagnement annuel ou d’un stage intensif avant l’épreuve.',
        ],
      },
    ],
    relatedLinks: relatedLinksFor('/reussir-eaf'),
    offerRefs: [
      { type: 'ponctuel', id: 'cap-eaf' },
      { type: 'annual', id: '1re-eaf' },
      { type: 'annual', id: '1re-libre-accomp' },
      { type: 'pack', id: 'pass-cap-bac-1re' },
    ],
    faq: [
      {
        question: 'Quels sont les coefficients de l’EAF ?',
        answer:
          'L’écrit et l’oral comptent chacun coefficient 5. L’ensemble représente donc 10 coefficients dans la note finale du baccalauréat.',
      },
      {
        question: 'Faut-il choisir commentaire ou dissertation à l’avance ?',
        answer:
          'Il faut travailler les deux méthodes, car le choix se fait le jour de l’épreuve selon le sujet et la maîtrise de l’élève.',
      },
      {
        question: 'Pourquoi l’oral ne se prépare-t-il pas uniquement avec des fiches ?',
        answer:
          'Parce que l’examinateur évalue aussi la clarté, l’appropriation du texte, la précision des réponses et la capacité à dialoguer sur une œuvre.',
      },
      {
        question: 'Le descriptif est-il obligatoire pour un candidat libre ?',
        answer:
          'Le candidat individuel doit présenter un descriptif conforme aux attentes de la session. Les consignes précises doivent être vérifiées dans la convocation et les documents officiels.',
      },
      {
        question: 'Comment commencer la préparation ?',
        answer:
          'Le bilan gratuit permet de situer le niveau en expression écrite, en lecture analytique et à l’oral, puis de proposer un rythme de travail adapté.',
      },
    ],
  },
  '/grand-oral': {
    path: '/grand-oral',
    title: 'Préparer le Grand Oral du bac',
    intro:
      'Le Grand Oral clôt le cycle terminal. À compter de la session 2027 en voie générale, il compte coefficient 8 et porte sur deux questions préparées pendant l’année, en lien avec les spécialités. L’épreuve évalue les connaissances, la clarté du propos, l’argumentation, l’échange avec le jury et la capacité à défendre une démarche personnelle.',
    jsonLdName: 'Préparation au Grand Oral du baccalauréat',
    primaryCtaHref: '/bilan-gratuit',
    metadata: metadata(
      '/grand-oral',
      'Préparer le Grand Oral du bac | Nexus Réussite',
      'Préparer le Grand Oral du bac : deux questions, spécialités, exposé de 10 minutes, échange avec le jury, posture, argumentation et simulations.',
    ),
    sections: [
      {
        heading: 'Une épreuve orale adossée aux spécialités',
        body: [
          'Le Grand Oral ne consiste pas à réciter un exposé générique. Le candidat prépare deux questions pendant l’année, liées à ses deux enseignements de spécialité, séparément ou de manière transversale. Le jour de l’épreuve, le jury choisit l’une des deux questions.',
          'La qualité de la question compte autant que la performance orale : elle doit être problématisée, compatible avec les programmes, suffisamment précise pour être traitée en 10 minutes et assez riche pour ouvrir un échange avec le jury.',
        ],
      },
      {
        heading: 'Déroulé de l’épreuve',
        body: [
          'L’épreuve comprend 20 minutes de préparation, puis 20 minutes devant le jury : 10 minutes d’exposé et 10 minutes d’échange. Un support peut être préparé pendant le temps de préparation, mais il n’est ni remis au jury ni évalué comme document autonome.',
          'Ces contraintes obligent à travailler le rythme. Un exposé trop court donne une impression d’impréparation ; un exposé trop long empêche de conclure proprement. La préparation doit donc intégrer des simulations chronométrées, des transitions et des réponses aux objections possibles.',
        ],
      },
      {
        heading: 'Ce que le jury observe',
        bullets: [
          'Solidité des connaissances mobilisées dans les spécialités.',
          'Capacité à argumenter, nuancer et relier les savoirs.',
          'Clarté de la parole, posture, regard, gestion du temps.',
          'Esprit critique et capacité à répondre dans l’échange.',
          'Cohérence entre la question choisie, le parcours de l’élève et la démarche présentée.',
        ],
      },
      {
        heading: 'Candidat libre : mêmes attendus, moins de cadre de classe',
        body: [
          'Le candidat libre passe le Grand Oral selon les mêmes attendus. La difficulté vient souvent du cadre : sans professeur de classe pour valider progressivement les questions, il faut vérifier soi-même la pertinence du sujet, l’ancrage dans les spécialités et la préparation de l’échange.',
          'Pour les familles, le risque n’est pas seulement le trac. Il est aussi méthodologique : question trop large, problématique faible, plan descriptif, connaissances superficielles ou absence d’entraînement face à un jury.',
        ],
      },
      {
        heading: 'La préparation Nexus Réussite',
        body: [
          'Le Studio Grand Oral accompagne la construction des deux questions, la problématisation, le plan de l’exposé, la posture et les simulations. L’objectif est d’obtenir une parole claire, maîtrisée et reliée aux connaissances réelles de l’élève.',
          'Le module peut compléter un parcours annuel, un pass intensif ou une préparation candidat libre. Le bilan gratuit permet de vérifier l’état d’avancement : questions déjà choisies, spécialités, niveau d’aisance orale, besoins de structuration et calendrier jusqu’à l’épreuve.',
        ],
      },
    ],
    relatedLinks: relatedLinksFor('/grand-oral'),
    offerRefs: [
      { type: 'ponctuel', id: 'studio-grand-oral' },
      { type: 'annual', id: 'term-duo' },
      { type: 'annual', id: 'term-libre-mixte' },
      { type: 'pack', id: 'pass-go-sprint' },
    ],
    faq: [
      {
        question: 'Quel est le coefficient du Grand Oral ?',
        answer:
          'En voie générale, la structure de référence session 2027 indique un coefficient 8. Les informations de convocation restent la référence finale.',
      },
      {
        question: 'Combien de questions faut-il préparer ?',
        answer:
          'Deux questions liées aux spécialités. Le jury en choisit une le jour de l’épreuve.',
      },
      {
        question: 'Les questions peuvent-elles croiser deux spécialités ?',
        answer:
          'Oui, une question peut être adossée à une spécialité ou croiser les deux, si le lien avec les programmes reste clair.',
      },
      {
        question: 'Le support préparé pendant l’épreuve est-il noté ?',
        answer:
          'Non. Il peut aider la prise de parole, mais il n’est pas remis au jury et ne constitue pas l’objet principal de l’évaluation.',
      },
      {
        question: 'Le Studio Grand Oral convient-il aux candidats libres ?',
        answer:
          'Oui. Il aide notamment à valider les questions, structurer l’exposé et s’entraîner à l’échange avec le jury.',
      },
    ],
  },
} satisfies Record<PreparationLink['href'], SeoLandingContent>;
