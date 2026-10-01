const { readFileSync } = require('node:fs');

global.fetch = async () => ({
  status: 200,
  text: async () => readFileSync(process.env.PREVIEW_TEST_HTML_FILE, 'utf8'),
});
