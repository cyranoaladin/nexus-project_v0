import { createRequire } from 'node:module';

const loadModule = createRequire(__filename);
const { escapeMarkdownTableText } = loadModule('../../scripts/audit/markdown-table.cjs') as {
  escapeMarkdownTableText: (value: string) => string;
};

test.each(['|', '\\|', '\\\\|', 'prefix\\\\\\|suffix', 'é\\|終', 'plain text'])('escapes each original table delimiter once: %j', value => {
  const expected = Array.from(value).map(character => character === '\\' || character === '|'
    ? '\\' + character : character).join('');
  expect(escapeMarkdownTableText(value)).toBe(expected);
});
