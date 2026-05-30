import fs from "fs";
import path from "path";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("EAM canonical route integration", () => {
  it("keeps /dashboard/eleve/eam as the only student EAM dashboard route", () => {
    expect(fs.existsSync(path.join(root, "app/dashboard/eleve/eam/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "app/dashboard/eleve/eam-premiere/page.tsx"))).toBe(false);
  });

  it("routes dashboard entry points to the canonical EAM dashboard", () => {
    const studentDashboard = read("app/dashboard/eleve/page.tsx");
    const cockpitSummary = read("components/dashboard/eleve/EAMCockpitSummary.tsx");

    expect(studentDashboard).toContain('href="/dashboard/eleve/eam"');
    expect(cockpitSummary).toContain('href="/dashboard/eleve/eam"');
    expect(studentDashboard).not.toContain("/dashboard/eleve/eam-premiere");
    expect(cockpitSummary).not.toContain("/dashboard/eleve/eam-premiere");
  });

  it("integrates sprint and booklet in the existing EAM orchestrator", () => {
    const source = read("components/EAMPrep/index.tsx");

    expect(source).toContain("Stage Commando");
    expect(source).toContain("Livret");
    expect(source).toContain("StagePanel");
    expect(source).not.toContain("EamPremiereDashboard");
  });
});
