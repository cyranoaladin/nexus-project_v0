
export default function EleveMesSessionsPage() {
  const sessions = [
    { id: 'sess-1', date: '2025-08-10 18:00', coach: 'Helios', subject: 'Maths', status: 'PLANIFIÉE' },
    { id: 'sess-2', date: '2025-08-15 17:00', coach: 'Zenon', subject: 'Philosophie', status: 'TERMINÉE' },
  ];
  return (
    <div className="max-w-5xl mx-auto px-4 py-6" data-testid="eleve-sessions">
      <h1 className="text-2xl font-semibold mb-4">Mes Sessions</h1>
      <div className="border rounded-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Coach</th>
              <th className="text-left p-2">Matière</th>
              <th className="text-left p-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id} className="border-t">
                <td className="p-2">{s.date}</td>
                <td className="p-2">{s.coach}</td>
                <td className="p-2">{s.subject}</td>
                <td className="p-2">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
