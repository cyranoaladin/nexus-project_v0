#!/usr/bin/env node
import https from 'https';

const url = process.env.SLACK_WEBHOOK_URL;
const text = process.argv.slice(2).join(' ') || 'Notification';

if (!url) {
  console.error('SLACK_WEBHOOK_URL manquant');
  process.exit(2);
}

const body = JSON.stringify({ text });
const { hostname, pathname } = new URL(url);

const req = https.request({ hostname, path: pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
  res.on('data', () => {});
  res.on('end', () => { console.log('Slack notified'); });
});
req.on('error', (e) => { console.error(e); process.exit(1); });
req.write(body);
req.end();
