import { BookOpenText, Bot, Handshake, Users } from "lucide-react";

export default function ADN() {
  const items = [
    { icon: Users, label: "Coachs agrégés & certifiés" },
    { icon: Bot, label: "IA ARIA (tuteur 24/7)" },
    { icon: BookOpenText, label: "Programmes officiels français" },
    { icon: Handshake, label: "Suivi famille & transparence" },
  ];
  return (
    <section className="py-10">
      <h2 className="text-xl font-semibold text-gray-900">Notre ADN : pédagogie augmentée</h2>
      <p className="text-gray-600 mt-1">Humain + IA + stratégie, au service de votre réussite.</p>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((it) => (
          <div key={it.label} className="rounded-xl border border-gray-300 bg-white p-4 flex items-center gap-3">
            <it.icon className="w-6 h-6 text-gray-700" />
            <div className="text-sm text-gray-800">{it.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

