import fs from 'fs';
import path from 'path';

type JobStatus = 'queued' | 'running' | 'done' | 'error';

export type BilanJob = {
  id: string;
  status: JobStatus;
  variant: 'eleve' | 'parent';
  createdAt: string;
  updatedAt: string;
  error?: string;
  outputPath?: string; // chemin du PDF généré si done
  meta?: Record<string, any>;
};

const ROOT = path.resolve(process.cwd(), 'storage', 'reports');
const JOBS_DIR = path.join(ROOT, 'jobs');
const OUT_DIR = path.join(ROOT, 'pdf');

function ensureDirs() {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

export function createJob(variant: 'eleve' | 'parent', meta?: Record<string, any>): BilanJob {
  ensureDirs();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const job: BilanJob = { id, status: 'queued', variant, createdAt: now, updatedAt: now, meta };
  const p = path.join(JOBS_DIR, `${id}.json`);
  fs.writeFileSync(p, JSON.stringify(job, null, 2), 'utf8');
  return job;
}

export function getJob(id: string): BilanJob | null {
  try {
    const p = path.join(JOBS_DIR, `${id}.json`);
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw) as BilanJob;
  } catch {
    return null;
  }
}

export function setJobStatus(id: string, partial: Partial<BilanJob>): BilanJob | null {
  ensureDirs();
  const existing = getJob(id);
  if (!existing) return null;
  const updated: BilanJob = { ...existing, ...partial, updatedAt: new Date().toISOString() } as BilanJob;
  const p = path.join(JOBS_DIR, `${id}.json`);
  fs.writeFileSync(p, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

export function getOutputPathFor(id: string): string {
  ensureDirs();
  return path.join(OUT_DIR, `${id}.pdf`);
}

export function listJobs(): BilanJob[] {
  ensureDirs();
  const files = fs.readdirSync(JOBS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      const raw = fs.readFileSync(path.join(JOBS_DIR, f), 'utf8');
      return JSON.parse(raw) as BilanJob;
    } catch {
      return null as any;
    }
  }).filter(Boolean);
}
