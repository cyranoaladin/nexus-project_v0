# Matrice d’affectation pédagogique

Cette matrice publique de gouvernance ne contient aucun nom. Les affectations réelles doivent être enregistrées dans un système opérationnel autorisé, puis validées avant publication du planning.

| Module | Niveau | Matière | Enseignant principal | Remplaçant | Diplôme/statut | Disponibilité | Charge/jour | Corrigés | Bilans |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- |
| `quatrieme-mathematiques` | 4e | Mathématiques | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |
| `quatrieme-francais` | 4e | Français | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |
| `troisieme-mathematiques` | 3e | Mathématiques | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |
| `troisieme-francais` | 3e | Français | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |
| `seconde-mathematiques` | Seconde | Mathématiques | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |
| `seconde-francais` | Seconde | Français | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |
| `premiere-mathematiques` | Première | Mathématiques | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |
| `premiere-francais-eaf` | Première | Français/EAF | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |
| `premiere-nsi` | Première | NSI | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |
| `premiere-physique-chimie` | Première | Physique-Chimie | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |
| `premiere-svt` | Première | SVT | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |
| `terminale-mathematiques` | Terminale | Mathématiques | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |
| `terminale-maths-expertes` | Terminale | Mathématiques expertes | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |
| `terminale-nsi` | Terminale | NSI | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |
| `terminale-physique-chimie` | Terminale | Physique-Chimie | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |
| `terminale-svt` | Terminale | SVT | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |
| `terminale-philosophie` | Terminale | Philosophie | À affecter | À affecter | À vérifier | À valider | 2 h | Validateur à affecter | Validateur à affecter |

```text
TEACHER_ASSIGNMENTS_VALIDATED=false
ROOM_ASSIGNMENTS_VALIDATED=false
NO_TEACHER_CONFLICT=true
NO_ROOM_CONFLICT=true
DAILY_LOAD_VALID=true
```

Les trois derniers contrôles portent uniquement sur le planning socle et ne valent pas validation d’affectation. La charge par enseignant est calculée et rapportée par le validateur (`scripts/validate-stage-planning.ts`) mais n’est plus une règle bloquante (mission consolidée §0.2, 2026-07-27) : un fichier de configuration ne décide plus des heures d’une personne réelle.

Les cohortes alternatives sont des options de créneau et non des modules
supplémentaires. La matrice contient exactement les 17 modules pédagogiques du
contrat canonique.
