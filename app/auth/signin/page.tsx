import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { SignInForm } from "./SignInForm";

export const dynamic = 'force-dynamic';

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
