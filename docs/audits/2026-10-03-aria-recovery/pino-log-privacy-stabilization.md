# Lot de logs accepté au gel de #337

Date : 2026-10-05. Base locale : 972083daa9a910a3bf4075a35537e026b6d19299.
Aucune extension fonctionnelle, migration, modification de permission ou de tarif.

## Huit fichiers préexistants au gel

| Fichier | Risque / correction |
|---|---|
| lib/logger.ts | Singleton Pino : projection des objets et bindings privés avant sérialisation. |
| lib/middleware/logger.ts | Erreur de service/Prisma contenant une invocation privée : résumé fixe, paramètres de route masqués. |
| app/api/payments/clictopay/webhook/route.ts | Message fournisseur libre dans le catch : résumé fixe. Contrat 501 inchangé. |
| lib/utils/serialize-error.ts | Expose les prédicats stricts du sérialiseur partagé, sans copie de logique. |
| scripts/serialize-error.cjs | Prédicats de noms/codes autorisés, sans texte privé. |
| scripts/serialize-error.d.cts | Contrat TypeScript des mêmes prédicats. |
| lib/security/pino-log-privacy.ts | Projection allowlist, descripteurs sans getters, cycles/profondeur bornés, child bindings et interpolation. |
| __tests__/middleware/logger-error-privacy.test.ts | Vérifie le JSON réellement émis par Pino, avec marqueurs exclusivement synthétiques. |

Test adjacent adapté : __tests__/middleware/pino-logger.test.ts observe la nouvelle méthode child via spy call-through, et exige le résumé sans message/stack plutôt que leur exposition.

## Preuves ciblées

Les 12 tests initiaux ont reproduit la fuite avant correction. Les deux tests supplémentaires object-first + interpolation ont échoué sur le marqueur privé puis passent après suppression des arguments de formatage secondaires. Huit suites ciblées : 164 tests verts, zéro ignoré. Typecheck vert ; lint ciblé sans erreur (24 warnings préexistants du test historique). Diff-check et Gitleaks du diff + nouveaux fichiers : verts.

Les identifiants opérationnels opaques, codes SQL allowlistés, méthode, template de route, compteurs, statut et durée restent disponibles. Corps, contacts, credentials, stack/cause et texte libre inconnu sont exclus. Les messages d'événement restent des libellés définis par les appelants : cette correction ne revendique pas un audit global de tous les messages interpolés. Les identifiants conservés restent soumis à la politique de rétention.

La suite complète 14911 tests sur 972083daa est une preuve antérieure au lot Pino ; une nouvelle campagne complète est requise avant push. Les preuves distantes de 16ae ne qualifient pas ce lot. Aucun déploiement ni modification des arbres historiques.
