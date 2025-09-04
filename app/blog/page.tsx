export const dynamic = 'force-static';

const categories = [
  'Bac NSI', 'Maths', 'Physique', 'Méthodologie', 'Parcoursup', 'Témoignages'
];

export default function BlogPage() {
  return (
    <main className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-4">Blog & Ressources</h1>
      <p className="text-slate-700 mb-6">Découvrez nos articles, guides et éclairages d’experts pour optimiser la réussite au Bac et Parcoursup.</p>
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map(c => (
          <span key={c} className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm">{c}</span>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <article key={i} className="rounded-xl border p-4">
            <h2 className="text-lg font-semibold mb-2">Article de fond #{i}</h2>
            <p className="text-sm text-slate-700">Contenu d’amorçage. Remplacez par de véritables billets et catégories. Slugs SEO recommandés.</p>
            <a href="#" className="text-blue-600 text-sm mt-2 inline-block">Lire la suite</a>
          </article>
        ))}
      </div>
    </main>
  );
}
