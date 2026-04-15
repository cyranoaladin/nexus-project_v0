export interface WhiteExamSlot {
  title: string;
  date: string;
  time: string;
  subject: string;
  type: string;
  colorClass: string;
}

export const WHITE_EXAM_SLOTS: Record<"premiere" | "terminale", WhiteExamSlot[]> = {
  premiere: [
    { title: "Français écrit blanc", date: "Mardi 28 avril", time: "09h00 – 12h00", subject: "francais", type: "Écrit", colorClass: "from-blue-500 to-indigo-500" },
    { title: "Maths écrit blanc", date: "Mercredi 29 avril", time: "09h00 – 12h00", subject: "maths", type: "Écrit", colorClass: "from-cyan-500 to-blue-500" },
    { title: "Français oral blanc", date: "Jeudi 30 avril", time: "13h30 – 16h30", subject: "francais", type: "Oral", colorClass: "from-indigo-500 to-violet-500" },
  ],
  terminale: [
    { title: "NSI écrit blanc", date: "Mardi 28 avril", time: "09h00 – 12h00", subject: "nsi", type: "Écrit", colorClass: "from-violet-500 to-fuchsia-500" },
    { title: "Physique-Chimie écrit blanc", date: "Mardi 28 avril", time: "09h00 – 12h00", subject: "physique", type: "Écrit", colorClass: "from-pink-500 to-rose-500" },
    { title: "Maths écrit blanc", date: "Mercredi 29 avril", time: "09h00 – 12h00", subject: "maths", type: "Écrit", colorClass: "from-rose-500 to-orange-500" },
    { title: "NSI pratique blanche", date: "Jeudi 30 avril", time: "09h00 – 12h00", subject: "nsi", type: "Pratique", colorClass: "from-emerald-500 to-teal-500" },
    { title: "Ateliers Grand Oral", date: "28 avril / 30 avril / 2 mai", time: "17h00 – 19h00", subject: "grandOral", type: "Atelier", colorClass: "from-amber-500 to-yellow-500" },
  ],
};
