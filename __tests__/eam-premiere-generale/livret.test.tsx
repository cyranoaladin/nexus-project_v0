import { render, screen } from "@testing-library/react";

import { Livret } from "@/components/EAMPrep/Livret";

describe("EAM canonical printable booklet", () => {
  it("renders the printable student booklet sections from shared EAM data", () => {
    render(<Livret />);

    for (const section of [
      "Planning des 10h",
      "Protocole week-end",
      "Fiches méthodes par module",
      "Automatismes indispensables",
      "Checklist finale",
    ]) {
      expect(screen.getByText(section)).toBeInTheDocument();
    }
  });

  it("keeps the booklet independent from account provisioning and security workstreams", () => {
    const { container } = render(<Livret />);
    const html = container.textContent?.toLowerCase() ?? "";

    expect(container.querySelector(".printable-eam-livret")).toBeTruthy();
    expect(html).not.toContain("prisma");
    expect(html).not.toContain("redis");
    expect(html).not.toContain("upstash");
    expect(html).not.toContain(["st", "mg"].join(""));
  });
});
