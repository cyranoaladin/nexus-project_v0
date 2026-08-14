"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { GraduationCap, MessageCircle } from "lucide-react";
import Link from "next/link";

interface AnnualParcoursCardProps {
  childFirstName: string;
}

/**
 * Parcours annuels — ce que le parent peut réellement souscrire.
 *
 * Remplace la vente d'abonnements mensuels et d'add-ons ARIA, retirée parce
 * qu'elle reposait sur une plateforme qui ne délivre aucune matière.
 *
 * Le catalogue n'est volontairement PAS redessiné ici : il est déjà rendu, à
 * jour, sur la page publique des offres. En dupliquer une seconde version dans
 * l'espace connecté recréerait la divergence que ce correctif supprime — et le
 * contenu des offres n'est de toute façon pas exposé au client (seuls les
 * montants le sont, cf. lib/pricing-client.ts et son test de synchronisation).
 *
 * L'inscription passe par le chemin réel : échange avec un conseiller,
 * validation pédagogique, puis paiement au centre ou par virement.
 */
export function AnnualParcoursCard({ childFirstName }: AnnualParcoursCardProps) {
  return (
    <Card className="mb-6 sm:mb-8 bg-white/5">
      <CardHeader>
        <CardTitle className="flex items-center">
          <GraduationCap className="w-5 h-5 mr-2 text-brand-accent" />
          Inscrire {childFirstName} à un parcours
        </CardTitle>
        <p className="text-neutral-300">
          Nos accompagnements se souscrivent à l&apos;année, par niveau et par matière.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <ol className="space-y-3 text-sm text-neutral-300">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-accent/20 text-xs font-bold text-brand-accent">
              1
            </span>
            <span>
              <strong className="text-white">On échange</strong> — sur WhatsApp ou au centre, à
              Mutuelleville. Sans engagement.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-neutral-300">
              2
            </span>
            <span>
              <strong className="text-white">Nous validons le parcours</strong> — bilan si besoin,
              puis une recommandation écrite : la formule, le groupe, le rythme.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-neutral-300">
              3
            </span>
            <span>
              <strong className="text-white">Vous confirmez</strong> — règlement au centre ou par
              virement.
            </span>
          </li>
        </ol>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <a
              href={buildWhatsAppUrl(`un parcours pour ${childFirstName}`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              En parler avec un conseiller
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto border-white/10">
            <Link href="/offres">Voir tous les parcours et leurs tarifs</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
