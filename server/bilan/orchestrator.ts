import fs from "fs";
import path from "path";
import cp from "child_process";
import Mustache from "mustache";
import { z } from "zod";
import { BilanOutSchema } from "./schema";
import { buildMessages } from "../openai/promptBuilders";
import { openai } from "../openai/client";
import { QcmSummary, StudentMeta, Variant, Volet2Summary } from "packages/shared/types/bilan";

export async function generateBilan(opts: {
    variant: Variant;
    student: StudentMeta;
    qcm: QcmSummary;
    volet2: Volet2Summary;
}) {
  const client = openai();
  const messages = buildMessages({ ...opts, outSchema: BilanOutSchema });
  
  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: messages as any,
    response_format: { type: "json_object" },
  });

  const raw = resp.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);
  const out = BilanOutSchema.parse(parsed);
  return out;
}

export function renderLatex(view: any) {
  const tmplPath = path.resolve(process.cwd(), "server/bilan/latex-template.mustache.tex");
  const tmpl = fs.readFileSync(tmplPath, "utf8");
  return Mustache.render(tmpl, view);
}

export function compileLatex(texContent: string, outDir: string, outFile = "bilan.tex"): string {
  fs.mkdirSync(outDir, { recursive: true });
  const texPath = path.join(outDir, outFile);
  fs.writeFileSync(texPath, texContent, "utf8");
  
  // S'assure que le logo est disponible pour la compilation
  const logoSrc = path.resolve(process.cwd(), "public/images/logo_nexus_reussite.png");
  if (fs.existsSync(logoSrc)) {
    fs.copyFileSync(logoSrc, path.join(outDir, "logo_nexus.pdf"));
  } else {
    console.warn("Logo not found at", logoSrc);
  }

  const cmd = `${process.env.TEXBIN || "latexmk"} -xelatex -interaction=nonstopmode -shell-escape ${outFile}`;
  
  try {
    cp.execSync(cmd, { cwd: outDir, stdio: "inherit" });
  } catch (error) {
    console.error("LaTeX compilation failed.");
    console.error(`Command: ${cmd}`);
    console.error(`Directory: ${outDir}`);
    // Tenter de lire le fichier de log LaTeX pour un meilleur débogage
    const logFile = path.join(outDir, outFile.replace(/\.tex$/, ".log"));
    if (fs.existsSync(logFile)) {
      const logContent = fs.readFileSync(logFile, "utf8");
      console.error("--- LaTeX Log ---");
      console.error(logContent);
    }
    throw new Error("LaTeX compilation failed.");
  }

  return path.join(outDir, outFile.replace(/\.tex$/, ".pdf"));
}
