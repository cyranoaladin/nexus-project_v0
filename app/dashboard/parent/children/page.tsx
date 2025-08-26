export default function ParentChildrenPage() {
  const children = [
    { id: 's1', name: 'Marie Dupont', grade: 'Terminale', subjects: ['Maths', 'Physique'] },
    { id: 's2', name: 'Lucas Dupont', grade: 'Première', subjects: ['NSI'] },
  ];
  return (
    <div className="max-w-5xl mx-auto px-4 py-6" data-testid="parent-children">
      <h1 className="text-2xl font-semibold mb-4">Gestion des Enfants</h1>
      <div className="border rounded-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Nom</th>
              <th className="text-left p-2">Niveau</th>
              <th className="text-left p-2">Matières ARIA</th>
            </tr>
          </thead>
          <tbody>
            {children.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2">{c.name}</td>
                <td className="p-2">{c.grade}</td>
                <td className="p-2">{c.subjects.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
