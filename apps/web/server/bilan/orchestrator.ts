import cp from 'child_process';
import fs from 'fs';
import Mustache from 'mustache';
import path from 'path';
import { openai } from '../openai/client';
import { buildBilanPrompt } from '../openai/promptBuilders';
import { getFallbackModel, selectModel } from '../openai/select';
import { BilanPremiumV1, type BilanPremium } from './schema';

export type GenerateBilanPremiumInput = {
  variant: 'eleve' | 'parent';
  student: { id: string; prenom: string; nom: string; niveau: 'Première' | 'Terminale'; specialites: string[]; objectifs?: string[]; contraintes?: string[]; };
  aria: { resume: string; points_faibles: string[]; };
  notes?: Record<string, any>;
  echeances?: string[];
  rag: { snippets: Array<{ title: string; source: string; page?: string; url?: string; summary: string; }>; };
  traceUserId?: string;
};

export function isE2EStubActive() {
  // Stub strict: seulement si E2E=1 et hors production
  return process.env.NODE_ENV !== 'production' && process.env.E2E === '1';
}

export async function generateBilanPremium(input: GenerateBilanPremiumInput, opts?: { timeoutMs?: number; }): Promise<BilanPremium> {
  // E2E stub: avoid external calls and return a deterministic payload
  if (isE2EStubActive()) {
    const sample = {
      meta: {
        variant: input.variant,
        matiere: 'NSI',
        niveau: 'Terminale',
        statut: 'fr',
        createdAtISO: new Date().toISOString(),
      },
      eleve: { firstName: 'Test', lastName: 'Élève', etab: 'Lycée E2E' },
      academic: {
        globalPercent: 74,
        scoresByDomain: [
          { domain: 'Algorithmes', percent: 68 },
          { domain: 'Python', percent: 72 },
          { domain: 'Programmation Objet', percent: 60 },
          { domain: 'Graphes', percent: 58 },
          { domain: 'BD/SQL', percent: 81 },
          { domain: 'Réseaux', percent: 77 },
          { domain: 'Web', percent: 65 },
        ],
        forces: ['Méthodique', 'Bonne régularité'],
        faiblesses: ['Modélisation de problèmes', 'Graphes avancés'],
        lacunesCritiques: ['Preuves de correction d’algorithmes'],
      },
      pedagogue: { style: 'Visuel', autonomie: 'moyenne', organisation: 'moyenne', stress: 'moyen', flags: [] },
      plan: { horizonMois: 3, hebdoHeures: 2, etapes: ['Consolider Python', 'Revoir graphes: BFS/DFS', 'Exercices de modélisation', 'Évaluer en conditions réelles'] },
      offres: { primary: 'Flex', alternatives: ['Odyssée'], reasoning: 'Progression continue avec RDV hebdo + ARIA.' },
      rag: { citations: [{ title: 'Graphes — parcours', src: 'kb:nsi/graphes', snippet: 'BFS et DFS, complexités O(V+E).' }] },
    } as const;
    return BilanPremiumV1.parse(sample as any);
  }

  const client = openai();
  const { system, user } = buildBilanPrompt({
    student: input.student,
    aria: input.aria,
    notes: input.notes,
    echeances: input.echeances,
    rag: input.rag,
    variant: input.variant,
  });
  const primaryModel = selectModel();
  const fallbackModel = getFallbackModel();
  const timeoutMs = Math.max(0, Number(opts?.timeoutMs ?? (process.env.OPENAI_TIMEOUT_MS || 0)));
  async function run(model: string) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined as any;
    const t = timeoutMs > 0 ? setTimeout(() => controller?.abort?.(), timeoutMs) : null;
    try {
      const r = await (client as any).chat.completions.create({
        model,
        temperature: 0.2,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        user: input.traceUserId ? `student:${input.traceUserId}` : undefined,
        max_tokens: Math.min(Number(process.env.OPENAI_MAX_TOKENS || 800), 800),
      }, controller ? { signal: (controller as any).signal } : undefined);
      return r;
    } finally {
      if (t) clearTimeout(t as any);
    }
  }
  let resp: any;
  try {
    resp = await run(primaryModel);
  } catch (err) {
    if (fallbackModel) {
      resp = await run(fallbackModel);
    } else {
      throw err;
    }
  }
  const raw = resp.choices?.[0]?.message?.content || '{}';
  const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] || '{}';
  const parsed = JSON.parse(jsonText);
  const out = BilanPremiumV1.parse(parsed);
  return out;
}

export function renderLatex(view: any) {
  const tmplPath = path.resolve(process.cwd(), 'apps/web/server/bilan/templates/bilan_report.tex');
  const tmpl = fs.readFileSync(tmplPath, 'utf8');
  return Mustache.render(tmpl, view);
}

export function compileLatex(texContent: string, outDir: string, outFile = 'bilan.tex') {
  fs.mkdirSync(outDir, { recursive: true });
  const texPath = path.join(outDir, outFile);
  fs.writeFileSync(texPath, texContent, 'utf8');
  // Force au moins deux passes pour stabiliser la table des matières et les références
  const cmd = `${process.env.TEXBIN || 'latexmk'} -xelatex -halt-on-error -interaction=nonstopmode -file-line-error ${outFile}`;
  cp.execSync(cmd, { cwd: outDir, stdio: 'inherit' });
  try { cp.execSync(cmd, { cwd: outDir, stdio: 'inherit' }); } catch {}
  return path.join(outDir, outFile.replace(/\.tex$/, '.pdf'));
}

export function texEscape(input: string) {
  // Préserve les blocs math LaTeX ($...$, \(...\), \[...\]) et échappe le reste
  const trim = (s: string) => (s?.length > 8000 ? s.slice(0, 8000) + '…' : s);
  const src = String(trim(input) || '');
  const parts: Array<{ text: string; math: boolean; }> = [];
  let i = 0;
  while (i < src.length) {
    // Détecter \[ ... \]
    if (src.startsWith('\\[', i)) {
      const j = src.indexOf('\\]', i + 2);
      const end = j === -1 ? src.length : j + 2;
      parts.push({ text: src.slice(i, end), math: true });
      i = end;
      continue;
    }
    // Détecter \( ... \)
    if (src.startsWith('\\(', i)) {
      const j = src.indexOf('\\)', i + 2);
      const end = j === -1 ? src.length : j + 2;
      parts.push({ text: src.slice(i, end), math: true });
      i = end;
      continue;
    }
    // Détecter $...$ (si pas de fermeture, traiter comme littéral)
    if (src[i] === '$') {
      let j = i + 1;
      while (j < src.length && !(src[j] === '$' && src[j - 1] !== '\\')) j++;
      if (j < src.length && j > i + 1) {
        const end = j + 1;
        parts.push({ text: src.slice(i, end), math: true });
        i = end;
      } else {
        parts.push({ text: '$', math: false });
        i += 1;
      }
      continue;
    }
    // Segment normal
    const next = (() => {
      const idxs = [src.indexOf('\\[', i), src.indexOf('\\(', i), src.indexOf('$', i)].filter(x => x !== -1);
      return idxs.length ? Math.min(...idxs) : -1;
    })();
    const end = next === -1 ? src.length : next;
    parts.push({ text: src.slice(i, end), math: false });
    i = end;
  }
  const escapeText = (s: string) => s
    .replace(/\\/g, '\\textbackslash ')
    .replace(/\$/g, '\\$')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/#/g, '\\#')
    .replace(/&/g, '\\&')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\^/g, '\\textasciicircum ')
    .replace(/~/g, '\\textasciitilde ');
  return parts.map(p => (p.math ? p.text : escapeText(p.text))).join('');
}

export function mapPremiumToTexView(d: BilanPremium) {
  const esc = (s: string) => texEscape(s);

  const statutHuman = d.meta.statut === 'fr' ? 'scolarisé' : d.meta.statut === 'candidat_libre' ? 'candidat libre' : String(d.meta.statut);

  // Order radar axes if known for the subject; otherwise, keep the given order
  const preferOrder: Record<string, string[]> = {
    NSI: ['Algorithmes', 'Python', 'Programmation Objet', 'Graphes', 'BD/SQL', 'Réseaux', 'Web'],
    Maths: ['Fonctions', 'Géométrie', 'Probabilités', 'Analyse', 'Algèbre', 'Arithmétique'],
  };
  const scores = (d.academic?.scoresByDomain || []).slice();
  const ref = preferOrder[d.meta.matiere];
  const ordered = ref
    ? scores.slice().sort((a, b) => {
      const ia = ref.indexOf(a.domain);
      const ib = ref.indexOf(b.domain);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    })
    : scores;

  const labels = ordered.map(s => esc(s.domain.replace(/,/g, ';')));
  const percents = ordered.map(s => Math.round(s.percent));
  const n = Math.max(1, percents.length);
  const step = 360 / n;
  const radarCoords = percents.map((p, i) => `(${Math.round(i * step)},${p})`).join(' ');
  const barsLabelsCsv = labels.join(',');
  const barsCoords = ordered.map((s, i) => `(${labels[i]},${Math.round(s.percent)})`).join(' ');

  // Build timeline (up to 8 steps) with phase codes and details
  type Phase = 'Consolidation' | 'Approfondissement' | 'Entrainement';
  const safe8 = <T,>(arr: T[], fill: T) => Array.from({ length: 8 }, (_, i) => (arr?.[i] ?? fill));
  const phasesIn: Phase[] = safe8((d as any)?.plan?.phases || [], 'Consolidation');
  const etapesIn: string[] = safe8((d.plan?.etapes || []), '');
  const toCode = (p: Phase) => (p?.toLowerCase?.().startsWith('appro') ? 'D' : p?.toLowerCase?.().startsWith('entrain') ? 'T' : 'C');
  const tlCodes = phasesIn.map(toCode);
  const timeline_rows = etapesIn.map((t, i) => ({ week: `S${i + 1}`, label: esc(t) }));
  const TLs = tlCodes; // ['C'|'D'|'T'] x8
  const TLd = etapesIn.map(esc);
  // Coordinates for bars per phase
  const coordStr = (code: 'C' | 'D' | 'T') => TLs.map((c, i) => `(S${i + 1},${c === code ? 1 : 0})`).join(' ');
  const tlC = coordStr('C');
  const tlD = coordStr('D');
  const tlT = coordStr('T');

  return {
    brand: { logo: 'assets/logo_nexus.pdf', watermark: 'Nexus Réussite' },
    meta: { ...d.meta, statut: statutHuman },
    eleve: { ...d.eleve, firstName: esc(d.eleve.firstName), lastName: esc(d.eleve.lastName) },

    qcm: {
      scoreGlobal: Math.round(d.academic?.globalPercent ?? 0),
      domains: ordered.map(s => ({ label: esc(s.domain), percent: Math.round(s.percent), points: 0, max: 100 })),
      forces: (d.academic?.forces || []).map(esc),
      faiblesses: (d.academic?.faiblesses || []).map(esc),
    },

    diagnostic_rows: ordered.map(x => ({ label: esc(x.domain), percent: Math.round(x.percent) })),
    forces: (d.academic?.forces || []).map(esc),
    faiblesses: (d.academic?.faiblesses || []).map(esc),
    lacunes: (d.academic?.lacunesCritiques || []).map(esc),

    profil: {
      style: esc(d.pedagogue.style),
      autonomie: esc(d.pedagogue.autonomie),
      organisation: esc(d.pedagogue.organisation),
      stress: esc(d.pedagogue.stress),
      flags: (d.pedagogue.flags || []).map(esc),
    },

    plan: { horizonMois: d.plan?.horizonMois, hebdoHeures: d.plan?.hebdoHeures },
    plan_rows: (d.plan?.etapes || []).map((t, i) => ({ idx: i + 1, text: esc(t) })),
    timeline_rows,
    timeline: { c: tlC, d: tlD, t: tlT },
    TLsOne: TLs[0], TLsTwo: TLs[1], TLsThree: TLs[2], TLsFour: TLs[3], TLsFive: TLs[4], TLsSix: TLs[5], TLsSeven: TLs[6], TLEight: TLs[7],
    TLdOne: TLd[0], TLdTwo: TLd[1], TLdThree: TLd[2], TLdFour: TLd[3], TLdFive: TLd[4], TLdSix: TLd[5], TLdSeven: TLd[6], TLdEight: TLd[7],

    offre: { primary: esc(d.offres.primary), alternatives: (d.offres.alternatives || []).map(esc), reasoning: esc(d.offres.reasoning) },

    citations: (d.rag?.citations || []).map(c => ({ title: esc(c.title), src: esc((c as any).src || (c as any).source || ''), snippet: esc(c.snippet) })),

    radar: { coords: radarCoords, labels },
    bars: { labelsCsv: barsLabelsCsv, coords: barsCoords },

    theme: { accent: d.meta.matiere === 'Maths' ? 'NexusBlue' : 'NexusViolet' },
  };
}

export async function tryGeneratePremiumLatexPdf(data: BilanPremium): Promise<Buffer | null> {
  try {
    const view = mapPremiumToTexView(data);
    const tex = renderLatex(view);
    const outDir = path.resolve(process.cwd(), 'apps/web/server/bilan/output');
    const safeBase = `${data.eleve?.lastName || 'eleve'}_${data.eleve?.firstName || ''}`
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') || 'unknown';
    const pdfPath = compileLatex(tex, outDir, `bilan_${safeBase}.tex`);
    return fs.readFileSync(pdfPath);
  } catch (e) {
    return null;
  }
}

// Backward-compat adapter: legacy generateBilan signature → generates a minimal structure
// expected by older routes (intro_text, diagnostic_text, profile_text, roadmap_text, offers_text,
// conclusion_text, table_domain_rows)
export async function generateBilan(args: any): Promise<any> {
  const fullName: string = String(args?.student?.name || '').trim();
  const [prenom, ...rest] = fullName.split(' ').filter(Boolean);
  const nom = rest.join(' ');
  const niveau = (args?.student?.level as any) || 'Terminale';

  const prem = await generateBilanPremium({
    variant: (args?.variant === 'parent' ? 'parent' : 'eleve'),
    student: {
      id: String(args?.traceUserId || ''),
      prenom: prenom || 'Élève',
      nom: nom || 'Test',
      niveau,
      specialites: Array.isArray(args?.student?.subjects)
        ? args.student.subjects
        : String(args?.student?.subjects || '')
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean),
    },
    aria: { resume: '—', points_faibles: [] },
    notes: { qcm: args?.qcm, volet2: args?.volet2 },
    rag: { snippets: [] },
    traceUserId: String(args?.traceUserId || ''),
  });

  const rows = (prem.academic?.scoresByDomain || []).map((r) => ({
    domain: r.domain,
    points: Math.round(r.percent),
    max: 100,
    masteryPct: Math.round(r.percent),
    remark: '',
  }));

  return {
    intro_text: 'Bilan Premium — synthèse automatique',
    diagnostic_text: (prem.academic?.faiblesses || []).join(', '),
    profile_text: [prem.pedagogue?.style, prem.pedagogue?.organisation].filter(Boolean).join(' · '),
    roadmap_text: (prem.plan?.etapes || []).join(' → '),
    offers_text: [prem.offres?.primary, ...(prem.offres?.alternatives || [])].filter(Boolean).join(' | '),
    conclusion_text: prem.offres?.reasoning || '',
    table_domain_rows: rows,
  };
}
