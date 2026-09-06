import { NextRequest, NextResponse } from 'next/server';
const mockCreateFamily = jest.fn();
jest.mock('@/lib/families/create-family', () => ({ createFamilyHandler: () => (request: NextRequest) => mockCreateFamily(request) }));
import { POST } from '@/app/api/assistante/students/route';
beforeEach(() => jest.clearAllMocks());
it('retains the single studentId response alias after canonical family creation', async () => {
 const body = { parentUserId: 'p1', children: [{ studentId: 's1', firstName: 'Student' }], invitationQueued: true };
 mockCreateFamily.mockResolvedValue(NextResponse.json(body, { status: 201 }));
 const request = new NextRequest('http://localhost/api/assistante/students', { method: 'POST' });
 const response = await POST(request);
 expect(mockCreateFamily).toHaveBeenCalledWith(request);
 expect(response.status).toBe(201);
 expect(await response.json()).toEqual({ ...body, studentId: 's1' });
});
it('preserves canonical validation failures without constructing a success', async () => {
 mockCreateFamily.mockResolvedValue(NextResponse.json({ error: { code: 'PARENT_PHONE_INVALID' } }, { status: 400 }));
 const response = await POST(new NextRequest('http://localhost/api/assistante/students', { method: 'POST' }));
 expect(response.status).toBe(400);
 expect(await response.json()).toEqual({ error: { code: 'PARENT_PHONE_INVALID' } });
});
it('returns both children unchanged without a single-student alias', async () => {
 const body = { parentUserId: 'p1', children: [{ studentId: 's1' }, { studentId: 's2' }], invitationQueued: true };
 mockCreateFamily.mockResolvedValue(NextResponse.json(body, { status: 201 }));
 const response = await POST(new NextRequest('http://localhost/api/assistante/students', { method: 'POST' }));
 expect(response.status).toBe(201);
 const result = await response.json();
 expect(result).toEqual(body);
 expect(result).not.toHaveProperty('studentId');
});
