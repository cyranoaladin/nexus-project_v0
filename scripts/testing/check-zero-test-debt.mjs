import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const SOURCE_EXTENSIONS = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.json', '.yml', '.yaml', '.sh',
]);
const FORBIDDEN_MEMBERS = new Set(['skip', 'todo', 'only', 'fixme']);
const FORBIDDEN_CALLEES = new Set(['x' + 'it', 'x' + 'describe', 'f' + 'it', 'f' + 'describe']);

function lineAndColumn(sourceFile, node) {
  const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${location.line + 1}:${location.character + 1}`;
}

function propertyName(expression) {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (ts.isElementAccessExpression(expression)
    && expression.argumentExpression
    && ts.isStringLiteral(expression.argumentExpression)) {
    return expression.argumentExpression.text;
  }
  return null;
}

function propertyChain(expression) {
  const members = [];
  let current = expression;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    const member = propertyName(current);
    if (member) members.unshift(member);
    current = current.expression;
  }
  return { root: ts.isIdentifier(current) ? current.text : null, members };
}

function numericLiteralValue(node) {
  if (node && ts.isNumericLiteral(node)) return Number(node.text);
  return null;
}

export function inspectTestDebtSource(file, text) {
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') || file.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const findings = [];
  const browserQualificationFile = /^e2e\/aria\//.test(file);
  const disabledAliases = new Set();
  const testAliases = new Set(['test', 'it', 'describe', 'suite']);
  const declarations = new Map();
  const collectDeclarations=node=>{
    if(ts.isFunctionDeclaration(node)&&node.name)testAliases.delete(node.name.text);
    if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name))
      declarations.set(node.name.text,[...(declarations.get(node.name.text)??[]),node]);
    ts.forEachChild(node,collectDeclarations);
  };
  collectDeclarations(sourceFile);
  const mutatedOptions = new Set();
  function optionAliases(name, seen = new Set()) {
    if (seen.has(name)) return [name];
    const next = new Set(seen).add(name);
    return [name, ...(declarations.get(name) ?? []).flatMap(value =>
      value.initializer && ts.isIdentifier(value.initializer) ? optionAliases(value.initializer.text, next) : [])];
  }
  const recordMutation = expression => {
    const { root, members } = propertyChain(expression);
    if (root && (members.some(member => FORBIDDEN_MEMBERS.has(member) || member === '__proto__')
      || ts.isElementAccessExpression(expression))) optionAliases(root).forEach(name => mutatedOptions.add(name));
  };
  const collectMutations = node => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
      && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) recordMutation(node.left);
    if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) recordMutation(node.operand);
    if (ts.isDeleteExpression(node)) recordMutation(node.expression);
    if (ts.isCallExpression(node)) {
      const chain = propertyChain(node.expression);
      if (chain.root === 'Object' && chain.members.some(member =>
        ['assign', 'defineProperty', 'defineProperties', 'setPrototypeOf'].includes(member))) {
        const target = node.arguments[0];
        if (target && ts.isIdentifier(target)) optionAliases(target.text).forEach(name => mutatedOptions.add(name));
      }
    }
    ts.forEachChild(node, collectMutations);
  };
  collectMutations(sourceFile);
  function optionState(object,property,seen=new Set()){
    while(ts.isParenthesizedExpression(object)||ts.isAsExpression(object)||ts.isSatisfiesExpression(object))object=object.expression;
    if(ts.isIdentifier(object)){
      if (optionAliases(object.text).some(name => mutatedOptions.has(name))) return 'unknown';
      if(seen.has(object.text))return 'unknown';
      const values=declarations.get(object.text);if(!values)return 'absent';
      const next=new Set(seen).add(object.text);
      const states=values.map(value=>value.initializer?optionState(value.initializer,property,next):'unknown');
      if(states.includes('disabled')||states.includes('unknown'))return 'disabled';
      if(values.some(value=>!(value.parent.flags&ts.NodeFlags.Const))&&states.includes('safe'))return 'disabled';
      return states.includes('safe')?'safe':'absent';
    }
    if(!ts.isObjectLiteralExpression(object))return 'absent';
    for(const candidate of [...object.properties].reverse()){
      if(ts.isSpreadAssignment(candidate)){
        const state=optionState(candidate.expression,property,seen);
        if(state!=='absent')return state;
        // A nonliteral spread cannot establish that an exclusion is absent.
        if(!ts.isObjectLiteralExpression(candidate.expression)
          &&!(ts.isIdentifier(candidate.expression)&&declarations.has(candidate.expression.text)))return 'unknown';
      }else if(ts.isPropertyAssignment(candidate)){
        const name=ts.isIdentifier(candidate.name)||ts.isStringLiteral(candidate.name)?candidate.name.text
          : ts.isComputedPropertyName(candidate.name)&&ts.isStringLiteral(candidate.name.expression)?candidate.name.expression.text:null;
        if (name === null || name === '__proto__') return 'unknown';
        if(name===property)return candidate.initializer.kind===ts.SyntaxKind.FalseKeyword?'safe':'disabled';
      }else if(ts.isGetAccessorDeclaration(candidate)||ts.isSetAccessorDeclaration(candidate)||ts.isMethodDeclaration(candidate)){
        const name=ts.isIdentifier(candidate.name)||ts.isStringLiteral(candidate.name)?candidate.name.text:null;
        if(name===null||name===property)return 'unknown';
      }else if(ts.isShorthandPropertyAssignment(candidate)&&candidate.name.text===property)return 'disabled';
    }
    return 'absent';
  }
  const hasDisabledOption=(object,property)=>['disabled','unknown'].includes(optionState(object,property));
  const collectAliases = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)
      && node.moduleSpecifier.text === 'node:test') {
      if (node.importClause?.name) testAliases.add(node.importClause.name.text);
      const bindings=node.importClause?.namedBindings;
      if(bindings && ts.isNamedImports(bindings)) for(const element of bindings.elements)
        if(['test','it','describe','suite'].includes((element.propertyName??element.name).text))testAliases.add(element.name.text);
    }
    if(ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && ts.isIdentifier(node.initializer) && testAliases.has(node.initializer.text))testAliases.add(node.name.text);
    if(ts.isVariableDeclaration(node)&&node.initializer){
      const chain=propertyChain(node.initializer);
      if(ts.isIdentifier(node.name)&&(disabledAliases.has(chain.root??'')
        ||testAliases.has(chain.root??'')&&chain.members.some(member=>FORBIDDEN_MEMBERS.has(member))))
        disabledAliases.add(node.name.text);
      if(ts.isObjectBindingPattern(node.name)&&ts.isIdentifier(node.initializer)&&testAliases.has(node.initializer.text))
        for(const element of node.name.elements){
          const imported=(element.propertyName??element.name);
          const name=ts.isIdentifier(imported)||ts.isStringLiteral(imported)?imported.text:null;
          if(FORBIDDEN_MEMBERS.has(name)&&ts.isIdentifier(element.name))disabledAliases.add(element.name.text);
        }
    }
    ts.forEachChild(node,collectAliases);
  };
  let priorSize;
  do{priorSize=testAliases.size+disabledAliases.size;collectAliases(sourceFile);}
  while(priorSize!==testAliases.size+disabledAliases.size);

  const visit = (node) => {
    if (ts.isVariableDeclaration(node)
      && ts.isObjectBindingPattern(node.name)
      && node.initializer
      && ts.isIdentifier(node.initializer)
      && testAliases.has(node.initializer.text)) {
      for (const element of node.name.elements) {
        const importedName = element.propertyName && ts.isIdentifier(element.propertyName)
          ? element.propertyName.text
          : ts.isIdentifier(element.name) ? element.name.text : null;
        if (importedName && FORBIDDEN_MEMBERS.has(importedName) && ts.isIdentifier(element.name)) {
          disabledAliases.add(element.name.text);
        }
      }
    }

    if (ts.isCallExpression(node)) {
      const chain = propertyChain(node.expression);
      const forbiddenMember = chain.members.find((member) => FORBIDDEN_MEMBERS.has(member));
      if (forbiddenMember) {
        findings.push(`${file}:${lineAndColumn(sourceFile, node)} focused-or-disabled-test:${forbiddenMember}`);
      } else if (chain.members.includes('failing')) {
        findings.push(`${file}:${lineAndColumn(sourceFile, node)} expected-failure-test:failing`);
      } else if (ts.isIdentifier(node.expression) && FORBIDDEN_CALLEES.has(node.expression.text)) {
        findings.push(`${file}:${lineAndColumn(sourceFile, node)} focused-or-disabled-test:${node.expression.text}`);
      } else if (ts.isIdentifier(node.expression) && disabledAliases.has(node.expression.text)) {
        findings.push(`${file}:${lineAndColumn(sourceFile, node)} focused-or-disabled-test:${node.expression.text}`);
      } else if (testAliases.has(chain.root ?? '')) {
        for(const option of ['skip','todo','only']) if(node.arguments.some(argument=>hasDisabledOption(argument,option)))
          findings.push(`${file}:${lineAndColumn(sourceFile, node)} focused-or-disabled-test:${option}-option`);
      }
      if(chain.root==='jest' && chain.members.includes('retryTimes')
        && numericLiteralValue(node.arguments[0])!==0)
        findings.push(`${file}:${lineAndColumn(sourceFile,node)} retry-policy-must-be-zero`);
      if (browserQualificationFile
        && ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression)
        && node.expression.expression.text === 'expect'
        && node.expression.name.text === 'anything') {
        findings.push(`${file}:${lineAndColumn(sourceFile, node)} permissive-qualification-assertion`);
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)
        ? node.name.text
        : null;
      if (name === 'retries') {
        const value = numericLiteralValue(node.initializer);
        if (value === null || value !== 0) {
          findings.push(`${file}:${lineAndColumn(sourceFile, node)} retry-policy-must-be-zero`);
        }
      }
      if (name === 'testIgnore' || name === 'testPathIgnorePatterns') {
        const serialized = node.initializer.getText(sourceFile).toLowerCase();
        const isOwnedLanePartition =
          (name === 'testPathIgnorePatterns'
            && ((file === 'jest.aria.unit.config.js'
              && serialized.includes('sse.test.ts') && serialized.includes('real'))
              || (file === 'jest.aria.integration.config.js'
                && serialized.includes('real') && !serialized.includes('aria'))
              // `jest.db-core.config.js` is `jest.config.db.js` minus the
              // `aria-*` files, which the disposable ARIA harness lanes
              // (`test:aria:db`, `test:aria:concurrency`) own and run with a
              // runtime a plain jest invocation cannot provide. Nothing is
              // dropped: `inspectAriaQualificationCollection` below still
              // requires every tracked ARIA qualification test to be collected
              // by some lane, so this entry cannot hide one.
              || (file === 'jest.db-core.config.js'
                && serialized.includes('(concurrency|database|db)/aria-'))))
          || (file === 'playwright.config.ts'
            && name === 'testIgnore'
            && serialized.includes('**/aria/**'));
        if (!isOwnedLanePartition
          && (serialized.includes('aria') || serialized.includes('candidate-diagnostic')
          || serialized.includes('coach-resource-student'))) {
          findings.push(`${file}:${lineAndColumn(sourceFile, node)} ignored-qualification-test`);
        }
      }
      if (name === 'passWithNoTests' && node.initializer.kind !== ts.SyntaxKind.FalseKeyword) {
        findings.push(`${file}:${lineAndColumn(sourceFile, node)} empty-test-lane-option`);
      }
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (/@\s*quarantine\b/i.test(text)) {
    findings.push(`${file}:1:1 quarantined-test-marker`);
  }
  if (file.endsWith('.py')) {
    for (const marker of ['skip', 'xfail']) {
      if (new RegExp(`@pytest\\.mark\\.${marker}\\b`).test(text)) {
        findings.push(`${file}:1:1 pytest-disabled-test:${marker}`);
      }
    }
  }
  const emptyLaneCliOption = ['--', 'pass', 'With', 'No', 'Tests'].join('');
  if (['.sh','.json','.yml','.yaml'].includes(extname(file)) && text.includes(emptyLaneCliOption)) {
    findings.push(`${file}:1:1 empty-test-lane-option`);
  }
  return findings;
}

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

export function inspectRepositoryTestDebt(files = trackedFiles()) {
  const findings = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    if (file.endsWith('/QUARANTINE.md') || file === 'e2e/QUARANTINE.md') {
      findings.push(`${file}: quarantined-test-inventory`);
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(extname(file))) continue;
    findings.push(...inspectTestDebtSource(file, readFileSync(file, 'utf8')));
  }
  return { filesInspected: files.length, findings };
}

export function auditAriaQualificationCollection(tracked, collected) {
  const counts = new Map();
  for (const file of collected) counts.set(file, (counts.get(file) ?? 0) + 1);
  return {
    tracked: tracked.length,
    ignored: tracked.filter((file) => !counts.has(file)).sort(),
    duplicated: tracked.filter((file) => (counts.get(file) ?? 0) > 1).sort(),
  };
}

function isTrackedAriaQualificationTest(file) {
  return /^(?:__tests__\/(?:api\/aria[^/]*\.test\.ts|architecture\/aria-[^/]*\.test\.ts|components\/aria\/.*\.test\.tsx?|concurrency\/aria-[^/]*\.test\.ts|database\/aria-[^/]*\.test\.ts|db\/aria-[^/]*\.real\.test\.ts|integration\/aria-[^/]*\.test\.ts|lib\/aria\/.*\.test\.ts|scripts\/aria\/.*\.test\.ts)|e2e\/aria\/.*\.spec\.ts)$/.test(file);
}

function repositoryRelative(path) {
  return relative(process.cwd(), resolve(path)).split('\\').join('/');
}

function collectJestQualificationFiles() {
  const configs = [
    'jest.aria.unit.config.js',
    'jest.aria.api.config.js',
    'jest.aria.integration.config.js',
    'jest.aria.db.config.js',
    'jest.aria.concurrency.config.js',
    'jest.aria.sse.config.js',
    'jest.aria.architecture.config.js',
  ];
  return configs.flatMap((config) => {
    const output = execFileSync(
      process.execPath,
      ['node_modules/jest/bin/jest.js', '--config', config, '--listTests', '--runInBand', '--json'],
      { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    );
    const parsed = JSON.parse(output);
    if (!Array.isArray(parsed) || parsed.some((file) => typeof file !== 'string')) {
      throw new Error(`ARIA_TEST_COLLECTION_INVALID:${config}`);
    }
    return parsed.map(repositoryRelative);
  });
}

function collectPlaywrightQualificationFiles() {
  const roles = [
    'parent', 'student', 'student2', 'studentSurvival', 'coach', 'coach2', 'admin',
    'assistante', 'zenon', 'ariaPersonasParent', 'ariaTerminaleMaths', 'ariaPremiereMaths', 'ariaNsi',
    'ariaNsiPeer', 'ariaStmgNoChat', 'ariaIncompleteProfile', 'ariaNotEntitled',
  ];
  const directory = mkdtempSync(join(tmpdir(), 'aria-test-collection-'));
  const credentialsPath = join(directory, 'credentials.json');
  writeFileSync(credentialsPath, `${JSON.stringify(Object.fromEntries(roles.map((role) => [
    role,
    { email: `${role}@collection.invalid`, password: 'collection-only-not-a-secret' },
  ])))}\n`);
  try {
    const output = execFileSync(
      process.execPath,
      [
        'node_modules/@playwright/test/cli.js', 'test',
        '--config=playwright.aria.config.ts', '--list', '--reporter=json',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        env: {
          ...process.env,
          E2E_CREDENTIALS_PATH: credentialsPath,
          E2E_DISPOSABLE_STACK: '1',
          E2E_DATABASE_URL: 'postgresql://127.0.0.1:5435/nexus_e2e?schema=public',
        },
      },
    );
    const parsed = JSON.parse(output);
    const files = new Set();
    const playwrightFile = (file) => {
      if (file.startsWith('e2e/aria/')) return file;
      if (!file.startsWith('/') && !file.includes('\\')) return `e2e/aria/${file}`;
      return repositoryRelative(file);
    };
    const visit = (value) => {
      if (!value || typeof value !== 'object') return;
      if (!Array.isArray(value) && typeof value.file === 'string') {
        const file = playwrightFile(value.file);
        if (file.startsWith('e2e/aria/') && file.endsWith('.spec.ts')) files.add(file);
      }
      if (!Array.isArray(value) && value.location && typeof value.location === 'object'
        && typeof value.location.file === 'string') {
        const file = playwrightFile(value.location.file);
        if (file.startsWith('e2e/aria/') && file.endsWith('.spec.ts')) files.add(file);
      }
      for (const nested of Array.isArray(value) ? value : Object.values(value)) visit(nested);
    };
    visit(parsed);
    return [...files];
  } finally {
    rmSync(directory, { recursive: true });
  }
}

export function inspectAriaQualificationCollection(files = trackedFiles()) {
  const tracked = files.filter(isTrackedAriaQualificationTest).sort();
  const collected = [
    ...collectJestQualificationFiles(),
    ...collectPlaywrightQualificationFiles(),
  ].filter(isTrackedAriaQualificationTest);
  return auditAriaQualificationCollection(tracked, collected);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const result = inspectRepositoryTestDebt();
  const collection = inspectAriaQualificationCollection();
  for (const file of collection.ignored) result.findings.push(`${file}: ignored-qualification-test`);
  for (const file of collection.duplicated) result.findings.push(`${file}: duplicate-qualification-test`);
  if (result.findings.length > 0) {
    process.stderr.write(`${result.findings.join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`TEST_DEBT_FILES_INSPECTED=${result.filesInspected}\n`);
    process.stdout.write('TEST_SKIP_COUNT=0\nTEST_TODO_COUNT=0\nXIT_COUNT=0\nXDESCRIBE_COUNT=0\n');
    process.stdout.write('FIT_COUNT=0\nFDESCRIBE_COUNT=0\nTEST_ONLY_COUNT=0\nQUARANTINED_TEST_COUNT=0\n');
    process.stdout.write(`IGNORED_ARIA_TEST_COUNT=${collection.ignored.length}\n`);
  }
}
