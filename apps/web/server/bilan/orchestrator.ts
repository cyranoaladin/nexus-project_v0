import cp from 'child_process';
import fs from 'fs';
import Mustache from 'mustache';
import path from 'path';
import { openai } from '../openai/client';
import { buildMessages } from '../openai/promptBuilders';
import { BilanOutSchema } from './schema';

export async function generateBilan({ variant, student, qcm, volet2, traceUserId }: any) {
  const client = openai();
  const messages = buildMessages({ variant, student, qcm, volet2, outSchema: BilanOutSchema });
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.3,
    messages: messages as any,
    user: traceUserId ? `student:${traceUserId}` : undefined,
  });
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
