'use client';

import { Activity } from 'lucide-react';

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  time: string;
  status: string;
  studentName: string;
  coachName: string;
  subject: string;
  action: string;
}

export default function AdminActivitiesPage() {
  const items: Activity[] = [
    {
      id: '1',
      type: 'SESSION',
      title: 'Session programmée',
      description: 'Marie avec Helios',
      time: 'Il y a 2h',
      status: 'PLANNED',
      studentName: 'Marie Dupont',
      coachName: 'Helios',
      subject: 'Maths',
      action: 'Planification',
    },
    {
      id: '2',
      type: 'ARIA',
      title: 'Réponse ARIA',
      description: 'Fiche PDF générée',
      time: 'Il y a 4h',
      status: 'DONE',
      studentName: 'Marie Dupont',
      coachName: 'ARIA',
      subject: 'Maths',
      action: 'PDF',
    },
  ];
  return (
    <div className="max-w-5xl mx-auto px-4 py-6" data-testid="admin-activities">
      <h1 className="text-2xl font-semibold mb-4">Activités du Système</h1>
      <div className="border rounded-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Titre</th>
              <th className="text-left p-2">Élève</th>
              <th className="text-left p-2">Coach</th>
              <th className="text-left p-2">Sujet</th>
              <th className="text-left p-2">Heure</th>
              <th className="text-left p-2">Statut</th>
              <th className="text-left p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-2">{a.type}</td>
                <td className="p-2">{a.title}</td>
                <td className="p-2">{a.studentName}</td>
                <td className="p-2">{a.coachName}</td>
                <td className="p-2">{a.subject}</td>
                <td className="p-2">{a.time}</td>
                <td className="p-2">{a.status}</td>
                <td className="p-2">{a.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
