import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';

export function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function validateAgainstSchema(schemaPath, dataPath) {
  const schema = loadJson(schemaPath);
  const data = loadJson(dataPath);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  const ok = validate(data);
  return { ok, data, errors: validate.errors ?? [] };
}

export function validateDataAgainstSchema(schemaPath, data) {
  const schema = loadJson(schemaPath);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  const ok = validate(data);
  return { ok, errors: validate.errors ?? [] };
}
