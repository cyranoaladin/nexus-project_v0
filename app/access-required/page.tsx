import { Suspense } from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Mail, Package } from 'lucide-react';
import { getFeatureDefinition } from '@/lib/access/features';

/**
 * Access Required page — shown when a user lacks entitlements for a feature.
 *
 * Query params:
 * - feature: FeatureKey that was denied
 * - reason: denial reason (missing_entitlement, auth_required, etc.)
 * - missing: comma-separated list of missing entitlement features
 */

interface AccessRequiredContentProps {
  searchParams: Promise<{ feature?: string; reason?: string; missing?: string }>;
}

async function AccessRequiredContent({ searchParams }: AccessRequiredContentProps) {
  const params = await searchParams;
  const featureKey = params.feature ?? '';
  const reason = params.reason ?? 'denied';
  const missingStr = params.missing ?? '';
  const missing = missingStr ? missingStr.split(',') : [];

  const featureDef = getFeatureDefinition(featureKey);
  const featureLabel = featureDef?.label ?? featureKey;
  const featureDescription = featureDef?.description ?? '';

  const reasonMessages: Record<string, string> = {
    missing_entitlement: 'Vous n\'avez pas encore accès à cette fonctionnalité.',
    auth_required: 'Vous devez être connecté pour accéder à cette page.',
    no_role: 'Votre compte n\'a pas de rôle assigné.',
    unknown_feature: 'Cette fonctionnalité n\'existe pas.',
    denied: 'L\'accès à cette fonctionnalité est restreint.',
  };

  const message = reasonMessages[reason] ?? reasonMessages.denied;

  return (
    <div className="min-h-screen bg-surface-darker flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-surface-card border border-white/10 rounded-2xl p-8 shadow-premium text-center">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
            <ShieldAlert className="w-8 h-8 text-amber-300" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-2">
            Accès requis
          </h1>

          {/* Feature label */}
          {featureLabel && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4">
              <Package className="w-4 h-4 text-brand-accent" />
              <span className="text-sm font-medium text-neutral-200">{featureLabel}</span>
            </div>
          )}

          {/* Message */}
          <p className="text-neutral-400 mb-2">{message}</p>

          {featureDescription && (
            <p className="text-sm text-neutral-500 mb-6">{featureDescription}</p>
          )}

          {/* Missing features */}
          {missing.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6 text-left">
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
                Droits manquants
              </p>
              <ul className="space-y-1">
                {missing.map((feat) => (
                  <li key={feat} className="text-sm text-neutral-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {feat.replace(/_/g, ' ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTAs */}
          <div className="space-y-3">
            <Link
              href="/offres"
              className="block w-full py-3 px-4 rounded-lg bg-brand-accent text-white font-medium hover:bg-brand-accent/90 transition-colors text-center"
            >
              Voir les offres
            </Link>

            <a
              href="mailto:contact@nexusreussite.academy?subject=Demande%20d%27acc%C3%A8s%20-%20${encodeURIComponent(featureLabel)}"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg border border-white/10 text-neutral-200 hover:text-white hover:border-white/20 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Contacter Nexus
            </a>

            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 w-full py-2 px-4 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour au tableau de bord
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AccessRequiredPage({
  searchParams,
}: {
  searchParams: Promise<{ feature?: string; reason?: string; missing?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-darker flex items-center justify-center">
          <div className="text-neutral-400">Chargement...</div>
        </div>
      }
    >
      <AccessRequiredContent searchParams={searchParams} />
    </Suspense>
  );
}
