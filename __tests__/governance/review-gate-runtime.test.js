let validateRuntimeArchiveEntries;
beforeAll(async () => {
  ({ validateRuntimeArchiveEntries } = await import('../../scripts/github/review-gate/qualification/runtime.mjs'));
});

describe('verified local reviewer runtime archive', () => {
  test('accepts only the pinned runtime subtree with llama-completion', () => {
    expect(validateRuntimeArchiveEntries('llama-b10977/\nllama-b10977/llama-completion\nllama-b10977/libfoo.so\n'))
      .toBe(true);
  });
  test.each(['../escape\n', '/root/file\n', 'other/llama-completion\n',
    'llama-b10977/../escape\n', 'llama-b10977/libfoo.so\n'])('rejects unsafe or incomplete archive: %s', (entries) => {
    expect(() => validateRuntimeArchiveEntries(entries)).toThrow('RUNTIME_ARCHIVE_INVALID');
  });
});
