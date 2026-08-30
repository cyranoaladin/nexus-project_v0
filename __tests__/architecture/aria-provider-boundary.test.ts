import { source, sourceFilesUnder } from './aria-boundary-helpers';

describe('H002 ARIA provider boundary', () => {
  it('contains provider SDK construction only in the model gateway adapter', () => {
    const violations = sourceFilesUnder('lib/aria')
      .filter((file) => file !== 'lib/aria/infrastructure/model/gateway.ts')
      .filter((file) => /from ['"]openai['"]|new OpenAI\s*\(/.test(source(file)));
    expect(violations).toEqual([]);
  });

  it('does not expose provider or model identifiers to frontend modules', () => {
    const frontend = sourceFilesUnder('components/aria')
      .map((file) => source(file)).join('\n');
    expect(frontend).not.toMatch(/OPENAI|OLLAMA|modelId|providerId|gpt-/i);
  });
});
