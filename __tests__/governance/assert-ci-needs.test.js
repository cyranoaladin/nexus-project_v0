describe('CI aggregate needs assertion', () => {
  let assertCiNeeds;

  beforeAll(async () => {
    ({ assertCiNeeds } = await import('../../scripts/github/assert-ci-needs.mjs'));
  });

  test('accepts only a non-empty object whose direct dependencies all succeeded', () => {
    expect(assertCiNeeds(JSON.stringify({
      lint: { result: 'success' },
      'aria-browser': { result: 'success' },
    }))).toEqual(['aria-browser', 'lint']);
  });

  test.each(['failure', 'skipped', 'cancelled'])('rejects a %s dependency result', (result) => {
    expect(() => assertCiNeeds(JSON.stringify({ aria: { result } })))
      .toThrow(`CI_REQUIRED_JOB_NOT_SUCCESS:aria:${result}`);
  });

  test.each(['', 'null', '[]', '{', '{"aria":{}}'])('rejects malformed needs evidence %j', (value) => {
    expect(() => assertCiNeeds(value)).toThrow(/CI_NEEDS_(?:INVALID|EMPTY)|CI_REQUIRED_JOB_RESULT_INVALID/);
  });
});
