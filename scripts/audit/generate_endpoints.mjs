import { promises as fs } from 'fs';
import path from 'path';

const API_DIRS = [
  path.resolve('app/api'),
  path.resolve('apps/web/app/api'),
];

const METHODS = ['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD'];
const ROLE_TOKENS = ['ADMIN','ASSISTANTE','COACH','PARENT','ELEVE'];
const PRIMITIVES = new Set(['String','Int','Float','Decimal','Boolean','DateTime','Json','Bytes','BigInt']);

function routePathFromFile(file) {
  for (const base of API_DIRS) {
    if (file.startsWith(base)) {
      const rel = file.slice(base.length).replaceAll('\\', '/');
      const seg = rel.replace(/\/route\.(t|j)sx?$/,'');
      // Next.js app router path
      let p = '/api' + seg;
      // Normalize dynamic segments to :param
      p = p.replace(/\[(\.\.\.)?([^\]]+)\]/g, (_m, dots, name) => `:${dots? '...' : ''}${name}`);
      // Remove trailing slash if any
      p = p.replace(/\/$/, '');
      return p || '/api';
    }
  }
  return null;
}

async function walk(dir, out=[]) {
  try {
    const ents = await fs.readdir(dir, { withFileTypes: true });
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p, out);
      else if (/route\.(t|j)sx?$/.test(e.name)) out.push(p);
    }
  } catch {}
  return out;
}

function detectMethods(src) {
  const methods = new Set();
  for (const m of METHODS) {
    const re = new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${m}\\b`,'m');
    if (re.test(src)) methods.add(m);
  }
  return Array.from(methods);
}

function detectAuth(src) {
  return /getServerSession\(|getAuthFromRequest\(|authOptions|Authorization/i.test(src);
}

function detectRoles(src) {
  const roles = new Set();
  for (const r of ROLE_TOKENS) {
    const re = new RegExp(`\"${r}\"|'${r}'|\b${r}\b`);
    if (re.test(src)) roles.add(r);
  }
  return Array.from(roles);
}

function detectRateLimit(src) {
  return /rateLimit|rate-limit/i.test(src);
}

function detectIO(src) {
  const inputs = new Set();
  if (/req\.json\(/i.test(src)) inputs.add('application/json');
  if (/req\.formData\(/i.test(src) || /multipart\/form-data/i.test(src)) inputs.add('multipart/form-data');
  if (/searchParams|nextUrl\./i.test(src)) inputs.add('query');
  const outputs = new Set();
  if (/text\/event-stream/i.test(src)) outputs.add('text/event-stream');
  if (/application\/pdf/i.test(src)) outputs.add('application/pdf');
  if (/JSON\.stringify\(|application\/json/i.test(src)) outputs.add('application/json');
  if (!outputs.size) outputs.add('auto');
  if (!inputs.size) inputs.add('auto');
  return { input: Array.from(inputs), output: Array.from(outputs) };
}

async function main() {
  const files = new Set();
  for (const d of API_DIRS) {
    const got = await walk(d);
    for (const f of got) files.add(f);
  }
  const endpoints = [];
  for (const file of Array.from(files).sort()) {
    let src = '';
    try { src = await fs.readFile(file,'utf8'); } catch {}
    const pathApi = routePathFromFile(file);
    const methods = detectMethods(src);
    const requiresAuth = detectAuth(src);
    const rolesAllowed = detectRoles(src);
    const rateLimit = detectRateLimit(src);
    const { input, output } = detectIO(src);
    const item = {
      file: path.relative(process.cwd(), file),
      path: pathApi,
      methods: methods.length ? methods : ['ANY'],
      requiresAuth,
      rolesAllowed,
      rateLimit,
      input,
      output,
    };
    endpoints.push(item);
  }
  await fs.mkdir(path.resolve('audit'), { recursive: true });
  await fs.writeFile(path.resolve('audit/endpoints.json'), JSON.stringify(endpoints, null, 2));
  console.log(`Generated ${endpoints.length} endpoints → audit/endpoints.json`);
}

main().catch(err => { console.error(err); process.exit(1); });

