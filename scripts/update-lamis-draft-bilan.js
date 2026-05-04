const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const studentId = 'cmoh7fpsn0002mgqsnw0vupv5';
  
  console.log(`🚀 Mise à jour du brouillon bilan pour Lamis (${studentId}) en production...`);

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
      coachComment: 'Présence qui prouve sa volonté de ne pas abandonner. Cependant, son anxiété massive génère une surcharge cognitive extrêmement rapide. Ses allers-retours fréquents ou le refuge sur son téléphone sont de véritables "soupapes de sécurité". J\'ai adapté la pédagogie par micro-séances de 10 minutes.'
    },

    // Section 2 - Diagnostic global
    globalDiagnostic: {
      overallProfile: 'FRAGILE_AND_DISCOURAGED',
      workPace: 'SLOW_AND_UNCERTAIN',
      errorManagement: 'ANXIOUS_ABOUT_MISTAKES',
      autonomyLevel: 'DEPENDENT',
      confidenceLevel: 'LACKS_CONFIDENCE',
      mainCoachMessage: 'Lamis se heurte à des lacunes profondes sur les opérations fondamentales. Le stage a été une opération de "sauvetage". Nous avons travaillé sur la psychologie de l\'épreuve : dédramatiser la feuille blanche, repérer visuellement les questions faciles, et sécuriser des points évidents.'
    },

    // Section 3 - Automatismes (STMG)
    automatismesStmg: {
      calculsBaseDecimaux: 1,
      tauxEvolutionCm: 2,
      lectureGraphique: 2,
      plusGrandPointFort: 'Parvient à appliquer des consignes visuelles simples (repérer le sommet d\'une courbe) si elle est guidée et rassurée en amont.',
      plusGrandPointFaible: 'Blocage total sur l\'arithmétique élémentaire (calcul mental, tables de multiplication). L\'interdiction de la calculatrice la paralyse.'
    },

    // Section 4 - Suites numériques (STMG)
    suitesStmg: {
      reconnaissanceArithGeom: 2,
      calculTermeTableur: 1,
      modelisationEvolution: 1,
      observationsSuites: 'Évitement total de l\'algèbre. Le travail s\'est concentré sur la logique verbale : l\'expression "on ajoute" signifie arithmétique, et "baisse de %" signifie géométrique.'
    },

    // Section 5 - Fonctions et Dérivation (STMG)
    fonctionsDerivationStmg: {
      secondDegreAllure: 2,
      troisiemeDegre: 1,
      derivationUsuelle: 1,
      lienSigneVariation: 1
    },

    // Section 6 - Statistiques et Probabilités (STMG)
    statistiquesProbabilitesStmg: {
      tableauxCroises: 2,
      probabilitesSimples: 2,
      arbrePondere: 1
    },

    // Section 8 - Épreuve finale (OMIS comme demandé)
    // finalAssessment: {}

    // Section 9 - Diagnostic par chapitre (STMG)
    chapterDiagnostics: {
      automatismesTauxEvolution: {
        mastery: 2,
        methodsAcquired: 'Prendre 10% en décalant la virgule, trouver 50%.',
        vigilancePoints: 'Les opérations posées avec virgules.',
        recurringErrors: 'L\'oubli des tables de multiplication.',
        revealingExercise: 'Réussit à trouver 10% mais bloque sur la soustraction pour trouver le prix final.',
        strength: 'Sait utiliser la règle de la moitié quand elle n\'est pas sous pression.',
        priorityRemediation: 'S\'entraîner uniquement sur les QCM des sujets 0 par déduction logique.'
      },
      suitesNumeriques: {
        mastery: 1,
        methodsAcquired: 'Distinguer le vocabulaire (+ vs x).',
        vigilancePoints: 'La panique face à l\'indice "n".',
        recurringErrors: 'Incapacité à mener un calcul avec un coefficient décimal.',
        revealingExercise: 'Incapable de calculer u1 si la formule contient des décimales.',
        strength: 'Comprend bien l\'idée de hausse globale.',
        priorityRemediation: 'Apprendre la phrase type : "On ajoute toujours le même nombre, la suite est arithmétique".'
      },
      fonctionsDegre2_3: {
        mastery: 1,
        methodsAcquired: 'Lire l\'abscisse du sommet d\'une parabole.',
        vigilancePoints: 'La présence du symbole x².',
        recurringErrors: 'Blocage face à toute expression algébrique.',
        revealingExercise: 'Ferme sa copie dès qu\'un calcul de fonction est demandé.',
        strength: 'Associe visuellement une courbe qui monte à un signe positif.',
        priorityRemediation: 'Faire l\'impasse sur les calculs. Se limiter à la lecture graphique.'
      },
      derivationVariations: {
        mastery: 1,
        methodsAcquired: 'Comprendre l\'allure d\'un tableau de variations.',
        vigilancePoints: 'L\'abstraction des formules.',
        recurringErrors: 'Ne parvient pas à dériver les fonctions de base.',
        revealingExercise: 'N\'arrive pas à utiliser la formule nx^(n-1).',
        strength: 'Sait repérer le maximum dans un tableau déjà rempli.',
        priorityRemediation: 'Extraire l\'information d\'un tableau de variations fourni dans l\'énoncé.'
      },
      probabilitesTableaux: {
        mastery: 2,
        methodsAcquired: 'Remplir une case vide par soustraction simple.',
        vigilancePoints: 'La lecture de "parmi ceux qui...".',
        recurringErrors: 'Divise par 100 systématiquement même en probabilité conditionnelle.',
        revealingExercise: 'Trouve les bonnes valeurs dans le tableau mais se trompe de diviseur.',
        strength: 'Bonne logique de déduction sur des entiers simples.',
        priorityRemediation: 'Surligner le mot après "sachant que" pour identifier le bon groupe.'
      }
    },

    // Section 10 - Message aux parents
    parentRecommendations: {
      parentTone: 'REASSURING',
      parentUrgency: 'IMPORTANT',
      parentMainMessage: 'Lamis a eu beaucoup de courage. Notre objectif est d\'appliquer un plan de "survie" stratégique pour l\'épreuve. Le mot d\'ordre à la maison doit être la bienveillance. L\'enjeu est qu\'elle arrive le jour J avec la certitude de pouvoir grappiller 4 ou 5 questions. Chaque point sera une victoire !',
      parentDoNotSay: 'Ne mentionnez pas son niveau "collège" ou son inaptitude aux tables. Ne lui fixez pas d\'objectif de note globale. Le but est purement l\'encouragement tactique.',
      estimatedCurrentLevel: 'preoccupant',
      recommendedFollowUp: 'accompagnement-regulier',
      priorityAxes: ['automatismes-taux-evolution', 'probabilites-tableaux', 'gestion-temps']
    }
  };

  // Check if a bilan exists for this student
  const existingBilan = await prisma.bilan.findFirst({
    where: {
      studentId,
      type: 'STAGE_POST',
      subject: 'STMG',
      sourceVersion: 'coach_maths_premiere_stage_printemps_v1'
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!existingBilan) {
    console.error('❌ Aucun bilan trouvé pour cet élève');
    process.exit(1);
  }

  console.log(`📝 Mise à jour du bilan existant (ID: ${existingBilan.id})...`);
  const bilan = await prisma.bilan.update({
    where: { id: existingBilan.id },
    data: {
      sourceData: sourceData,
      status: 'PENDING',
      progress: 50,
      updatedAt: new Date()
    }
  });
  
  console.log(`✅ Bilan mis à jour: ${bilan.id}`);
  console.log(`🎉 Données pédagogiques insérées avec succès pour Lamis !`);
}

main()
  .catch(e => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
