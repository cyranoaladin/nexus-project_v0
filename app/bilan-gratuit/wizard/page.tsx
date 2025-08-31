"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import BilanWizard from "@/components/bilan/BilanWizard";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { useEffect } from "react";

export default function BilanWizardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isE2E = process.env.NEXT_PUBLIC_E2E === '1';

  useEffect(() => {
    if (isE2E) return; // Ne pas rediriger en E2E pour éviter les flakiness
    if (status === "loading") return;
    if (!session?.user) {
      router.replace("/auth/signin");
    }
  }, [session, status, router, isE2E]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="py-6">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          {isE2E ? (
            <BilanWizard />
          ) : session?.user ? (
            <BilanWizard />
          ) : (
            <p className="text-center text-gray-600" data-testid="wizard-auth-redirect">Redirection vers la connexion…</p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
