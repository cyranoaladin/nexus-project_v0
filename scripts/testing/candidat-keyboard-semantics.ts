import ts from 'typescript';

const CANDIDATE_STUDENT_ACTION_LABELS = [
  'Utiliser pour ce devis',
  'Utiliser pour un devis candidat individuel',
] as const;

function normalizeJsxText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function fail(code: string): never {
  throw new Error(code);
}

function assertFixedCandidateHref(opening: ts.JsxOpeningElement, sourceFile: ts.SourceFile): void {
  const href = opening.attributes.properties.find((property): property is ts.JsxAttribute =>
    ts.isJsxAttribute(property) && property.name.getText(sourceFile) === 'href');
  const expression = href?.initializer && ts.isJsxExpression(href.initializer)
    ? href.initializer.expression
    : undefined;
  if (
    !expression
    || !ts.isCallExpression(expression)
    || !ts.isIdentifier(expression.expression)
    || expression.expression.text !== 'getCandidateSimulatorPath'
    || expression.arguments.length !== 1
    || !ts.isIdentifier(expression.arguments[0])
    || expression.arguments[0].text !== 'staffRole'
  ) fail('CANDIDATE_ANCHOR_HREF_NOT_FIXED');
}

function assertNativeCandidateAnchor(element: ts.JsxElement, sourceFile: ts.SourceFile): void {
  const opening = element.openingElement;
  if (opening.tagName.getText(sourceFile) !== 'a') fail('CANDIDATE_ACTION_NOT_NATIVE_ANCHOR');
  for (const property of opening.attributes.properties) {
    if (ts.isJsxSpreadAttribute(property)) fail('CANDIDATE_ANCHOR_SPREAD_ATTRIBUTES');
    const name = property.name.getText(sourceFile).toLowerCase();
    if (name === 'onkeydown' || name === 'onkeyup' || name === 'onkeypress') {
      fail('CANDIDATE_ANCHOR_CUSTOM_KEYBOARD_HANDLER');
    }
  }
  assertFixedCandidateHref(opening, sourceFile);
}

export function assertCandidateStudentAnchorSemantics(source: string): string[] {
  const sourceFile = ts.createSourceFile(
    'StudentsManagementWorkspace.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const expected = new Set<string>(CANDIDATE_STUDENT_ACTION_LABELS);

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      const label = normalizeJsxText(node.text);
      if (expected.has(label)) {
        if (!ts.isJsxElement(node.parent)) fail('CANDIDATE_ACTION_NOT_NATIVE_ANCHOR');
        assertNativeCandidateAnchor(node.parent, sourceFile);
        found.push(label);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (
    found.length !== CANDIDATE_STUDENT_ACTION_LABELS.length
    || CANDIDATE_STUDENT_ACTION_LABELS.some((label) => found.filter((candidate) => candidate === label).length !== 1)
  ) fail('CANDIDATE_ANCHOR_COUNT_INVALID');
  return found;
}
