// app/aria/page.tsx
import { ChatWindow } from "@/components/aria/ChatWindow";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { getServerSession } from "next-auth";

export default async function AriaPage() {
  if (process.env.NEXT_PUBLIC_E2E === '1') {
    return (
      <main className="container mx-auto p-4 md:p-8">
        <div className="flex flex-col items-center text-center mb-8">
          <h1 className="text-4xl font-bold text-bleu-primaire font-poppins">Assistant Pédagogique ARIA</h1>
          <p className="mt-2 text-lg text-gray-600">Votre partenaire de réussite, disponible 24/7.</p>
        </div>
        <ChatWindow />
      </main>
    );
  }

  const session = await getServerSession(authOptions);
  const role = session?.user?.role as UserRole | undefined;
  if (!role || role !== 'ELEVE') {
    return (
      <main className="container mx-auto p-8">
        <h1 className="text-2xl font-semibold">Accès non autorisé</h1>
        <p className="mt-2">Cette page est réservée aux élèves.</p>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col items-center text-center mb-8">
        <h1 className="text-4xl font-bold text-bleu-primaire font-poppins">
          Assistant Pédagogique ARIA
        </h1>
        <p className="mt-2 text-lg text-gray-600">
          Votre partenaire de réussite, disponible 24/7.
        </p>
      </div>
      <ChatWindow />
    </main>
  );
}
