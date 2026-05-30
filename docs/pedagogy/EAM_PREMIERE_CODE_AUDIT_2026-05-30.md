# Audit code - Dashboard EAM Maths Premiere generale

Date : 2026-05-30

## Routes existantes

| Route | Role | Etat |
|---|---|---|
| `/dashboard/eleve/eam` | Module EAM canonique avec progression locale/API | A garder et enrichir avec le sprint 10h |
| `/api/eam/progress` | Sauvegarde progression EAM | Reutilisable, non modifie dans ce lot |
| `/api/coach/students/eam-summary` | Synthese coach EAM | Hors scope dashboard eleve |
| `/dashboard/eleve/automatismes` | Cockpit automatismes | Complement utile, non modifie |
| `/programme/maths-1ere` et `/dashboard/eleve/programme/maths` | Parcours programme Premiere | Trop large pour l'urgence EAM |

## Composants existants

| Composant | Role | A garder | A ameliorer |
|---|---|---|---|
| `components/EAMPrep/*` | Preparation EAM J-11, modules, sujet blanc et progression | Oui | Enrichir sans creer de second dashboard |
| `components/dashboard/eleve/EAMCockpitSummary.tsx` | Carte resume EAM dans le dashboard | Oui | Pointer vers `/dashboard/eleve/eam` |
| `components/automatismes/*` | Entrainement automatismes | Oui | Utiliser comme ressource annexe |
| `hooks/useEAMProgress.ts` | Progression EAM persistante | Oui | Non modifie pour eviter risque |

## Contenus existants

| Fichier | Contenu | Redondance | Decision |
|---|---|---|---|
| `components/EAMPrep/data.ts` | Modules EAM larges : automatismes, suites, derivees, exponentielle, geometrie, probabilites | Partielle | Garder pour revision longue |
| `components/EAMPrep/mockExamData.ts` | Sujet blanc embarque | Partielle | Garder, ne pas recopier |
| `docs/automatismes-eds-premiere.md` | References automatismes | Faible | Source de coherence |

## Tests existants

| Test | Couverture | Manque |
|---|---|---|
| `__tests__/eam-progress-core.test.ts` | Progression, modules EAM historiques, anti-regressions | Pas de sprint 10h |
| `__tests__/eam-mock-exam.test.ts` | Structure sujet blanc | Pas de livret ni mission du jour |
| Tests programme maths Premiere | Acces et contenus programme | Pas de dashboard premium EAM |

## Problemes identifies

- doublons : risque de superposer le module J-11 historique et un second dashboard ; decision : route canonique unique `/dashboard/eleve/eam`.
- zombies : anciens documents de stage et sujets blancs archives dans Drive, non a importer dans le code.
- orphelins : aucun orphelin code EAM critique identifie, mais les contenus EAM sont disperses entre programme, automatismes et dashboard.
- hardcoding : ne pas integrer de donnees nominatives issues des bilans.
- dette pedagogique : le dashboard historique reste utile, mais ne donne pas une lecture "mission commando" immediate.
- dette UX : besoin d'un cockpit plus direct avec mission du jour, barometre, anti-erreurs et livret imprimable.

## Decision d'architecture

Enrichir le flux existant `/dashboard/eleve/eam` avec le sprint 10h, le stage Commando, la mission du jour, le protocole week-end et le livret. Les routes paralleles `/dashboard/eleve/eam-premiere/**` ne doivent pas subsister comme second dashboard.
