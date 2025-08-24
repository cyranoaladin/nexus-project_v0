
export default function ParentPaiementPage() {
  const invoices = [
    { id: 'inv-001', date: '2025-08-01', amount: 120, status: 'PAYÉ' },
    { id: 'inv-002', date: '2025-09-01', amount: 120, status: 'EN ATTENTE' },
  ];
  return (
    <div className="max-w-4xl mx-auto px-4 py-6" data-testid="parent-payments">
      <h1 className="text-2xl font-semibold mb-4">Paiements</h1>
      <div className="border rounded-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Facture</th>
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Montant (TND)</th>
              <th className="text-left p-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(i => (
              <tr key={i.id} className="border-t">
                <td className="p-2">{i.id}</td>
                <td className="p-2">{i.date}</td>
                <td className="p-2">{i.amount.toFixed(2)}</td>
                <td className="p-2">{i.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
