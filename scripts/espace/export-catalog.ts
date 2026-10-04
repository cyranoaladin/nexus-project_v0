/**
 * Exporte le catalogue d'activités du CODE (JSON) pour le preflight de déploiement.
 *
 *   npx tsx scripts/espace/export-catalog.ts > <release>/espace-catalog.json
 *
 * `switch-release.sh` compare ce fichier au miroir `espace_activities` de la base (lecture seule) avant toute bascule.
 */
import { ACTIVITIES } from '@/lib/espace/catalog';

process.stdout.write(
  `${JSON.stringify(
    ACTIVITIES.map((a) => ({ slug: a.slug, subject: a.subject, moduleSlug: a.moduleSlug, title: a.title, kind: a.kind, stepsTotal: a.stepsTotal, contentVersion: a.contentVersion })),
    null,
    2,
  )}\n`,
);
