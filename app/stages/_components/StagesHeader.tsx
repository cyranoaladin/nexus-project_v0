import CountdownChip from "./CountdownChip";
import CTAButton from "./CTAButton";
import { TARGET_DATES } from "../_lib/constants";

export default function StagesHeader() {
  return (
    <div
      className="sticky z-30 border-b border-white/8 bg-nexus-bg/85 backdrop-blur-xl"
      style={{ top: "calc(var(--promo-banner-offset, 0px) + 72px)" }}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-sm font-bold uppercase tracking-[0.18em] text-white">
            NEXUS <span className="font-light text-white/72">RÉUSSITE</span>
          </span>
          <CountdownChip
            targetDate={TARGET_DATES.pratique_nsi.toISOString()}
            label="NSI Pratique"
            tone="red"
          />
          <CountdownChip
            targetDate={TARGET_DATES.bac_ecrit.toISOString()}
            label="Bac Écrit"
            tone="green"
          />
        </div>

        <CTAButton href="#reservation" className="w-full lg:w-auto">
          Réserver
        </CTAButton>
      </div>
    </div>
  );
}
