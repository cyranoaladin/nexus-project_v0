import cp from "child_process";
import fs from "fs";
import path from "path";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - types fournis via @types/mustache si installés
import Mustache from "mustache";
import OpenAI from "openai";
import { z } from "zod";

type DomainScore = { domain: string; points: number; max: number; masteryPct: number; note?: string; };

type BilanInput = {
  student: { name: string; level: string; subjects: string; status: string; };
  qcm: { total: number; max: number; scoreGlobalPct: number; weakDomainsCount: number; domains: DomainScore[]; };
  volet2: { indices: Record<string, number>; portraitText: string; badges: string[]; radarPath?: string; };
};

const OutSchema = z.object({
  intro_text: z.string(),
  diagnostic_text: z.string(),
  profile_text: z.string(),
  roadmap_text: z.string(),
  offers_text: z.string(),
  conclusion_text: z.string(),
  table_domain_rows: z.array(z.object({
    domain: z.string(), points: z.number(), max: z.number(), masteryPct: z.number(), remark: z.string().optional()
  }))
});

type BilanOut = z.infer<typeof OutSchema>;

function buildMessages(input: BilanInput): Array<{ role: 'system' | 'user'; content: string; }> {
  const sys = `Tu es ARIA, IA éducative premium. Tu produis un rapport LaTeX professionnel. Réponds en JSON strict.`;
  const user = { student: input.student, qcm: input.qcm, volet2: input.volet2 };
  return [{ role: "system", content: sys }, { role: "user", content: JSON.stringify(user) }];
}

export async function generateBilanContent(apiKey: string, input: BilanInput): Promise<BilanOut> {
  const client = new OpenAI({ apiKey });
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: buildMessages(input) as any,
    temperature: 0.3,
    user: input?.student?.name ? `student:${input.student.name}` : undefined,
  });
  const raw = resp.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}");
  return OutSchema.parse(parsed);
}

export function renderLatex(templatePath: string, outPath: string, input: BilanInput, out: BilanOut) {
  const tmpl = fs.readFileSync(templatePath, "utf8");
  const rows = out.table_domain_rows.map(r => `${r.domain} & ${r.points}/${r.max} & ${r.masteryPct}% & ${r.remark ?? ''} \\\\`).join("\n");
  const view = {
    ...input.student, ...input.qcm, ...out,
    table_domain_rows: rows,
    badges_tex: input.volet2.badges.map(b => `\\badge{${b}}`).join(" "),
    fig_radar_path: input.volet2.radarPath || "radar.png"
  };
  fs.writeFileSync(outPath, Mustache.render(tmpl, view), "utf8");
}

export function compilePdf(outPath: string) {
  const cmd = `latexmk -xelatex -interaction=nonstopmode -shell-escape ${path.basename(outPath)}`;
  cp.execSync(cmd, { cwd: path.dirname(outPath), stdio: "inherit" });
}

// Exemple d'utilisation
(async () => {
  const apiKey = process.env.OPENAI_API_KEY!;
  const input: BilanInput = {
    student: { name: "Alice Dupont", level: "Terminale", subjects: "Spé Maths + NSI", status: "Scolarisée" },
    qcm: { total: 63, max: 86, scoreGlobalPct: 73.3, weakDomainsCount: 1, domains: [] },
    volet2: { indices: { AUTONOMIE: 4.2 }, portraitText: "Profil visuel", badges: ["Autonomie solide"], radarPath: "radar.png" }
  };
  const out = await generateBilanContent(apiKey, input);
  const texPath = path.resolve("out/bilan.tex");
  renderLatex("template/bilan_report.tex", texPath, input, out);
  compilePdf(texPath);
})();
