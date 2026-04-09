import { CheckCircle2, GraduationCap } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-r from-slate-900 to-slate-800">
      <div className="text-center text-white">
        <h1 className="text-4xl font-bold mb-4">
          <span className="inline-flex items-center gap-3"><GraduationCap className="h-10 w-10" aria-hidden="true" />Nexus Réussite Academy</span>
        </h1>
        <p className="text-xl mb-8">
          Plateforme éducative de référence
        </p>
        <div className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-lg p-6">
          <p className="text-lg">
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-300" aria-hidden="true" />Application déployée avec succès</span>
          </p>
          <p className="text-sm mt-2">
            Version de production opérationnelle
          </p>
        </div>
      </div>
    </main>
  );
}
