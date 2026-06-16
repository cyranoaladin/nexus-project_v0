import StudentDashboard from "@/components/lamis/LamisStudentApp";

export const metadata = {
  title: "Mission Lamis - Objectif Bac Maths STMG | Nexus Réussite",
  description: "Interface interactive de préparation à l’épreuve anticipée de mathématiques Première STMG.",
};

export default function LamisPage() {
  return <StudentDashboard />;
}
