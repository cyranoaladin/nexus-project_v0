/* Données initiales Nexus Réussite 2026-2027 (schéma v2).
   Fichier généré depuis data/planning.default.json — chargé en fallback local (file://).
   Pour modifier le planning initial : éditer le JSON puis relancer `node tests/build-default-data.mjs`. */
window.NEXUS_DEFAULT_PLANNING = {
  "schemaVersion": 2,
  "meta": {
    "title": "Planning Nexus Réussite 2026-2027",
    "updatedAt": "2026-09-03",
    "source": "planning initial 2026-2027 (v1 migré)"
  },
  "settings": {
    "academicYear": "2026-2027",
    "title": "Planning Nexus Réussite 2026-2027",
    "dayStart": "08:00",
    "dayEnd": "22:00",
    "slotMinutes": 15,
    "normalSimultaneous": 2,
    "maxSimultaneous": 3,
    "lateThreshold": "21:30",
    "lunchBreak": {
      "start": "13:15",
      "end": "14:45"
    },
    "waitLightMinutes": 45,
    "waitStrongMinutes": 90,
    "amplitudeWarnMinutes": 600,
    "suggestedSlots": [
      {
        "start": "09:00",
        "end": "11:00"
      },
      {
        "start": "11:15",
        "end": "13:15"
      },
      {
        "start": "14:45",
        "end": "16:45"
      },
      {
        "start": "17:00",
        "end": "19:00"
      },
      {
        "start": "19:15",
        "end": "21:15"
      }
    ]
  },
  "teachers": [
    {
      "id": "teacher-m1",
      "code": "M1",
      "name": "Enseignant Maths / NSI — Scolarisés",
      "subjects": [
        "MATHS",
        "NSI",
        "EAM"
      ],
      "color": "#0B1F3A",
      "active": true,
      "unavailability": [],
      "notes": ""
    },
    {
      "id": "teacher-m2",
      "code": "M2",
      "name": "Enseignant Maths / NSI — Candidats individuels",
      "subjects": [
        "MATHS",
        "NSI",
        "EAM"
      ],
      "color": "#2457C5",
      "active": true,
      "unavailability": [],
      "notes": ""
    },
    {
      "id": "teacher-f1",
      "code": "F1",
      "name": "Enseignante Français / Philosophie",
      "subjects": [
        "FRANCAIS",
        "PHILO",
        "GRAND_ORAL"
      ],
      "color": "#B3261E",
      "active": true,
      "unavailability": [],
      "notes": ""
    },
    {
      "id": "teacher-pc",
      "code": "PC",
      "name": "Enseignant Physique-Chimie",
      "subjects": [
        "PC"
      ],
      "color": "#0E7C9B",
      "active": true,
      "unavailability": [],
      "notes": ""
    },
    {
      "id": "teacher-svt",
      "code": "SVT",
      "name": "Enseignant SVT",
      "subjects": [
        "SVT"
      ],
      "color": "#2E7D32",
      "active": true,
      "unavailability": [],
      "notes": ""
    },
    {
      "id": "teacher-ses",
      "code": "SES",
      "name": "Enseignant SES",
      "subjects": [
        "SES"
      ],
      "color": "#B7791F",
      "active": true,
      "unavailability": [],
      "notes": ""
    },
    {
      "id": "teacher-hg",
      "code": "HG",
      "name": "Enseignant HGGSP / Histoire-Géo / EMC",
      "subjects": [
        "HGGSP",
        "HG_EMC"
      ],
      "color": "#C2571B",
      "active": true,
      "unavailability": [],
      "notes": ""
    },
    {
      "id": "teacher-lv",
      "code": "LV",
      "name": "Enseignant Langues vivantes",
      "subjects": [
        "LANGUES"
      ],
      "color": "#0F766E",
      "active": true,
      "unavailability": [],
      "notes": ""
    },
    {
      "id": "teacher-es",
      "code": "ES",
      "name": "Enseignant Enseignement scientifique",
      "subjects": [
        "ENS_SCI"
      ],
      "color": "#4D7C0F",
      "active": true,
      "unavailability": [],
      "notes": ""
    },
    {
      "id": "teacher-etude",
      "code": "ETUDE",
      "name": "Encadrement étude",
      "subjects": [
        "ETUDE"
      ],
      "color": "#64748B",
      "active": true,
      "unavailability": [],
      "notes": ""
    }
  ],
  "rooms": [
    {
      "id": "room-1",
      "name": "Salle 1",
      "capacity": 6,
      "exceptional": false,
      "active": true,
      "notes": ""
    },
    {
      "id": "room-2",
      "name": "Salle 2",
      "capacity": 6,
      "exceptional": false,
      "active": true,
      "notes": ""
    },
    {
      "id": "room-3",
      "name": "Salle 3",
      "capacity": 6,
      "exceptional": true,
      "active": true,
      "notes": ""
    }
  ],
  "subjects": [
    {
      "id": "MATHS",
      "label": "Mathématiques",
      "short": "Maths",
      "color": "#2457C5",
      "levels": [
        "QUATRIEME",
        "TROISIEME",
        "SECONDE",
        "PREMIERE",
        "TERMINALE"
      ],
      "active": true
    },
    {
      "id": "NSI",
      "label": "Numérique et sciences informatiques",
      "short": "NSI",
      "color": "#5B3FB8",
      "levels": [
        "PREMIERE",
        "TERMINALE"
      ],
      "active": true
    },
    {
      "id": "FRANCAIS",
      "label": "Français / EAF",
      "short": "Français",
      "color": "#B3261E",
      "levels": [
        "QUATRIEME",
        "TROISIEME",
        "SECONDE",
        "PREMIERE"
      ],
      "active": true
    },
    {
      "id": "PHILO",
      "label": "Philosophie",
      "short": "Philo",
      "color": "#7A2E6B",
      "levels": [
        "TERMINALE"
      ],
      "active": true
    },
    {
      "id": "PC",
      "label": "Physique-Chimie",
      "short": "PC",
      "color": "#0E7C9B",
      "levels": [
        "PREMIERE",
        "TERMINALE"
      ],
      "active": true
    },
    {
      "id": "SVT",
      "label": "SVT",
      "short": "SVT",
      "color": "#2E7D32",
      "levels": [
        "PREMIERE",
        "TERMINALE"
      ],
      "active": true
    },
    {
      "id": "SES",
      "label": "SES",
      "short": "SES",
      "color": "#B7791F",
      "levels": [
        "PREMIERE",
        "TERMINALE"
      ],
      "active": true
    },
    {
      "id": "HGGSP",
      "label": "HGGSP",
      "short": "HGGSP",
      "color": "#C2571B",
      "levels": [
        "PREMIERE",
        "TERMINALE"
      ],
      "active": true
    },
    {
      "id": "HG_EMC",
      "label": "Histoire-Géographie / EMC",
      "short": "HG/EMC",
      "color": "#8A5A2B",
      "levels": [
        "PREMIERE",
        "TERMINALE"
      ],
      "active": true
    },
    {
      "id": "EAM",
      "label": "Mathématiques anticipées / EAM",
      "short": "EAM",
      "color": "#1F6FB2",
      "levels": [
        "PREMIERE"
      ],
      "active": true
    },
    {
      "id": "LANGUES",
      "label": "Langues vivantes A / B",
      "short": "LVA/LVB",
      "color": "#0F766E",
      "levels": [
        "PREMIERE",
        "TERMINALE"
      ],
      "active": true
    },
    {
      "id": "ENS_SCI",
      "label": "Enseignement scientifique",
      "short": "Ens. sci.",
      "color": "#4D7C0F",
      "levels": [
        "PREMIERE",
        "TERMINALE"
      ],
      "active": true
    },
    {
      "id": "GRAND_ORAL",
      "label": "Grand Oral / expression",
      "short": "Grand Oral",
      "color": "#9F1239",
      "levels": [
        "TERMINALE"
      ],
      "active": true
    },
    {
      "id": "ETUDE",
      "label": "Étude encadrée / devoirs",
      "short": "Étude",
      "color": "#64748B",
      "levels": [],
      "active": true
    }
  ],
  "groups": [
    {
      "id": "P1-CL",
      "label": "Candidats individuels",
      "level": "PREMIERE",
      "audience": "CL",
      "variant": null,
      "notes": ""
    },
    {
      "id": "T-CL",
      "label": "Candidats individuels",
      "level": "TERMINALE",
      "audience": "CL",
      "variant": null,
      "notes": ""
    },
    {
      "id": "4E-SCO",
      "label": "Scolarisés",
      "level": "QUATRIEME",
      "audience": "SCO",
      "variant": null,
      "notes": ""
    },
    {
      "id": "3E-SCO",
      "label": "Scolarisés",
      "level": "TROISIEME",
      "audience": "SCO",
      "variant": null,
      "notes": ""
    },
    {
      "id": "2DE-SCO",
      "label": "Scolarisés",
      "level": "SECONDE",
      "audience": "SCO",
      "variant": null,
      "notes": ""
    },
    {
      "id": "T-SCO-A",
      "label": "Maths A",
      "level": "TERMINALE",
      "audience": "SCO",
      "variant": "A",
      "notes": "Parcours Maths A : priorité au profil Maths + NSI (enchaînement Maths → NSI)."
    },
    {
      "id": "P1-SCO",
      "label": "Scolarisés",
      "level": "PREMIERE",
      "audience": "SCO",
      "variant": null,
      "notes": ""
    },
    {
      "id": "T-SCO-B",
      "label": "Maths B",
      "level": "TERMINALE",
      "audience": "SCO",
      "variant": "B",
      "notes": "Parcours Maths B : priorité au profil Maths + Physique-Chimie (enchaînement Maths → PC)."
    },
    {
      "id": "P1-SCO-A",
      "label": "Maths A",
      "level": "PREMIERE",
      "audience": "SCO",
      "variant": "A",
      "notes": "Parcours Maths A : priorité au profil Maths + NSI (enchaînement Maths → NSI)."
    },
    {
      "id": "T-SCO",
      "label": "Scolarisés",
      "level": "TERMINALE",
      "audience": "SCO",
      "variant": null,
      "notes": ""
    },
    {
      "id": "P1-SCO-B",
      "label": "Maths B",
      "level": "PREMIERE",
      "audience": "SCO",
      "variant": "B",
      "notes": "Parcours Maths B : priorité au profil Maths + Physique-Chimie (enchaînement Maths → PC)."
    }
  ],
  "sessions": [
    {
      "id": "MON-1730-P1-EAM",
      "day": "MON",
      "start": "17:30",
      "end": "19:30",
      "audience": "CL",
      "level": "PREMIERE",
      "subjectId": "EAM",
      "groupId": "P1-CL",
      "teacherId": "teacher-m2",
      "roomId": "room-1",
      "title": "Première CL — Maths anticipées / EAM",
      "active": true,
      "notes": ""
    },
    {
      "id": "MON-1730-T-HG",
      "day": "MON",
      "start": "17:30",
      "end": "19:30",
      "audience": "CL",
      "level": "TERMINALE",
      "subjectId": "HG_EMC",
      "groupId": "T-CL",
      "teacherId": "teacher-hg",
      "roomId": "room-2",
      "title": "Terminale CL — Histoire-Géo / EMC",
      "active": true,
      "notes": ""
    },
    {
      "id": "MON-1945-P1-HG",
      "day": "MON",
      "start": "19:45",
      "end": "21:45",
      "audience": "CL",
      "level": "PREMIERE",
      "subjectId": "HG_EMC",
      "groupId": "P1-CL",
      "teacherId": "teacher-hg",
      "roomId": "room-1",
      "title": "Première CL — Histoire-Géo / EMC",
      "active": true,
      "notes": ""
    },
    {
      "id": "MON-1945-T-GO",
      "day": "MON",
      "start": "19:45",
      "end": "21:45",
      "audience": "CL",
      "level": "TERMINALE",
      "subjectId": "GRAND_ORAL",
      "groupId": "T-CL",
      "teacherId": "teacher-f1",
      "roomId": "room-2",
      "title": "Terminale CL — Grand Oral / expression",
      "active": true,
      "notes": ""
    },
    {
      "id": "TUE-1730-P1-LV",
      "day": "TUE",
      "start": "17:30",
      "end": "19:30",
      "audience": "CL",
      "level": "PREMIERE",
      "subjectId": "LANGUES",
      "groupId": "P1-CL",
      "teacherId": "teacher-lv",
      "roomId": "room-1",
      "title": "Première CL — LVA / LVB",
      "active": true,
      "notes": ""
    },
    {
      "id": "TUE-1730-T-ES",
      "day": "TUE",
      "start": "17:30",
      "end": "19:30",
      "audience": "CL",
      "level": "TERMINALE",
      "subjectId": "ENS_SCI",
      "groupId": "T-CL",
      "teacherId": "teacher-es",
      "roomId": "room-2",
      "title": "Terminale CL — Enseignement scientifique",
      "active": true,
      "notes": ""
    },
    {
      "id": "TUE-1945-P1-ES",
      "day": "TUE",
      "start": "19:45",
      "end": "21:45",
      "audience": "CL",
      "level": "PREMIERE",
      "subjectId": "ENS_SCI",
      "groupId": "P1-CL",
      "teacherId": "teacher-es",
      "roomId": "room-1",
      "title": "Première CL — Enseignement scientifique",
      "active": true,
      "notes": ""
    },
    {
      "id": "TUE-1945-T-LV",
      "day": "TUE",
      "start": "19:45",
      "end": "21:45",
      "audience": "CL",
      "level": "TERMINALE",
      "subjectId": "LANGUES",
      "groupId": "T-CL",
      "teacherId": "teacher-lv",
      "roomId": "room-2",
      "title": "Terminale CL — LVA / LVB",
      "active": true,
      "notes": ""
    },
    {
      "id": "WED-1430-4-M",
      "day": "WED",
      "start": "14:30",
      "end": "16:30",
      "audience": "SCO",
      "level": "QUATRIEME",
      "subjectId": "MATHS",
      "groupId": "4E-SCO",
      "teacherId": "teacher-m1",
      "roomId": "room-1",
      "title": "4e — Mathématiques",
      "active": true,
      "notes": ""
    },
    {
      "id": "WED-1430-3-F",
      "day": "WED",
      "start": "14:30",
      "end": "16:30",
      "audience": "SCO",
      "level": "TROISIEME",
      "subjectId": "FRANCAIS",
      "groupId": "3E-SCO",
      "teacherId": "teacher-f1",
      "roomId": "room-2",
      "title": "3e — Français",
      "active": true,
      "notes": ""
    },
    {
      "id": "WED-1645-2-M",
      "day": "WED",
      "start": "16:45",
      "end": "18:45",
      "audience": "SCO",
      "level": "SECONDE",
      "subjectId": "MATHS",
      "groupId": "2DE-SCO",
      "teacherId": "teacher-m1",
      "roomId": "room-1",
      "title": "Seconde — Mathématiques",
      "active": true,
      "notes": ""
    },
    {
      "id": "WED-1645-4-F",
      "day": "WED",
      "start": "16:45",
      "end": "18:45",
      "audience": "SCO",
      "level": "QUATRIEME",
      "subjectId": "FRANCAIS",
      "groupId": "4E-SCO",
      "teacherId": "teacher-f1",
      "roomId": "room-2",
      "title": "4e — Français",
      "active": true,
      "notes": ""
    },
    {
      "id": "WED-1645-3-ET",
      "day": "WED",
      "start": "16:45",
      "end": "18:45",
      "audience": "SCO",
      "level": "TROISIEME",
      "subjectId": "ETUDE",
      "groupId": "3E-SCO",
      "teacherId": "teacher-etude",
      "roomId": "room-3",
      "title": "3e — Étude encadrée / devoirs",
      "active": false,
      "notes": "Salle 3 exceptionnelle ; activer uniquement si encadrement disponible."
    },
    {
      "id": "WED-1900-3-M",
      "day": "WED",
      "start": "19:00",
      "end": "21:00",
      "audience": "SCO",
      "level": "TROISIEME",
      "subjectId": "MATHS",
      "groupId": "3E-SCO",
      "teacherId": "teacher-m1",
      "roomId": "room-1",
      "title": "3e — Mathématiques",
      "active": true,
      "notes": ""
    },
    {
      "id": "WED-1900-2-F",
      "day": "WED",
      "start": "19:00",
      "end": "21:00",
      "audience": "SCO",
      "level": "SECONDE",
      "subjectId": "FRANCAIS",
      "groupId": "2DE-SCO",
      "teacherId": "teacher-f1",
      "roomId": "room-2",
      "title": "Seconde — Français",
      "active": true,
      "notes": ""
    },
    {
      "id": "THU-1700-P1-M",
      "day": "THU",
      "start": "17:00",
      "end": "19:00",
      "audience": "CL",
      "level": "PREMIERE",
      "subjectId": "MATHS",
      "groupId": "P1-CL",
      "teacherId": "teacher-m2",
      "roomId": "room-1",
      "title": "Première CL — Mathématiques EDS",
      "active": true,
      "notes": ""
    },
    {
      "id": "THU-1700-T-SES",
      "day": "THU",
      "start": "17:00",
      "end": "19:00",
      "audience": "CL",
      "level": "TERMINALE",
      "subjectId": "SES",
      "groupId": "T-CL",
      "teacherId": "teacher-ses",
      "roomId": "room-2",
      "title": "Terminale CL — SES",
      "active": true,
      "notes": ""
    },
    {
      "id": "THU-1915-P1-NSI",
      "day": "THU",
      "start": "19:15",
      "end": "21:15",
      "audience": "CL",
      "level": "PREMIERE",
      "subjectId": "NSI",
      "groupId": "P1-CL",
      "teacherId": "teacher-m2",
      "roomId": "room-1",
      "title": "Première CL — NSI",
      "active": true,
      "notes": ""
    },
    {
      "id": "THU-1915-T-HGGSP",
      "day": "THU",
      "start": "19:15",
      "end": "21:15",
      "audience": "CL",
      "level": "TERMINALE",
      "subjectId": "HGGSP",
      "groupId": "T-CL",
      "teacherId": "teacher-hg",
      "roomId": "room-2",
      "title": "Terminale CL — HGGSP",
      "active": true,
      "notes": ""
    },
    {
      "id": "FRI-1430-P1-PC",
      "day": "FRI",
      "start": "14:30",
      "end": "16:30",
      "audience": "CL",
      "level": "PREMIERE",
      "subjectId": "PC",
      "groupId": "P1-CL",
      "teacherId": "teacher-pc",
      "roomId": "room-1",
      "title": "Première CL — Physique-Chimie",
      "active": true,
      "notes": ""
    },
    {
      "id": "FRI-1430-T-M",
      "day": "FRI",
      "start": "14:30",
      "end": "16:30",
      "audience": "CL",
      "level": "TERMINALE",
      "subjectId": "MATHS",
      "groupId": "T-CL",
      "teacherId": "teacher-m2",
      "roomId": "room-2",
      "title": "Terminale CL — Mathématiques EDS",
      "active": true,
      "notes": ""
    },
    {
      "id": "FRI-1645-P1-SVT",
      "day": "FRI",
      "start": "16:45",
      "end": "18:45",
      "audience": "CL",
      "level": "PREMIERE",
      "subjectId": "SVT",
      "groupId": "P1-CL",
      "teacherId": "teacher-svt",
      "roomId": "room-1",
      "title": "Première CL — SVT",
      "active": true,
      "notes": ""
    },
    {
      "id": "FRI-1645-T-NSI",
      "day": "FRI",
      "start": "16:45",
      "end": "18:45",
      "audience": "CL",
      "level": "TERMINALE",
      "subjectId": "NSI",
      "groupId": "T-CL",
      "teacherId": "teacher-m2",
      "roomId": "room-2",
      "title": "Terminale CL — NSI",
      "active": true,
      "notes": ""
    },
    {
      "id": "FRI-1900-P1-SES",
      "day": "FRI",
      "start": "19:00",
      "end": "21:00",
      "audience": "CL",
      "level": "PREMIERE",
      "subjectId": "SES",
      "groupId": "P1-CL",
      "teacherId": "teacher-ses",
      "roomId": "room-1",
      "title": "Première CL — SES",
      "active": true,
      "notes": ""
    },
    {
      "id": "FRI-1900-T-PC",
      "day": "FRI",
      "start": "19:00",
      "end": "21:00",
      "audience": "CL",
      "level": "TERMINALE",
      "subjectId": "PC",
      "groupId": "T-CL",
      "teacherId": "teacher-pc",
      "roomId": "room-2",
      "title": "Terminale CL — Physique-Chimie",
      "active": true,
      "notes": ""
    },
    {
      "id": "SAT-0900-T-MA",
      "day": "SAT",
      "start": "09:00",
      "end": "11:00",
      "audience": "SCO",
      "level": "TERMINALE",
      "subjectId": "MATHS",
      "groupId": "T-SCO-A",
      "teacherId": "teacher-m1",
      "roomId": "room-1",
      "title": "Terminale — Maths A (priorité Maths + NSI)",
      "active": true,
      "notes": ""
    },
    {
      "id": "SAT-0900-P1-F",
      "day": "SAT",
      "start": "09:00",
      "end": "11:00",
      "audience": "SCO",
      "level": "PREMIERE",
      "subjectId": "FRANCAIS",
      "groupId": "P1-SCO",
      "teacherId": "teacher-f1",
      "roomId": "room-2",
      "title": "Première — Français / EAF",
      "active": true,
      "notes": ""
    },
    {
      "id": "SAT-1115-T-NSI",
      "day": "SAT",
      "start": "11:15",
      "end": "13:15",
      "audience": "SCO",
      "level": "TERMINALE",
      "subjectId": "NSI",
      "groupId": "T-SCO-A",
      "teacherId": "teacher-m1",
      "roomId": "room-1",
      "title": "Terminale — NSI",
      "active": true,
      "notes": ""
    },
    {
      "id": "SAT-1115-P1-SVT",
      "day": "SAT",
      "start": "11:15",
      "end": "13:15",
      "audience": "SCO",
      "level": "PREMIERE",
      "subjectId": "SVT",
      "groupId": "P1-SCO",
      "teacherId": "teacher-svt",
      "roomId": "room-2",
      "title": "Première — SVT",
      "active": true,
      "notes": ""
    },
    {
      "id": "SAT-1445-T-MB",
      "day": "SAT",
      "start": "14:45",
      "end": "16:45",
      "audience": "SCO",
      "level": "TERMINALE",
      "subjectId": "MATHS",
      "groupId": "T-SCO-B",
      "teacherId": "teacher-m1",
      "roomId": "room-1",
      "title": "Terminale — Maths B (priorité Maths + PC)",
      "active": true,
      "notes": ""
    },
    {
      "id": "SAT-1445-P1-SES",
      "day": "SAT",
      "start": "14:45",
      "end": "16:45",
      "audience": "SCO",
      "level": "PREMIERE",
      "subjectId": "SES",
      "groupId": "P1-SCO",
      "teacherId": "teacher-ses",
      "roomId": "room-2",
      "title": "Première — SES",
      "active": true,
      "notes": ""
    },
    {
      "id": "SAT-1700-T-PC",
      "day": "SAT",
      "start": "17:00",
      "end": "19:00",
      "audience": "SCO",
      "level": "TERMINALE",
      "subjectId": "PC",
      "groupId": "T-SCO-B",
      "teacherId": "teacher-pc",
      "roomId": "room-1",
      "title": "Terminale — Physique-Chimie",
      "active": true,
      "notes": ""
    },
    {
      "id": "SAT-1700-P1-HGGSP",
      "day": "SAT",
      "start": "17:00",
      "end": "19:00",
      "audience": "SCO",
      "level": "PREMIERE",
      "subjectId": "HGGSP",
      "groupId": "P1-SCO",
      "teacherId": "teacher-hg",
      "roomId": "room-2",
      "title": "Première — HGGSP",
      "active": true,
      "notes": ""
    },
    {
      "id": "SAT-1915-P1CL-F",
      "day": "SAT",
      "start": "19:15",
      "end": "21:15",
      "audience": "CL",
      "level": "PREMIERE",
      "subjectId": "FRANCAIS",
      "groupId": "P1-CL",
      "teacherId": "teacher-f1",
      "roomId": "room-1",
      "title": "Première CL — Français / EAF",
      "active": true,
      "notes": ""
    },
    {
      "id": "SAT-1915-TCL-SVT",
      "day": "SAT",
      "start": "19:15",
      "end": "21:15",
      "audience": "CL",
      "level": "TERMINALE",
      "subjectId": "SVT",
      "groupId": "T-CL",
      "teacherId": "teacher-svt",
      "roomId": "room-2",
      "title": "Terminale CL — SVT",
      "active": true,
      "notes": ""
    },
    {
      "id": "SUN-0900-P1-MA",
      "day": "SUN",
      "start": "09:00",
      "end": "11:00",
      "audience": "SCO",
      "level": "PREMIERE",
      "subjectId": "MATHS",
      "groupId": "P1-SCO-A",
      "teacherId": "teacher-m1",
      "roomId": "room-1",
      "title": "Première — Maths A (priorité Maths + NSI)",
      "active": true,
      "notes": ""
    },
    {
      "id": "SUN-0900-T-PHILO",
      "day": "SUN",
      "start": "09:00",
      "end": "11:00",
      "audience": "SCO",
      "level": "TERMINALE",
      "subjectId": "PHILO",
      "groupId": "T-SCO",
      "teacherId": "teacher-f1",
      "roomId": "room-2",
      "title": "Terminale — Philosophie",
      "active": true,
      "notes": ""
    },
    {
      "id": "SUN-1115-P1-NSI",
      "day": "SUN",
      "start": "11:15",
      "end": "13:15",
      "audience": "SCO",
      "level": "PREMIERE",
      "subjectId": "NSI",
      "groupId": "P1-SCO-A",
      "teacherId": "teacher-m1",
      "roomId": "room-1",
      "title": "Première — NSI",
      "active": true,
      "notes": ""
    },
    {
      "id": "SUN-1115-T-SVT",
      "day": "SUN",
      "start": "11:15",
      "end": "13:15",
      "audience": "SCO",
      "level": "TERMINALE",
      "subjectId": "SVT",
      "groupId": "T-SCO",
      "teacherId": "teacher-svt",
      "roomId": "room-2",
      "title": "Terminale — SVT",
      "active": true,
      "notes": ""
    },
    {
      "id": "SUN-1445-P1-MB",
      "day": "SUN",
      "start": "14:45",
      "end": "16:45",
      "audience": "SCO",
      "level": "PREMIERE",
      "subjectId": "MATHS",
      "groupId": "P1-SCO-B",
      "teacherId": "teacher-m1",
      "roomId": "room-1",
      "title": "Première — Maths B (priorité Maths + PC)",
      "active": true,
      "notes": ""
    },
    {
      "id": "SUN-1445-T-SES",
      "day": "SUN",
      "start": "14:45",
      "end": "16:45",
      "audience": "SCO",
      "level": "TERMINALE",
      "subjectId": "SES",
      "groupId": "T-SCO",
      "teacherId": "teacher-ses",
      "roomId": "room-2",
      "title": "Terminale — SES",
      "active": true,
      "notes": ""
    },
    {
      "id": "SUN-1700-P1-PC",
      "day": "SUN",
      "start": "17:00",
      "end": "19:00",
      "audience": "SCO",
      "level": "PREMIERE",
      "subjectId": "PC",
      "groupId": "P1-SCO-B",
      "teacherId": "teacher-pc",
      "roomId": "room-1",
      "title": "Première — Physique-Chimie",
      "active": true,
      "notes": ""
    },
    {
      "id": "SUN-1700-T-HGGSP",
      "day": "SUN",
      "start": "17:00",
      "end": "19:00",
      "audience": "SCO",
      "level": "TERMINALE",
      "subjectId": "HGGSP",
      "groupId": "T-SCO",
      "teacherId": "teacher-hg",
      "roomId": "room-2",
      "title": "Terminale — HGGSP",
      "active": true,
      "notes": ""
    },
    {
      "id": "SUN-1915-P1CL-HGGSP",
      "day": "SUN",
      "start": "19:15",
      "end": "21:15",
      "audience": "CL",
      "level": "PREMIERE",
      "subjectId": "HGGSP",
      "groupId": "P1-CL",
      "teacherId": "teacher-hg",
      "roomId": "room-1",
      "title": "Première CL — HGGSP",
      "active": true,
      "notes": ""
    },
    {
      "id": "SUN-1915-TCL-PHILO",
      "day": "SUN",
      "start": "19:15",
      "end": "21:15",
      "audience": "CL",
      "level": "TERMINALE",
      "subjectId": "PHILO",
      "groupId": "T-CL",
      "teacherId": "teacher-f1",
      "roomId": "room-2",
      "title": "Terminale CL — Philosophie",
      "active": true,
      "notes": ""
    }
  ]
};
