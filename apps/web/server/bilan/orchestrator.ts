import cp from 'child_process';
import fs from 'fs';
import Mustache from 'mustache';
import path from 'path';
import { openai } from '../openai/client';
import { selectModel, getFallbackModel } from '../openai/select';
import { buildMessages } from '../openai/promptBuilders';
import { BilanOutSchema } from './schema';

export async function generateBilan({ variant, student, qcm, volet2, traceUserId }: any) {
  if (process.env.TEST_PDF_FAKE === '1' && process.env.ARIA_LIVE !== '1') {
    const dummy = {
      intro_text: 'Intro test',
      diagnostic_text: 'Diagnostic test',
      profile_text: 'Profil test',
      roadmap_text: 'Feuille de route test',
      offers_text: 'Offres test',
      conclusion_text: 'Conclusion test',
      table_domain_rows: [
        { domain: 'Algèbre', points: 8, max: 10, masteryPct: 80, remark: 'OK' },
        { domain: 'Analyse', points: 7, max: 10, masteryPct: 70 },
      ],
    };
    return BilanOutSchema.parse(dummy);
  }
  const client = openai();
  const messages = buildMessages({ variant, student, qcm, volet2, outSchema: BilanOutSchema });
  let resp: any;
  const primaryModel = selectModel();
  const fallbackModel = getFallbackModel();
  try {
    resp = await client.chat.completions.create({
      model: primaryModel,
      temperature: 0.3,
      messages: messages as any,
      user: traceUserId ? `student:${traceUserId}` : undefined,
    });
  } catch (err) {
    if (fallbackModel) {
      console.warn(`[BILAN][OpenAI] Primary model failed (${primaryModel}). Retrying with fallback: ${fallbackModel}`);
      resp = await client.chat.completions.create({
        model: fallbackModel,
        temperature: 0.3,
        messages: messages as any,
        user: traceUserId ? `student:${traceUserId}` : undefined,
      });
    } else {
      throw err;
    }
  }
  const raw = resp.choices[0]?.message?.content || '{}';
  const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] || '{}';
  const parsed = JSON.parse(jsonText);
  const out = BilanOutSchema.parse(parsed);
  return out;
}

export function renderLatex(view: any) {
  const tmplPath = path.resolve(process.cwd(), 'apps/web/server/bilan/latex-template.mustache.tex');
  const tmpl = fs.readFileSync(tmplPath, 'utf8');
  return Mustache.render(tmpl, view);
}

export function compileLatex(texContent: string, outDir: string, outFile = 'bilan.tex') {
  fs.mkdirSync(outDir, { recursive: true });
  const texPath = path.join(outDir, outFile);
  fs.writeFileSync(texPath, texContent, 'utf8');
  const cmd = `${process.env.TEXBIN || 'latexmk'} -xelatex -interaction=nonstopmode -shell-escape ${outFile}`;
  cp.execSync(cmd, { cwd: outDir, stdio: 'inherit' });
  return path.join(outDir, outFile.replace(/\.tex$/, '.pdf'));
}
