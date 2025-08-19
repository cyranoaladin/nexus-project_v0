"use client";

import { Activity } from "lucide-react";

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
  return (
    <div>
      <h1>Activités du Système</h1>
      <p>Cette page est en cours de construction.</p>
    </div>
  );
}
