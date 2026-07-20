# Impact fonctionnel des différences Bilans

## Sens des comparaisons

La commande imposée `diff local production` montre ce qui disparaîtrait en revenant vers la production. Pour analyser le progrès fonctionnel, le tableau ci-dessous décrit le sens **production `1b8219b1` → local `db04d23f`**. Tous les fichiers sont `M` ; aucun fichier du périmètre n'est ajouté ou supprimé entre ces deux commits.

Abréviations : `P0-OWN` ownership, `P0-ASYNC` durabilité, `P0-AUD` audience, `VAL` validation d'entrée, `LOG` sérialisation d'erreur, `NA` sans migration. « Tests » indique l'effet connu, pas une exécution dans cette session.

## Production → HEAD local : 55 fichiers

| Fichier | Changement et impact route/P0 | Tests | Migration | Réaudit |
|---|---|---|---|---|
| `app/api/assessments/submit/route.ts` | LOG seulement ; submit, P0-ASYNC, NSP et transaction inchangés | assessments à rejouer | NA | oui pour P0, diff faible |
| `app/api/assessments/test/route.ts` | LOG/robustesse endpoint technique | suite route modifiée | NA | léger |
| `app/api/bilans/[id]/export/route.ts` | VAL params/query/body + LOG ; ownership déjà présent ; audience `all` reste | bilans export/ID à rejouer | NA | oui P0-AUD |
| `app/api/bilans/[id]/route.ts` | VAL ID/body + LOG ; PUT/publication/destruction restent non versionnés | tests ID/CRUD modifiés | NA | oui sécurité/workflow |
| `app/api/bilans/generate/route.ts` | VAL + LOG ; à `db04`, aucun scope ownership et fire-and-forget inchangé | generate modifié, mocks | NA | **obligatoire P0-OWN/P0-ASYNC** |
| `app/api/bilans/route.ts` | VAL filtres/body + LOG ; coachId forcé mais `studentId` non assigné | CRUD/IDOR modifiés | NA | **obligatoire P0-OWN** |
| `app/api/coach/dashboard/route.ts` | LOG uniquement | dashboard à rejouer | NA | non structurel |
| `app/api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate/route.ts` | VAL param avant assignment ; chaîne dédiée inchangée | nouveau test sécurité EAF | NA | oui route |
| `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent/route.ts` | VAL param ; assignment existant | tests stage ciblés | NA | oui route |
| `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-student/route.ts` | VAL param ; assignment existant | tests stage ciblés | NA | oui route |
| `app/api/coach/nsi-pratique-2026/students/[studentId]/progress/route.ts` | garde server-only/bundle | tests programme | NA | léger |
| `app/api/coach/nsi-pratique-2026/students/route.ts` | LOG uniquement | tests NSI | NA | non structurel |
| `app/api/coach/sessions/[sessionId]/report/route.ts` | LOG uniquement | test report session | NA | non structurel |
| `app/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale/route.ts` | schéma strict des notes/IDs de questions + VAL ; assignment conservé | nouveau test sécurité coach | NA | oui scoring/route |
| `app/api/coach/students/[studentId]/documents/route.ts` | VAL params/body/upload, projection sans chemin local et contraintes fichiers renforcées | documents access/ID modifiés | NA | oui stockage/RBAC |
| `app/api/coach/students/[studentId]/dossier/route.ts` | LOG uniquement | dossier à rejouer | NA | non structurel |
| `app/api/coach/students/[studentId]/eaf-preparation-report/validate/route.ts` | VAL param avant assignment/job | test validation modifié | NA | oui workflow dédié |
| `app/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate/route.ts` | VAL `studentId/reportId`, projection interne maintenue | generated reports modifié | NA | oui P0-ASYNC reste |
| `app/api/coach/students/[studentId]/notes/route.ts` | VAL param/body, longueurs, LOG ; assignment conservé | pas de preuve DB nouvelle identifiée | NA | oui privacy/RBAC |
| `app/api/coach/students/[studentId]/route.ts` | LOG uniquement | route coach à rejouer | NA | non structurel |
| `app/api/coach/students/[studentId]/survival-mode/route.ts` | VAL param/payload + LOG ; assignment conservé | sécurité route à rejouer | NA | oui route |
| `app/api/coach/students/eam-summary/route.ts` | LOG uniquement | EAM à rejouer | NA | non structurel |
| `app/api/coach/students/route.ts` | LOG uniquement | coach students à rejouer | NA | non structurel |
| `app/api/coach/trajectory/route.ts` | VAL body, assignment coach, borne targetScore corrigée + LOG | nouveau test sécurité trajectory | NA | oui route métier |
| `app/api/diagnostics/definitions/route.ts` | LOG uniquement | definitions à rejouer | NA | architecture inchangée |
| `app/api/parent/children/route.ts` | VAL création/enfant et cycle activation ajusté ; modèle mono-parent inchangé | tests children/activation modifiés | NA | oui famille |
| `app/api/parent/credit-request/route.ts` | LOG uniquement | credit request | NA | non structurel |
| `app/api/parent/dashboard/route.ts` | LOG uniquement | dashboard parent | NA | non structurel |
| `app/api/parent/subscription-requests/route.ts` | VAL body/query, catalogue serveur et LOG ; ownership enfant conservé | test subscription modifié | NA | oui parent |
| `app/api/parent/subscriptions/route.ts` | VAL et suppression de prix/crédits client ; catalogue serveur | test subscriptions modifié | NA | oui parent |
| `app/api/student/activate/route.ts` | VAL token/password et lifecycle renforcé | nouveau test lifecycle + route modifiée | NA | oui auth |
| `app/api/student/automatismes/attempts/[id]/route.ts` | LOG uniquement | automatismes à rejouer | NA | léger |
| `app/api/student/automatismes/attempts/route.ts` | VAL commande/session ; identité serveur renforcée | tests programme/route indirects | NA | oui ownership |
| `app/api/student/automatismes/check-answer/route.ts` | VAL réponse/identifiants | tests automatismes | NA | oui scoring auxiliaire |
| `app/api/student/automatismes/series/[id]/route.ts` | VAL param | tests automatismes | NA | léger |
| `app/api/student/automatismes/series/route.ts` | LOG uniquement | tests automatismes | NA | non structurel |
| `app/api/student/bilans/[publicShareId]/route.ts` | LOG uniquement ; projection/ownership Bilans inchangés | bilan student à rejouer | NA | oui P0-AUD reste |
| `app/api/student/dashboard/route.ts` | LOG uniquement | dashboard student | NA | non structurel |
| `app/api/student/documents/[id]/download/route.ts` | validation/path logging renforcés | documents download/access modifiés | NA | oui stockage/IDOR |
| `app/api/student/documents/route.ts` | LOG uniquement | documents | NA | léger |
| `app/api/student/nexus-index/route.ts` | VAL payload/session | route student | NA | oui ownership |
| `app/api/student/resources/official/[slug]/route.ts` | LOG/safe erreurs | ressources | NA | léger |
| `app/api/student/resources/route.ts` | LOG uniquement | ressources | NA | non structurel |
| `app/api/student/survival/phrases/[phraseId]/copied/route.ts` | VAL param | tests survival | NA | léger |
| `app/api/student/survival/progress/route.ts` | VAL payload/progression | tests survival | NA | oui identité/état |
| `app/api/student/survival/qcm/attempt/route.ts` | VAL tentative/réponses | tests survival | NA | oui scoring auxiliaire |
| `app/api/student/survival/reflexes/[reflexId]/attempt/route.ts` | VAL param/payload | tests survival | NA | oui scoring auxiliaire |
| `app/api/student/survival/ritual/route.ts` | LOG uniquement | tests survival | NA | non structurel |
| `app/api/student/trajectory/route.ts` | VAL payload et identité de session | tests trajectory | NA | oui ownership |
| `app/dashboard/parent/add-child-dialog.tsx` | UI activation/mot de passe alignée au nouveau cycle | composants/E2E parent à rejouer | NA | oui famille/frontend |
| `lib/bilan/generator.ts` | LOG uniquement ; RAG/LLM/fire-and-forget inchangés | generator à rejouer | NA | oui P0-ASYNC/RAG |
| `lib/rag-client.ts` | LOG sérialisé seulement ; erreur toujours confondue avec vide | tests RAG à rejouer | NA | oui architecture RAG |
| `package-lock.json` | ajout `server-only` | install/build CI | NA | non Bilans |
| `package.json` | `server-only` + gates bundle | CI/build modifiés | NA | oui reproductibilité |
| `prisma/schema.prisma` | ajout `BusinessConfig`/Audit, aucun modèle Bilan modifié | 613 tests config ajoutés | 3 migrations post-production, dont 2 config | oui avant migration Bilans |

## HEAD local → origin/main : 10 fichiers métier dans le périmètre

| Fichier | Changement supplémentaire | Impact P0 / tests / migration | Réaudit |
|---|---|---|---|
| `app/api/bilans/[id]/export/route.ts` | parser JSON borné | robustesse ; aucun modèle | léger |
| `app/api/bilans/[id]/route.ts` | enum `BilanStatus`, bornes SSN/UAI, parser JSON | réduit payload invalide, workflow reste libre | oui |
| `app/api/bilans/generate/route.ts` | `buildBilanWriteWhere`/`ReadWhere` avant accès | ferme statiquement generate/poll IDOR ; nouveau test mocké | **obligatoire DB réel** |
| `app/api/bilans/route.ts` | enums `BilanType/Status`, parser JSON | ne vérifie toujours pas assignment du `studentId` en création | **obligatoire P0** |
| `app/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale/route.ts` | validation teacherGrades strictement bornée aux questions ouvertes | sécurité/scoring ; tests modifiés | oui |
| `app/api/coach/students/[studentId]/documents/route.ts` | storage root centralisé et download endpoint projeté | stockage/IDOR ; tests download ajoutés | oui |
| `app/api/coach/trajectory/route.ts` | parser JSON et targetScore 0–100/null | contrat métier | oui |
| `app/api/parent/children/route.ts` | parser JSON + email activation échappé/non bloquant | famille ; tests activation modifiés | oui |
| `app/api/parent/subscription-requests/route.ts` | `reason` accepte null | compatibilité contrat | léger |
| `app/dashboard/admin/tests/page.tsx` | page réservée à ADMIN | RBAC frontend ; pas Prisma | léger |

En dehors de ce périmètre, G-SEC/G-PAY modifient guards, helpers, téléchargements, paiements, scripts de gate et 32 fichiers de tests/support. Il n'existe aucune différence de schéma, migration ou dépendance entre `db04d23f` et `origin/main`.

## Conséquences pour B1

1. Ne pas réimplémenter le finding « generate sans ownership » comme s'il était intact : vérifier le correctif de `origin/main`, son helper et sa couverture DB.
2. Conserver ouvert le finding de création `/api/bilans` pour élève arbitraire.
3. Conserver ouverts fire-and-forget, audiences, NSP, scoring fail-open et identité email : aucun des trois commits distants ne les ferme.
4. Refaire l'inventaire exact des routes depuis `c90b142c` avant tout patch.
5. Les futures migrations Bilans devront être créées après les migrations EAM/BusinessConfig déjà commitées, sans supposer qu'elles sont déployées.
