"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WHITE_EXAM_SLOTS, type WhiteExamSlot } from "../_data/whiteExams";
import { toast } from "sonner";

interface Props {
  level: "premiere" | "terminale";
}

export default function WhiteExamsSidebar({ level }: Props) {
  const slots = WHITE_EXAM_SLOTS[level];
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="sticky top-28 overflow-hidden rounded-3xl border border-white/10 bg-[#111826]">
      <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-5">
        <h3 className="flex items-center gap-2 text-base font-bold text-white">
          Créneaux blancs clés
        </h3>
        <p className="mt-1 text-sm text-blue-100">
          {level === "premiere" ? "Première" : "Terminale"}
        </p>
      </div>
      <div className="space-y-3 p-4">
        {slots.map((slot, i) => (
          <motion.div
            key={slot.title}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`group cursor-pointer rounded-2xl border p-4 transition-all duration-300 hover:shadow-lg ${
              selected === slot.title
                ? "border-white/20 bg-white/[0.06]"
                : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
            }`}
            onClick={() =>
              setSelected(selected === slot.title ? null : slot.title)
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={`text-sm font-semibold bg-gradient-to-r ${slot.colorClass} bg-clip-text text-transparent`}>
                  {slot.title}
                </div>
                <div className="mt-1 text-sm text-slate-300">{slot.date}</div>
                <div className="mt-1 text-sm font-medium text-white">{slot.time}</div>
              </div>
              <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-slate-300">
                {slot.type}
              </span>
            </div>
            <AnimatePresence>
              {selected === slot.title && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 border-t border-white/10 pt-3"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.info("Inscription à l'épreuve blanche enregistrée");
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white transition hover:bg-white/[0.08]"
                  >
                    S&apos;inscrire à cette épreuve
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
