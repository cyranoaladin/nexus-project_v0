"use client";

import { useEffect, useState } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";

import { WHATSAPP_URL } from "../_lib/constants";

type StickyMobileCTAProps = {
  onReserve: () => void;
};

export default function StickyMobileCTA({ onReserve }: StickyMobileCTAProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 320);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0f172acc] backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <div className="mx-auto flex max-w-7xl gap-2 px-4 pt-3">
        <button
          type="button"
          onClick={onReserve}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-nexus-green to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-green/50"
          aria-label="Réserver ma place"
        >
          Réserver ma place
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-green/50"
          aria-label="Nous contacter sur WhatsApp"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          WhatsApp
        </a>
      </div>
    </div>
  );
}
