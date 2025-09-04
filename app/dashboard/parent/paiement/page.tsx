'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Globe, Wallet } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ParentPaiementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'PARENT') {
      router.push('/auth/signin');
      return;
    }
  }, [status, session, router]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paiement</h1>
          <p className="text-gray-600 text-sm">Choisissez une méthode de paiement</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-2 border-blue-200" data-testid="pay-card-cb">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-blue-600" /> Carte bancaire (Visa/Mastercard)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-700">Payer en ligne par carte bancaire. Flux démo via Konnect.</p>
              <Button asChild>
                <Link href="/dashboard/parent/paiement/konnect-demo">Continuer</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200" data-testid="pay-card-wire">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-green-600" /> Virement bancaire (SEPA / Wise)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-700">Saisissez les informations de virement et envoyez la preuve pour validation.</p>
              <Button asChild variant="outline">
                <Link href="/dashboard/parent/paiement/wise">Continuer</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 border-amber-200" data-testid="pay-card-cash">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-amber-600" /> Paiement au centre</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-700">Réservez et réglez directement à l’accueil du centre Nexus.</p>
              <Button asChild variant="secondary">
                <Link href="/dashboard/parent/paiement/cash">Continuer</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
