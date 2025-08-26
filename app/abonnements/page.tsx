import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';

export default function SubscriptionsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Nos Formules d'Abonnement</h1>
          <p className="text-lg text-gray-600">
            Cette section est en cours de construction. Découvrez bientôt nos offres conçues pour
            votre réussite !
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
