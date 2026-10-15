/** @jest-environment node */
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));
jest.mock('@/lib/guards',()=>({requireAuth:jest.fn(async()=>({user:{id:'synthetic-actor',role:'ADMIN'},expires:'2099-01-01'})),isErrorResponse:()=>false}));
jest.mock('@/lib/core-v2/client',()=>({...jest.requireActual('@/lib/core-v2/client'),requireCoreV2Client:jest.fn(async()=>({}))}));
jest.mock('@/lib/core-v2/http/actor',()=>({resolveActor:jest.fn(async()=>({userId:'synthetic-actor',role:'ADMIN'}))}));

import { logger } from '@/lib/logger';
import { failFromError } from '@/lib/core-v2/http/respond';
import { defineStaffRoute,NO_PARAMS } from '@/lib/core-v2/http/staff-route';
import { NextRequest,NextResponse } from 'next/server';

beforeEach(() => jest.clearAllMocks());

test.each([
  new Error('synthetic-private-provider-body'),
  Object.assign(new TypeError('synthetic-private-query'), { name: 'synthetic-private-name', code: 'synthetic-private-code' }),
  { message: 'synthetic-private-object', nested: { body: 'synthetic-private-request' } },
  'synthetic-private-thrown-string',
])('unknown route failures never log the raw exception or its private data', async error => {
  const response = failFromError(error, 'synthetic-request-correlation');
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Unexpected error.' }, correlationId: 'synthetic-request-correlation' });
  expect(logger.error).toHaveBeenCalledTimes(1);
  expect(jest.mocked(logger.error).mock.calls[0]?.[0]).not.toHaveProperty('err');
  const serialized = JSON.stringify(jest.mocked(logger.error).mock.calls);
  expect(serialized).not.toContain('synthetic-private');
  expect(serialized).toContain('synthetic-request-correlation');
  expect(serialized).toContain('CORE_V2_ROUTE_UNEXPECTED_ERROR');
});

test('a recognized database failure retains its non-sensitive operational code', () => {
  failFromError(Object.assign(new Error('synthetic-private-database-details'), { code: 'P2002' }), 'synthetic-request-correlation');
  expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'P2002' }), expect.any(String));
  expect(JSON.stringify(jest.mocked(logger.error).mock.calls)).not.toContain('synthetic-private');
});

test('the complete staff wrapper logs an unknown failure once without raw error or request identifiers',async()=>{
  const route=defineStaffRoute({handler:async()=>{throw new Error('synthetic-private-driver-payload');}});
  const response=await route(new NextRequest('http://localhost/api/v2/staff/students/synthetic-private-path',
    {headers:{'x-correlation-id':'synthetic-request-correlation'}}),NO_PARAMS);
  expect(response.status).toBe(500);
  expect(await response.json()).toMatchObject({error:{code:'INTERNAL_ERROR',message:'Unexpected error.'}});
  expect(logger.error).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(jest.mocked(logger.error).mock.calls)).not.toContain('synthetic-private');
});

test('an error mapper cannot turn a refused handler into a successful response',async()=>{
  const route=defineStaffRoute({handler:async()=>{throw new Error('synthetic-private-driver-payload');},
    mapError:()=>new NextResponse('synthetic-private-mapped-success',{status:200})});
  const response=await route(new NextRequest('http://localhost/api/v2/staff/example'),NO_PARAMS);
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain('synthetic-private');
});
