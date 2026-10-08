let fs;
let path;
let yaml;
let ROOT;

const CACHE_SHA = '55cc8345863c7cc4c66a329aec7e433d2d1c52a9';
const LOCAL_ACTION = './.github/actions/apt-archive-cache';
const APT_STEP = /\bapt-get\b|playwright install --with-deps/;

describe('apt-dependent CI steps cannot be stalled by a slow Ubuntu mirror', () => {
  beforeAll(async () => {
    fs = await import('node:fs');
    path = await import('node:path');
    yaml = (await import('js-yaml')).default;
    ROOT = path.resolve(__dirname, '../..');
  });

  const workflow = () => yaml.load(fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8'));
  const aptSteps = () => Object.entries(workflow().jobs).flatMap(([job, definition]) =>
    (definition.steps ?? []).map((step, index, steps) => ({ job, step, index, steps }))
      .filter(({ step }) => typeof step.run === 'string' && APT_STEP.test(step.run)));

  test('the workflow still has apt-dependent steps to protect', () => {
    expect(aptSteps().length).toBeGreaterThanOrEqual(9);
  });

  test('every apt-dependent step is wrapped by a restore and a save of the same package set', () => {
    const unwrapped = aptSteps().filter(({ steps, index }) => {
      const before = steps[index - 1];
      const after = steps[index + 1];
      return before?.uses !== LOCAL_ACTION || before.with?.mode !== 'restore'
        || after?.uses !== LOCAL_ACTION || after.with?.mode !== 'save'
        || !before.with?.id || before.with.id !== after.with?.id;
    }).map(({ job, step }) => `${job}: ${step.name}`);
    expect(unwrapped).toEqual([]);
  });

  test('every apt-dependent step fails on its own bounded timeout, not the job budget', () => {
    const unbounded = aptSteps().filter(({ step }) => !(step['timeout-minutes'] > 0 && step['timeout-minutes'] <= 10))
      .map(({ job, step }) => `${job}: ${step.name}`);
    expect(unbounded).toEqual([]);
  });

  test('the composite action pins actions/cache and bounds apt network waits', () => {
    const source = fs.readFileSync(path.join(ROOT, '.github/actions/apt-archive-cache/action.yml'), 'utf8');
    const action = yaml.load(source);
    const uses = action.runs.steps.map(step => step.uses).filter(Boolean);
    expect(uses.length).toBeGreaterThan(0);
    for (const reference of uses) expect(reference).toMatch(new RegExp(`^actions/cache/(restore|save)@${CACHE_SHA}$`));
    expect(source).toContain('Acquire::Retries "5";');
    expect(source).toContain('Acquire::http::Timeout "30";');
    expect(source).toContain('Acquire::https::Timeout "30";');
    expect(source).toMatch(/ImageVersion/);
  });
});
