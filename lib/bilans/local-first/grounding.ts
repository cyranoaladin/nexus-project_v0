export type DomainGroundingIssue = Readonly<{ path: string; message: string }>;

type GroundedBundle = Readonly<{
  eleve: Readonly<{ priorites: readonly Readonly<{ domainId: string }>[] }>;
  parents: Readonly<{
    pointsAppui: readonly Readonly<{ domainId: string }>[];
    priorites: readonly Readonly<{ domainId: string }>[];
  }>;
}>;

export function validateDomainGrounding(
  expectedDomainIds: readonly string[],
  bundle: GroundedBundle,
): DomainGroundingIssue[] {
  const issues: DomainGroundingIssue[] = [];
  const expected = new Set(expectedDomainIds);
  const references = [
    ...bundle.eleve.priorites.map(({ domainId }) => ({ path: 'eleve.priorites', domainId })),
    ...bundle.parents.pointsAppui.map(({ domainId }) => ({ path: 'parents.pointsAppui', domainId })),
    ...bundle.parents.priorites.map(({ domainId }) => ({ path: 'parents.priorites', domainId })),
  ];
  const covered = new Set<string>();
  for (const reference of references) {
    if (!expected.has(reference.domainId)) {
      issues.push({ path: reference.path, message: `Unknown domain ${reference.domainId}` });
    } else {
      covered.add(reference.domainId);
    }
  }
  for (const domainId of expected) {
    if (!covered.has(domainId)) {
      issues.push({ path: 'domains', message: `Evaluated domain ${domainId} is not grounded` });
    }
  }
  return issues;
}
