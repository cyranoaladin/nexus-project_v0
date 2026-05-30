import { render, screen } from "@testing-library/react";

import { EamPremiereLivret } from "@/components/eam-premiere-generale/EamPremiereLivret";

describe("EAM Premiere generale livret", () => {
  it("renders the printable student booklet sections", () => {
    render(<EamPremiereLivret />);

    for (const section of [
      "Objectif de l'épreuve",
      "Les points à sécuriser",
      "Planning des 10h",
      "Automatismes indispensables",
      "Fonctions et dérivation",
      "Suites et évolutions",
      "Probabilités et variables aléatoires",
      "Méthode sujet blanc",
      "Erreurs fréquentes",
      "Week-end final",
      "Checklist veille d'épreuve",
    ]) {
      expect(screen.getByText(section)).toBeInTheDocument();
    }
  });

  it("keeps the booklet printable and independent from account provisioning", () => {
    const { container } = render(<EamPremiereLivret />);
    const html = container.textContent?.toLowerCase() ?? "";

    expect(container.querySelector(".printable-eam-livret")).toBeTruthy();
    expect(html).not.toContain("prisma");
    expect(html).not.toContain("redis");
    expect(html).not.toContain("upstash");
    expect(html).not.toContain(["st", "mg"].join(""));
  });
});
