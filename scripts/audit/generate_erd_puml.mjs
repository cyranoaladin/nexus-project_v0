import { promises as fs } from 'fs';
import path from 'path';

const SCHEMA = path.resolve('prisma/schema.prisma');

async function main() {
  let src = '';
  try { src = await fs.readFile(SCHEMA, 'utf8'); } catch (e) {
    console.error('Cannot read prisma/schema.prisma');
    process.exit(1);
  }
  const modelBlocks = Array.from(src.matchAll(/model\s+(\w+)\s+\{([\s\S]*?)\}/g));
  const models = modelBlocks.map(m => ({ name: m[1], body: m[2] }));
  const modelNames = new Set(models.map(m => m.name));

  function parseFields(body) {
    const lines = body.split(/\n/).map(l => l.trim()).filter(Boolean);
    const fields = [];
    for (const line of lines) {
      if (line.startsWith('//') || line.startsWith('@')) continue;
      const m = line.match(/^(\w+)\s+([^\s]+)(.*)$/);
      if (!m) continue;
      const name = m[1];
      const type = m[2];
      fields.push({ name, type, raw: line });
    }
    return fields;
  }

  const relations = [];
  const entities = [];
  for (const mdl of models) {
    const fields = parseFields(mdl.body);
    entities.push({ name: mdl.name, fields });
  }

  // Build PUML
  let out = '';
  out += '@startuml\n';
  out += 'hide methods\n';
  out += 'skinparam classAttributeIconSize 0\n';

  for (const ent of entities) {
    out += `entity ${ent.name} {\n`;
    for (const f of ent.fields) {
      out += `  ${f.name}: ${f.type}\n`;
    }
    out += '}\n';
  }

  // relations by field type names that match model names
  for (const ent of entities) {
    for (const f of ent.fields) {
      const baseType = f.type.replace(/[\[\]\?]/g, '');
      if (modelNames.has(baseType)) {
        const isMany = /\[\]/.test(f.type);
        // ent -- baseType
        const arrow = isMany ? '"*"' : '"1"';
        out += `${ent.name} ${arrow}-- "1" ${baseType} : ${f.name}\n`;
      }
    }
  }

  out += '@enduml\n';
  await fs.mkdir(path.resolve('audit'), { recursive: true });
  await fs.writeFile(path.resolve('audit/erd.puml'), out);
  console.log('Generated audit/erd.puml');
}

main().catch(e => { console.error(e); process.exit(1); });

