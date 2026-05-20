"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { track } from "@/lib/analytics";
import { WHATSAPP_URL } from "@/components/sections/homepage/content";

export default function MobileStickyWhatsApp() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // Show after scrolling past the hero (~500px)
      setVisible(window.scrollY > 500);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track.ctaClick("mobile_sticky", WHATSAPP_URL)}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 z-50 flex items-center justify-center gap-2 rounded-2xl border border-[#0f3d73] bg-[#0f3d73] px-6 py-3.5 text-sm font-display font-bold text-white shadow-lg shadow-[#0f3d73]/25 transition-all duration-200 active:scale-[0.98] lg:hidden"
      aria-label="Contacter Nexus Réussite sur WhatsApp"
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      WhatsApp · Être conseillé
    </a>
  );
}
