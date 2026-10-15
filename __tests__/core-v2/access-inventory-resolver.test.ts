import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createAccessInventory } from '@/scripts/core-v2/access-policy-inventory';
let root: string;
function put(path: string, text: string) { const file = join(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); }
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'nexus-policy-ast-'));
  put('tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./*'] }, moduleResolution: 'bundler', module: 'esnext' } }));
  put('lib/core-v2/rbac.ts', 'export function assertCapability(actor: unknown, value: string) {}');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
const guard = "import { assertCapability } from '@/lib/core-v2/rbac';";
function putPrivateBoundary(operation: string) {
  put('lib/guards.ts','export async function requireAuth(){return {user:{id:"actor",role:"ELEVE"}};} export function isErrorResponse(x:unknown){return false;}');
  put('lib/auth/private-v1-session.ts','export async function readBoundPrivateV1Session(request:unknown,session:unknown){return {userId:"actor",role:"ELEVE",sessionVersion:1,expiresAt:99};}');
  put('lib/auth/v1-session-authority.ts','export async function acquireV1SessionAuthority(original:unknown){return {verify:async()=>{},release:async()=>{}};}');
  put('lib/core-v2/client.ts','export async function requireCoreV2Client(){return {$transaction:async(fn:any)=>fn({})};}');
  put('lib/core-v2/http/actor.ts','export async function resolveActor(client:unknown,id:unknown){return {userId:id,role:"ELEVE"};}');
  put('lib/core-v2/http/respond.ts','export function fail(correlation:string,status:number){return {};}');
  put('lib/core-v2/services/context.ts','export function createServiceContext(actor:unknown){return {actor};}');
  put('lib/core-v2/http/staff-route.ts',`import {requireAuth,isErrorResponse} from '@/lib/guards';import {resolveActor} from './actor';
    import {readBoundPrivateV1Session} from '@/lib/auth/private-v1-session';import {requireCoreV2Client} from '../client';
    import {createServiceContext} from '../services/context';import {fail} from './respond';
    export function defineStaffRoute(options:any){return async(request:any)=>{
      const session=await requireAuth();if(isErrorResponse(session))return fail('correlation',401);
      const original=await readBoundPrivateV1Session(request,session);const db=await requireCoreV2Client();
      const actor=await resolveActor(db,session.user.id);const ctx=createServiceContext(actor);
      return options.handler({db,ctx,request,original});};}`);
  put('lib/core-v2/services/private-operation.ts',`import {acquireV1SessionAuthority} from '@/lib/auth/v1-session-authority';
    import {resolveActor} from '../http/actor';import {assertCapability} from '../rbac';import {createServiceContext} from './context';
    export async function renamedDelegate(client:any,original:any,ctx:any){${operation}}`);
  put('app/api/v2/example/route.ts',`import {defineStaffRoute} from '@/lib/core-v2/http/staff-route';
    import {renamedDelegate} from '@/lib/core-v2/services/private-operation';
    export const GET=defineStaffRoute({handler:async({db,ctx,original}:any)=>renamedDelegate(db,original,ctx)});`);
}
const freshOperation=`const claims=Object.freeze({...original});return await client.$transaction(async tx=>{
  const lease=await acquireV1SessionAuthority(claims);const actor=await resolveActor(tx,claims.userId);
  assertCapability(actor,'READ');await lease.verify();await lease.release();return {};});`;
test.each([
  ['plain closure','()=>{original.userId="forged";}'],
  ['method receiver','()=>box.mutate()'],
])('an imported delegate cannot hide authority mutation through a no-arg %s',(_name,callback)=>{
  putPrivateBoundary(freshOperation);
  put('lib/http/bounded-request-body.ts','export async function callNoArgs(fn:any){return fn();}');
  put('lib/core-v2/services/private-operation.ts',`import {acquireV1SessionAuthority} from '@/lib/auth/v1-session-authority';
    import {resolveActor} from '../http/actor';import {assertCapability} from '../rbac';
    import {callNoArgs} from '@/lib/http/bounded-request-body';
    export async function renamedDelegate(client:any,original:any,ctx:any){
      const box={original,mutate(){this.original.userId="forged";}};
      await callNoArgs(${callback});${freshOperation}}`);
  const result=createAccessInventory(root).handlers[0];
  expect(result.unresolved.some(value=>value.endsWith(':authority-write'))).toBe(true);
});
test('an imported delegate follows a pure no-arg captured reader without creating authority gates',()=>{
  putPrivateBoundary(freshOperation);
  put('lib/http/bounded-request-body.ts','export async function callNoArgs(fn:any){return fn();}');
  put('lib/core-v2/services/private-operation.ts',`import {acquireV1SessionAuthority} from '@/lib/auth/v1-session-authority';
    import {resolveActor} from '../http/actor';import {assertCapability} from '../rbac';
    import {callNoArgs} from '@/lib/http/bounded-request-body';
    export async function renamedDelegate(client:any,original:any,ctx:any){await callNoArgs(()=>original.role);${freshOperation}}`);
  const result=createAccessInventory(root).handlers[0];expect(result.unresolved).toEqual([]);
  for(const path of result.boundaryPaths)expect(path.filter(value=>value.kind==='BOUNDARY_FRESH_CORE')).toHaveLength(1);
});
test('a recursive structural producer refuses without recursively expanding forever',()=>{
  putPrivateBoundary(`ctx.now();${freshOperation}`);
  put('lib/core-v2/services/context.ts','function recursive(actor:any):any{return {...recursive(actor)};} export function createServiceContext(actor:any){return {...recursive(actor),actor};}');
  expect(createAccessInventory(root).handlers[0].unresolved.some(value=>value.endsWith(':recursive-object-producer'))).toBe(true);
});
test.each([
  'Function.prototype.call=(()=>true) as never;',
  'const inherited=Function.prototype;inherited.call=(()=>true) as never;',
  "Object.defineProperty(Function.prototype,'call',{value:()=>true});",
])('native property reads refuse a mutated Function primordial: %s',mutation=>{
  putPrivateBoundary(freshOperation.replace('return await client.$transaction',
    `${mutation}Object.prototype.hasOwnProperty.call(claims,'userId');return await client.$transaction`));
  expect(createAccessInventory(root).handlers[0].unresolved.length).toBeGreaterThan(0);
});
test('private provenance follows actual wrapper arguments through a renamed helper and frozen original cookie',()=>{
  putPrivateBoundary(freshOperation);
  const handler=createAccessInventory(root).handlers[0];expect(handler.unresolved).toEqual([]);
  for(const path of handler.boundaryPaths){
    const cookie=path.find(gate=>gate.kind==='BOUNDARY_PRIVATE_V1');expect(cookie).toBeDefined();
    expect(path.some(gate=>gate.kind==='BOUNDARY_V1_LEASE'&&gate.value===cookie!.value)).toBe(true);
    expect(path.some(gate=>gate.kind==='BOUNDARY_FRESH_CORE'&&gate.value===cookie!.value)).toBe(true);
  }
});
test('a genuine transaction CRUD delete with a scalar identity preserves private provenance',()=>{
  putPrivateBoundary(freshOperation.replace("assertCapability(actor,'READ');",
    "await tx.user.delete({where:{id:claims.userId}});assertCapability(actor,'READ');"));
  expect(createAccessInventory(root).handlers[0].unresolved).toEqual([]);
});
test('a context clock follows the actual inert default arrow in its source',()=>{
  putPrivateBoundary(freshOperation.replace("assertCapability(actor,'READ');","const local=createServiceContext(actor);local.now();assertCapability(actor,'READ');"));
  put('lib/core-v2/services/context.ts','export function createServiceContext(actor:any,options:any={}){return {actor,now:options.now??(()=>new Date())};}');
  expect(createAccessInventory(root).handlers[0].unresolved).toEqual([]);
});
test.each([
  "{now:()=>{claims.userId='forged';return new Date();}}",
  "{__proto__:{now(){claims.userId='forged';return new Date();}}}",
])('a supplied or inherited context clock cannot mutate captured private claims: %s',options=>{
  putPrivateBoundary(freshOperation.replace("assertCapability(actor,'READ');",`const local=createServiceContext(actor,${options});local.now();assertCapability(actor,'READ');`));
  put('lib/core-v2/services/context.ts','export function createServiceContext(actor:any,options:any={}){return {actor,now:options.now??(()=>new Date())};}');
  expect(createAccessInventory(root).handlers[0].unresolved.length).toBeGreaterThan(0);
});
test('an omitted default parameter with effects cannot be hidden by structural return projection',()=>{
  putPrivateBoundary(freshOperation.replace("assertCapability(actor,'READ');",
    "function unsafe(value:any,options=(claims.userId='forged',{})){return {actor:value};}unsafe(actor);assertCapability(actor,'READ');"));
  expect(createAccessInventory(root).handlers[0].unresolved.length).toBeGreaterThan(0);
});
test.each([
  "const fake={delete(value:any){value.role='ADMIN';}};fake.delete(claims);",
  'await tx.user.delete({data:claims});',
  'tx.user.delete=async()=>null;await tx.user.delete({where:{id:claims.userId}});',
])('CRUD spelling cannot certify an authority escape: %s',operation=>{
  putPrivateBoundary(freshOperation.replace("assertCapability(actor,'READ');",`${operation}assertCapability(actor,'READ');`));
  expect(createAccessInventory(root).handlers[0].unresolved.length).toBeGreaterThan(0);
});
test.each([
  ['forged claims',freshOperation.replace('Object.freeze({...original})','{userId:"forged",role:"ADMIN"}')],
  ['later identity override',freshOperation.replace('Object.freeze({...original})','Object.freeze({...original,userId:"forged"})')],
  ['unawaited lease',freshOperation.replace('await acquireV1SessionAuthority','acquireV1SessionAuthority')],
  ['fresh actor before lease',freshOperation.replace('const lease=await acquireV1SessionAuthority(claims);const actor=await resolveActor(tx,claims.userId);','const actor=await resolveActor(tx,claims.userId);const lease=await acquireV1SessionAuthority(claims);')],
  ['released lease',freshOperation.replace('const actor=await resolveActor','await lease.release();const actor=await resolveActor')],
  ['identity mutation',freshOperation.replace('const actor=await resolveActor','Object.assign(claims,{userId:"forged"});const actor=await resolveActor')],
])('%s cannot certify fresh private Core authority',(_name,operation)=>{
  putPrivateBoundary(operation);const handler=createAccessInventory(root).handlers[0];
  expect(handler.unresolved.length).toBeGreaterThan(0);
});
test('two exports retain their own guards, including HEAD and OPTIONS', () => {
  put('app/api/v2/example/route.ts', `${guard}
    export function GET(){ assertCapability({}, 'READ'); return {}; }
    export function POST(){ assertCapability({}, 'WRITE'); return {}; }
    export function HEAD(){ return {}; } export function OPTIONS(){ return {}; }`);
  const handlers = createAccessInventory(root).handlers;
  expect(handlers.map(h => h.method).sort()).toEqual(['GET', 'HEAD', 'OPTIONS', 'POST']);
  expect(handlers.find(h => h.method === 'GET')?.gatePaths).toEqual([[expect.objectContaining({ value: 'READ' })]]);
  expect(handlers.find(h => h.method === 'POST')?.gatePaths).toEqual([[expect.objectContaining({ value: 'WRITE' })]]);
  expect(handlers.find(h => h.method === 'HEAD')?.unguardedPath).toBe(true);
});
test('aliases and barrels resolve declarations by module instead of a homonym', () => {
  put('lib/core-v2/services/a.ts', `${guard} export function read(){ assertCapability({}, 'READ'); return {}; }`);
  put('lib/core-v2/services/b.ts', `${guard} export function read(){ assertCapability({}, 'WRONG'); return {}; }`);
  put('lib/core-v2/services/index.ts', "export { read as allowed } from './a';");
  put('app/api/v2/example/route.ts', "import { allowed as renamed } from '@/lib/core-v2/services'; export function GET(){ return renamed(); }");
  expect(createAccessInventory(root).handlers[0].gatePaths).toEqual([[expect.objectContaining({ value: 'READ' })]]);
});
test.each([
  ['comment', "// assertCapability({}, 'READ');\nreturn {};"],
  ['after-return', "return {}; assertCapability({}, 'READ');"],
  ['unused-callback', "const unused = () => assertCapability({}, 'READ'); return {};"],
  ['unguarded-branch', "if (Date.now()) { assertCapability({}, 'READ'); return {}; } return {};"],
])('%s cannot masquerade as an unconditional guard', (_name, body) => {
  put('app/api/v2/example/route.ts', `${guard} export function GET(){ ${body} }`);
  expect(createAccessInventory(root).handlers[0].unguardedPath).toBe(true);
});
test('a local fake function with the guard name supplies no protection', () => {
  put('app/api/v2/example/route.ts', "function assertCapability(...args: unknown[]){} export function GET(){ assertCapability({}, 'READ'); return {}; }");
  expect(createAccessInventory(root).handlers[0].unguardedPath).toBe(true);
});
test('a guard beyond 3000 characters remains visible without truncation', () => {
  put('app/api/v2/example/route.ts', `${guard} export function GET(){ ${'/* padding */'.repeat(500)} assertCapability({}, 'READ'); return {}; }`);
  expect(createAccessInventory(root).handlers[0].unguardedPath).toBe(false);
});
test('a reexported handler and namespace import resolve their actual symbols', () => {
  put('lib/core-v2/services/a.ts', `${guard} export function GET(){ assertCapability({}, 'READ'); return {}; }`);
  put('app/api/v2/example/route.ts', "export { GET } from '@/lib/core-v2/services/a';");
  put('app/api/v2/namespace/route.ts', "import * as rbac from '@/lib/core-v2/rbac'; export function GET(){ rbac.assertCapability({}, 'WRITE'); return {}; }");
  expect(createAccessInventory(root).handlers.map(h => h.gatePaths[0][0].value).sort()).toEqual(['READ', 'WRITE']);
});
test('an unresolved dynamic delegate is reported and never credited with a guard', () => {
  put('app/api/v2/example/route.ts', `${guard} const handler = Date.now() ? () => assertCapability({}, 'READ') : () => ({}); export function GET(){ return handler(); }`);
  const result = createAccessInventory(root).handlers[0]; expect(result.unguardedPath).toBe(true);
  expect(result.unresolved).not.toEqual([]);
});
test('a cycle without a guard is reported and cannot prove protection', () => {
  put('app/api/v2/example/route.ts', 'function a(){ return b(); } function b(){ return a(); } export function GET(){ return a(); }');
  const result = createAccessInventory(root).handlers[0]; expect(result.unguardedPath).toBe(true); expect(result.unresolved).not.toEqual([]);
});

test.each([
  ['catch-success', "try { assertCapability(actor, 'READ'); return {}; } catch { return {}; }"],
  ['loop-return', "for (const x of [1]) { return {}; } assertCapability(actor, 'READ'); return {};"],
  ['fake-transaction', "const fake = {$transaction(fn: unknown){ return {}; }}; fake.$transaction(() => assertCapability(actor, 'READ')); return {};"],
  ['lazy-assignment', "let allowed = false; allowed &&= (assertCapability(actor, 'READ'), true); return {};"],
  ['switch-break', "switch(Date.now()){ case 1: break; assertCapability(actor, 'READ'); default: assertCapability(actor, 'READ'); } return {};"],
  ['successful-fail', "if(Date.now()) return fail('correlation', 200, 'OK', 'success'); assertCapability(actor, 'READ'); return {};"],
  ['fake-response', "const NextResponse = {json(...args: unknown[]){return {};}}; if(Date.now()) return NextResponse.json({}, {status:403}); assertCapability(actor, 'READ'); return {};"],
  ['forged-actor', "assertCapability({userId:'forged',role:'ADMIN'}, 'READ'); return {};"],
])('%s cannot produce a false unconditional guard', (_name, body) => {
  put('lib/core-v2/http/respond.ts', 'export function fail(correlation: string, status: number, code: string, message: string) { return {}; }');
  put('app/api/v2/example/route.ts', `${guard} import {fail} from '@/lib/core-v2/http/respond'; export function GET(actor: unknown){ ${body} }`);
  expect(createAccessInventory(root).handlers[0].unguardedPath).toBe(true);
});

test('dead authentication in the canonical wrapper is rejected', () => {
  put('lib/guards.ts', 'export async function requireAuth(){return {user:{id:"actor"}};}');
  put('lib/core-v2/http/actor.ts', 'export async function resolveActor(...args: unknown[]){return {};}');
  put('lib/core-v2/http/staff-route.ts', `import {requireAuth} from '@/lib/guards'; import {resolveActor} from './actor';
    export function defineStaffRoute(options: any){return async()=>{if(false){await requireAuth(); await resolveActor();} return options.handler({});};}`);
  put('app/api/v2/example/route.ts', `${guard} import {defineStaffRoute} from '@/lib/core-v2/http/staff-route';
    export const GET=defineStaffRoute({handler:async({ctx}:any)=>{assertCapability(ctx.actor,'READ');return {};}});`);
  expect(createAccessInventory(root).handlers[0].unresolved).toContain('staff-wrapper-boundary-missing');
});

test('the canonical wrapper binds accepted authentication, actor and context in order', () => {
  put('lib/guards.ts', 'export async function requireAuth(){return {user:{id:"actor"}};} export function isErrorResponse(value:unknown){return false;}');
  put('lib/core-v2/http/actor.ts', 'export async function resolveActor(...args: unknown[]){return {};}');
  put('lib/core-v2/services/context.ts', 'export function createServiceContext(actor:unknown){return {actor};}');
  put('lib/core-v2/http/respond.ts','export function fail(correlation:string,status:number){return {};}');
  put('lib/core-v2/http/staff-route.ts', `import {requireAuth,isErrorResponse} from '@/lib/guards'; import {resolveActor} from './actor';
    import {createServiceContext} from '../services/context'; import {fail} from './respond';
    export function defineStaffRoute(options:any){return async()=>{
      const session=await requireAuth(); if(isErrorResponse(session))return fail('correlation',401);
      const actor=await resolveActor({},session.user.id); const ctx=createServiceContext(actor); return options.handler({ctx,session});};}`);
  put('app/api/v2/example/route.ts', `${guard} import {defineStaffRoute} from '@/lib/core-v2/http/staff-route';
    export const GET=defineStaffRoute({handler:async({ctx}:any)=>{assertCapability(ctx.actor,'READ');return {};}});`);
  const result=createAccessInventory(root).handlers[0];
  expect(result.unresolved).toEqual([]);
  expect(result.boundaryPaths[0].map(gate=>gate.kind)).toEqual(['BOUNDARY_AUTH','BOUNDARY_CORE','BOUNDARY_HANDLER']);
});

test('declarations and every distinct call site retain valid independent locations', () => {
  put('app/api/v2/example/route.ts', `${guard}\nexport function GET(actor: unknown){\n assertCapability(actor,'READ');\n assertCapability(actor,'READ');\n return {};\n}`);
  const handler = createAccessInventory(root).handlers[0];
  expect(handler.calls.filter(call=>call.name==='assertCapability').map(call=>call.callSite.line)).toEqual([3,4]);
  expect(handler.guards[0]).toMatchObject({declaration:{file:'lib/core-v2/rbac.ts',line:1},callSite:{file:'app/api/v2/example/route.ts',line:4}});
});

test('do-while guards dominate its normal return', () => {
  put('app/api/v2/example/route.ts', `${guard} export function GET(actor: unknown){do{assertCapability(actor,'READ');}while(false);return {};}`);
  expect(createAccessInventory(root).handlers[0].unguardedPath).toBe(false);
});

test('a return in finally suppresses a rejected guard and therefore exposes an unguarded success',()=>{
  put('app/api/v2/example/route.ts', `${guard} export function GET(actor:unknown){try{assertCapability(actor,'READ');return {};}finally{return {};}}`);
  expect(createAccessInventory(root).handlers[0].unguardedPath).toBe(true);
});

test('a finally block that only cleans up does not suppress a rejected guard',()=>{
  put('app/api/v2/example/route.ts', `${guard} export function GET(actor:unknown){try{assertCapability(actor,'READ');return {};}finally{console.log('cleanup');}}`);
  expect(createAccessInventory(root).handlers[0].unguardedPath).toBe(false);
});

test('a fire-and-forget async delegate cannot reject the successful route',()=>{
  put('lib/core-v2/services/a.ts',`${guard} export async function protectedLater(actor:unknown){assertCapability(actor,'READ');}`);
  put('app/api/v2/example/route.ts',"import {protectedLater} from '@/lib/core-v2/services/a'; export function GET(actor:unknown){protectedLater(actor);return {};}");
  expect(createAccessInventory(root).handlers[0].unguardedPath).toBe(true);
});

test('a typed local fake transaction object is not a Prisma authority',()=>{
  put('app/api/v2/example/route.ts',`${guard} import type {PrismaClient} from '@/core-v2/generated/client';
    export function GET(actor:unknown){const fake:PrismaClient={$transaction(fn:unknown){return {};}} as never;
      fake.$transaction(()=>assertCapability(actor,'READ'));return {};}`);
  expect(createAccessInventory(root).handlers[0].unguardedPath).toBe(true);
});

test.each(['other-handler','early-success','detached-handler'])('the wrapper rejects %s outside the actual guarded callback',fault=>{
  put('lib/guards.ts','export async function requireAuth(){return {user:{id:"actor"}};} export function isErrorResponse(value:unknown){return false;}');
  put('lib/core-v2/http/actor.ts','export async function resolveActor(...args:unknown[]){return {};}');
  put('lib/core-v2/services/context.ts','export function createServiceContext(actor:unknown){return {actor};}');
  put('lib/core-v2/http/respond.ts','export function fail(correlation:string,status:number){return {};}');
  put('lib/core-v2/http/staff-route.ts',`import {requireAuth,isErrorResponse} from '@/lib/guards';import {resolveActor} from './actor';
    import {createServiceContext} from '../services/context';import {fail} from './respond';
    export function defineStaffRoute(options:any){return async()=>{${fault==='early-success'?'if(Date.now())return {};':''}
      const session=await requireAuth();if(isErrorResponse(session))return fail('correlation',401);
      const actor=await resolveActor({},session.user.id);const ctx=createServiceContext(actor);
      ${fault==='other-handler'?'const other={handler:()=>({})};return other.handler({ctx});':fault==='detached-handler'?'options.handler({ctx});return {};':'return options.handler({ctx});'}};}`);
  put('app/api/v2/example/route.ts',`${guard} import {defineStaffRoute} from '@/lib/core-v2/http/staff-route';
    export const GET=defineStaffRoute({handler:async({ctx}:any)=>{assertCapability(ctx.actor,'READ');return {};}});`);
  expect(createAccessInventory(root).handlers[0].unresolved).toContain('staff-wrapper-boundary-missing');
});

test('opposite boundary orders remain distinct even with the same session and capability',()=>{
  put('lib/guards.ts','export async function requireAuth(){return {user:{id:"actor"}};} export function isErrorResponse(value:unknown){return false;}');
  put('lib/core-v2/http/actor.ts','export async function resolveActor(...args:unknown[]){return {};}');
  put('lib/core-v2/http/respond.ts','export function fail(correlation:string,status:number){return {};}');
  put('app/api/v2/example/route.ts',`${guard} import {requireAuth,isErrorResponse} from '@/lib/guards';
    import {resolveActor} from '@/lib/core-v2/http/actor';import {fail} from '@/lib/core-v2/http/respond';
    export async function GET(actor:unknown){const session=await requireAuth();
      if(Date.now()){await resolveActor({},session.user.id);if(isErrorResponse(session))return fail('correlation',401);
        assertCapability(actor,'READ');return {};}
      if(isErrorResponse(session))return fail('correlation',401);await resolveActor({},session.user.id);assertCapability(actor,'READ');return {};}`);
  const paths=createAccessInventory(root).handlers[0].boundaryPaths;
  expect(paths.map(path=>path.map(gate=>gate.kind).join('→')).sort()).toEqual(['BOUNDARY_AUTH→BOUNDARY_CORE','BOUNDARY_CORE→BOUNDARY_AUTH']);
});

test('an async alias still requires propagation of its promise',()=>{
  put('lib/core-v2/services/a.ts',`${guard} export async function protectedLater(actor:unknown){assertCapability(actor,'READ');}`);
  put('app/api/v2/example/route.ts',"import {protectedLater} from '@/lib/core-v2/services/a';const alias=protectedLater;export function GET(actor:unknown){alias(actor);return {};}");
  expect(createAccessInventory(root).handlers[0].unguardedPath).toBe(true);
});
test('a detached canonical transaction cannot reject the route through its callback',()=>{
  put('lib/core-v2/services/context.ts','export function inTransaction(client:any,fn:any){return client.$transaction(fn);}');
  put('app/api/v2/example/route.ts',`${guard} import {inTransaction} from '@/lib/core-v2/services/context';
    export function GET(actor:unknown){inTransaction({},()=>assertCapability(actor,'READ'));return {};}`);
  expect(createAccessInventory(root).handlers[0].unguardedPath).toBe(true);
});
test('a detached Core actor resolution never establishes a Core boundary',()=>{
  put('lib/guards.ts','export async function requireAuth(){return {user:{id:"actor"}};}export function isErrorResponse(value:unknown){return false;}');
  put('lib/core-v2/http/actor.ts','export async function resolveActor(...args:unknown[]){return {};}');
  put('lib/core-v2/http/respond.ts','export function fail(correlation:string,status:number){return {};}');
  put('app/api/v2/example/route.ts',`${guard} import {requireAuth,isErrorResponse} from '@/lib/guards';
    import {resolveActor} from '@/lib/core-v2/http/actor';import {fail} from '@/lib/core-v2/http/respond';
    export async function GET(actor:unknown){const session=await requireAuth();if(isErrorResponse(session))return fail('correlation',401);
      resolveActor({},session.user.id);assertCapability(actor,'READ');return {};}`);
  expect(createAccessInventory(root).handlers[0].boundaryPaths.flat().some(gate=>gate.kind==='BOUNDARY_CORE')).toBe(false);
});
