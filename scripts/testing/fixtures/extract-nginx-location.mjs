/**
 * Extracts one `location ... { ... }` block verbatim from an Nginx config
 * file, by brace depth (not a fixed line count), so
 * verify-nginx-sse-streaming.sh always tests the CURRENT, exact bytes of
 * nginx/nginx.conf's SSE location — never a hand-copied reproduction that
 * could silently drift from the real file.
 *
 * Usage: node extract-nginx-location.mjs <confPath> <locationMarker>
 * Prints the extracted block to stdout, or exits 1 if not found.
 */
import { readFileSync } from 'node:fs';

const [, , confPath, marker] = process.argv;
const content = readFileSync(confPath, 'utf8');
const startIndex = content.indexOf(marker);
if (startIndex === -1) {
  console.error(`Marker not found: ${marker}`);
  process.exit(1);
}

const openBraceIndex = content.indexOf('{', startIndex);
let depth = 0;
let endIndex = -1;
for (let i = openBraceIndex; i < content.length; i++) {
  if (content[i] === '{') depth += 1;
  else if (content[i] === '}') {
    depth -= 1;
    if (depth === 0) {
      endIndex = i;
      break;
    }
  }
}
if (endIndex === -1) {
  console.error('Unbalanced braces: no matching closing brace found');
  process.exit(1);
}

process.stdout.write(content.slice(startIndex, endIndex + 1));
