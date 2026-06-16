import fs from 'node:fs';
import path from 'node:path';

import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Nexus Réussite — Accompagnement Bac français, candidats libres et double cursus',
  description:
    "Nexus Réussite accompagne les élèves de Première et Terminale comme un établissement d’accompagnement : carte d’examen, bacs blancs, bulletins, référent, Masterium et suivi parents.",
  keywords:
    "Nexus Réussite, Bac français, candidats libres, double cursus, Première, Terminale, carte d’examen, bacs blancs, Masterium, suivi parents, Tunis",
  openGraph: {
    title: 'Nexus Réussite — Accompagnement Bac français, candidats libres et double cursus',
    description:
      "Un parcours complet jusqu’au bac : carte d’examen, groupes réduits selon format, bacs blancs, bulletins, référent pédagogique, Masterium et suivi parents.",
    type: 'website',
    url: 'https://nexusreussite.academy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexus Réussite — Accompagnement Bac français, candidats libres et double cursus',
    description:
      "Pas seulement des cours : un cadre, une méthode et un suivi humain pour piloter la trajectoire jusqu’au bac.",
  },
};

const homepageSourcePath = path.join(process.cwd(), 'Nexus_Reussite_Accueil.html');

function getHomepageSource() {
  const html = fs.readFileSync(homepageSourcePath, 'utf8');
  const style = html.match(/<style>([\s\S]*?)<\/style>/i)?.[1] ?? '';
  const body = html.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? '';
  const script = body.match(/<script>([\s\S]*?)<\/script>/i)?.[1] ?? '';
  const bodyWithoutScript = body.replace(/<script>[\s\S]*?<\/script>/i, '');

  return {
    style,
    script,
    body: bodyWithoutScript,
  };
}

export default function HomePage() {
  const source = getHomepageSource();

  return (
    <>
      <link rel="stylesheet" href="/styles/nexus-tokens.css" />
      <style dangerouslySetInnerHTML={{ __html: source.style }} />
      <div dangerouslySetInnerHTML={{ __html: source.body }} />
      <Script
        id="nexus-homepage-interactions"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: source.script }}
      />
    </>
  );
}
