import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import type { Metadata } from "next";
import { SignInForm } from "./SignInForm";
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Connexion | Nexus Réussite",
  description: "Connectez-vous a votre espace Nexus Reussite pour suivre votre parcours, vos documents et vos prochaines actions.",
};

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-lux-ink">
      <CorporateNavbar />
      <main id="main-content" className="py-12 sm:py-20">
        <SignInForm />
      </main>
      <CorporateFooter />
    </div>
  );
}
