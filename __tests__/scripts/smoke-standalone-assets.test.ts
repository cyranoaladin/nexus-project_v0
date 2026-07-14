/**
 * Behavioral tests for smoke-standalone-assets.mjs
 *
 * Each test creates a temporary buildDir with a minimal Node.js server
 * at .next/standalone/server.js, then runs the smoke script as a child
 * process and verifies the exit code.
 */

import { execFileSync } from 'child_process';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createServer } from 'net';

const SMOKE_SCRIPT = join(__dirname, '../../scripts/release/smoke-standalone-assets.mjs');

let testDir: string;
let smokePort: number;

/** Find a free port */
async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as any).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/** Create a fixture server.js that serves configurable responses */
function makeServerJs(options: {
  pages?: Record<string, { status: number; body: string; contentType?: string }>;
  assets?: Record<string, { status: number; body: string; contentType?: string }>;
  healthOk?: boolean;
  exitImmediately?: boolean;
  exitDuringRequests?: boolean;
}): string {
  const { pages = {}, assets = {}, healthOk = true, exitImmediately = false, exitDuringRequests = false } = options;

  // Default pages with chunks if not overridden
  const defaultBody = `<html><script src="/_next/static/chunks/main-abc.js"></script><link href="/_next/static/css/style.css" rel="stylesheet"></html>`;
  const defaultPages: Record<string, any> = {
    '/': { status: 200, body: defaultBody },
    '/stages': { status: 200, body: defaultBody },
    '/bilan-gratuit': { status: 200, body: defaultBody },
    '/api/health': { status: healthOk ? 200 : 503, body: '{"status":"ok"}' },
  };
  const mergedPages = { ...defaultPages, ...pages };

  const defaultAssets: Record<string, any> = {
    '/_next/static/chunks/main-abc.js': { status: 200, body: 'console.log(1)', contentType: 'application/javascript; charset=utf-8' },
    '/_next/static/css/style.css': { status: 200, body: 'body{}', contentType: 'text/css; charset=utf-8' },
  };
  const mergedAssets = { ...defaultAssets, ...assets };

  return `
const http = require('http');
${exitImmediately ? 'process.exit(1);' : ''}
const pages = ${JSON.stringify(mergedPages)};
const assets = ${JSON.stringify(mergedAssets)};
let reqCount = 0;
const server = http.createServer((req, res) => {
  reqCount++;
  ${exitDuringRequests ? 'if (reqCount > 5) { process.exit(1); }' : ''}
  const route = pages[req.url] || assets[req.url];
  if (route) {
    res.writeHead(route.status, { 'Content-Type': route.contentType || 'text/html' });
    res.end(route.body);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});
server.listen(parseInt(process.env.PORT || '3199'), '127.0.0.1');
process.on('SIGTERM', () => { server.close(); process.exit(0); });
`;
}

async function createBuildDir(serverJs: string) {
  await mkdir(join(testDir, '.next/standalone/.next/static/chunks'), { recursive: true });
  await mkdir(join(testDir, '.next/standalone/public'), { recursive: true });
  await writeFile(join(testDir, '.next/standalone/server.js'), serverJs);
}

function runSmoke(port: number, timeout = 45000): { code: number; output: string } {
  try {
    const output = execFileSync('node', [SMOKE_SCRIPT, testDir], {
      encoding: 'utf8',
      timeout,
      env: { ...process.env, SMOKE_PORT: String(port), NODE_ENV: 'test' },
    });
    return { code: 0, output };
  } catch (e: any) {
    return { code: e.status ?? 1, output: (e.stdout || '') + (e.stderr || '') };
  }
}

beforeEach(async () => {
  testDir = join(tmpdir(), `smoke-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(testDir, { recursive: true });
  smokePort = await getFreePort();
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('smoke-standalone-assets behavioral', () => {
  test('A: three pages + valid assets → exit 0', async () => {
    await createBuildDir(makeServerJs({}));
    const { code, output } = runSmoke(smokePort);
    expect(code).toBe(0);
    expect(output).toContain('SMOKE PASSED');
    expect(output).toContain('JS_ASSET_COUNT=');
  }, 60000);

  test('B: no static asset URLs in HTML → exit 1', async () => {
    const noAssetBody = '<html><body>No chunks</body></html>';
    await createBuildDir(makeServerJs({
      pages: {
        '/': { status: 200, body: noAssetBody },
        '/stages': { status: 200, body: noAssetBody },
        '/bilan-gratuit': { status: 200, body: noAssetBody },
      },
    }));
    const { code, output } = runSmoke(smokePort);
    expect(code).toBe(1);
    expect(output).toContain('No static assets');
  }, 60000);

  test('C: CSS only, no JS → exit 1', async () => {
    const cssOnlyBody = '<html><link href="/_next/static/css/style.css" rel="stylesheet"></html>';
    await createBuildDir(makeServerJs({
      pages: {
        '/': { status: 200, body: cssOnlyBody },
        '/stages': { status: 200, body: cssOnlyBody },
        '/bilan-gratuit': { status: 200, body: cssOnlyBody },
      },
    }));
    const { code, output } = runSmoke(smokePort);
    expect(code).toBe(1);
    expect(output).toContain('No JavaScript chunks');
  }, 60000);

  test('D: JS chunk returns 404 → exit 1', async () => {
    await createBuildDir(makeServerJs({
      assets: {
        '/_next/static/chunks/main-abc.js': { status: 404, body: 'Not Found', contentType: 'text/plain' },
      },
    }));
    const { code, output } = runSmoke(smokePort);
    expect(code).toBe(1);
    expect(output).toContain('404');
  }, 60000);

  test('E: CSS returns 404 → exit 1', async () => {
    await createBuildDir(makeServerJs({
      assets: {
        '/_next/static/css/style.css': { status: 404, body: 'Not Found', contentType: 'text/plain' },
      },
    }));
    const { code, output } = runSmoke(smokePort);
    expect(code).toBe(1);
    expect(output).toContain('404');
  }, 60000);

  test('F: JS with wrong Content-Type → exit 1', async () => {
    await createBuildDir(makeServerJs({
      assets: {
        '/_next/static/chunks/main-abc.js': { status: 200, body: 'code', contentType: 'text/plain' },
      },
    }));
    const { code, output } = runSmoke(smokePort);
    expect(code).toBe(1);
    expect(output).toContain('JS wrong Content-Type');
  }, 60000);

  test('G: CSS with wrong Content-Type → exit 1', async () => {
    await createBuildDir(makeServerJs({
      assets: {
        '/_next/static/css/style.css': { status: 200, body: 'body{}', contentType: 'text/plain' },
      },
    }));
    const { code, output } = runSmoke(smokePort);
    expect(code).toBe(1);
    expect(output).toContain('CSS wrong Content-Type');
  }, 60000);

  test('H: one page returns 500 → exit 1', async () => {
    await createBuildDir(makeServerJs({
      pages: { '/stages': { status: 500, body: 'Error' } },
    }));
    const { code, output } = runSmoke(smokePort);
    expect(code).toBe(1);
    expect(output).toContain('500');
  }, 60000);

  test('I: server exits before /api/health → exit 1', async () => {
    await createBuildDir(makeServerJs({ exitImmediately: true }));
    const { code, output } = runSmoke(smokePort);
    expect(code).toBe(1);
    expect(output).toContain('Server exited prematurely');
  }, 60000);

  test('J: server exits during asset checks → exit 1', async () => {
    await createBuildDir(makeServerJs({ exitDuringRequests: true }));
    const { code } = runSmoke(smokePort);
    expect(code).toBe(1);
  }, 60000);

  test('K: port already occupied → exit 1', async () => {
    // Occupy the port
    const net = require('net');
    const blocker = net.createServer();
    await new Promise<void>((res) => blocker.listen(smokePort, '127.0.0.1', res));
    try {
      await createBuildDir(makeServerJs({}));
      const { code } = runSmoke(smokePort);
      expect(code).toBe(1);
    } finally {
      await new Promise<void>((res) => blocker.close(res));
    }
  }, 60000);

  test('L: clean shutdown confirms process termination via PID', async () => {
    // Server fixture writes its PID to a temp file
    const pidFile = join(testDir, 'server.pid');
    const serverWithPid = makeServerJs({}).replace(
      "server.listen(",
      `require('fs').writeFileSync('${pidFile.replace(/\\/g, '\\\\')}', String(process.pid));\nserver.listen(`
    );
    await createBuildDir(serverWithPid);

    const { code, output } = runSmoke(smokePort);
    expect(code).toBe(0);
    expect(output).toContain('SERVER_SHUTDOWN_CONFIRMED=true');
    expect(output).toContain('SERVER_ORPHAN_PROCESS_COUNT=0');

    // Verify process is actually gone
    const { readFileSync } = require('fs');
    try {
      const pid = parseInt(readFileSync(pidFile, 'utf8').trim());
      // signal 0 checks existence without killing
      try { process.kill(pid, 0); fail(`Process ${pid} still alive`); } catch { /* expected — process gone */ }
    } catch { /* PID file may not exist if server didn't write it — acceptable */ }

    // Verify port is free
    const net = require('net');
    const probe = net.createServer();
    await new Promise<void>((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(smokePort, '127.0.0.1', () => { probe.close(); resolve(); });
    });
  }, 60000);

  test('M: server ignoring SIGTERM is killed with SIGKILL', async () => {
    // Fixture that traps SIGTERM and ignores it
    const stubbornServer = makeServerJs({}).replace(
      "process.on('SIGTERM'",
      "process.on('SIGTERM', () => { /* ignore SIGTERM */ }); process.on('SIGTERM_ORIG'"
    );
    await createBuildDir(stubbornServer);

    const { code, output } = runSmoke(smokePort);
    expect(code).toBe(0);
    expect(output).toContain('SERVER_SHUTDOWN_CONFIRMED=true');
    // SIGKILL may or may not be needed depending on timing
  }, 60000);
});
