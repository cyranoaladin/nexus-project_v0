interface PracticalInfoProps {
  campaign: {
    startDate: string;
    endDate: string;
    decisionDeadline: string;
    venue: { name: string; neighborhood: string; city: string };
  };
}

export function PracticalInformation({ campaign }: PracticalInfoProps) {
  return (
    <section className="bg-lux-paper py-14 md:py-20 px-4" aria-labelledby="practical-heading">
      <div className="mx-auto max-w-6xl">
        <h2 id="practical-heading" className="font-fraunces text-2xl md:text-3xl text-lux-ink mb-8">
          Informations pratiques
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lux-ink">Lieu</h3>
              <p className="text-lux-slate">{campaign.venue.name}</p>
              <p className="text-lux-slate">{campaign.venue.neighborhood}, {campaign.venue.city}</p>
            </div>
            <div>
              <h3 className="font-semibold text-lux-ink">Dates</h3>
              <p className="text-lux-slate">Du 17 au 28 août 2026 (hors week-end du 22-23)</p>
            </div>
            <div>
              <h3 className="font-semibold text-lux-ink">Volume</h3>
              <p className="text-lux-slate">5 séances de 2 heures par matière (10 heures par matière)</p>
            </div>
            <div>
              <h3 className="font-semibold text-lux-ink">Matériel</h3>
              <p className="text-lux-slate">Cahier, trousse complète, calculatrice si concerné</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lux-ink">Seuil d'ouverture</h3>
              <p className="text-lux-slate">Groupe ouvert à partir de 3 élèves (maximum 5)</p>
            </div>
            <div>
              <h3 className="font-semibold text-lux-ink">Décision d'ouverture</h3>
              <p className="text-lux-slate">Le 10 août 2026 à 18 h</p>
            </div>
            <div>
              <h3 className="font-semibold text-lux-ink">Acompte</h3>
              <p className="text-lux-slate">30 % du tarif, versé après confirmation par l'équipe Nexus</p>
            </div>
            <div>
              <h3 className="font-semibold text-lux-ink">Groupe non ouvert</h3>
              <p className="text-lux-slate">Remboursement intégral de l'acompte si le seuil n'est pas atteint</p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-lux-gold/20 bg-lux-gold/5 p-5 space-y-2">
          <p className="text-sm text-lux-ink">
            La pré-inscription transmet votre demande à l'équipe Nexus. Elle ne garantit pas
            une place tant que le groupe, le profil pédagogique et l'acompte n'ont pas été confirmés.
          </p>
          <p className="text-sm text-lux-ink">
            Aucun paiement en ligne n'est demandé sur cette page. Les conditions
            contractuelles applicables sont communiquées avant confirmation.
          </p>
          <p className="text-sm text-lux-slate">
            <a href="/mentions-legales" className="underline hover:text-lux-ink">
              Conditions générales de vente
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
