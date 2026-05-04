import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { SignInForm } from "./SignInForm";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-surface-darker">
      <CorporateNavbar />
      <main className="py-20">
        <Suspense fallback={
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
          </div>
        }>
          <SignInForm />
        </Suspense>
      </main>
      <CorporateFooter />
    </div>
  );
}
