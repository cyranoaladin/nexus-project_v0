import { render, screen } from "@testing-library/react";

import { EamPremiereDashboard } from "@/components/eam-premiere-generale/EamPremiereDashboard";

describe("EAM Premiere generale dashboard", () => {
  it("renders the premium sprint cockpit", () => {
    render(<EamPremiereDashboard />);

    expect(screen.getByRole("heading", { name: /Sprint EAM Maths — Première générale/i })).toBeInTheDocument();
    expect(screen.getByText(/Objectif : prêt pour le 8 juin/i)).toBeInTheDocument();
    expect(screen.getByText(/Plan de mission 10h/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Mission du jour/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Baromètre de compétences/i)).toBeInTheDocument();
    expect(screen.getByText(/Banque anti-erreurs/i)).toBeInTheDocument();
    expect(screen.getByText(/Week-end final/i)).toBeInTheDocument();
  });

  it("shows exactly five session cards without duplicated track entries", () => {
    render(<EamPremiereDashboard />);
    const excludedTrack = ["S", "T", "M", "G"].join("");

    expect(screen.getAllByTestId("eam-premiere-session-card")).toHaveLength(5);
    expect(screen.queryByText(new RegExp(excludedTrack, "i"))).not.toBeInTheDocument();
  });
});
