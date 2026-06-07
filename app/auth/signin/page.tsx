import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import type { Metadata } from "next";
import { SignInForm } from "./SignInForm";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Connexion | Nexus Réussite",
  description: "Connectez-vous a votre espace Nexus Reussite pour suivre votre parcours, vos documents et vos prochaines actions.",
};

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-surface-darker">
      <CorporateNavbar />
      <main className="py-12 sm:py-20">
        <SignInForm />
      </main>
      <CorporateFooter />
    </div>
  );
}
