import type { DiagnosticModuleDefinition } from './types';

export const CANDIDATE_DIAGNOSTIC_MODULES: DiagnosticModuleDefinition[] = [
  {
    "key": "accueil-integrite",
    "title": "Conditions de passation et consentement",
    "shortTitle": "Démarrage",
    "description": "Vérification des conditions matérielles, du consentement et de l’intégrité de la passation.",
    "audience": "ELEVE",
    "kind": "questionnaire",
    "estimatedMinutes": 10,
    "timed": false,
    "prerequisites": [],
    "instructions": [
      "Installez-vous dans un endroit calme.",
      "Préparez vos relevés de notes et vos documents.",
      "Les réponses peuvent être enregistrées en brouillon."
    ],
    "questions": [
      {
        "id": "integrity-01",
        "type": "acknowledgement",
        "prompt": "Je réalise les épreuves seul, sans aide extérieure ni moteur de recherche.",
        "competencies": [
          "integrite"
        ],
        "domains": [
          "conditions_passation"
        ],
        "maxPoints": 0,
        "required": true
      },
      {
        "id": "integrity-02",
        "type": "acknowledgement",
        "prompt": "Je comprends que certaines parties sont chronométrées et ne peuvent pas être recommencées sans autorisation.",
        "competencies": [
          "integrite"
        ],
        "domains": [
          "conditions_passation"
        ],
        "maxPoints": 0,
        "required": true
      },
      {
        "id": "integrity-03",
        "type": "acknowledgement",
        "prompt": "Je signalerai honnêtement une notion non étudiée au lieu de répondre au hasard.",
        "competencies": [
          "metacognition"
        ],
        "domains": [
          "conditions_passation"
        ],
        "maxPoints": 0,
        "required": true
      },
      {
        "id": "integrity-04",
        "type": "single",
        "prompt": "Quel appareil utiliserez-vous principalement ?",
        "competencies": [
          "conditions_techniques"
        ],
        "domains": [
          "logistique"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Ordinateur portable ou fixe"
          },
          {
            "id": "b",
            "label": "Tablette"
          },
          {
            "id": "c",
            "label": "Téléphone uniquement"
          },
          {
            "id": "d",
            "label": "Autre"
          }
        ],
        "required": true
      },
      {
        "id": "integrity-05",
        "type": "single",
        "prompt": "Votre connexion internet est-elle suffisamment stable pour déposer des fichiers ?",
        "competencies": [
          "conditions_techniques"
        ],
        "domains": [
          "logistique"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Oui, stable"
          },
          {
            "id": "b",
            "label": "Variable mais utilisable"
          },
          {
            "id": "c",
            "label": "Souvent instable"
          },
          {
            "id": "d",
            "label": "Je ne sais pas"
          }
        ],
        "required": true
      },
      {
        "id": "integrity-06",
        "type": "single",
        "prompt": "Disposez-vous d’un lieu calme pendant les épreuves ?",
        "competencies": [
          "conditions_passation"
        ],
        "domains": [
          "logistique"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Toujours"
          },
          {
            "id": "b",
            "label": "Le plus souvent"
          },
          {
            "id": "c",
            "label": "Rarement"
          },
          {
            "id": "d",
            "label": "Jamais"
          }
        ],
        "required": true
      },
      {
        "id": "integrity-07",
        "type": "acknowledgement",
        "prompt": "J’autorise l’enregistrement de mes réponses et traces de passation pour établir le diagnostic Nexus.",
        "competencies": [
          "consentement"
        ],
        "domains": [
          "consentement"
        ],
        "maxPoints": 0,
        "required": true
      },
      {
        "id": "integrity-08",
        "type": "acknowledgement",
        "prompt": "Je comprends que le diagnostic peut conclure qu’une préparation en un an est trop risquée.",
        "competencies": [
          "consentement"
        ],
        "domains": [
          "consentement"
        ],
        "maxPoints": 0,
        "required": true
      }
    ],
    "scoreDomains": [
      "conditions_passation",
      "logistique",
      "consentement"
    ],
    "requiredForSubmission": true
  },
  {
    "key": "profil-parcours",
    "title": "Profil scolaire, parcours et projet",
    "shortTitle": "Profil",
    "description": "Comprendre le parcours, les échecs antérieurs, les objectifs et les contraintes avant d’interpréter les scores.",
    "audience": "ELEVE",
    "kind": "questionnaire",
    "estimatedMinutes": 25,
    "timed": false,
    "prerequisites": [
      "accueil-integrite"
    ],
    "instructions": [
      "Répondez factuellement.",
      "Une difficulté signalée n’est pas une faute : elle aide à choisir le bon parcours."
    ],
    "questions": [
      {
        "id": "profil-01",
        "type": "single",
        "prompt": "Dans quel système avez-vous été principalement scolarisé en 2025/2026 ?",
        "competencies": [
          "analyse_parcours"
        ],
        "domains": [
          "parcours"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Système tunisien"
          },
          {
            "id": "b",
            "label": "Système français homologué"
          },
          {
            "id": "c",
            "label": "Cours à distance / CNED"
          },
          {
            "id": "d",
            "label": "Parcours mixte"
          },
          {
            "id": "e",
            "label": "Autre"
          }
        ],
        "required": true
      },
      {
        "id": "profil-02",
        "type": "single",
        "prompt": "Quel a été votre résultat au baccalauréat tunisien 2026 ?",
        "competencies": [
          "analyse_parcours"
        ],
        "domains": [
          "parcours"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Admis"
          },
          {
            "id": "b",
            "label": "Ajourné"
          },
          {
            "id": "c",
            "label": "Absent à une ou plusieurs épreuves"
          },
          {
            "id": "d",
            "label": "Résultat incomplet / contesté"
          },
          {
            "id": "e",
            "label": "Non concerné"
          }
        ],
        "required": true
      },
      {
        "id": "profil-03",
        "type": "single",
        "prompt": "Avez-vous passé des épreuves du baccalauréat français en 2026 ?",
        "competencies": [
          "analyse_parcours"
        ],
        "domains": [
          "parcours"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Oui, toutes les épreuves prévues de première"
          },
          {
            "id": "b",
            "label": "Oui, seulement certaines"
          },
          {
            "id": "c",
            "label": "Inscrit mais absent"
          },
          {
            "id": "d",
            "label": "Non"
          },
          {
            "id": "e",
            "label": "Je ne sais pas précisément"
          }
        ],
        "required": true
      },
      {
        "id": "profil-04",
        "type": "single",
        "prompt": "Quelles spécialités avez-vous déclarées en première ?",
        "competencies": [
          "analyse_parcours"
        ],
        "domains": [
          "parcours"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Mathématiques, NSI et SES"
          },
          {
            "id": "b",
            "label": "Mathématiques et NSI seulement"
          },
          {
            "id": "c",
            "label": "Mathématiques et SES seulement"
          },
          {
            "id": "d",
            "label": "NSI et SES seulement"
          },
          {
            "id": "e",
            "label": "Autre / à confirmer"
          }
        ],
        "required": true
      },
      {
        "id": "profil-05",
        "type": "single",
        "prompt": "Quelle spécialité pensez-vous abandonner ?",
        "competencies": [
          "analyse_parcours"
        ],
        "domains": [
          "parcours"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Mathématiques"
          },
          {
            "id": "b",
            "label": "NSI"
          },
          {
            "id": "c",
            "label": "SES"
          },
          {
            "id": "d",
            "label": "Je ne sais pas"
          },
          {
            "id": "e",
            "label": "La décision est déjà enregistrée dans Cyclades"
          }
        ],
        "required": true
      },
      {
        "id": "profil-06",
        "type": "single",
        "prompt": "Combien d’heures de travail personnel effectif faisiez-vous par semaine ?",
        "competencies": [
          "analyse_parcours"
        ],
        "domains": [
          "parcours"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Moins de 3 h"
          },
          {
            "id": "b",
            "label": "3 à 6 h"
          },
          {
            "id": "c",
            "label": "7 à 10 h"
          },
          {
            "id": "d",
            "label": "11 à 15 h"
          },
          {
            "id": "e",
            "label": "Plus de 15 h"
          }
        ],
        "required": true
      },
      {
        "id": "profil-07",
        "type": "single",
        "prompt": "À quelle fréquence rendiez-vous les devoirs demandés ?",
        "competencies": [
          "analyse_parcours"
        ],
        "domains": [
          "parcours"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Toujours"
          },
          {
            "id": "b",
            "label": "Souvent"
          },
          {
            "id": "c",
            "label": "Environ une fois sur deux"
          },
          {
            "id": "d",
            "label": "Rarement"
          },
          {
            "id": "e",
            "label": "Presque jamais"
          }
        ],
        "required": true
      },
      {
        "id": "profil-08",
        "type": "single",
        "prompt": "Votre difficulté principale pendant l’année était surtout…",
        "competencies": [
          "analyse_parcours"
        ],
        "domains": [
          "parcours"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Le niveau des connaissances"
          },
          {
            "id": "b",
            "label": "La compréhension du français scolaire"
          },
          {
            "id": "c",
            "label": "La méthode des épreuves françaises"
          },
          {
            "id": "d",
            "label": "L’organisation et la régularité"
          },
          {
            "id": "e",
            "label": "Le stress ou la santé"
          },
          {
            "id": "f",
            "label": "Plusieurs de ces facteurs"
          }
        ],
        "required": true
      },
      {
        "id": "profil-09",
        "type": "single",
        "prompt": "Quel est votre projet principal pour 2027 ?",
        "competencies": [
          "analyse_parcours"
        ],
        "domains": [
          "parcours"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Obtenir le baccalauréat français"
          },
          {
            "id": "b",
            "label": "Préparer une orientation précise"
          },
          {
            "id": "c",
            "label": "Reprendre confiance"
          },
          {
            "id": "d",
            "label": "Éviter de perdre une année"
          },
          {
            "id": "e",
            "label": "Je n’ai pas encore de projet clair"
          }
        ],
        "required": true
      },
      {
        "id": "profil-10",
        "type": "single",
        "prompt": "Quel environnement de préparation vous conviendrait le mieux ?",
        "competencies": [
          "analyse_parcours"
        ],
        "domains": [
          "parcours"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Présentiel quotidien très encadré"
          },
          {
            "id": "b",
            "label": "Mixte : présentiel régulier + travail en ligne"
          },
          {
            "id": "c",
            "label": "Principalement en ligne avec suivi"
          },
          {
            "id": "d",
            "label": "Travail autonome avec bilans ponctuels"
          },
          {
            "id": "e",
            "label": "Je ne sais pas"
          }
        ],
        "required": true
      },
      {
        "id": "profil-11",
        "type": "short",
        "prompt": "Indiquez votre établissement 2025/2026.",
        "competencies": [
          "analyse_parcours"
        ],
        "domains": [
          "parcours"
        ],
        "maxPoints": 0,
        "placeholder": "Nom de l’établissement et ville",
        "required": true
      },
      {
        "id": "profil-12",
        "type": "long",
        "prompt": "Décrivez brièvement votre parcours depuis la classe de seconde.",
        "competencies": [
          "analyse_parcours"
        ],
        "domains": [
          "parcours"
        ],
        "maxPoints": 0,
        "placeholder": "Changements d’établissement, interruptions, redoublements, cours particuliers…",
        "required": true,
        "manualReview": true,
        "wordLimit": 300
      },
      {
        "id": "profil-13",
        "type": "multiple",
        "prompt": "Quelles matières vous semblent aujourd’hui les plus solides ?",
        "competencies": [
          "metacognition"
        ],
        "domains": [
          "auto_evaluation"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Français"
          },
          {
            "id": "b",
            "label": "Mathématiques"
          },
          {
            "id": "c",
            "label": "NSI"
          },
          {
            "id": "d",
            "label": "SES"
          },
          {
            "id": "e",
            "label": "Histoire-géographie"
          },
          {
            "id": "f",
            "label": "Enseignement scientifique"
          },
          {
            "id": "g",
            "label": "Philosophie"
          },
          {
            "id": "h",
            "label": "Anglais"
          },
          {
            "id": "i",
            "label": "LVB"
          }
        ],
        "required": true
      },
      {
        "id": "profil-14",
        "type": "multiple",
        "prompt": "Quelles matières vous semblent aujourd’hui les plus fragiles ?",
        "competencies": [
          "metacognition"
        ],
        "domains": [
          "auto_evaluation"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Français"
          },
          {
            "id": "b",
            "label": "Mathématiques"
          },
          {
            "id": "c",
            "label": "NSI"
          },
          {
            "id": "d",
            "label": "SES"
          },
          {
            "id": "e",
            "label": "Histoire-géographie"
          },
          {
            "id": "f",
            "label": "Enseignement scientifique"
          },
          {
            "id": "g",
            "label": "Philosophie"
          },
          {
            "id": "h",
            "label": "Anglais"
          },
          {
            "id": "i",
            "label": "LVB"
          }
        ],
        "required": true
      },
      {
        "id": "profil-15",
        "type": "numeric",
        "prompt": "Quelle note globale pensez-vous pouvoir atteindre au bac français avec un accompagnement intensif ?",
        "competencies": [
          "projection"
        ],
        "domains": [
          "auto_evaluation"
        ],
        "maxPoints": 0,
        "min": 0,
        "max": 20,
        "step": 0.25,
        "required": true
      },
      {
        "id": "profil-16",
        "type": "single",
        "prompt": "Quel volume hebdomadaire total êtes-vous réellement prêt à consacrer aux cours et au travail personnel ?",
        "competencies": [
          "engagement"
        ],
        "domains": [
          "disponibilite"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Moins de 10 h"
          },
          {
            "id": "b",
            "label": "10 à 15 h"
          },
          {
            "id": "c",
            "label": "16 à 20 h"
          },
          {
            "id": "d",
            "label": "21 à 25 h"
          },
          {
            "id": "e",
            "label": "26 à 30 h"
          },
          {
            "id": "f",
            "label": "Plus de 30 h"
          }
        ],
        "required": true
      },
      {
        "id": "profil-17",
        "type": "long",
        "prompt": "Décrivez votre projet d’études ou de métier, même s’il est encore incertain.",
        "competencies": [
          "projection"
        ],
        "domains": [
          "orientation"
        ],
        "maxPoints": 0,
        "required": true,
        "manualReview": true,
        "wordLimit": 250
      },
      {
        "id": "profil-18",
        "type": "long",
        "prompt": "Qu’attendez-vous concrètement de Nexus Réussite ?",
        "competencies": [
          "projection"
        ],
        "domains": [
          "attentes"
        ],
        "maxPoints": 0,
        "required": true,
        "manualReview": true,
        "wordLimit": 250
      },
      {
        "id": "profil-19",
        "type": "single",
        "prompt": "Avez-vous un aménagement officiel d’examen ou un besoin d’accessibilité à signaler ?",
        "competencies": [
          "accessibilite"
        ],
        "domains": [
          "accessibilite"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Non"
          },
          {
            "id": "b",
            "label": "Oui, décision officielle disponible"
          },
          {
            "id": "c",
            "label": "Demande en cours"
          },
          {
            "id": "d",
            "label": "Je souhaite en parler confidentiellement"
          }
        ],
        "required": true
      },
      {
        "id": "profil-20",
        "type": "long",
        "prompt": "Y a-t-il une contrainte importante de santé, de déplacement ou de calendrier qui peut affecter la préparation ?",
        "competencies": [
          "analyse_risque"
        ],
        "domains": [
          "contraintes"
        ],
        "maxPoints": 0,
        "required": false,
        "manualReview": true,
        "wordLimit": 250
      }
    ],
    "scoreDomains": [
      "parcours",
      "auto_evaluation",
      "disponibilite",
      "orientation",
      "contraintes"
    ],
    "requiredForSubmission": true
  },
  {
    "key": "autonomie-methodes",
    "title": "Autonomie, méthodes et fonctions exécutives",
    "shortTitle": "Autonomie",
    "description": "Mesurer la capacité à travailler hors établissement, planifier, persévérer, corriger ses erreurs et respecter un contrat pédagogique.",
    "audience": "ELEVE",
    "kind": "questionnaire",
    "estimatedMinutes": 35,
    "timed": false,
    "prerequisites": [
      "profil-parcours"
    ],
    "instructions": [
      "Répondez selon vos comportements réels des trois derniers mois.",
      "Les réponses seront confrontées aux données de passation et au questionnaire parent."
    ],
    "questions": [
      {
        "id": "auto-01",
        "type": "scale",
        "prompt": "Je commence un travail sans attendre qu’un adulte me relance.",
        "competencies": [
          "initiative"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-02",
        "type": "scale",
        "prompt": "Je sais transformer un objectif mensuel en tâches hebdomadaires.",
        "competencies": [
          "planification"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-03",
        "type": "scale",
        "prompt": "Je respecte les horaires que je me fixe.",
        "competencies": [
          "regularite"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-04",
        "type": "scale",
        "prompt": "Je rends les travaux même lorsqu’ils ne sont pas notés.",
        "competencies": [
          "engagement"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-05",
        "type": "scale",
        "prompt": "Je relis une correction et je refais l’exercice sans regarder.",
        "competencies": [
          "remediation"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-06",
        "type": "scale",
        "prompt": "Je répartis les révisions au lieu de tout faire la veille.",
        "competencies": [
          "espacement"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-07",
        "type": "scale",
        "prompt": "Je peux travailler 90 minutes avec une pause planifiée sans consulter mon téléphone.",
        "competencies": [
          "attention"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-08",
        "type": "scale",
        "prompt": "Je demande de l’aide avant d’accumuler plusieurs semaines de retard.",
        "competencies": [
          "alerte"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-09",
        "type": "scale",
        "prompt": "Je classe mes cours et retrouve rapidement un document.",
        "competencies": [
          "organisation"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-10",
        "type": "scale",
        "prompt": "Je sauvegarde mes fichiers sur au moins deux supports.",
        "competencies": [
          "organisation_numerique"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-11",
        "type": "scale",
        "prompt": "Je vérifie les consignes avant de commencer un devoir.",
        "competencies": [
          "lecture_consigne"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-12",
        "type": "scale",
        "prompt": "Je réserve du temps pour relire et corriger ma copie.",
        "competencies": [
          "gestion_temps"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-13",
        "type": "scale",
        "prompt": "Je sais distinguer ce que je comprends de ce que je mémorise seulement.",
        "competencies": [
          "metacognition"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-14",
        "type": "scale",
        "prompt": "Après une mauvaise note, je peux identifier deux causes précises et modifiables.",
        "competencies": [
          "metacognition"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-15",
        "type": "scale",
        "prompt": "Je tiens un calendrier des échéances.",
        "competencies": [
          "planification"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-16",
        "type": "scale",
        "prompt": "Je peux suivre un cours en ligne sans faire autre chose en parallèle.",
        "competencies": [
          "attention"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-17",
        "type": "scale",
        "prompt": "Je dors suffisamment avant une épreuve importante.",
        "competencies": [
          "hygiene_travail"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-18",
        "type": "scale",
        "prompt": "Je peux expliquer à mon parent ce qui est terminé, en retard et prioritaire.",
        "competencies": [
          "reporting"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-19",
        "type": "scale",
        "prompt": "Je supporte de ne pas réussir immédiatement un exercice difficile.",
        "competencies": [
          "perseverance"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-20",
        "type": "scale",
        "prompt": "Je corrige une méthode inefficace lorsque les résultats ne progressent pas.",
        "competencies": [
          "adaptation"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-21",
        "type": "scale",
        "prompt": "Je travaille régulièrement même quand la motivation baisse.",
        "competencies": [
          "regularite"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-22",
        "type": "scale",
        "prompt": "Je peux préparer seul mon matériel avant une séance.",
        "competencies": [
          "autonomie"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-23",
        "type": "scale",
        "prompt": "Je signale honnêtement une absence ou un travail non fait.",
        "competencies": [
          "fiabilite"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-24",
        "type": "scale",
        "prompt": "Je suis prêt à accepter un suivi d’assiduité et des alertes parent.",
        "competencies": [
          "contractualisation"
        ],
        "domains": [
          "autonomie"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "auto-25",
        "type": "long",
        "prompt": "Construisez un planning réaliste pour une semaine comprenant 12 h de cours Nexus, 15 h de travail personnel, deux examens blancs et une contrainte familiale de 4 h.",
        "competencies": [
          "planification",
          "priorisation"
        ],
        "domains": [
          "fonctions_executives"
        ],
        "maxPoints": 8,
        "instruction": "Indiquez les créneaux, les pauses, les priorités et les temps de reprise des corrections.",
        "required": true,
        "manualReview": true,
        "wordLimit": 500
      },
      {
        "id": "auto-26",
        "type": "long",
        "prompt": "Un devoir de mathématiques est en retard, une épreuve de SES a lieu demain et un oral est prévu dans trois jours. Que faites-vous dans les prochaines 24 heures ?",
        "competencies": [
          "priorisation",
          "arbitrage"
        ],
        "domains": [
          "fonctions_executives"
        ],
        "maxPoints": 5,
        "required": true,
        "manualReview": true,
        "wordLimit": 250
      },
      {
        "id": "auto-27",
        "type": "long",
        "prompt": "Quelle stratégie utilisez-vous lorsqu’une consigne vous paraît incompréhensible ?",
        "competencies": [
          "strategie_aide"
        ],
        "domains": [
          "methodes"
        ],
        "maxPoints": 4,
        "required": true,
        "manualReview": true,
        "wordLimit": 180
      },
      {
        "id": "auto-28",
        "type": "single",
        "prompt": "Acceptez-vous les conditions minimales suivantes : assiduité ≥ 90 %, remise de tous les travaux évalués, examens blancs et point hebdomadaire ?",
        "competencies": [
          "contractualisation"
        ],
        "domains": [
          "engagement"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Oui, sans réserve"
          },
          {
            "id": "b",
            "label": "Oui, avec une contrainte à discuter"
          },
          {
            "id": "c",
            "label": "Non pour le moment"
          }
        ],
        "required": true
      }
    ],
    "scoreDomains": [
      "autonomie",
      "fonctions_executives",
      "methodes",
      "engagement"
    ],
    "requiredForSubmission": true
  },
  {
    "key": "francais-academique",
    "title": "Français académique : comprendre, rédiger, argumenter",
    "shortTitle": "Français",
    "description": "Compétence seuil transversale pour comprendre les sujets, rédiger en SES et philosophie, justifier en mathématiques et réussir l’oral.",
    "audience": "ELEVE",
    "kind": "academic",
    "estimatedMinutes": 95,
    "timed": true,
    "prerequisites": [
      "profil-parcours"
    ],
    "instructions": [
      "Travaillez sans dictionnaire ni correcteur automatique.",
      "Le texte support est original et propre au diagnostic Nexus.",
      "Les productions longues seront corrigées par un enseignant."
    ],
    "questions": [
      {
        "id": "fr-info",
        "type": "information",
        "prompt": "Texte support",
        "competencies": [
          "lecture"
        ],
        "domains": [
          "comprehension"
        ],
        "maxPoints": 0,
        "description": "Une décision fondée sur des données n’est pas nécessairement une décision raisonnable. Les nombres décrivent certains aspects du réel, mais ils ne choisissent ni les critères pertinents ni les valeurs à privilégier. Un établissement peut constater qu’un élève obtient de meilleurs résultats lorsqu’il travaille davantage. Cette corrélation n’autorise pourtant pas à conclure que toute heure ajoutée produit mécaniquement le même progrès : la qualité du travail, le sommeil et la difficulté des tâches modifient la relation. La donnée devient donc utile lorsqu’elle éclaire un jugement explicite, contrôlable et révisable. Elle devient dangereuse lorsqu’elle remplace le jugement tout en donnant l’apparence de l’objectivité.",
        "required": true
      },
      {
        "id": "fr-01",
        "type": "single",
        "prompt": "Quelle est la thèse principale du texte ?",
        "competencies": [
          "comprehension_globale"
        ],
        "domains": [
          "francais_academique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "Les données rendent toutes les décisions objectives."
          },
          {
            "id": "b",
            "label": "Les données sont inutiles sans calcul statistique."
          },
          {
            "id": "c",
            "label": "Les données peuvent éclairer une décision mais ne remplacent pas le jugement."
          },
          {
            "id": "d",
            "label": "Le temps de travail explique entièrement la réussite."
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "fr-02",
        "type": "single",
        "prompt": "Dans le texte, le mot « pourtant » introduit…",
        "competencies": [
          "connecteurs"
        ],
        "domains": [
          "francais_academique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "une cause"
          },
          {
            "id": "b",
            "label": "une opposition ou une restriction"
          },
          {
            "id": "c",
            "label": "un exemple"
          },
          {
            "id": "d",
            "label": "une conclusion définitive"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "fr-03",
        "type": "single",
        "prompt": "Pourquoi l’auteur évoque-t-il le sommeil ?",
        "competencies": [
          "raisonnement"
        ],
        "domains": [
          "francais_academique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "Pour prouver que les élèves dorment trop."
          },
          {
            "id": "b",
            "label": "Pour montrer qu’une corrélation simple peut dépendre d’autres facteurs."
          },
          {
            "id": "c",
            "label": "Pour changer de sujet."
          },
          {
            "id": "d",
            "label": "Pour définir le mot donnée."
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "fr-04",
        "type": "single",
        "prompt": "Quelle proposition reformule le plus fidèlement la dernière phrase ?",
        "competencies": [
          "reformulation"
        ],
        "domains": [
          "francais_academique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "L’objectivité interdit le jugement."
          },
          {
            "id": "b",
            "label": "Une donnée peut donner une fausse impression de neutralité lorsqu’elle est utilisée sans expliciter les choix."
          },
          {
            "id": "c",
            "label": "Les décisions chiffrées sont toujours dangereuses."
          },
          {
            "id": "d",
            "label": "Il faut supprimer toutes les statistiques."
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "fr-05",
        "type": "single",
        "prompt": "Le texte distingue principalement…",
        "competencies": [
          "distinction_conceptuelle"
        ],
        "domains": [
          "francais_academique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "la mémoire et l’attention"
          },
          {
            "id": "b",
            "label": "la corrélation et la causalité"
          },
          {
            "id": "c",
            "label": "le présent et le passé"
          },
          {
            "id": "d",
            "label": "l’école et la famille"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "fr-06",
        "type": "single",
        "prompt": "Quel titre convient le mieux ?",
        "competencies": [
          "synthese"
        ],
        "domains": [
          "francais_academique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "Travailler plus pour réussir"
          },
          {
            "id": "b",
            "label": "Mesurer sans renoncer à juger"
          },
          {
            "id": "c",
            "label": "Pourquoi les nombres mentent toujours"
          },
          {
            "id": "d",
            "label": "Le sommeil des lycéens"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "fr-07",
        "type": "single",
        "prompt": "Dans « les valeurs à privilégier », le mot « valeurs » désigne surtout…",
        "competencies": [
          "vocabulaire_contexte"
        ],
        "domains": [
          "francais_academique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "des nombres"
          },
          {
            "id": "b",
            "label": "des principes ou finalités"
          },
          {
            "id": "c",
            "label": "des prix"
          },
          {
            "id": "d",
            "label": "des notes"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "fr-08",
        "type": "single",
        "prompt": "Quelle affirmation est explicitement soutenue ?",
        "competencies": [
          "preuve_textuelle"
        ],
        "domains": [
          "francais_academique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "Toute heure de travail augmente la note."
          },
          {
            "id": "b",
            "label": "La qualité du travail influence l’efficacité du temps consacré."
          },
          {
            "id": "c",
            "label": "Les statistiques doivent être interdites à l’école."
          },
          {
            "id": "d",
            "label": "Le sommeil est la seule cause de réussite."
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "fr-09",
        "type": "single",
        "prompt": "Choisissez la phrase correctement accordée.",
        "competencies": [
          "accord_participe"
        ],
        "domains": [
          "francais_academique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "Les données que nous avons recueilli sont utiles."
          },
          {
            "id": "b",
            "label": "Les données que nous avons recueillies sont utiles."
          },
          {
            "id": "c",
            "label": "Les données que nous avons recueillis est utile."
          },
          {
            "id": "d",
            "label": "Les données que nous avons recueillie sont utiles."
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "fr-10",
        "type": "single",
        "prompt": "Choisissez la ponctuation la plus claire.",
        "competencies": [
          "ponctuation"
        ],
        "domains": [
          "francais_academique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "Cependant les résultats, restent fragiles."
          },
          {
            "id": "b",
            "label": "Cependant, les résultats restent fragiles."
          },
          {
            "id": "c",
            "label": "Cependant les résultats restent, fragiles."
          },
          {
            "id": "d",
            "label": "Cependant : les résultats, restent fragiles."
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "fr-11",
        "type": "single",
        "prompt": "Quel mot est le plus proche de « révisable » dans le contexte ?",
        "competencies": [
          "vocabulaire"
        ],
        "domains": [
          "francais_academique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "modifiable après examen"
          },
          {
            "id": "b",
            "label": "visible immédiatement"
          },
          {
            "id": "c",
            "label": "impossible à justifier"
          },
          {
            "id": "d",
            "label": "calculable exactement"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "fr-12",
        "type": "single",
        "prompt": "Quelle phrase exprime une concession correcte ?",
        "competencies": [
          "syntaxe"
        ],
        "domains": [
          "francais_academique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "Bien que les données soient utiles, elles ne suffisent pas à décider."
          },
          {
            "id": "b",
            "label": "Parce que les données soient utiles, elles ne suffisent pas."
          },
          {
            "id": "c",
            "label": "Les données sont utiles afin qu’elles ne suffisent pas."
          },
          {
            "id": "d",
            "label": "Si les données utiles, elles ne suffisent pas."
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "fr-13",
        "type": "single",
        "prompt": "Quelle formulation évite le contresens ?",
        "competencies": [
          "interpretation"
        ],
        "domains": [
          "francais_academique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "Le texte affirme que les chiffres sont faux."
          },
          {
            "id": "b",
            "label": "Le texte affirme que les chiffres doivent être interprétés dans un cadre explicite."
          },
          {
            "id": "c",
            "label": "Le texte affirme que travailler est inutile."
          },
          {
            "id": "d",
            "label": "Le texte affirme que le jugement est toujours subjectif."
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "fr-14",
        "type": "single",
        "prompt": "Dans une réponse argumentée, citer le texte sert d’abord à…",
        "competencies": [
          "methode_citation"
        ],
        "domains": [
          "francais_academique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "remplir la copie"
          },
          {
            "id": "b",
            "label": "remplacer l’analyse"
          },
          {
            "id": "c",
            "label": "appuyer une interprétation précise"
          },
          {
            "id": "d",
            "label": "montrer que l’on connaît la ponctuation"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "fr-15",
        "type": "single",
        "prompt": "Une synthèse fidèle doit…",
        "competencies": [
          "synthese"
        ],
        "domains": [
          "francais_academique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "reprendre toutes les phrases"
          },
          {
            "id": "b",
            "label": "hiérarchiser les idées sans ajouter d’opinion personnelle"
          },
          {
            "id": "c",
            "label": "donner seulement un exemple"
          },
          {
            "id": "d",
            "label": "contester obligatoirement l’auteur"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "fr-16",
        "type": "long",
        "prompt": "Résumez le texte en 70 à 90 mots.",
        "competencies": [
          "synthese",
          "fidelite",
          "cohesion"
        ],
        "domains": [
          "production_ecrite"
        ],
        "maxPoints": 10,
        "instruction": "Ne donnez pas votre opinion. Conservez la progression logique.",
        "required": true,
        "manualReview": true,
        "wordLimit": 90
      },
      {
        "id": "fr-17",
        "type": "long",
        "prompt": "Expliquez en 120 à 180 mots la différence entre corrélation et causalité à partir d’un exemple personnel ou scolaire.",
        "competencies": [
          "explication",
          "exemple",
          "precision"
        ],
        "domains": [
          "production_ecrite"
        ],
        "maxPoints": 10,
        "required": true,
        "manualReview": true,
        "wordLimit": 180
      },
      {
        "id": "fr-18",
        "type": "long",
        "prompt": "Rédigez une introduction argumentée sur le sujet : « Peut-on décider justement à partir de chiffres ? »",
        "competencies": [
          "problematique",
          "introduction",
          "argumentation"
        ],
        "domains": [
          "production_ecrite"
        ],
        "maxPoints": 12,
        "instruction": "Votre introduction doit amener le sujet, définir les termes, formuler un problème et annoncer une démarche.",
        "required": true,
        "manualReview": true,
        "wordLimit": 280
      },
      {
        "id": "fr-19",
        "type": "short",
        "prompt": "Réécrivez cette phrase en corrigeant toutes les erreurs : « Les informations qu’il a collecté ne permet pas de conclure, malgré qu’elles semblent précise. »",
        "competencies": [
          "orthographe",
          "syntaxe"
        ],
        "domains": [
          "langue"
        ],
        "maxPoints": 6,
        "required": true,
        "manualReview": true,
        "wordLimit": 60
      },
      {
        "id": "fr-20",
        "type": "upload",
        "prompt": "Présentez oralement en deux minutes la thèse du texte, un argument et une limite.",
        "competencies": [
          "oral",
          "structure",
          "expression"
        ],
        "domains": [
          "expression_orale"
        ],
        "maxPoints": 15,
        "instruction": "Déposez un fichier audio ou vidéo, sans montage.",
        "required": true,
        "manualReview": true,
        "uploadRule": {
          "category": "ORAL_RECORDING",
          "accept": [
            "audio/mpeg",
            "audio/mp4",
            "audio/webm",
            "video/mp4",
            "video/webm"
          ],
          "maxFiles": 1,
          "maxBytesPerFile": 52428800,
          "required": true,
          "help": "2 minutes environ, fichier brut."
        }
      },
      {
        "id": "fr-21",
        "type": "scale",
        "prompt": "À quel point avez-vous compris le texte sans relire plus de deux fois ?",
        "competencies": [
          "metacognition"
        ],
        "domains": [
          "auto_evaluation"
        ],
        "maxPoints": 0,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Très difficile",
        "rightLabel": "Très facile",
        "required": true
      },
      {
        "id": "fr-22",
        "type": "single",
        "prompt": "Quelle partie vous a demandé le plus d’effort ?",
        "competencies": [
          "metacognition"
        ],
        "domains": [
          "auto_evaluation"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Comprendre la thèse"
          },
          {
            "id": "b",
            "label": "Comprendre les mots"
          },
          {
            "id": "c",
            "label": "Suivre le raisonnement"
          },
          {
            "id": "d",
            "label": "Rédiger"
          },
          {
            "id": "e",
            "label": "Parler à l’oral"
          },
          {
            "id": "f",
            "label": "Aucune difficulté majeure"
          }
        ],
        "required": true
      },
      {
        "id": "fr-23",
        "type": "long",
        "prompt": "Décrivez une erreur que vous pensez avoir commise dans cette épreuve.",
        "competencies": [
          "metacognition"
        ],
        "domains": [
          "auto_evaluation"
        ],
        "maxPoints": 2,
        "required": false,
        "manualReview": true,
        "wordLimit": 120
      },
      {
        "id": "fr-24",
        "type": "scale",
        "prompt": "Quel niveau de confiance accordez-vous à vos réponses ?",
        "competencies": [
          "metacognition"
        ],
        "domains": [
          "auto_evaluation"
        ],
        "maxPoints": 0,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Très faible",
        "rightLabel": "Très élevé",
        "required": true
      }
    ],
    "scoreDomains": [
      "francais_academique",
      "production_ecrite",
      "langue",
      "expression_orale"
    ],
    "requiredForSubmission": true
  },
  {
    "key": "mathematiques",
    "title": "Mathématiques : prérequis, raisonnement et entrée en terminale",
    "shortTitle": "Mathématiques",
    "description": "Évaluer les automatismes de première, le raisonnement, la rédaction et la capacité à entrer dans les notions de terminale.",
    "audience": "ELEVE",
    "kind": "academic",
    "estimatedMinutes": 105,
    "timed": true,
    "prerequisites": [
      "profil-parcours"
    ],
    "instructions": [
      "Calculatrice simple autorisée uniquement pour les questions longues si nécessaire.",
      "Toute réponse doit être justifiée dans les productions ouvertes.",
      "Signalez « non étudié » plutôt que répondre au hasard."
    ],
    "questions": [
      {
        "id": "math-01",
        "type": "single",
        "prompt": "Calculer : 3/4 − 5/8.",
        "competencies": [
          "calcul_exact"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "1/8"
          },
          {
            "id": "b",
            "label": "-1/8"
          },
          {
            "id": "c",
            "label": "2/8"
          },
          {
            "id": "d",
            "label": "-2/8"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-02",
        "type": "single",
        "prompt": "Après une hausse de 20 %, un prix vaut 120 DT. Quel était le prix initial ?",
        "competencies": [
          "pourcentage"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "96 DT"
          },
          {
            "id": "b",
            "label": "100 DT"
          },
          {
            "id": "c",
            "label": "104 DT"
          },
          {
            "id": "d",
            "label": "144 DT"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-03",
        "type": "single",
        "prompt": "Résoudre 3x − 7 = 11.",
        "competencies": [
          "equation"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "x = 4/3"
          },
          {
            "id": "b",
            "label": "x = 6"
          },
          {
            "id": "c",
            "label": "x = 18"
          },
          {
            "id": "d",
            "label": "x = -6"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-04",
        "type": "single",
        "prompt": "Les solutions de x² − 5x + 6 = 0 sont…",
        "competencies": [
          "second_degre"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "−2 et −3"
          },
          {
            "id": "b",
            "label": "2 et 3"
          },
          {
            "id": "c",
            "label": "1 et 6"
          },
          {
            "id": "d",
            "label": "aucune"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-05",
        "type": "single",
        "prompt": "Pour f(x)=2x²−3x+1, f(−1)=…",
        "competencies": [
          "fonction"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "0"
          },
          {
            "id": "b",
            "label": "2"
          },
          {
            "id": "c",
            "label": "6"
          },
          {
            "id": "d",
            "label": "-4"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-06",
        "type": "single",
        "prompt": "Si f est croissante sur [0;4] et f(1)=2, f(3)=7, alors…",
        "competencies": [
          "variations"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "f(2)<2"
          },
          {
            "id": "b",
            "label": "2≤f(2)≤7"
          },
          {
            "id": "c",
            "label": "f(2)>7"
          },
          {
            "id": "d",
            "label": "f(2)=4,5 nécessairement"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-07",
        "type": "single",
        "prompt": "La dérivée de x³−4x est…",
        "competencies": [
          "derivation"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "3x²−4"
          },
          {
            "id": "b",
            "label": "x²−4"
          },
          {
            "id": "c",
            "label": "3x−4"
          },
          {
            "id": "d",
            "label": "3x²"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-08",
        "type": "single",
        "prompt": "Une tangente à la courbe de f en a a pour coefficient directeur…",
        "competencies": [
          "tangente"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "f(a)"
          },
          {
            "id": "b",
            "label": "f’(a)"
          },
          {
            "id": "c",
            "label": "a/f(a)"
          },
          {
            "id": "d",
            "label": "f’(0)"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-09",
        "type": "single",
        "prompt": "Une suite arithmétique vérifie u₀=5 et raison −2. Alors u₄ vaut…",
        "competencies": [
          "suites"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "13"
          },
          {
            "id": "b",
            "label": "3"
          },
          {
            "id": "c",
            "label": "−3"
          },
          {
            "id": "d",
            "label": "−8"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-10",
        "type": "single",
        "prompt": "Une suite géométrique vérifie v₀=3 et raison 2. Alors v₅ vaut…",
        "competencies": [
          "suites"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "30"
          },
          {
            "id": "b",
            "label": "48"
          },
          {
            "id": "c",
            "label": "96"
          },
          {
            "id": "d",
            "label": "192"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-11",
        "type": "single",
        "prompt": "Si P(A)=0,4 et P(B|A)=0,5, alors P(A∩B)=…",
        "competencies": [
          "probabilites_conditionnelles"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "0,2"
          },
          {
            "id": "b",
            "label": "0,45"
          },
          {
            "id": "c",
            "label": "0,9"
          },
          {
            "id": "d",
            "label": "1,25"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-12",
        "type": "single",
        "prompt": "Deux événements A et B sont indépendants lorsque…",
        "competencies": [
          "independance"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "P(A∩B)=0"
          },
          {
            "id": "b",
            "label": "P(A∩B)=P(A)P(B)"
          },
          {
            "id": "c",
            "label": "P(A)=P(B)"
          },
          {
            "id": "d",
            "label": "P(A∪B)=1"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-13",
        "type": "single",
        "prompt": "Dans un schéma de Bernoulli de paramètres n=10 et p=0,3, l’espérance de X est…",
        "competencies": [
          "loi_binomiale"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "0,3"
          },
          {
            "id": "b",
            "label": "3"
          },
          {
            "id": "c",
            "label": "7"
          },
          {
            "id": "d",
            "label": "10"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-14",
        "type": "single",
        "prompt": "La fonction exponentielle vérifie…",
        "competencies": [
          "exponentielle"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "e^(a+b)=e^a+e^b"
          },
          {
            "id": "b",
            "label": "e^(a+b)=e^a e^b"
          },
          {
            "id": "c",
            "label": "e^0=0"
          },
          {
            "id": "d",
            "label": "e^(-a)=-e^a"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-15",
        "type": "single",
        "prompt": "ln(e³)=…",
        "competencies": [
          "logarithme"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "e ln 3"
          },
          {
            "id": "b",
            "label": "3"
          },
          {
            "id": "c",
            "label": "1/3"
          },
          {
            "id": "d",
            "label": "0"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-16",
        "type": "single",
        "prompt": "La limite de 1/x lorsque x tend vers +∞ est…",
        "competencies": [
          "limites"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "1"
          },
          {
            "id": "b",
            "label": "+∞"
          },
          {
            "id": "c",
            "label": "0"
          },
          {
            "id": "d",
            "label": "−∞"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-17",
        "type": "single",
        "prompt": "Le vecteur AB avec A(1;2) et B(4;−1) a pour coordonnées…",
        "competencies": [
          "vecteurs"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "(5;1)"
          },
          {
            "id": "b",
            "label": "(3;−3)"
          },
          {
            "id": "c",
            "label": "(−3;3)"
          },
          {
            "id": "d",
            "label": "(4;−2)"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-18",
        "type": "single",
        "prompt": "Une droite de vecteur directeur (2;−1) peut avoir pour vecteur normal…",
        "competencies": [
          "geometrie_analytique"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "(2;−1)"
          },
          {
            "id": "b",
            "label": "(1;2)"
          },
          {
            "id": "c",
            "label": "(−1;−2)"
          },
          {
            "id": "d",
            "label": "(2;1)"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-19",
        "type": "single",
        "prompt": "La négation de « pour tout réel x, f(x)>0 » est…",
        "competencies": [
          "logique"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "pour tout x, f(x)≤0"
          },
          {
            "id": "b",
            "label": "il existe x tel que f(x)≤0"
          },
          {
            "id": "c",
            "label": "il existe x tel que f(x)>0"
          },
          {
            "id": "d",
            "label": "f est nulle"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-20",
        "type": "single",
        "prompt": "Pour prouver qu’une proposition « si P alors Q » est fausse, il suffit…",
        "competencies": [
          "raisonnement"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "de montrer un cas où P est faux"
          },
          {
            "id": "b",
            "label": "de trouver un cas où P est vrai et Q faux"
          },
          {
            "id": "c",
            "label": "de trouver un cas où P et Q sont vrais"
          },
          {
            "id": "d",
            "label": "de montrer Q sans P"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-21",
        "type": "single",
        "prompt": "Dans l’algorithme suivant, quelle est la valeur finale de s ? s=0 ; pour k de 1 à 4 : s=s+k",
        "competencies": [
          "algorithmique"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "4"
          },
          {
            "id": "b",
            "label": "6"
          },
          {
            "id": "c",
            "label": "10"
          },
          {
            "id": "d",
            "label": "15"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-22",
        "type": "single",
        "prompt": "Une valeur passe de 80 à 68. Le taux d’évolution est…",
        "competencies": [
          "pourcentage"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "−12 %"
          },
          {
            "id": "b",
            "label": "−15 %"
          },
          {
            "id": "c",
            "label": "15 %"
          },
          {
            "id": "d",
            "label": "−20 %"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-23",
        "type": "single",
        "prompt": "La moyenne de 4, 7, 9 et 10 est…",
        "competencies": [
          "statistiques"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "7"
          },
          {
            "id": "b",
            "label": "7,5"
          },
          {
            "id": "c",
            "label": "8"
          },
          {
            "id": "d",
            "label": "30"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-24",
        "type": "single",
        "prompt": "Si une fonction dérivable admet un minimum local en a et si a est intérieur à l’intervalle, alors nécessairement…",
        "competencies": [
          "extremum"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "f(a)=0"
          },
          {
            "id": "b",
            "label": "f’(a)=0"
          },
          {
            "id": "c",
            "label": "f’’(a)=0"
          },
          {
            "id": "d",
            "label": "a=0"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "math-25",
        "type": "long",
        "prompt": "Résoudre et justifier l’inéquation (2x−1)(x+3)≤0.",
        "competencies": [
          "calcul",
          "raisonnement",
          "redaction"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 8,
        "instruction": "Présentez un tableau de signes ou une justification équivalente.",
        "required": true,
        "manualReview": true,
        "wordLimit": 250
      },
      {
        "id": "math-26",
        "type": "long",
        "prompt": "Une population de 2 000 individus augmente de 4 % par an. Modélisez la situation, calculez l’effectif après 5 ans et expliquez la limite du modèle.",
        "competencies": [
          "modelisation",
          "suites",
          "interpretation"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 10,
        "required": true,
        "manualReview": true,
        "wordLimit": 300
      },
      {
        "id": "math-27",
        "type": "long",
        "prompt": "On choisit au hasard une pièce dans une boîte contenant 6 pièces conformes et 4 défectueuses. Après contrôle, un détecteur signale « défaut » avec probabilité 0,9 pour une pièce défectueuse et 0,1 pour une pièce conforme. Calculer la probabilité qu’une pièce signalée défectueuse le soit réellement.",
        "competencies": [
          "probabilites_conditionnelles",
          "arbre",
          "redaction"
        ],
        "domains": [
          "mathematiques"
        ],
        "maxPoints": 12,
        "required": true,
        "manualReview": true,
        "wordLimit": 350
      },
      {
        "id": "math-28",
        "type": "upload",
        "prompt": "Déposez une photo ou un PDF de votre brouillon et de vos calculs pour les questions 25 à 27.",
        "competencies": [
          "trace_raisonnement"
        ],
        "domains": [
          "preuves"
        ],
        "maxPoints": 0,
        "required": true,
        "manualReview": true,
        "uploadRule": {
          "category": "WRITTEN_COPY",
          "accept": [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp"
          ],
          "maxFiles": 3,
          "maxBytesPerFile": 12582912,
          "required": true,
          "help": "Photos nettes, pages dans l’ordre."
        }
      }
    ],
    "scoreDomains": [
      "mathematiques",
      "preuves"
    ],
    "requiredForSubmission": true
  },
  {
    "key": "nsi",
    "title": "NSI : algorithmique, programmation, données et systèmes",
    "shortTitle": "NSI",
    "description": "Évaluer la compréhension informatique et la capacité à raisonner sur une épreuve entièrement écrite pour un candidat individuel.",
    "audience": "ELEVE",
    "kind": "academic",
    "estimatedMinutes": 95,
    "timed": true,
    "prerequisites": [
      "profil-parcours"
    ],
    "instructions": [
      "Python est le langage de référence.",
      "N’exécutez pas le code pendant les questions de trace.",
      "Les réponses ouvertes seront relues par un enseignant de NSI."
    ],
    "questions": [
      {
        "id": "nsi-01",
        "type": "single",
        "prompt": "Quelle est l’écriture binaire de 13 ?",
        "competencies": [
          "representation_entiers"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "1011"
          },
          {
            "id": "b",
            "label": "1101"
          },
          {
            "id": "c",
            "label": "1110"
          },
          {
            "id": "d",
            "label": "1001"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-02",
        "type": "single",
        "prompt": "En Python, que vaut 7 // 2 ?",
        "competencies": [
          "python_operateurs"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "3"
          },
          {
            "id": "b",
            "label": "3.5"
          },
          {
            "id": "c",
            "label": "4"
          },
          {
            "id": "d",
            "label": "1"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-03",
        "type": "single",
        "prompt": "Que vaut len([2,4,6]) ?",
        "competencies": [
          "listes"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "2"
          },
          {
            "id": "b",
            "label": "3"
          },
          {
            "id": "c",
            "label": "6"
          },
          {
            "id": "d",
            "label": "12"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-04",
        "type": "single",
        "prompt": "Après d={\"a\":2}; d[\"b\"]=5, que vaut len(d) ?",
        "competencies": [
          "dictionnaires"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "1"
          },
          {
            "id": "b",
            "label": "2"
          },
          {
            "id": "c",
            "label": "5"
          },
          {
            "id": "d",
            "label": "7"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-05",
        "type": "single",
        "prompt": "Que renvoie [x*x for x in range(4)] ?",
        "competencies": [
          "comprehension_liste"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "[1,4,9,16]"
          },
          {
            "id": "b",
            "label": "[0,1,4,9]"
          },
          {
            "id": "c",
            "label": "[0,1,2,3]"
          },
          {
            "id": "d",
            "label": "[0,2,4,6]"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-06",
        "type": "single",
        "prompt": "Une fonction récursive doit notamment posséder…",
        "competencies": [
          "recursivite"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "une boucle infinie"
          },
          {
            "id": "b",
            "label": "un cas de base"
          },
          {
            "id": "c",
            "label": "deux paramètres"
          },
          {
            "id": "d",
            "label": "une variable globale"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-07",
        "type": "single",
        "prompt": "La complexité d’une recherche dichotomique dans une liste triée est typiquement…",
        "competencies": [
          "complexite"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "O(1)"
          },
          {
            "id": "b",
            "label": "O(log n)"
          },
          {
            "id": "c",
            "label": "O(n)"
          },
          {
            "id": "d",
            "label": "O(n²)"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-08",
        "type": "single",
        "prompt": "Dans une pile, l’élément retiré en premier est…",
        "competencies": [
          "structures_lineaires"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "le premier ajouté"
          },
          {
            "id": "b",
            "label": "le dernier ajouté"
          },
          {
            "id": "c",
            "label": "le plus petit"
          },
          {
            "id": "d",
            "label": "choisi au hasard"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-09",
        "type": "single",
        "prompt": "Dans une file, l’élément retiré en premier est…",
        "competencies": [
          "structures_lineaires"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "le premier ajouté"
          },
          {
            "id": "b",
            "label": "le dernier ajouté"
          },
          {
            "id": "c",
            "label": "le plus grand"
          },
          {
            "id": "d",
            "label": "le milieu"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-10",
        "type": "single",
        "prompt": "Dans un arbre binaire de recherche, les valeurs du sous-arbre gauche d’un nœud sont en général…",
        "competencies": [
          "arbres"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "supérieures"
          },
          {
            "id": "b",
            "label": "inférieures"
          },
          {
            "id": "c",
            "label": "égales"
          },
          {
            "id": "d",
            "label": "sans relation"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-11",
        "type": "single",
        "prompt": "Quelle requête sélectionne tous les élèves dont la note est au moins 10 ?",
        "competencies": [
          "sql"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "SELECT * FROM eleves WHERE note >= 10;"
          },
          {
            "id": "b",
            "label": "GET eleves IF note = 10;"
          },
          {
            "id": "c",
            "label": "SELECT note > 10 IN eleves;"
          },
          {
            "id": "d",
            "label": "FROM eleves SELECT >=10;"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-12",
        "type": "single",
        "prompt": "Une clé primaire sert principalement à…",
        "competencies": [
          "bases_donnees"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "chiffrer la table"
          },
          {
            "id": "b",
            "label": "identifier de manière unique une ligne"
          },
          {
            "id": "c",
            "label": "trier automatiquement les colonnes"
          },
          {
            "id": "d",
            "label": "supprimer les doublons de texte"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-13",
        "type": "single",
        "prompt": "Le protocole HTTP est principalement utilisé pour…",
        "competencies": [
          "reseaux"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "adresser les paquets sur un réseau local"
          },
          {
            "id": "b",
            "label": "échanger des ressources web"
          },
          {
            "id": "c",
            "label": "chiffrer les disques"
          },
          {
            "id": "d",
            "label": "compiler Python"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-14",
        "type": "single",
        "prompt": "Une adresse IPv4 contient…",
        "competencies": [
          "reseaux"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "16 bits"
          },
          {
            "id": "b",
            "label": "32 bits"
          },
          {
            "id": "c",
            "label": "64 bits"
          },
          {
            "id": "d",
            "label": "128 bits"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-15",
        "type": "single",
        "prompt": "Le rôle principal du DNS est de…",
        "competencies": [
          "reseaux"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "traduire un nom de domaine en adresse IP"
          },
          {
            "id": "b",
            "label": "compresser les pages web"
          },
          {
            "id": "c",
            "label": "attribuer les mots de passe"
          },
          {
            "id": "d",
            "label": "exécuter les requêtes SQL"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-16",
        "type": "single",
        "prompt": "Un système d’exploitation gère notamment…",
        "competencies": [
          "architecture_systeme"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "uniquement les fichiers texte"
          },
          {
            "id": "b",
            "label": "les processus, la mémoire et les périphériques"
          },
          {
            "id": "c",
            "label": "la syntaxe HTML seulement"
          },
          {
            "id": "d",
            "label": "les notes des élèves"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-17",
        "type": "single",
        "prompt": "Dans un graphe non orienté, une arête relie…",
        "competencies": [
          "graphes"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "un sommet à une table SQL"
          },
          {
            "id": "b",
            "label": "deux sommets sans orientation"
          },
          {
            "id": "c",
            "label": "toujours trois sommets"
          },
          {
            "id": "d",
            "label": "deux fonctions Python"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-18",
        "type": "single",
        "prompt": "Un parcours en largeur utilise naturellement…",
        "competencies": [
          "graphes"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "une pile"
          },
          {
            "id": "b",
            "label": "une file"
          },
          {
            "id": "c",
            "label": "un dictionnaire uniquement"
          },
          {
            "id": "d",
            "label": "une récursion obligatoire"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-19",
        "type": "single",
        "prompt": "Que vaut f(4) pour f(n): si n==0 retourner 1 sinon retourner n*f(n-1) ?",
        "competencies": [
          "recursivite"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "4"
          },
          {
            "id": "b",
            "label": "10"
          },
          {
            "id": "c",
            "label": "16"
          },
          {
            "id": "d",
            "label": "24"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-20",
        "type": "single",
        "prompt": "Une collision dans une table de hachage se produit lorsque…",
        "competencies": [
          "hachage"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "deux clés obtiennent le même indice"
          },
          {
            "id": "b",
            "label": "une clé est trop longue"
          },
          {
            "id": "c",
            "label": "la table est triée"
          },
          {
            "id": "d",
            "label": "un programme compile"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-21",
        "type": "single",
        "prompt": "Quel principe réduit le risque d’accès non autorisé ?",
        "competencies": [
          "securite"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "Donner tous les droits à tous"
          },
          {
            "id": "b",
            "label": "Principe du moindre privilège"
          },
          {
            "id": "c",
            "label": "Réutiliser le même mot de passe"
          },
          {
            "id": "d",
            "label": "Désactiver les sauvegardes"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-22",
        "type": "single",
        "prompt": "Dans le modèle client-serveur…",
        "competencies": [
          "architecture_reseau"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "le client fournit toujours le service"
          },
          {
            "id": "b",
            "label": "le serveur répond à des requêtes de clients"
          },
          {
            "id": "c",
            "label": "aucun réseau n’est nécessaire"
          },
          {
            "id": "d",
            "label": "les rôles ne peuvent jamais changer"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "nsi-23",
        "type": "long",
        "prompt": "Sans exécuter le programme, donner la valeur affichée et expliquer :\n\nL=[3,1,4,1,5]\ns=0\nfor i in range(len(L)):\n    if L[i] > i:\n        s += L[i]\nprint(s)",
        "competencies": [
          "trace_programme",
          "explication"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 8,
        "required": true,
        "manualReview": true,
        "wordLimit": 220
      },
      {
        "id": "nsi-24",
        "type": "long",
        "prompt": "Écrire une fonction Python `indices_pairs(L)` qui renvoie la liste des indices où l’élément de L est pair. Préciser un jeu de tests.",
        "competencies": [
          "programmation",
          "tests"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 10,
        "required": true,
        "manualReview": true,
        "wordLimit": 300
      },
      {
        "id": "nsi-25",
        "type": "long",
        "prompt": "On dispose des tables ELEVE(id, nom) et NOTE(id_eleve, matiere, valeur). Écrire une requête qui renvoie le nom et la moyenne de chaque élève en mathématiques.",
        "competencies": [
          "sql",
          "jointure",
          "agregation"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 10,
        "required": true,
        "manualReview": true,
        "wordLimit": 250
      },
      {
        "id": "nsi-26",
        "type": "long",
        "prompt": "Expliquer pourquoi un algorithme correct sur quelques exemples peut néanmoins être incorrect en général. Donner un exemple ou une méthode de preuve.",
        "competencies": [
          "preuve_algorithme",
          "esprit_critique"
        ],
        "domains": [
          "nsi"
        ],
        "maxPoints": 8,
        "required": true,
        "manualReview": true,
        "wordLimit": 250
      }
    ],
    "scoreDomains": [
      "nsi"
    ],
    "requiredForSubmission": true
  },
  {
    "key": "ses",
    "title": "SES : connaissances, données et argumentation",
    "shortTitle": "SES",
    "description": "Évaluer les mécanismes, l’analyse de documents et la capacité à produire une démonstration écrite de niveau baccalauréat.",
    "audience": "ELEVE",
    "kind": "academic",
    "estimatedMinutes": 95,
    "timed": true,
    "prerequisites": [
      "profil-parcours"
    ],
    "instructions": [
      "Les notions de première doivent être mobilisables.",
      "Justifiez les réponses ouvertes par des mécanismes et des exemples."
    ],
    "questions": [
      {
        "id": "ses-01",
        "type": "single",
        "prompt": "Sur un marché concurrentiel, une hausse du prix tend, toutes choses égales par ailleurs, à…",
        "competencies": [
          "marche"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "augmenter la demande"
          },
          {
            "id": "b",
            "label": "réduire la quantité demandée"
          },
          {
            "id": "c",
            "label": "supprimer l’offre"
          },
          {
            "id": "d",
            "label": "rendre la demande verticale"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-02",
        "type": "single",
        "prompt": "Une externalité négative est…",
        "competencies": [
          "externalites"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "un coût subi par un tiers sans compensation"
          },
          {
            "id": "b",
            "label": "une taxe volontaire"
          },
          {
            "id": "c",
            "label": "un bénéfice privé"
          },
          {
            "id": "d",
            "label": "une baisse de salaire"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-03",
        "type": "single",
        "prompt": "Le PIB mesure principalement…",
        "competencies": [
          "croissance"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "le bonheur"
          },
          {
            "id": "b",
            "label": "la valeur des biens et services produits sur un territoire"
          },
          {
            "id": "c",
            "label": "le patrimoine total"
          },
          {
            "id": "d",
            "label": "l’égalité des revenus"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-04",
        "type": "single",
        "prompt": "Le chômage au sens du BIT suppose notamment…",
        "competencies": [
          "chomage"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "d’être sans emploi et disponible pour travailler"
          },
          {
            "id": "b",
            "label": "d’être étudiant"
          },
          {
            "id": "c",
            "label": "d’avoir un emploi à temps partiel"
          },
          {
            "id": "d",
            "label": "de refuser toute recherche"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-05",
        "type": "single",
        "prompt": "La socialisation primaire se déroule surtout…",
        "competencies": [
          "socialisation"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "uniquement à l’université"
          },
          {
            "id": "b",
            "label": "pendant l’enfance, notamment dans la famille"
          },
          {
            "id": "c",
            "label": "après la retraite"
          },
          {
            "id": "d",
            "label": "dans les entreprises seulement"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-06",
        "type": "single",
        "prompt": "La mobilité sociale intergénérationnelle compare…",
        "competencies": [
          "mobilite_sociale"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "deux emplois du même individu"
          },
          {
            "id": "b",
            "label": "la position sociale d’un individu à celle de ses parents"
          },
          {
            "id": "c",
            "label": "les salaires de deux pays"
          },
          {
            "id": "d",
            "label": "les notes de deux classes"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-07",
        "type": "single",
        "prompt": "Une corrélation positive entre X et Y signifie que…",
        "competencies": [
          "donnees"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "X cause nécessairement Y"
          },
          {
            "id": "b",
            "label": "les deux variables tendent à évoluer dans le même sens"
          },
          {
            "id": "c",
            "label": "X et Y sont égales"
          },
          {
            "id": "d",
            "label": "aucune relation n’existe"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-08",
        "type": "single",
        "prompt": "Une politique budgétaire de relance consiste typiquement à…",
        "competencies": [
          "politique_economique"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "réduire toute dépense publique"
          },
          {
            "id": "b",
            "label": "augmenter les dépenses publiques ou réduire certains prélèvements"
          },
          {
            "id": "c",
            "label": "interdire le crédit"
          },
          {
            "id": "d",
            "label": "fixer tous les prix"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-09",
        "type": "single",
        "prompt": "Le capital culturel peut inclure…",
        "competencies": [
          "inegalites"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "uniquement l’argent disponible"
          },
          {
            "id": "b",
            "label": "des connaissances, dispositions et titres scolaires"
          },
          {
            "id": "c",
            "label": "le nombre de machines"
          },
          {
            "id": "d",
            "label": "la monnaie détenue par la banque centrale"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-10",
        "type": "single",
        "prompt": "Un bien public pur est en principe…",
        "competencies": [
          "action_publique"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "rival et excluable"
          },
          {
            "id": "b",
            "label": "non rival et non excluable"
          },
          {
            "id": "c",
            "label": "toujours vendu par une entreprise"
          },
          {
            "id": "d",
            "label": "un bien de luxe"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-11",
        "type": "single",
        "prompt": "La spécialisation internationale peut s’expliquer par…",
        "competencies": [
          "commerce_international"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "des avantages comparatifs"
          },
          {
            "id": "b",
            "label": "l’absence totale de coûts"
          },
          {
            "id": "c",
            "label": "l’identité des technologies"
          },
          {
            "id": "d",
            "label": "l’interdiction des échanges"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-12",
        "type": "single",
        "prompt": "Une élasticité-prix de la demande égale à −2 signifie approximativement qu’une hausse du prix de 1 % entraîne…",
        "competencies": [
          "elasticite"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "une hausse de demande de 2 %"
          },
          {
            "id": "b",
            "label": "une baisse de demande de 2 %"
          },
          {
            "id": "c",
            "label": "une baisse de prix de 2 %"
          },
          {
            "id": "d",
            "label": "aucun effet"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-13",
        "type": "single",
        "prompt": "Un sondage représentatif exige notamment…",
        "competencies": [
          "methodologie"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "un échantillon composé uniquement de volontaires proches"
          },
          {
            "id": "b",
            "label": "une méthode d’échantillonnage adaptée à la population"
          },
          {
            "id": "c",
            "label": "le plus petit échantillon possible"
          },
          {
            "id": "d",
            "label": "aucune définition de la population"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-14",
        "type": "single",
        "prompt": "Le marché peut être défaillant lorsque…",
        "competencies": [
          "defaillances_marche"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "les prix existent"
          },
          {
            "id": "b",
            "label": "des externalités ou asymétries d’information empêchent une allocation efficace"
          },
          {
            "id": "c",
            "label": "les entreprises font des calculs"
          },
          {
            "id": "d",
            "label": "les consommateurs choisissent"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-15",
        "type": "single",
        "prompt": "La stratification sociale désigne…",
        "competencies": [
          "stratification"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "la succession des saisons"
          },
          {
            "id": "b",
            "label": "l’organisation hiérarchisée des groupes sociaux"
          },
          {
            "id": "c",
            "label": "la seule différence d’âge"
          },
          {
            "id": "d",
            "label": "le classement alphabétique"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-16",
        "type": "single",
        "prompt": "Une institution est…",
        "competencies": [
          "institutions"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "une habitude individuelle sans règle"
          },
          {
            "id": "b",
            "label": "un ensemble relativement stable de règles et pratiques sociales"
          },
          {
            "id": "c",
            "label": "un prix de marché"
          },
          {
            "id": "d",
            "label": "un algorithme"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-17",
        "type": "single",
        "prompt": "Pour établir une causalité, il faut au minimum…",
        "competencies": [
          "causalite"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "observer une seule coïncidence"
          },
          {
            "id": "b",
            "label": "écarter des explications alternatives et identifier un mécanisme"
          },
          {
            "id": "c",
            "label": "avoir deux pourcentages égaux"
          },
          {
            "id": "d",
            "label": "interroger une personne"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-18",
        "type": "single",
        "prompt": "Dans une dissertation, la problématique sert à…",
        "competencies": [
          "methode_dissertation"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "répéter le sujet"
          },
          {
            "id": "b",
            "label": "transformer le sujet en problème organisé qui guide la démonstration"
          },
          {
            "id": "c",
            "label": "annoncer seulement les exemples"
          },
          {
            "id": "d",
            "label": "éviter de définir les termes"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ses-19",
        "type": "long",
        "prompt": "Un tableau indique que la part des diplômés du supérieur est de 52 % chez les enfants de cadres et de 18 % chez les enfants d’ouvriers. Rédigez deux phrases de lecture rigoureuses, puis formulez une limite d’interprétation.",
        "competencies": [
          "lecture_donnees",
          "comparaison",
          "prudence"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 10,
        "required": true,
        "manualReview": true,
        "wordLimit": 220
      },
      {
        "id": "ses-20",
        "type": "long",
        "prompt": "Expliquez comment une externalité négative peut justifier une intervention publique. Présentez un mécanisme et deux instruments possibles.",
        "competencies": [
          "mecanisme",
          "action_publique",
          "argumentation"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 12,
        "required": true,
        "manualReview": true,
        "wordLimit": 320
      },
      {
        "id": "ses-21",
        "type": "long",
        "prompt": "Construisez un plan détaillé pour le sujet : « L’égalité des chances suffit-elle à réduire les inégalités ? »",
        "competencies": [
          "problematique",
          "plan",
          "connaissances"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 14,
        "required": true,
        "manualReview": true,
        "wordLimit": 450
      },
      {
        "id": "ses-22",
        "type": "long",
        "prompt": "Rédigez un paragraphe AEI (Affirmation–Explication–Illustration) sur le rôle de la socialisation dans la différenciation des comportements.",
        "competencies": [
          "aei",
          "redaction",
          "illustration"
        ],
        "domains": [
          "ses"
        ],
        "maxPoints": 10,
        "required": true,
        "manualReview": true,
        "wordLimit": 250
      }
    ],
    "scoreDomains": [
      "ses"
    ],
    "requiredForSubmission": true
  },
  {
    "key": "tronc-commun",
    "title": "Tronc commun, langues et philosophie",
    "shortTitle": "Tronc commun",
    "description": "Évaluer les compétences transversales qui comptent dans les évaluations ponctuelles et les épreuves finales.",
    "audience": "ELEVE",
    "kind": "academic",
    "estimatedMinutes": 105,
    "timed": true,
    "prerequisites": [
      "profil-parcours"
    ],
    "instructions": [
      "La partie LVB peut être complétée après confirmation de la langue.",
      "Les productions longues sont corrigées manuellement."
    ],
    "questions": [
      {
        "id": "tc-01",
        "type": "single",
        "prompt": "Une source historique produite au moment des faits est…",
        "competencies": [
          "critique_source"
        ],
        "domains": [
          "histoire_geo"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "toujours vraie"
          },
          {
            "id": "b",
            "label": "une source primaire à contextualiser et critiquer"
          },
          {
            "id": "c",
            "label": "inutile"
          },
          {
            "id": "d",
            "label": "une statistique"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-02",
        "type": "single",
        "prompt": "Pour analyser une carte, il faut d’abord…",
        "competencies": [
          "analyse_carte"
        ],
        "domains": [
          "histoire_geo"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "ignorer la légende"
          },
          {
            "id": "b",
            "label": "identifier le titre, l’échelle, la légende et la source"
          },
          {
            "id": "c",
            "label": "compter les couleurs"
          },
          {
            "id": "d",
            "label": "donner son opinion"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-03",
        "type": "single",
        "prompt": "Une démocratie représentative repose notamment sur…",
        "competencies": [
          "emc"
        ],
        "domains": [
          "histoire_geo"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "l’absence d’élections"
          },
          {
            "id": "b",
            "label": "la désignation de représentants par les citoyens"
          },
          {
            "id": "c",
            "label": "un parti unique obligatoire"
          },
          {
            "id": "d",
            "label": "la suppression des lois"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-04",
        "type": "single",
        "prompt": "Un taux de variation de 25 % à 30 % correspond à…",
        "competencies": [
          "lecture_donnees"
        ],
        "domains": [
          "histoire_geo"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "5 %"
          },
          {
            "id": "b",
            "label": "5 points et 20 % d’augmentation relative"
          },
          {
            "id": "c",
            "label": "20 points"
          },
          {
            "id": "d",
            "label": "30 %"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-05",
        "type": "single",
        "prompt": "Dans une argumentation géographique, un changement d’échelle sert à…",
        "competencies": [
          "echelles"
        ],
        "domains": [
          "histoire_geo"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "répéter la même information"
          },
          {
            "id": "b",
            "label": "comparer les phénomènes du local au mondial"
          },
          {
            "id": "c",
            "label": "éviter les exemples"
          },
          {
            "id": "d",
            "label": "remplacer les cartes"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-06",
        "type": "single",
        "prompt": "Un document officiel doit être interrogé notamment sur…",
        "competencies": [
          "critique_source"
        ],
        "domains": [
          "histoire_geo"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "son auteur, sa date, son contexte et son objectif"
          },
          {
            "id": "b",
            "label": "sa longueur seulement"
          },
          {
            "id": "c",
            "label": "la couleur du papier"
          },
          {
            "id": "d",
            "label": "le nombre de paragraphes"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-07",
        "type": "single",
        "prompt": "L’unité de l’énergie dans le Système international est…",
        "competencies": [
          "energie"
        ],
        "domains": [
          "enseignement_scientifique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "le watt"
          },
          {
            "id": "b",
            "label": "le joule"
          },
          {
            "id": "c",
            "label": "le volt"
          },
          {
            "id": "d",
            "label": "le kelvin"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-08",
        "type": "single",
        "prompt": "Le watt mesure…",
        "competencies": [
          "energie"
        ],
        "domains": [
          "enseignement_scientifique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "une énergie"
          },
          {
            "id": "b",
            "label": "une puissance"
          },
          {
            "id": "c",
            "label": "une masse"
          },
          {
            "id": "d",
            "label": "une température"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-09",
        "type": "single",
        "prompt": "L’effet de serre naturel…",
        "competencies": [
          "climat"
        ],
        "domains": [
          "enseignement_scientifique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "n’existe pas"
          },
          {
            "id": "b",
            "label": "contribue à rendre la Terre habitable, mais son renforcement modifie le climat"
          },
          {
            "id": "c",
            "label": "est uniquement dû à l’ozone"
          },
          {
            "id": "d",
            "label": "refroidit toujours la planète"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-10",
        "type": "single",
        "prompt": "Une corrélation entre deux grandeurs expérimentales…",
        "competencies": [
          "demarche_scientifique"
        ],
        "domains": [
          "enseignement_scientifique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "prouve toujours la causalité"
          },
          {
            "id": "b",
            "label": "doit être interprétée avec un modèle et des contrôles"
          },
          {
            "id": "c",
            "label": "est impossible"
          },
          {
            "id": "d",
            "label": "supprime l’incertitude"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-11",
        "type": "single",
        "prompt": "Une mesure scientifique doit idéalement préciser…",
        "competencies": [
          "mesure"
        ],
        "domains": [
          "enseignement_scientifique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "seulement le nombre obtenu"
          },
          {
            "id": "b",
            "label": "l’unité et une estimation de l’incertitude"
          },
          {
            "id": "c",
            "label": "le nom de l’élève uniquement"
          },
          {
            "id": "d",
            "label": "une opinion"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-12",
        "type": "single",
        "prompt": "L’ADN porte une information sous forme…",
        "competencies": [
          "genetique"
        ],
        "domains": [
          "enseignement_scientifique"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "d’une séquence de nucléotides"
          },
          {
            "id": "b",
            "label": "d’une température"
          },
          {
            "id": "c",
            "label": "d’une force"
          },
          {
            "id": "d",
            "label": "d’un signal sonore uniquement"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-en-info",
        "type": "information",
        "prompt": "English reading text",
        "competencies": [
          "reading"
        ],
        "domains": [
          "anglais"
        ],
        "maxPoints": 0,
        "description": "A school introduced a weekly study-planning session. After three months, late assignments decreased, but the improvement was uneven. Students who reviewed their plans every Friday progressed more than those who only filled in the form once. The school therefore concluded that the tool itself was less important than the habit of revising decisions in light of new information.",
        "required": true
      },
      {
        "id": "tc-13",
        "type": "single",
        "prompt": "What changed after three months?",
        "competencies": [
          "reading_detail"
        ],
        "domains": [
          "anglais"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "All students obtained the same grades."
          },
          {
            "id": "b",
            "label": "Late assignments decreased."
          },
          {
            "id": "c",
            "label": "The planning session was cancelled."
          },
          {
            "id": "d",
            "label": "Students stopped reviewing plans."
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-14",
        "type": "single",
        "prompt": "Which students progressed more?",
        "competencies": [
          "reading_detail"
        ],
        "domains": [
          "anglais"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "Those who never used a plan."
          },
          {
            "id": "b",
            "label": "Those who reviewed their plans weekly."
          },
          {
            "id": "c",
            "label": "Only the oldest students."
          },
          {
            "id": "d",
            "label": "Those who filled the form once."
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-15",
        "type": "single",
        "prompt": "What is the main conclusion?",
        "competencies": [
          "reading_inference"
        ],
        "domains": [
          "anglais"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "A form is sufficient by itself."
          },
          {
            "id": "b",
            "label": "Regular revision of decisions matters more than the tool alone."
          },
          {
            "id": "c",
            "label": "Planning has no effect."
          },
          {
            "id": "d",
            "label": "Friday is the best day for exams."
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-16",
        "type": "single",
        "prompt": "In the text, “uneven” is closest to…",
        "competencies": [
          "vocabulary"
        ],
        "domains": [
          "anglais"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "identical"
          },
          {
            "id": "b",
            "label": "not equal or consistent"
          },
          {
            "id": "c",
            "label": "impossible"
          },
          {
            "id": "d",
            "label": "immediate"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-17",
        "type": "single",
        "prompt": "Choose the correct sentence.",
        "competencies": [
          "grammar"
        ],
        "domains": [
          "anglais"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "Students has improved."
          },
          {
            "id": "b",
            "label": "Students have improved."
          },
          {
            "id": "c",
            "label": "Students is improving yesterday."
          },
          {
            "id": "d",
            "label": "Students have improve."
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-18",
        "type": "single",
        "prompt": "Choose the most appropriate connector: “The tool was simple; ___, it became useful only when students reviewed it regularly.”",
        "competencies": [
          "connectors"
        ],
        "domains": [
          "anglais"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "however"
          },
          {
            "id": "b",
            "label": "because of"
          },
          {
            "id": "c",
            "label": "unless"
          },
          {
            "id": "d",
            "label": "during"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "tc-19",
        "type": "long",
        "prompt": "Write 120–160 words in English: explain one study habit you need to change and how you will measure progress.",
        "competencies": [
          "writing",
          "argumentation"
        ],
        "domains": [
          "anglais"
        ],
        "maxPoints": 10,
        "required": true,
        "manualReview": true,
        "wordLimit": 160
      },
      {
        "id": "tc-20",
        "type": "single",
        "prompt": "Choisissez votre LVB.",
        "competencies": [
          "langues"
        ],
        "domains": [
          "lvb"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Arabe"
          },
          {
            "id": "b",
            "label": "Espagnol"
          },
          {
            "id": "c",
            "label": "Allemand"
          },
          {
            "id": "d",
            "label": "Italien"
          },
          {
            "id": "e",
            "label": "Autre"
          },
          {
            "id": "f",
            "label": "Aucune / à confirmer"
          }
        ],
        "required": true
      },
      {
        "id": "tc-21",
        "type": "upload",
        "prompt": "Déposez un enregistrement de 90 secondes dans votre LVB : présentez-vous et expliquez votre projet pour l’année.",
        "competencies": [
          "expression_orale"
        ],
        "domains": [
          "lvb"
        ],
        "maxPoints": 8,
        "required": false,
        "manualReview": true,
        "uploadRule": {
          "category": "ORAL_RECORDING",
          "accept": [
            "audio/mpeg",
            "audio/mp4",
            "audio/webm",
            "video/mp4",
            "video/webm"
          ],
          "maxFiles": 1,
          "maxBytesPerFile": 41943040,
          "required": false,
          "help": "Facultatif tant que la LVB n’est pas confirmée."
        }
      },
      {
        "id": "tc-22",
        "type": "single",
        "prompt": "En philosophie, définir un terme du sujet sert à…",
        "competencies": [
          "conceptualisation"
        ],
        "domains": [
          "philosophie"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "réciter le dictionnaire"
          },
          {
            "id": "b",
            "label": "fixer le sens pertinent et faire apparaître une difficulté"
          },
          {
            "id": "c",
            "label": "éviter la problématique"
          },
          {
            "id": "d",
            "label": "annoncer seulement un auteur"
          }
        ],
        "required": true
      },
      {
        "id": "tc-23",
        "type": "single",
        "prompt": "Une objection dans une dissertation sert à…",
        "competencies": [
          "argumentation"
        ],
        "domains": [
          "philosophie"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "détruire tout raisonnement"
          },
          {
            "id": "b",
            "label": "tester et nuancer une thèse"
          },
          {
            "id": "c",
            "label": "changer de sujet"
          },
          {
            "id": "d",
            "label": "remplacer les arguments"
          }
        ],
        "required": true
      },
      {
        "id": "tc-24",
        "type": "long",
        "prompt": "Analysez le sujet : « Être libre, est-ce faire tout ce que l’on veut ? » Définissez les termes et formulez un problème.",
        "competencies": [
          "analyse_sujet",
          "problematique"
        ],
        "domains": [
          "philosophie"
        ],
        "maxPoints": 12,
        "required": true,
        "manualReview": true,
        "wordLimit": 320
      },
      {
        "id": "tc-25",
        "type": "long",
        "prompt": "Rédigez un argument et une objection sur l’affirmation : « La technique nous rend plus libres. »",
        "competencies": [
          "argument",
          "objection"
        ],
        "domains": [
          "philosophie"
        ],
        "maxPoints": 10,
        "required": true,
        "manualReview": true,
        "wordLimit": 280
      },
      {
        "id": "tc-26",
        "type": "long",
        "prompt": "Décrivez votre méthode habituelle pour apprendre un chapitre d’histoire-géographie ou de philosophie.",
        "competencies": [
          "methodes"
        ],
        "domains": [
          "methodes_tronc_commun"
        ],
        "maxPoints": 4,
        "required": true,
        "manualReview": true,
        "wordLimit": 180
      }
    ],
    "scoreDomains": [
      "histoire_geo",
      "enseignement_scientifique",
      "anglais",
      "lvb",
      "philosophie"
    ],
    "requiredForSubmission": true
  },
  {
    "key": "grand-oral",
    "title": "Grand oral : question, structure et prestation",
    "shortTitle": "Grand oral",
    "description": "Évaluer la capacité à construire une question, organiser un exposé et répondre sans récitation intégrale.",
    "audience": "ELEVE",
    "kind": "oral",
    "estimatedMinutes": 45,
    "timed": true,
    "prerequisites": [
      "profil-parcours"
    ],
    "instructions": [
      "L’enregistrement doit être réalisé en une prise.",
      "La qualité technique de la vidéo n’est pas notée."
    ],
    "questions": [
      {
        "id": "go-01",
        "type": "single",
        "prompt": "Avez-vous déjà préparé deux questions adossées à vos spécialités ?",
        "competencies": [
          "grand_oral"
        ],
        "domains": [
          "grand_oral"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Oui, elles sont stabilisées"
          },
          {
            "id": "b",
            "label": "Oui, mais elles doivent être retravaillées"
          },
          {
            "id": "c",
            "label": "J’ai seulement des thèmes"
          },
          {
            "id": "d",
            "label": "Non"
          }
        ],
        "required": true
      },
      {
        "id": "go-02",
        "type": "single",
        "prompt": "Une bonne question de Grand oral doit surtout…",
        "competencies": [
          "grand_oral"
        ],
        "domains": [
          "grand_oral"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "être très large"
          },
          {
            "id": "b",
            "label": "permettre une démonstration personnelle et structurée liée aux spécialités"
          },
          {
            "id": "c",
            "label": "appeler une réponse par oui/non seulement"
          },
          {
            "id": "d",
            "label": "être copiée d’un sujet trouvé en ligne"
          }
        ],
        "required": true
      },
      {
        "id": "go-03",
        "type": "single",
        "prompt": "Pendant l’exposé, un exemple sert à…",
        "competencies": [
          "grand_oral"
        ],
        "domains": [
          "grand_oral"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "remplacer l’argument"
          },
          {
            "id": "b",
            "label": "rendre concret et étayer le raisonnement"
          },
          {
            "id": "c",
            "label": "gagner du temps seulement"
          },
          {
            "id": "d",
            "label": "éviter les notions du programme"
          }
        ],
        "required": true
      },
      {
        "id": "go-04",
        "type": "single",
        "prompt": "Face à une question imprévue du jury, la meilleure stratégie est…",
        "competencies": [
          "grand_oral"
        ],
        "domains": [
          "grand_oral"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "inventer une réponse"
          },
          {
            "id": "b",
            "label": "reformuler, raisonner à voix haute et reconnaître précisément une limite"
          },
          {
            "id": "c",
            "label": "rester silencieux"
          },
          {
            "id": "d",
            "label": "changer de sujet"
          }
        ],
        "required": true
      },
      {
        "id": "go-05",
        "type": "single",
        "prompt": "Quel est votre niveau actuel de stress à l’oral ?",
        "competencies": [
          "grand_oral"
        ],
        "domains": [
          "grand_oral"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "0 à 2 / 10"
          },
          {
            "id": "b",
            "label": "3 à 4 / 10"
          },
          {
            "id": "c",
            "label": "5 à 6 / 10"
          },
          {
            "id": "d",
            "label": "7 à 8 / 10"
          },
          {
            "id": "e",
            "label": "9 à 10 / 10"
          }
        ],
        "required": true
      },
      {
        "id": "go-06",
        "type": "long",
        "prompt": "Proposez deux questions possibles : une liée à chacune de vos spécialités ou une question transversale clairement justifiée.",
        "competencies": [
          "choix_question",
          "ancrage_programme"
        ],
        "domains": [
          "grand_oral"
        ],
        "maxPoints": 8,
        "required": true,
        "manualReview": true,
        "wordLimit": 250
      },
      {
        "id": "go-07",
        "type": "long",
        "prompt": "Pour votre meilleure question, rédigez une problématique et un plan en trois mouvements.",
        "competencies": [
          "problematique",
          "structure"
        ],
        "domains": [
          "grand_oral"
        ],
        "maxPoints": 10,
        "required": true,
        "manualReview": true,
        "wordLimit": 350
      },
      {
        "id": "go-08",
        "type": "upload",
        "prompt": "Déposez un exposé vidéo de 5 minutes, sans lire un texte intégral.",
        "competencies": [
          "oral",
          "posture",
          "structure",
          "precision"
        ],
        "domains": [
          "grand_oral"
        ],
        "maxPoints": 20,
        "required": true,
        "manualReview": true,
        "uploadRule": {
          "category": "ORAL_RECORDING",
          "accept": [
            "video/mp4",
            "video/webm"
          ],
          "maxFiles": 1,
          "maxBytesPerFile": 125829120,
          "required": true,
          "help": "Cadrez le buste et le visage, sans montage."
        }
      },
      {
        "id": "go-09",
        "type": "short",
        "prompt": "Après l’enregistrement, indiquez une force observable.",
        "competencies": [
          "auto_evaluation"
        ],
        "domains": [
          "grand_oral"
        ],
        "maxPoints": 2,
        "required": true,
        "manualReview": true,
        "wordLimit": 80
      },
      {
        "id": "go-10",
        "type": "short",
        "prompt": "Après l’enregistrement, indiquez une priorité de progrès.",
        "competencies": [
          "auto_evaluation"
        ],
        "domains": [
          "grand_oral"
        ],
        "maxPoints": 2,
        "required": true,
        "manualReview": true,
        "wordLimit": 80
      },
      {
        "id": "go-11",
        "type": "single",
        "prompt": "Avez-vous lu un texte pendant plus d’un tiers de l’exposé ?",
        "competencies": [
          "integrite_oral"
        ],
        "domains": [
          "grand_oral"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Non"
          },
          {
            "id": "b",
            "label": "Oui, ponctuellement"
          },
          {
            "id": "c",
            "label": "Oui, la plupart du temps"
          }
        ],
        "required": true
      },
      {
        "id": "go-12",
        "type": "single",
        "prompt": "Quel temps de préparation hebdomadaire êtes-vous prêt à consacrer au Grand oral ?",
        "competencies": [
          "engagement"
        ],
        "domains": [
          "grand_oral"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Moins de 30 min"
          },
          {
            "id": "b",
            "label": "30 à 60 min"
          },
          {
            "id": "c",
            "label": "1 à 2 h"
          },
          {
            "id": "d",
            "label": "Plus de 2 h"
          }
        ],
        "required": true
      }
    ],
    "scoreDomains": [
      "grand_oral"
    ],
    "requiredForSubmission": true
  },
  {
    "key": "potentiel-t0",
    "title": "Prétest T0 : raisonnement et transfert",
    "shortTitle": "Prétest T0",
    "description": "Mesure initiale sur des notions de proportion, condition, probabilité et preuve avant une micro-remédiation.",
    "audience": "ELEVE",
    "kind": "learning-potential",
    "estimatedMinutes": 25,
    "timed": true,
    "prerequisites": [
      "autonomie-methodes"
    ],
    "instructions": [
      "Ne cherchez pas de cours pendant le prétest.",
      "La progression entre T0 et T1 compte autant que le niveau initial."
    ],
    "questions": [
      {
        "id": "t0-01",
        "type": "single",
        "prompt": "Une classe compte 40 % de filles. Parmi les filles, 30 % pratiquent un sport en club. Quelle proportion de la classe est composée de filles pratiquant un sport en club ?",
        "competencies": [
          "proportion_composee"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "12 %"
          },
          {
            "id": "b",
            "label": "30 %"
          },
          {
            "id": "c",
            "label": "40 %"
          },
          {
            "id": "d",
            "label": "70 %"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t0-02",
        "type": "single",
        "prompt": "Un test est positif chez 90 % des personnes malades et chez 10 % des personnes non malades. Peut-on déterminer P(malade | positif) sans connaître la fréquence de la maladie ?",
        "competencies": [
          "probabilite_inverse"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "Oui, toujours 90 %"
          },
          {
            "id": "b",
            "label": "Non, il manque la prévalence"
          },
          {
            "id": "c",
            "label": "Oui, toujours 50 %"
          },
          {
            "id": "d",
            "label": "Non, car les probabilités sont interdites"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t0-03",
        "type": "single",
        "prompt": "Si A implique B et B est faux, que peut-on conclure ?",
        "competencies": [
          "contraposition"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "A est vrai"
          },
          {
            "id": "b",
            "label": "A est faux"
          },
          {
            "id": "c",
            "label": "B implique A"
          },
          {
            "id": "d",
            "label": "Rien sur A"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t0-04",
        "type": "single",
        "prompt": "Une quantité augmente de 10 %, puis baisse de 10 %. Le résultat final est…",
        "competencies": [
          "evolutions_successives"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "identique"
          },
          {
            "id": "b",
            "label": "1 % plus faible"
          },
          {
            "id": "c",
            "label": "1 % plus élevé"
          },
          {
            "id": "d",
            "label": "20 % plus faible"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t0-05",
        "type": "single",
        "prompt": "Dans un groupe, 60 % parlent anglais, 35 % parlent espagnol et 20 % parlent les deux. Quelle proportion parle au moins une des deux langues ?",
        "competencies": [
          "union"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "75 %"
          },
          {
            "id": "b",
            "label": "95 %"
          },
          {
            "id": "c",
            "label": "115 %"
          },
          {
            "id": "d",
            "label": "20 %"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t0-06",
        "type": "single",
        "prompt": "Une moyenne passe de 8 à 10. L’augmentation relative est…",
        "competencies": [
          "taux_evolution"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "2 %"
          },
          {
            "id": "b",
            "label": "20 %"
          },
          {
            "id": "c",
            "label": "25 %"
          },
          {
            "id": "d",
            "label": "80 %"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t0-07",
        "type": "single",
        "prompt": "La phrase « Tous les élèves qui révisent réussissent » est contredite par…",
        "competencies": [
          "contre_exemple"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "un élève qui ne révise pas et échoue"
          },
          {
            "id": "b",
            "label": "un élève qui révise et échoue"
          },
          {
            "id": "c",
            "label": "un élève qui révise et réussit"
          },
          {
            "id": "d",
            "label": "un élève qui ne révise pas et réussit"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t0-08",
        "type": "single",
        "prompt": "Un tableau montre une hausse simultanée de l’usage d’une application et des résultats. Quelle conclusion est la plus rigoureuse ?",
        "competencies": [
          "correlation_causalite"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "L’application cause nécessairement la hausse"
          },
          {
            "id": "b",
            "label": "Il existe une association, mais des facteurs confondants sont possibles"
          },
          {
            "id": "c",
            "label": "La hausse est fausse"
          },
          {
            "id": "d",
            "label": "Aucune analyse n’est possible"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t0-09",
        "type": "single",
        "prompt": "Si 3 objets coûtent 18 DT au même prix unitaire, 7 objets coûtent…",
        "competencies": [
          "proportionnalite"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "24 DT"
          },
          {
            "id": "b",
            "label": "36 DT"
          },
          {
            "id": "c",
            "label": "42 DT"
          },
          {
            "id": "d",
            "label": "54 DT"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t0-10",
        "type": "single",
        "prompt": "Une règle fonctionne pour 5 exemples testés. Cela prouve-t-il qu’elle fonctionne toujours ?",
        "competencies": [
          "preuve"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "Oui"
          },
          {
            "id": "b",
            "label": "Non, il faut une preuve ou un test exhaustif adapté"
          },
          {
            "id": "c",
            "label": "Oui si les exemples sont simples"
          },
          {
            "id": "d",
            "label": "Non seulement en mathématiques"
          }
        ],
        "required": true,
        "allowNotStudied": true
      }
    ],
    "scoreDomains": [
      "potentiel_apprentissage"
    ],
    "requiredForSubmission": true
  },
  {
    "key": "micro-remediation",
    "title": "Micro-remédiation explicite",
    "shortTitle": "Micro-leçon",
    "description": "Enseignement court, ciblé et contrôlé avant un post-test parallèle.",
    "audience": "ELEVE",
    "kind": "learning-potential",
    "estimatedMinutes": 20,
    "timed": false,
    "prerequisites": [
      "potentiel-t0"
    ],
    "instructions": [
      "Prenez des notes.",
      "Vous pourrez consulter cette leçon pendant 20 minutes, puis elle sera masquée au début de T1."
    ],
    "questions": [
      {
        "id": "rem-info",
        "type": "information",
        "prompt": "Micro-leçon guidée",
        "competencies": [
          "apprentissage_explicite"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 0,
        "description": "Micro-leçon — Quatre idées à maîtriser :\n1. Une proportion conditionnelle P(B|A) décrit B parmi les cas où A est réalisé. Pour remonter de P(B|A) à P(A|B), il faut aussi connaître la fréquence de A.\n2. Deux évolutions successives se composent par multiplication des coefficients : +10 % puis −10 % donne 1,10 × 0,90 = 0,99.\n3. Pour réfuter « pour tout x, P(x) », un seul contre-exemple suffit.\n4. Une corrélation ne prouve pas une causalité : il faut examiner la temporalité, un mécanisme et les facteurs confondants.",
        "required": true
      },
      {
        "id": "rem-01",
        "type": "acknowledgement",
        "prompt": "J’ai lu la micro-leçon et refait les quatre exemples sur papier.",
        "competencies": [
          "engagement"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 0,
        "required": true
      },
      {
        "id": "rem-02",
        "type": "short",
        "prompt": "Formulez avec vos mots une différence entre P(B|A) et P(A|B).",
        "competencies": [
          "explication"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 4,
        "required": true,
        "manualReview": true,
        "wordLimit": 100
      }
    ],
    "scoreDomains": [
      "potentiel_apprentissage"
    ],
    "requiredForSubmission": true
  },
  {
    "key": "potentiel-t1",
    "title": "Post-test T1 : apprentissage immédiat",
    "shortTitle": "Post-test T1",
    "description": "Test parallèle pour mesurer le gain après une micro-remédiation explicite.",
    "audience": "ELEVE",
    "kind": "learning-potential",
    "estimatedMinutes": 25,
    "timed": true,
    "prerequisites": [
      "micro-remediation"
    ],
    "instructions": [
      "La micro-leçon n’est plus consultable pendant ce test.",
      "Répondez sans aide."
    ],
    "questions": [
      {
        "id": "t1-01",
        "type": "single",
        "prompt": "Dans un établissement, 50 % des élèves sont demi-pensionnaires. Parmi eux, 24 % prennent le bus. Quelle proportion de tous les élèves est demi-pensionnaire et prend le bus ?",
        "competencies": [
          "proportion_composee"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "12 %"
          },
          {
            "id": "b",
            "label": "24 %"
          },
          {
            "id": "c",
            "label": "50 %"
          },
          {
            "id": "d",
            "label": "74 %"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t1-02",
        "type": "single",
        "prompt": "Un contrôle signale une fraude chez 80 % des fraudeurs et chez 5 % des non-fraudeurs. Pour calculer la probabilité qu’un élève signalé soit réellement fraudeur, il faut aussi connaître…",
        "competencies": [
          "probabilite_inverse"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "le nombre de questions"
          },
          {
            "id": "b",
            "label": "la fréquence initiale de la fraude"
          },
          {
            "id": "c",
            "label": "la durée du contrôle seulement"
          },
          {
            "id": "d",
            "label": "le nom du surveillant"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t1-03",
        "type": "single",
        "prompt": "Si P implique Q et Q est faux, alors…",
        "competencies": [
          "contraposition"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "P est faux"
          },
          {
            "id": "b",
            "label": "P est vrai"
          },
          {
            "id": "c",
            "label": "Q implique P"
          },
          {
            "id": "d",
            "label": "aucune conclusion logique"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t1-04",
        "type": "single",
        "prompt": "Une quantité baisse de 20 %, puis augmente de 20 %. Elle devient…",
        "competencies": [
          "evolutions_successives"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "identique"
          },
          {
            "id": "b",
            "label": "4 % plus faible"
          },
          {
            "id": "c",
            "label": "4 % plus élevée"
          },
          {
            "id": "d",
            "label": "40 % plus faible"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t1-05",
        "type": "single",
        "prompt": "70 % utilisent A, 40 % utilisent B et 25 % utilisent les deux. Quelle proportion utilise A ou B ?",
        "competencies": [
          "union"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "85 %"
          },
          {
            "id": "b",
            "label": "110 %"
          },
          {
            "id": "c",
            "label": "45 %"
          },
          {
            "id": "d",
            "label": "25 %"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t1-06",
        "type": "single",
        "prompt": "Un score passe de 12 à 15. Le taux d’augmentation est…",
        "competencies": [
          "taux_evolution"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "3 %"
          },
          {
            "id": "b",
            "label": "20 %"
          },
          {
            "id": "c",
            "label": "25 %"
          },
          {
            "id": "d",
            "label": "30 %"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t1-07",
        "type": "single",
        "prompt": "La phrase « Tout nombre pair est divisible par 4 » est réfutée par…",
        "competencies": [
          "contre_exemple"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "2"
          },
          {
            "id": "b",
            "label": "4"
          },
          {
            "id": "c",
            "label": "8"
          },
          {
            "id": "d",
            "label": "12"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t1-08",
        "type": "single",
        "prompt": "Après l’installation d’un tutorat, les notes augmentent. Quelle vérification renforce le plus l’hypothèse causale ?",
        "competencies": [
          "correlation_causalite"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "les élèves aiment le logo"
          },
          {
            "id": "b",
            "label": "comparer à un groupe similaire sans tutorat et contrôler les différences initiales"
          },
          {
            "id": "c",
            "label": "mesurer une seule note"
          },
          {
            "id": "d",
            "label": "demander à un élève"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t1-09",
        "type": "single",
        "prompt": "5 cahiers coûtent 35 DT au même prix. 8 cahiers coûtent…",
        "competencies": [
          "proportionnalite"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "40 DT"
          },
          {
            "id": "b",
            "label": "48 DT"
          },
          {
            "id": "c",
            "label": "56 DT"
          },
          {
            "id": "d",
            "label": "64 DT"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "t1-10",
        "type": "single",
        "prompt": "Pourquoi plusieurs exemples favorables ne suffisent-ils pas toujours à prouver une règle générale ?",
        "competencies": [
          "preuve"
        ],
        "domains": [
          "potentiel_apprentissage"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "Un cas non testé peut la contredire"
          },
          {
            "id": "b",
            "label": "Les exemples sont interdits"
          },
          {
            "id": "c",
            "label": "Une règle générale est toujours fausse"
          },
          {
            "id": "d",
            "label": "Les calculs ne servent à rien"
          }
        ],
        "required": true,
        "allowNotStudied": true
      }
    ],
    "scoreDomains": [
      "potentiel_apprentissage"
    ],
    "requiredForSubmission": true
  },
  {
    "key": "retention-transfert",
    "title": "Rétention et transfert différé",
    "shortTitle": "Rétention 72 h",
    "description": "Mesure la stabilité après plusieurs jours et la capacité à transférer les principes dans une situation nouvelle.",
    "audience": "ELEVE",
    "kind": "learning-potential",
    "estimatedMinutes": 30,
    "timed": true,
    "prerequisites": [
      "potentiel-t1"
    ],
    "instructions": [
      "Ce module s’ouvre normalement 72 heures après T1.",
      "Ne relisez pas la micro-leçon avant de répondre."
    ],
    "questions": [
      {
        "id": "ret-01",
        "type": "single",
        "prompt": "Une population baisse de 15 %, puis augmente de 15 %. Le coefficient global vaut…",
        "competencies": [
          "evolutions_successives"
        ],
        "domains": [
          "retention"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "1"
          },
          {
            "id": "b",
            "label": "0,9775"
          },
          {
            "id": "c",
            "label": "1,0225"
          },
          {
            "id": "d",
            "label": "0,70"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ret-02",
        "type": "single",
        "prompt": "Pour calculer une probabilité inverse après un test, quelle donnée est indispensable en plus des sensibilités ?",
        "competencies": [
          "probabilite_inverse"
        ],
        "domains": [
          "retention"
        ],
        "maxPoints": 2,
        "options": [
          {
            "id": "a",
            "label": "la prévalence du phénomène"
          },
          {
            "id": "b",
            "label": "la couleur du test"
          },
          {
            "id": "c",
            "label": "le nombre de pages"
          },
          {
            "id": "d",
            "label": "le nom du candidat"
          }
        ],
        "required": true,
        "allowNotStudied": true
      },
      {
        "id": "ret-03",
        "type": "short",
        "prompt": "Donnez un contre-exemple à : « si n² est multiple de 4, alors n est multiple de 4 ».",
        "competencies": [
          "contre_exemple"
        ],
        "domains": [
          "retention"
        ],
        "maxPoints": 4,
        "required": true,
        "manualReview": true,
        "wordLimit": 80
      },
      {
        "id": "ret-04",
        "type": "short",
        "prompt": "Expliquez en deux phrases pourquoi une corrélation temporelle ne suffit pas à établir une causalité.",
        "competencies": [
          "correlation_causalite"
        ],
        "domains": [
          "retention"
        ],
        "maxPoints": 4,
        "required": true,
        "manualReview": true,
        "wordLimit": 100
      },
      {
        "id": "ret-05",
        "type": "short",
        "prompt": "Une enquête observe que les élèves qui lisent davantage ont de meilleures notes. Citez un facteur confondant plausible.",
        "competencies": [
          "facteur_confondu"
        ],
        "domains": [
          "transfert"
        ],
        "maxPoints": 4,
        "required": true,
        "manualReview": true,
        "wordLimit": 80
      },
      {
        "id": "ret-06",
        "type": "numeric",
        "prompt": "Parmi 1 000 personnes, 10 sont malades. Un test détecte 9 malades et signale à tort 99 personnes saines. Parmi les tests positifs, quelle proportion environ est réellement malade ?",
        "competencies": [
          "probabilite_inverse"
        ],
        "domains": [
          "transfert"
        ],
        "maxPoints": 6,
        "min": 0,
        "max": 100,
        "step": 0.1,
        "required": true
      },
      {
        "id": "ret-07",
        "type": "long",
        "prompt": "Dans votre propre travail scolaire, donnez un exemple où mesurer un indicateur sans examiner sa qualité pourrait conduire à une mauvaise décision.",
        "competencies": [
          "transfert",
          "esprit_critique"
        ],
        "domains": [
          "transfert"
        ],
        "maxPoints": 8,
        "required": true,
        "manualReview": true,
        "wordLimit": 180
      },
      {
        "id": "ret-08",
        "type": "long",
        "prompt": "Sans relire la leçon, indiquez l’idée que vous avez le mieux retenue et celle qui reste fragile.",
        "competencies": [
          "metacognition",
          "retention"
        ],
        "domains": [
          "retention"
        ],
        "maxPoints": 4,
        "required": true,
        "manualReview": true,
        "wordLimit": 150
      }
    ],
    "scoreDomains": [
      "retention",
      "transfert"
    ],
    "requiredForSubmission": true,
    "unlockDelayHours": 72
  },
  {
    "key": "documents",
    "title": "Dossier documentaire et pièces officielles",
    "shortTitle": "Documents",
    "description": "Réunir les pièces nécessaires pour vérifier la situation scolaire, les notes et l’inscription.",
    "audience": "ELEVE",
    "kind": "documents",
    "estimatedMinutes": 30,
    "timed": false,
    "prerequisites": [
      "accueil-integrite"
    ],
    "instructions": [
      "Les documents sont stockés hors du dossier public.",
      "Masquez les informations sans rapport avec le diagnostic si nécessaire.",
      "Un document reçu n’est considéré authentifié qu’après contrôle Nexus."
    ],
    "questions": [
      {
        "id": "doc-01",
        "type": "upload",
        "prompt": "Pièce d’identité du candidat",
        "competencies": [
          "integrite_documentaire"
        ],
        "domains": [
          "documents"
        ],
        "maxPoints": 0,
        "required": true,
        "manualReview": true,
        "uploadRule": {
          "category": "IDENTITY",
          "accept": [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp"
          ],
          "maxFiles": 1,
          "maxBytesPerFile": 12582912,
          "required": true,
          "help": "Carte d’identité ou passeport lisible."
        }
      },
      {
        "id": "doc-02",
        "type": "upload",
        "prompt": "Récapitulatif d’inscription Cyclades",
        "competencies": [
          "integrite_documentaire"
        ],
        "domains": [
          "documents"
        ],
        "maxPoints": 0,
        "required": true,
        "manualReview": true,
        "uploadRule": {
          "category": "CYCLADES",
          "accept": [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp"
          ],
          "maxFiles": 1,
          "maxBytesPerFile": 12582912,
          "required": true,
          "help": "Toutes les pages, avec session et options."
        }
      },
      {
        "id": "doc-03",
        "type": "upload",
        "prompt": "Relevé officiel des notes du baccalauréat français 2026",
        "competencies": [
          "integrite_documentaire"
        ],
        "domains": [
          "documents"
        ],
        "maxPoints": 0,
        "required": true,
        "manualReview": true,
        "uploadRule": {
          "category": "FRENCH_BAC_TRANSCRIPT",
          "accept": [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp"
          ],
          "maxFiles": 1,
          "maxBytesPerFile": 12582912,
          "required": true,
          "help": "Document officiel complet."
        }
      },
      {
        "id": "doc-04",
        "type": "upload",
        "prompt": "Relevé officiel du baccalauréat tunisien 2026",
        "competencies": [
          "integrite_documentaire"
        ],
        "domains": [
          "documents"
        ],
        "maxPoints": 0,
        "required": true,
        "manualReview": true,
        "uploadRule": {
          "category": "TUNISIAN_BAC_TRANSCRIPT",
          "accept": [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp"
          ],
          "maxFiles": 1,
          "maxBytesPerFile": 12582912,
          "required": true,
          "help": "Relevé ou attestation officielle."
        }
      },
      {
        "id": "doc-05",
        "type": "upload",
        "prompt": "Bulletins de l’année 2025/2026",
        "competencies": [
          "integrite_documentaire"
        ],
        "domains": [
          "documents"
        ],
        "maxPoints": 0,
        "required": true,
        "manualReview": true,
        "uploadRule": {
          "category": "SCHOOL_REPORT",
          "accept": [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp"
          ],
          "maxFiles": 5,
          "maxBytesPerFile": 12582912,
          "required": true,
          "help": "Un PDF par trimestre ou un fichier fusionné."
        }
      },
      {
        "id": "doc-06",
        "type": "upload",
        "prompt": "Copies d’épreuves françaises disponibles",
        "competencies": [
          "integrite_documentaire"
        ],
        "domains": [
          "documents"
        ],
        "maxPoints": 0,
        "required": false,
        "manualReview": true,
        "uploadRule": {
          "category": "WRITTEN_COPY",
          "accept": [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp"
          ],
          "maxFiles": 5,
          "maxBytesPerFile": 12582912,
          "required": false,
          "help": "Français, mathématiques, spécialités ou autres."
        }
      },
      {
        "id": "doc-07",
        "type": "upload",
        "prompt": "Décision d’aménagement d’examen",
        "competencies": [
          "integrite_documentaire"
        ],
        "domains": [
          "documents"
        ],
        "maxPoints": 0,
        "required": false,
        "manualReview": true,
        "uploadRule": {
          "category": "EXAM_ACCOMMODATION",
          "accept": [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp"
          ],
          "maxFiles": 1,
          "maxBytesPerFile": 12582912,
          "required": false,
          "help": "Uniquement si applicable."
        }
      },
      {
        "id": "doc-08",
        "type": "upload",
        "prompt": "Anciennes évaluations significatives",
        "competencies": [
          "integrite_documentaire"
        ],
        "domains": [
          "documents"
        ],
        "maxPoints": 0,
        "required": false,
        "manualReview": true,
        "uploadRule": {
          "category": "WRITTEN_COPY",
          "accept": [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp"
          ],
          "maxFiles": 5,
          "maxBytesPerFile": 12582912,
          "required": false,
          "help": "Copies représentatives, bonnes ou faibles."
        }
      },
      {
        "id": "doc-09",
        "type": "upload",
        "prompt": "Autre document utile",
        "competencies": [
          "integrite_documentaire"
        ],
        "domains": [
          "documents"
        ],
        "maxPoints": 0,
        "required": false,
        "manualReview": true,
        "uploadRule": {
          "category": "OTHER",
          "accept": [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp"
          ],
          "maxFiles": 1,
          "maxBytesPerFile": 12582912,
          "required": false,
          "help": "Attestation, emploi du temps, justificatif pertinent."
        }
      }
    ],
    "scoreDomains": [
      "documents"
    ],
    "requiredForSubmission": true
  },
  {
    "key": "validation-finale",
    "title": "Vérification et soumission finale",
    "shortTitle": "Finalisation",
    "description": "Contrôler l’intégrité du dossier et transmettre le diagnostic à l’équipe pédagogique.",
    "audience": "ELEVE",
    "kind": "review",
    "estimatedMinutes": 15,
    "timed": false,
    "prerequisites": [
      "francais-academique",
      "mathematiques",
      "nsi",
      "ses",
      "tronc-commun",
      "grand-oral",
      "autonomie-methodes",
      "potentiel-t1",
      "documents"
    ],
    "instructions": [
      "Vérifiez les modules incomplets avant de soumettre.",
      "Le module de rétention peut rester programmé si le responsable autorise une pré-soumission."
    ],
    "questions": [
      {
        "id": "final-01",
        "type": "acknowledgement",
        "prompt": "J’ai vérifié que mes réponses sont complètes et sincères.",
        "competencies": [
          "integrite"
        ],
        "domains": [
          "validation"
        ],
        "maxPoints": 0,
        "required": true
      },
      {
        "id": "final-02",
        "type": "acknowledgement",
        "prompt": "Je comprends qu’une soumission finale verrouille les modules académiques.",
        "competencies": [
          "consentement"
        ],
        "domains": [
          "validation"
        ],
        "maxPoints": 0,
        "required": true
      },
      {
        "id": "final-03",
        "type": "acknowledgement",
        "prompt": "J’accepte qu’un enseignant corrige mes productions écrites et orales.",
        "competencies": [
          "consentement"
        ],
        "domains": [
          "validation"
        ],
        "maxPoints": 0,
        "required": true
      },
      {
        "id": "final-04",
        "type": "single",
        "prompt": "Quelle épreuve vous paraît avoir le mieux reflété votre niveau réel ?",
        "competencies": [
          "metacognition"
        ],
        "domains": [
          "validation"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Français"
          },
          {
            "id": "b",
            "label": "Mathématiques"
          },
          {
            "id": "c",
            "label": "NSI"
          },
          {
            "id": "d",
            "label": "SES"
          },
          {
            "id": "e",
            "label": "Tronc commun"
          },
          {
            "id": "f",
            "label": "Grand oral"
          },
          {
            "id": "g",
            "label": "Aucune"
          }
        ],
        "required": true
      },
      {
        "id": "final-05",
        "type": "long",
        "prompt": "Quelle épreuve vous paraît avoir sous-estimé votre niveau réel, et pourquoi ?",
        "competencies": [
          "metacognition"
        ],
        "domains": [
          "validation"
        ],
        "maxPoints": 2,
        "required": false,
        "manualReview": true,
        "wordLimit": 180
      },
      {
        "id": "final-06",
        "type": "long",
        "prompt": "Décrivez une difficulté technique ou un incident de passation.",
        "competencies": [
          "integrite"
        ],
        "domains": [
          "validation"
        ],
        "maxPoints": 0,
        "required": false,
        "manualReview": true,
        "wordLimit": 180
      },
      {
        "id": "final-07",
        "type": "scale",
        "prompt": "Sur une échelle de 1 à 5, êtes-vous toujours prêt à suivre une préparation intensive en un an ?",
        "competencies": [
          "engagement"
        ],
        "domains": [
          "validation"
        ],
        "maxPoints": 0,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Pas du tout",
        "rightLabel": "Tout à fait",
        "required": true
      },
      {
        "id": "final-08",
        "type": "long",
        "prompt": "Quel engagement concret prenez-vous pour les 30 prochains jours ?",
        "competencies": [
          "engagement",
          "plan_action"
        ],
        "domains": [
          "validation"
        ],
        "maxPoints": 4,
        "required": true,
        "manualReview": true,
        "wordLimit": 200
      }
    ],
    "scoreDomains": [
      "validation"
    ],
    "requiredForSubmission": true
  },
  {
    "key": "questionnaire-parent",
    "title": "Questionnaire confidentiel du parent",
    "shortTitle": "Parent",
    "description": "Recueillir une observation indépendante sur l’autonomie, les causes d’échec, les contraintes et le niveau de risque acceptable.",
    "audience": "PARENT",
    "kind": "questionnaire",
    "estimatedMinutes": 30,
    "timed": false,
    "prerequisites": [],
    "instructions": [
      "À remplir sans consulter les réponses de l’élève.",
      "Les réponses brutes du parent ne sont pas affichées à l’élève."
    ],
    "questions": [
      {
        "id": "parent-01",
        "type": "scale",
        "prompt": "Mon enfant commence son travail sans relance répétée.",
        "competencies": [
          "autonomie"
        ],
        "domains": [
          "observation_parent"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "parent-02",
        "type": "scale",
        "prompt": "Il respecte un emploi du temps convenu.",
        "competencies": [
          "regularite"
        ],
        "domains": [
          "observation_parent"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "parent-03",
        "type": "scale",
        "prompt": "Il remet les travaux demandés dans les délais.",
        "competencies": [
          "fiabilite"
        ],
        "domains": [
          "observation_parent"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "parent-04",
        "type": "scale",
        "prompt": "Il accepte de montrer ses résultats réels, même faibles.",
        "competencies": [
          "transparence"
        ],
        "domains": [
          "observation_parent"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "parent-05",
        "type": "scale",
        "prompt": "Il peut travailler sans téléphone pendant une période définie.",
        "competencies": [
          "attention"
        ],
        "domains": [
          "observation_parent"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "parent-06",
        "type": "scale",
        "prompt": "Il demande de l’aide avant que le retard devienne important.",
        "competencies": [
          "alerte"
        ],
        "domains": [
          "observation_parent"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "parent-07",
        "type": "scale",
        "prompt": "Il supporte la frustration d’un exercice difficile.",
        "competencies": [
          "perseverance"
        ],
        "domains": [
          "observation_parent"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "parent-08",
        "type": "scale",
        "prompt": "Il applique les corrections données.",
        "competencies": [
          "remediation"
        ],
        "domains": [
          "observation_parent"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "parent-09",
        "type": "scale",
        "prompt": "Son rythme de sommeil est compatible avec une préparation intensive.",
        "competencies": [
          "hygiene"
        ],
        "domains": [
          "observation_parent"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "parent-10",
        "type": "scale",
        "prompt": "La famille peut garantir un environnement de travail stable.",
        "competencies": [
          "logistique"
        ],
        "domains": [
          "observation_parent"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "parent-11",
        "type": "scale",
        "prompt": "La famille accepte un suivi d’assiduité et des alertes.",
        "competencies": [
          "contractualisation"
        ],
        "domains": [
          "observation_parent"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "parent-12",
        "type": "scale",
        "prompt": "La famille peut éviter de faire le travail à la place de l’élève.",
        "competencies": [
          "autonomie_familiale"
        ],
        "domains": [
          "observation_parent"
        ],
        "maxPoints": 1,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Jamais / faux",
        "rightLabel": "Toujours / vrai",
        "required": true
      },
      {
        "id": "parent-13",
        "type": "multiple",
        "prompt": "Quelle est, selon vous, la cause principale des échecs de 2026 ?",
        "competencies": [
          "analyse_parcours"
        ],
        "domains": [
          "observation_parent"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Lacunes anciennes"
          },
          {
            "id": "b",
            "label": "Méthode française mal comprise"
          },
          {
            "id": "c",
            "label": "Manque de travail"
          },
          {
            "id": "d",
            "label": "Manque d’encadrement"
          },
          {
            "id": "e",
            "label": "Double préparation tunisienne/française"
          },
          {
            "id": "f",
            "label": "Stress ou santé"
          },
          {
            "id": "g",
            "label": "Absences"
          },
          {
            "id": "h",
            "label": "Orientation peu claire"
          },
          {
            "id": "i",
            "label": "Autre"
          }
        ],
        "required": true
      },
      {
        "id": "parent-14",
        "type": "long",
        "prompt": "Décrivez les cours particuliers, stages ou accompagnements déjà suivis et leurs effets.",
        "competencies": [
          "historique_accompagnement"
        ],
        "domains": [
          "observation_parent"
        ],
        "maxPoints": 0,
        "required": true,
        "manualReview": true,
        "wordLimit": 350
      },
      {
        "id": "parent-15",
        "type": "single",
        "prompt": "Combien d’heures de travail effectif observez-vous actuellement par semaine ?",
        "competencies": [
          "charge_travail"
        ],
        "domains": [
          "observation_parent"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Moins de 3 h"
          },
          {
            "id": "b",
            "label": "3 à 6 h"
          },
          {
            "id": "c",
            "label": "7 à 10 h"
          },
          {
            "id": "d",
            "label": "11 à 15 h"
          },
          {
            "id": "e",
            "label": "Plus de 15 h"
          },
          {
            "id": "f",
            "label": "Impossible à estimer"
          }
        ],
        "required": true
      },
      {
        "id": "parent-16",
        "type": "single",
        "prompt": "La famille peut-elle garantir une disponibilité totale de 25 à 30 h par semaine pour cours et travail personnel ?",
        "competencies": [
          "faisabilite"
        ],
        "domains": [
          "logistique_familiale"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Oui"
          },
          {
            "id": "b",
            "label": "Oui sous conditions"
          },
          {
            "id": "c",
            "label": "Non"
          },
          {
            "id": "d",
            "label": "À déterminer"
          }
        ],
        "required": true
      },
      {
        "id": "parent-17",
        "type": "long",
        "prompt": "Quelles contraintes familiales, financières, géographiques ou de santé doivent être prises en compte ?",
        "competencies": [
          "analyse_risque"
        ],
        "domains": [
          "logistique_familiale"
        ],
        "maxPoints": 0,
        "required": false,
        "manualReview": true,
        "wordLimit": 300
      },
      {
        "id": "parent-18",
        "type": "single",
        "prompt": "Quelle priorité guide votre décision ?",
        "competencies": [
          "priorite_familiale"
        ],
        "domains": [
          "arbitrage"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Sécuriser le diplôme"
          },
          {
            "id": "b",
            "label": "Éviter de perdre une année"
          },
          {
            "id": "c",
            "label": "Réduire le coût"
          },
          {
            "id": "d",
            "label": "Préserver l’orientation post-bac"
          },
          {
            "id": "e",
            "label": "Restaurer la confiance"
          },
          {
            "id": "f",
            "label": "Combinaison de plusieurs priorités"
          }
        ],
        "required": true
      },
      {
        "id": "parent-19",
        "type": "scale",
        "prompt": "Quel niveau de risque scolaire êtes-vous prêt à accepter pour tenter le parcours en un an ?",
        "competencies": [
          "tolerance_risque"
        ],
        "domains": [
          "arbitrage"
        ],
        "maxPoints": 0,
        "min": 1,
        "max": 5,
        "step": 1,
        "leftLabel": "Très faible",
        "rightLabel": "Élevé",
        "required": true
      },
      {
        "id": "parent-20",
        "type": "long",
        "prompt": "Quelles preuves attendez-vous de Nexus avant de décider ?",
        "competencies": [
          "attentes"
        ],
        "domains": [
          "arbitrage"
        ],
        "maxPoints": 0,
        "required": true,
        "manualReview": true,
        "wordLimit": 300
      },
      {
        "id": "parent-21",
        "type": "single",
        "prompt": "Acceptez-vous qu’un avis défavorable puisse recommander une scolarité sur deux ans ?",
        "competencies": [
          "acceptation_decision"
        ],
        "domains": [
          "arbitrage"
        ],
        "maxPoints": 0,
        "options": [
          {
            "id": "a",
            "label": "Oui"
          },
          {
            "id": "b",
            "label": "Oui, après échange contradictoire"
          },
          {
            "id": "c",
            "label": "Non"
          }
        ],
        "required": true
      },
      {
        "id": "parent-22",
        "type": "acknowledgement",
        "prompt": "Je certifie avoir répondu séparément de l’élève et autorise Nexus à utiliser ces informations pour le diagnostic.",
        "competencies": [
          "consentement_parent"
        ],
        "domains": [
          "consentement"
        ],
        "maxPoints": 0,
        "required": true
      }
    ],
    "scoreDomains": [
      "observation_parent",
      "logistique_familiale",
      "arbitrage",
      "consentement"
    ],
    "requiredForSubmission": true
  }
];

export const CANDIDATE_DIAGNOSTIC_MODULE_MAP = Object.fromEntries(
  CANDIDATE_DIAGNOSTIC_MODULES.map((module) => [module.key, module]),
) as Record<string, DiagnosticModuleDefinition>;

export function getPublicModuleDefinition(moduleKey: string): DiagnosticModuleDefinition | null {
  return CANDIDATE_DIAGNOSTIC_MODULE_MAP[moduleKey] ?? null;
}
