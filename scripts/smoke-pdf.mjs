import fetch from 'node-fetch';

const base = process.env.BASE_URL || 'http://localhost:3003';

async function head(headers) {
  return Object.fromEntries([...headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
}

async function fetchPdf(url) {
  const r = await fetch(url);
  const h = await head(r.headers);
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, contentType: h['content-type'], size: buf.length };
}

async function main() {
  const urls = [
    `${base}/api/bilan/pdf?niveau=premiere&variant=general`,
    `${base}/api/bilan/pdf?niveau=premiere&variant=parent`,
  ];
  const out = [];
  for (const u of urls) {
    out.push({ url: u, ...(await fetchPdf(u)) });
  }
  // Force regen
  process.env.FORCE_PDF_REGEN = '1';
  out.push({ url: urls[0] + '&force=1', ...(await fetchPdf(urls[0])) });
  console.log(JSON.stringify(out));
}

main().catch((e) => { console.error(e); process.exit(2); });


