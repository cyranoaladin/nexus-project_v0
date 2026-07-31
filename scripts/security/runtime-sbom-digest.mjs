#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export const RUNTIME_COMPONENT_SET_SCHEMA =
  'nexus-runtime-component-set-recursive/v1';

function requiredNfcString(value, errorCode) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(errorCode);
  }
  return value.normalize('NFC');
}

function normalizedComponent(component) {
  if (!component || typeof component !== 'object' || Array.isArray(component)) {
    throw new Error('RUNTIME_COMPONENT_INVALID');
  }

  const componentName = requiredNfcString(
    component.name,
    'RUNTIME_COMPONENT_NAME_INVALID',
  );
  const group = component.group == null || component.group === ''
    ? ''
    : requiredNfcString(component.group, 'RUNTIME_COMPONENT_GROUP_INVALID');
  const rawVersion = requiredNfcString(
    component.version,
    'RUNTIME_COMPONENT_VERSION_INVALID',
  );

  return {
    name: group ? `${group}/${componentName}` : componentName,
    version: /^v[0-9]/.test(rawVersion) ? rawVersion.slice(1) : rawVersion,
  };
}

function collectComponents(components, collected) {
  if (!Array.isArray(components)) {
    throw new Error('RUNTIME_COMPONENTS_INVALID');
  }

  for (const component of components) {
    const normalized = normalizedComponent(component);
    collected.set(`${normalized.name}\0${normalized.version}`, normalized);

    if (component.components != null) {
      if (!Array.isArray(component.components)) {
        throw new Error('RUNTIME_SUBCOMPONENTS_INVALID');
      }
      collectComponents(component.components, collected);
    }
  }
}

function binaryCompare(left, right) {
  if (left.name < right.name) return -1;
  if (left.name > right.name) return 1;
  if (left.version < right.version) return -1;
  if (left.version > right.version) return 1;
  return 0;
}

export function canonicalizeRuntimeSbom(sbom) {
  if (!sbom || typeof sbom !== 'object' || Array.isArray(sbom)) {
    throw new Error('RUNTIME_SBOM_INVALID');
  }

  const collected = new Map();
  collectComponents(sbom.components, collected);
  const components = [...collected.values()].sort(binaryCompare);
  const canonical = `${JSON.stringify({
    schema: RUNTIME_COMPONENT_SET_SCHEMA,
    components,
  })}\n`;

  return { canonical, components };
}

export function runtimeGraphDigest(sbom) {
  const { canonical, components } = canonicalizeRuntimeSbom(sbom);
  return {
    canonical,
    componentCount: components.length,
    digest: createHash('sha256').update(canonical, 'utf8').digest('hex'),
    schema: RUNTIME_COMPONENT_SET_SCHEMA,
  };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function main() {
  const sbomPath = argument('--sbom');
  const canonicalOutput = argument('--canonical-output');
  if (!sbomPath) throw new Error('RUNTIME_SBOM_PATH_REQUIRED');
  if (!canonicalOutput) throw new Error('RUNTIME_CANONICAL_OUTPUT_REQUIRED');

  const sbom = JSON.parse(readFileSync(sbomPath, 'utf8'));
  const result = runtimeGraphDigest(sbom);
  writeFileSync(canonicalOutput, result.canonical, 'utf8');
  process.stdout.write(`${JSON.stringify({
    digest: result.digest,
    componentCount: result.componentCount,
    schema: result.schema,
  })}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
  }
}
