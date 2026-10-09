import Link from 'next/link';

export function PaymentsUnavailable() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-16 space-y-4">
      <h1 className="text-2xl font-semibold">Paiements indisponibles</h1>
      <p>Aucun paiement ne peut être effectué depuis cet espace pour le moment.</p>
      <Link href="/dashboard/parent" className="underline">Retour à mon espace</Link>
    </main>
  );
}
