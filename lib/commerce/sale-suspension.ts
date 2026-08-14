/**
 * Suspension de vente — surfaces commerciales adossées à un service non livré.
 *
 * Motif : la plateforme ARIA ne délivre aujourd'hui aucune matière en
 * production (collection RAG interrogée vide, matières autres que NSI
 * redirigées de force, parcours d'activation sans effet). Tant que ce n'est
 * pas corrigé, aucune surface ne doit permettre de SOUSCRIRE à une offre dont
 * la valeur repose sur cette plateforme : les abonnements mensuels et les
 * add-ons ARIA.
 *
 * Ce module ne supprime aucune donnée. Les catalogues restent lisibles et un
 * abonnement déjà actif continue de s'afficher au parent : seule la
 * souscription est fermée. Rouvrir la vente = repasser un drapeau à false,
 * après avoir vérifié qu'ARIA livre réellement.
 */

export const SUSPENDED_SALE_SURFACES = ['SUBSCRIPTION_PLAN', 'ARIA_ADDON'] as const;

export type SaleSurface = 'SUBSCRIPTION_PLAN' | 'ARIA_ADDON' | 'SPECIAL_PACK';

export const ARIA_SUSPENSION_REASON =
  "La plateforme ARIA ne délivre aucune matière en production : aucune offre dont " +
  "la valeur en dépend ne peut être vendue tant que ce n'est pas corrigé.";

/**
 * Une surface de vente est-elle fermée ?
 *
 * Les packs (coaching Grand Oral, méthodologie Bac de français, orientation)
 * reposent sur des séances réellement assurées : ils restent ouverts.
 */
export function isSaleSuspended(surface: SaleSurface): boolean {
  return (SUSPENDED_SALE_SURFACES as readonly string[]).includes(surface);
}
