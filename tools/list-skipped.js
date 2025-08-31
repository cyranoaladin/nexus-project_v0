const fs = require('fs');
const path = require('path');

const reportPath = path.resolve(__dirname, '..', 'test-results', 'chromium-report.json');

function main() {
  const raw = fs.readFileSync(reportPath, 'utf8');
  const idx = raw.indexOf('{');
  const txt = idx >= 0 ? raw.slice(idx) : raw;
  const data = JSON.parse(txt);

  const skipped = [];
  function walk(node) {
    if (!node) return;
    if (node.specs) {
      for (const spec of node.specs) {
        const file = spec.file;
        const title = spec.title;
        const line = spec.line || 0;
        for (const test of (spec.tests || [])) {
          const res = (test.results && test.results[0]) || {};
          const status = test.expectedStatus || res.status || '';
          if (status === 'skipped') {
            skipped.push({ file, title, line, annotations: test.annotations || [] });
          }
        }
      }
    }
    for (const s of (node.suites || [])) walk(s);
  }
  walk({ suites: data.suites });
  console.log(JSON.stringify(skipped, null, 2));
}

main();

