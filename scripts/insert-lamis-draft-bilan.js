const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const studentId = 'cmoh7fpsn0002mgqsnw0vupv5';
  
  console.log(`🚀 Insertion du brouillon bilan pour Lamis (${studentId}) en production...`);

  // Check if student exists
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  if (!student) {
    console.error('❌ Élève introuvable');
    process.exit(1);
  }

  console.log(`✅ Élève trouvé: ${student.user.firstName} ${student.user.lastName} (${student.academicTrack})`);

  const sourceData = {
    meta: {
      version: '1.1.0',
      subject: 'MATHEMATIQUES',
      gradeLevel: 'PREMIERE',
      stage: 'printemps',
      supportsStmg: true,
      studentId,
      coachId: null,
      savedAt: new Date().toISOString(),
      coach: {
        name: 'Alaeddine BEN RHOUMA',
        email: 'cyranoaladin@gmail.com'
      },
      student: {
        name: 'Lamis',
        level: 'PREMIERE',
        subject: 'STMG'
      }
    },
    subject: 'STMG',
    
    // Section 1 - Presence et implication
    attendanceAndEngagement: {
      attendance: 'reguliere',
      punctuality: 'satisfaisante',
      involvement: 3,
      concentration: 1,
      coachComment: 'La présence de Lamis à ce stage est en soi une réussite qui prouve sa volonté de ne pas abandonner. Cependant, son anxiété massive face aux mathématiques génère une surcharge cognitive extrêmement rapide. Ses baisses de concentration, ses allers-retours fréquents ou le refuge sur son téléphone ne sont pas des manques de respect, mais de véritables "soupapes de sécurité" face à l\'angoisse. J\'ai dû adapter ma pédagogie en permanence : abandonner le format classique pour des micro-séances de 10 minutes, rassurer constamment, et changer d\'approche au moindre signe de panique pour la maintenir dans une dynamique positive.'
    },

    // Section 2 - Diagnostic global
    globalDiagnostic: {
      overallProfile: 'FRAGILE_AND_DISCOURAGED',
      workPace: 'SLOW_AND_UNCERTAIN',
      errorManagement: 'ANXIOUS_ABOUT_MISTAKES',
      autonomyLevel: 'DEPENDENT',
      confidenceLevel: 'LACKS_CONFIDENCE',
      mainCoachMessage: 'Lamis se heurte à des lacunes profondes sur les opérations fondamentales (additions de base, tables de multiplication). Face à l\'interdiction de la calculatrice à l\'examen, le stage a été conçu comme une opération de "sauvetage". Plutôt que de s\'acharner sur des concepts inaccessibles (l\'algèbre, les équations complexes), nous avons travaillé sur la psychologie de l\'épreuve : dédramatiser la feuille blanche, repérer visuellement les questions faciles, et sécuriser des points par simple déduction.'
    },

    // Section 3 - Automatismes (STMG)
    automatismesStmg: {
      calculsBaseDecimaux: 1,
      tauxEvolutionCm: 2,
      lectureGraphique: 2,
      plusGrandPointFort: 'Dès qu\'on enlève la pression du calcul pur, Lamis parvient à appliquer des consignes visuelles (lire les coordonnées d\'un point, repérer le sommet d\'une courbe).',
      plusGrandPointFaible: 'Le blocage total sur l\'arithmétique élémentaire. La peur de se tromper sur une simple soustraction la paralyse et l\'empêche de démarrer un exercice.'
    },

    // Section 4 - Suites numériques (STMG)
    suitesStmg: {
      reconnaissanceArithGeom: 2,
      calculTermeTableur: 1,
      modelisationEvolution: 1,
      observationsSuites: 'Nous avons totalement évité les formules algébriques (Un+1). Le travail s\'est concentré sur la logique verbale : si l\'énoncé dit "on ajoute 50€", c\'est arithmétique. S\'il dit "baisse de 10%", c\'est géométrique. Cet apprentissage par mots-clés fonctionne mieux avec elle.'
    },

    // Section 5 - Fonctions et Dérivation (STMG)
    fonctionsDerivationStmg: {
      secondDegreAllure: 2,
      troisiemeDegre: 1,
      derivationUsuelle: 1,
      lienSigneVariation: 2
    },

    // Section 6 - Statistiques et Probabilités (STMG)
    statistiquesProbabilitesStmg: {
      tableauxCroises: 2,
      probabilitesSimples: 2,
      arbrePondere: 1
    },

    // Section 8 - Épreuve finale
    finalAssessment: {
      finalTestDone: 'partiellement_realisee',
      approximateScore: '4/20',
      timeManagement: 2,
      comprehensionInstructions: 2,
      justificationWriting: 1,
      methodChoice: 1,
      resilience: 1,
      avoidableMistake: 'L\'abandon prématuré. En voyant un exercice long, Lamis a tendance à fermer sa copie sans même lire la première question, qui est souvent une simple lecture de graphique accessible.',
      positivePoint: 'Elle a réussi à obtenir des points précieux sur la partie QCM et sur la lecture d\'un tableau croisé d\'effectifs, prouvant que la stratégie du "grappillage" fonctionne.',
      priorityBeforeExam: 'S\'entraîner à trier les questions. Le jour du bac, elle doit utiliser les 10 premières minutes pour repérer au fluo les 5 questions qu\'elle peut traiter, et ignorer totalement le reste pour ne pas paniquer.'
    },

    // Section 9 - Diagnostic par chapitre (STMG)
    chapterDiagnostics: {
      automatismesTauxEvolution: {
        mastery: 2,
        methodsAcquired: ['Prendre 10% en décalant la virgule', 'ou trouver 50% en prenant la moitié'],
        vigilancePoints: ['Les opérations posées (soustractions avec virgules)'],
        recurringErrors: ['L\'oubli des tables de multiplication qui fausse les résultats finaux'],
        strength: 'Sait répondre correctement si on lui laisse le temps et qu\'on la guide pas à pas.',
        priorityRemediation: 'Limiter les révisions aux QCM des sujets 0. Ne travailler que la reconnaissance des pourcentages de base (10%, 25%, 50%).'
      },
      suitesNumeriques: {
        mastery: 1,
        methodsAcquired: ['Distinguer le vocabulaire d\'une suite arithmétique et géométrique'],
        vigilancePoints: ['Le calcul mental des termes successifs'],
        recurringErrors: ['Blocage total dès qu\'il faut utiliser un coefficient multiplicateur décimal (ex: x 0,9)'],
        priorityRemediation: 'Apprendre par cœur la phrase type : "Comme on ajoute toujours le même nombre, la suite est arithmétique".'
      },
      fonctionsDegre2_3: {
        mastery: 1,
        methodsAcquired: ['Associer visuellement une courbe qui monte à un signe \'+\''],
        vigilancePoints: ['La présence du symbole \'x\''],
        recurringErrors: ['Incapacité à mener un calcul algébrique (développement, dérivée)'],
        priorityRemediation: 'Faire l\'impasse sur les calculs. Se concentrer uniquement sur les questions de lecture graphique (minimum, maximum, antécédents).'
      },
      derivationVariations: {
        mastery: 1,
        methodsAcquired: ['Comprendre l\'allure générale d\'un tableau de variations'],
        vigilancePoints: ['L\'abstraction totale de la notion de dérivée'],
        recurringErrors: ['Panique face aux formules de dérivation'],
        priorityRemediation: 'Apprendre à extraire l\'information d\'un tableau de variations déjà rempli fourni dans l\'énoncé.'
      },
      probabilitesTableaux: {
        mastery: 2,
        methodsAcquired: ['Compléter un tableau croisé par des additions/soustractions simples'],
        vigilancePoints: ['La lecture de la consigne pour les probabilités conditionnelles ("parmi ceux qui...")'],
        recurringErrors: ['Diviser par le total général (souvent 100) au lieu du total de la ligne concernée'],
        priorityRemediation: 'Prendre le réflexe de surligner le mot qui suit "sachant que" pour identifier la bonne ligne du tableau à utiliser.'
      }
    },

    // Section 10 - Message aux parents
    parentRecommendations: {
      parentTone: 'REASSURING',
      parentUrgency: 'IMPORTANT',
      parentMainMessage: 'Lamis a eu beaucoup de courage d\'affronter ce stage malgré sa grande anxiété. Notre objectif n\'est pas de combler des années de lacunes en quelques semaines, mais d\'appliquer un plan de "survie" stratégique pour l\'épreuve anticipée. Le mot d\'ordre à la maison doit être la bienveillance et la dédramatisation. Voici le plan d\'action précis pour les 5 semaines à venir :\n\n- Semaines 1 et 2 : Entraînement exclusif sur la Partie 1 de l\'épreuve (Automatismes). Travaillez par sessions ultra-courtes (15 minutes chrono, pas plus) en refaisant les mêmes QCM des Sujets 0 jusqu\'à créer un rassurant sentiment de "déjà-vu".\n- Semaines 3 et 4 : Apprendre à "chasser" les points faciles de la Partie 2. Lamis doit s\'entraîner à repérer les questions de lecture graphique, les tableaux à remplir, et écrire les phrases modèles du Livret (ex: "Comme la valeur augmente, je multiplie...").\n- Semaine 5 : Mise en confiance. On ne fait plus de mathématiques nouvelles, on valorise uniquement ce qu\'elle sait faire.\n\nL\'enjeu est qu\'elle arrive le jour de l\'épreuve avec la certitude qu\'elle peut répondre à au moins 4 ou 5 questions. Chaque point gagné sera une victoire. Nous sommes de tout cœur avec elle !',
      parentDoNotSay: 'Ne mentionnez pas son niveau "collège" ou son inaptitude aux tables de multiplication de façon brutale. Ne lui fixez pas d\'objectif de note globale (ne parlez pas d\'avoir la moyenne). Le but est purement l\'encouragement tactique.',
      estimatedCurrentLevel: 'preoccupant',
      recommendedFollowUp: 'accompagnement-regulier',
      priorityAxes: ['automatismes-taux-evolution', 'suites-numeriques', 'probabilites-tableaux']
    }
  };

  const studentName = `${student.user.firstName || ''} ${student.user.lastName || ''}`.trim() || student.user.email || 'Élève';

  // Check if a bilan already exists for this student
  const existingBilan = await prisma.bilan.findFirst({
    where: {
      studentId,
      type: 'STAGE_POST',
      subject: 'MATHEMATIQUES',
      sourceVersion: 'coach_maths_premiere_stage_printemps_v1'
    },
    orderBy: { createdAt: 'desc' }
  });

  let bilan;
  if (existingBilan) {
    // Update existing bilan
    console.log('📝 Mise à jour du bilan existant...');
    bilan = await prisma.bilan.update({
      where: { id: existingBilan.id },
      data: {
        sourceData: sourceData,
        status: 'PENDING',
        progress: 50,
        updatedAt: new Date()
      }
    });
    console.log(`✅ Bilan mis à jour: ${bilan.id}`);
  } else {
    // Create new bilan
    console.log('📝 Création d\'un nouveau bilan...');
    bilan = await prisma.bilan.create({
      data: {
        type: 'STAGE_POST',
        subject: 'MATHEMATIQUES',
        studentId,
        studentEmail: student.user.email || '',
        studentName,
        sourceData: sourceData,
        sourceVersion: 'coach_maths_premiere_stage_printemps_v1',
        status: 'PENDING',
        progress: 50,
        engineVersion: 'manual_coach'
      }
    });
    console.log(`✅ Bilan créé: ${bilan.id}`);
  }

  console.log(`🎉 Brouillon bilan inséré avec succès pour Lamis !`);
  console.log(`   ID: ${bilan.id}`);
  console.log(`   Status: ${bilan.status}`);
  console.log(`   Subject: ${bilan.subject}`);
  console.log(`   Type: ${bilan.type}`);
}

main()
  .catch(e => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
