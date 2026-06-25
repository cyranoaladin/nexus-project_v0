import Link from "next/link";
import {
  BookOpen,
  Bot,
  CheckCircle2,
  Crown,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { getRules } from "@/lib/pricing";

export default function FamillePage() {
  const rules = getRules();
  const groupMax = rules.group_max;
  const lyceeMin = rules.group_min_open.lycee;
  const collegeMin = rules.group_min_open.college;

  const engagementCards = [
    {
      icon: Users,
      title: "Groupes réduits",
      text: `${groupMax} élèves maximum, avec ouverture dès ${lyceeMin} inscrits au lycée et ${collegeMin} au Brevet.`,
    },
    {
      icon: ShieldCheck,
      title: "Cadre contractuel clair",
      text: "Si un groupe n'atteint pas le seuil d'ouverture, l'acompte correspondant est remboursé.",
    },
    {
      icon: BookOpen,
      title: "Méthode et suivi",
      text: "Diagnostic, entraînements, corrections sur attendus officiels et bilans réguliers pour ajuster le travail.",
    },
  ];

  const frameworkItems = [
    "Enseignants qualifiés et profils pédagogiques documentés",
    `Groupes de ${groupMax} maximum avec suivi individualisé`,
    "Corrections appuyées sur les attendus des épreuves",
    "Bilans réguliers et visibilité parent",
    "Plateforme ARIA selon la formule choisie",
    "Orientation vers un parcours adapté après diagnostic",
  ];

  return (
    <div className="min-h-screen bg-lux-ink font-dm-sans">
      <CorporateNavbar />

      <main id="main-content">
        <section className="relative overflow-hidden py-24 bg-lux-ink">
          <div className="absolute inset-0 bg-gradient-to-b from-lux-ink via-lux-ink/70 to-lux-ink" />
          <div className="absolute -top-24 right-10 h-72 w-72 rounded-full bg-lux-gold/10 blur-[140px]" />
          <div className="absolute bottom-0 left-10 h-72 w-72 rounded-full bg-neutral-800/30 blur-[140px]" />

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="max-w-4xl">
              <p className="inline-flex items-center rounded-full border border-lux-gold/40 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-lux-gold">
                Accompagnement scolaire
              </p>
              <h1 className="mt-6 text-4xl md:text-5xl font-fraunces font-light text-lux-ivory">
                Un cadre clair pour préparer le Bac et Parcoursup.
              </h1>
              <p className="mt-6 max-w-2xl text-base text-lux-on-dark-muted">
                Nexus Réussite accompagne les familles avec une méthode structurée,
                des groupes réduits, des corrections sur grilles officielles et un
                suivi parent régulier.
              </p>

              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {[
                  {
                    label: "Terminale",
                    text: "Structurer les spécialités, le Grand Oral et Parcoursup",
                  },
                  {
                    label: "Première",
                    text: "Préparer l'EAF, les spécialités et la méthode",
                  },
                  {
                    label: "Seconde",
                    text: "Consolider les bases et clarifier l'orientation",
                  },
                ].map((item) => (
                  <a
                    key={item.label}
                    href="#offres"
                    className="rounded-2xl border border-lux-line/40 bg-white/5 p-5 text-left backdrop-blur-md transition hover:border-lux-gold/50 hover:bg-white/10"
                  >
                    <div className="text-lux-gold text-sm font-semibold uppercase tracking-wider">
                      {item.label}
                    </div>
                    <div className="mt-2 text-lux-ivory font-semibold">{item.text}</div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-lux-ink py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-2xl md:text-3xl font-fraunces font-light text-lux-ivory text-center">
              Le soutien scolaire a évolué. Votre exigence aussi.
            </h2>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-lux-line/40 bg-white/5 p-6">
                <h3 className="text-xl font-semibold text-lux-ivory">Un suivi trop souvent opaque</h3>
                <ul className="mt-4 space-y-2 text-lux-on-dark-muted">
                  <li>• Peu de visibilité parent entre deux séances.</li>
                  <li>• Des exercices sans plan de progression clair.</li>
                  <li>• Des priorités qui changent sans diagnostic partagé.</li>
                </ul>
              </div>
              <div className="rounded-3xl border border-lux-gold/30 bg-white/5 p-6">
                <h3 className="text-xl font-semibold text-lux-ivory">Le cadre Nexus</h3>
                <ul className="mt-4 space-y-2 text-lux-on-dark-muted">
                  <li>• Diagnostic initial et priorités explicites.</li>
                  <li>• Groupes réduits et corrections régulières.</li>
                  <li>• Bilans parent pour suivre les ajustements pédagogiques.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="offres" className="bg-lux-ink py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-2xl md:text-3xl font-fraunces font-light text-lux-ivory text-center">
              Des parcours adaptés à chaque besoin.
            </h2>

            <div className="mt-10 rounded-3xl border border-lux-gold/40 bg-white/5 p-8 backdrop-blur-md">
              <div className="flex items-center gap-3 text-lux-gold text-sm font-semibold uppercase">
                <Crown className="h-5 w-5" />
                Parcours annuel
              </div>
              <h3 className="mt-4 text-2xl md:text-3xl font-fraunces font-light text-lux-ivory">
                Accompagnement structuré Nexus
              </h3>
              <p className="mt-3 text-lux-on-dark-muted">
                Un parcours annuel pour organiser le travail, suivre les progrès et préparer les échéances.
              </p>
              <div className="mt-6 grid gap-3 md:grid-cols-2 text-lux-on-dark-muted text-sm">
                <div>• Suivi parent régulier</div>
                <div>• ARIA selon formule</div>
                <div>• Présentiel, distanciel ou mixte selon parcours</div>
                <div>• Bilans réguliers</div>
              </div>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-lux-line/40 bg-white/5 p-6 backdrop-blur-md">
                <div className="flex items-center gap-2 text-lux-gold">
                  <GraduationCap className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">
                    Stages intensifs
                  </span>
                </div>
                <p className="mt-4 text-lux-ivory font-semibold">
                  Travailler une période courte avec un objectif précis
                </p>
                <p className="mt-2 text-sm text-lux-on-dark-muted">
                  Modules vacances, entraînements et corrections selon le niveau.
                </p>
              </div>
              <div className="rounded-3xl border border-lux-line/40 bg-white/5 p-6 backdrop-blur-md">
                <div className="flex items-center gap-2 text-lux-gold">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">
                    Modules ciblés
                  </span>
                </div>
                <p className="mt-4 text-lux-ivory font-semibold">EAF, Grand Oral, coaching ou méthode</p>
                <p className="mt-2 text-sm text-lux-on-dark-muted">
                  Sessions ciblées lorsque le diagnostic fait apparaître un besoin ponctuel.
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-lux-line/40 bg-lux-ink/40 p-6 text-center">
              <div className="text-lux-gold text-sm font-semibold uppercase tracking-wider">
                Plateforme ARIA
              </div>
              <p className="mt-2 text-lux-ivory font-semibold">
                Un assistant pédagogique complémentaire
              </p>
              <p className="text-lux-on-dark-muted text-sm">
                Ressources et exercices selon la formule retenue.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-lux-ink py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-2xl md:text-3xl font-fraunces font-light text-lux-ivory text-center">
              Nos engagements.
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {engagementCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="rounded-3xl border border-lux-gold/40 bg-white/5 p-6 text-center backdrop-blur-md"
                  >
                    <Icon className="mx-auto h-8 w-8 text-lux-gold" />
                    <h3 className="mt-4 text-xl font-semibold text-lux-ivory">{card.title}</h3>
                    <p className="mt-2 text-lux-on-dark-muted">{card.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-lux-ink py-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-fraunces font-light text-lux-ivory">
                Un cadre exigeant
              </h2>
              <p className="mt-3 text-lux-on-dark-muted">
                Des preuves de méthode plutôt que des promesses de résultat.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {frameworkItems.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-lux-line/40 bg-white/5 p-5"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-lux-gold" aria-hidden="true" />
                  <span className="text-sm leading-6 text-lux-on-dark-muted">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link href="/equipe" className="inline-flex items-center justify-center rounded-lg border-[1.5px] border-lux-ivory/60 bg-transparent px-6 py-3 text-sm font-semibold text-lux-ivory hover:bg-lux-ivory hover:text-lux-ink transition-all min-h-[44px]">
                Découvrir l'équipe pédagogique
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4 md:px-6">
            <div className="rounded-3xl border border-lux-line/40 bg-white/5 p-8 md:p-10">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-lux-gold">
                    Prochaine étape
                  </p>
                  <h2 className="mt-2 text-2xl md:text-3xl font-fraunces font-light text-lux-ivory">
                    Obtenir un diagnostic personnalisé
                  </h2>
                  <p className="mt-3 text-base text-lux-on-dark-muted">
                    Un bilan gratuit pour poser un plan clair, sans engagement.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/bilan-gratuit" className="lux-cta-reserve rounded-lg px-8 py-3.5 text-sm font-semibold">
                    Démarrer un bilan gratuit
                  </Link>
                  <Link href="/contact" className="inline-flex items-center justify-center rounded-lg border-[1.5px] border-lux-ivory/60 bg-transparent px-6 py-3 text-sm font-semibold text-lux-ivory hover:bg-lux-ivory hover:text-lux-ink transition-all min-h-[44px]">
                    Parler à un conseiller
                  </Link>
                </div>
              </div>
              <div className="mt-6 flex items-center gap-3 text-lux-on-dark-muted">
                <Bot className="h-5 w-5 text-lux-gold" />
                <span>
                  Le bilan permet d'identifier les priorités et de recommander un format adapté.
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <CorporateFooter />
    </div>
  );
}
