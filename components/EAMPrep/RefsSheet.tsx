import { MODULES } from "./data";
import { MathFormula } from "./MathFormula";

const antiBlindSpots = [
  "Factoriser avant de calculer : les nombres du sujet sans calculatrice sont conçus pour tomber juste.",
  "L'exponentielle est toujours strictement positive : le signe vient du facteur restant.",
  "Cercle : revenir à la forme centrée, puis développer ou compléter le carré.",
  "Probabilités : multiplier sur les branches, additionner les chemins.",
  "Tangente horizontale : penser immédiatement à une dérivée nulle.",
];

export function RefsSheet() {
  return (
    <div className="w-full min-w-0 max-w-full space-y-5 overflow-hidden">
      <section className="min-w-0 overflow-hidden rounded-xl border border-amber-400/20 bg-amber-500/10 p-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-amber-200">Anti-angle mort - 5 réflexes</h3>
        <div className="mt-3 grid min-w-0 gap-2 md:grid-cols-2">
          {antiBlindSpots.map((item, index) => (
            <div key={item} className="min-w-0 break-words rounded-lg bg-surface-darker/60 p-3 text-sm leading-relaxed text-neutral-100">
              <strong className="text-amber-200">R{index + 1}.</strong> {item}
            </div>
          ))}
        </div>
      </section>

      {MODULES.map((module) => (
        <section key={module.id} className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-surface-card p-4" style={{ borderLeftColor: module.color, borderLeftWidth: 4 }}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-xl" style={{ color: module.color }}>{module.icon}</span>
            <div className="min-w-0">
              <h3 className="break-words font-black text-white">{module.title}</h3>
              <p className="break-words text-xs text-neutral-400">{module.subtitle}</p>
            </div>
          </div>
          <div className="mt-4 grid min-w-0 gap-2 md:grid-cols-2">
            {module.formules.map((formula) => (
              <div key={formula.title} className="min-w-0 overflow-hidden rounded-lg bg-white/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: module.color }}>{formula.title}</p>
                <div className="mt-2 max-w-full overflow-x-auto rounded-lg bg-surface-darker/70 px-2 py-3 text-neutral-100">
                  <MathFormula value={formula.content} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Méthodes express</p>
            <ul className="mt-2 space-y-1">
              {module.methodes.slice(0, 3).map((method) => (
                <li key={method} className="border-l border-white/10 pl-3 text-xs leading-relaxed text-neutral-300">{method}</li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
