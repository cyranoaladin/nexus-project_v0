"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EAF_URL, STAGES_URL } from "@/components/sections/homepage/content";

const MOBILE_BREAKPOINT = 640;
const BANNER_OFFSET = "40px";

export default function PromoBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileIndex, setMobileIndex] = useState(0);

  useEffect(() => {
    const syncViewport = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    if (!isVisible) {
      document.documentElement.style.setProperty("--promo-banner-offset", "0px");
      return;
    }

    document.documentElement.style.setProperty("--promo-banner-offset", BANNER_OFFSET);
    return () => {
      document.documentElement.style.setProperty("--promo-banner-offset", "0px");
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !isMobile) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setMobileIndex((current) => (current + 1) % 2);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [isMobile, isVisible]);

  const mobileSlides = useMemo(
    () => [
      {
        copy: "🌿 Stages Printemps — 18 avr au 2 mai",
        cta: "Réserver →",
        href: STAGES_URL,
        external: false,
      },
      {
        copy: "📖 Plateforme EAF — Bac Français avec l'IA",
        cta: "Essayer →",
        href: EAF_URL,
        external: true,
      },
    ],
    []
  );

  if (!isVisible) {
    return null;
  }

  const activeSlide = mobileSlides[mobileIndex];

  return (
    <div className="relative z-[60] border-b border-nexus-green/15 bg-gradient-to-r from-nexus-bg-alt via-surface-darker to-nexus-bg-alt text-white animate-in slide-in-from-top-2 duration-300">
      <div className="mx-auto flex min-h-10 max-w-7xl items-center justify-center px-4 py-2 text-xs font-body sm:px-6 sm:text-sm">
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          aria-label="Fermer le bandeau"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 p-1 text-neutral-300 transition-colors hover:border-white/20 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {isMobile ? (
          <div className="flex w-full items-center justify-center pr-8">
            <div
              key={mobileIndex}
              className="flex items-center gap-2 text-center font-body text-xs text-neutral-100 transition-all duration-500"
            >
              <span>{activeSlide.copy}</span>
              {activeSlide.external ? (
                <a
                  href={activeSlide.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-display font-bold text-white underline-offset-4 hover:text-nexus-purple hover:underline"
                >
                  {activeSlide.cta}
                </a>
              ) : (
                <Link
                  href={activeSlide.href}
                  className="font-display font-bold text-white underline-offset-4 hover:text-nexus-green hover:underline"
                >
                  {activeSlide.cta}
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-3 pr-8 text-center text-neutral-200">
            <span>🌿 Stages Printemps (18 avr – 2 mai) : places limitées à 6</span>
            <Link href={STAGES_URL} className="font-display font-bold text-white hover:text-nexus-green">
              Réserver →
            </Link>
            <span className="text-white/25">|</span>
            <span>📖 Plateforme EAF : prépare ton Bac Français avec l'IA</span>
            <a
              href={EAF_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn("font-display font-bold text-white hover:text-nexus-purple")}
            >
              Essayer gratuitement →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
