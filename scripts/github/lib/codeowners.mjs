export function parseCodeowners(content) {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  return lines.map((line) => {
    const [pattern, ...owners] = line.split(/\s+/);
    return { pattern, owners: owners.map((owner) => owner.replace(/^@/, '')) };
  });
}

export function catchAllRule(rules) {
  return rules.find((rule) => rule.pattern === '*') ?? null;
}

export function hasFullCoverage(content) {
  const rules = parseCodeowners(content);
  const catchAll = catchAllRule(rules);
  return {
    coverage: catchAll ? 1 : 0,
    catchAll,
    rules,
  };
}
