import { findOrCaptureResponsableLeadInTransaction } from '@/lib/crm/contact-leads';
import { enqueueEmailIntent } from '@/lib/email/outbox';

jest.mock('@/lib/email/outbox', () => ({ enqueueEmailIntent: jest.fn() }));

const mockEnqueue = enqueueEmailIntent as jest.Mock;

function transaction() {
  return {
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    contactLead: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    jobOutbox: {},
  };
}

describe('findOrCaptureResponsableLeadInTransaction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('normalizes the email, locks it, and reuses the governed existing lead', async () => {
    const tx = transaction();
    const existing = { id: 'lead-existing', name: 'Sonia Ben Salah', email: 'sonia@example.test', phone: null, status: 'NEW' };
    tx.contactLead.findFirst.mockResolvedValue(existing);

    const result = await findOrCaptureResponsableLeadInTransaction(tx as never, {
      name: 'Sonia Ben Salah', email: '  SONIA@Example.Test ', phone: '', source: 'STAFF_STUDENT_CREATION',
    });

    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      'nexus:contact-lead:sonia@example.test',
    );
    expect(tx.contactLead.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: { equals: 'sonia@example.test', mode: 'insensitive' } },
    }));
    expect(tx.contactLead.create).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it('captures one minimized governed lead when no normalized email exists', async () => {
    const tx = transaction();
    tx.contactLead.findFirst.mockResolvedValue(null);
    tx.contactLead.create.mockResolvedValue({
      id: 'lead-new', name: 'Sonia Ben Salah', email: 'sonia@example.test', phone: '+21699111222',
      profile: null, interest: null, urgency: null, source: 'STAFF_STUDENT_CREATION', status: 'NEW', notes: null,
      createdAt: new Date('2026-08-30T00:00:00Z'), updatedAt: new Date('2026-08-30T00:00:00Z'),
    });

    const result = await findOrCaptureResponsableLeadInTransaction(tx as never, {
      name: ' Sonia Ben Salah ', email: 'SONIA@EXAMPLE.TEST', phone: ' +21699111222 ', source: 'STAFF_STUDENT_CREATION',
    });

    expect(tx.contactLead.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      name: 'Sonia Ben Salah', email: 'sonia@example.test', phone: '+21699111222', source: 'STAFF_STUDENT_CREATION', status: 'NEW',
    }) });
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('lead-new');
  });

  it.each(['', '   ', undefined])('fails closed without a responsible email (%p)', async (email) => {
    const tx = transaction();

    await expect(findOrCaptureResponsableLeadInTransaction(tx as never, {
      name: 'Sonia Ben Salah', email, source: 'STAFF_STUDENT_CREATION',
    })).rejects.toMatchObject({ code: 'missing_required' });
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(tx.contactLead.findFirst).not.toHaveBeenCalled();
    expect(tx.contactLead.create).not.toHaveBeenCalled();
  });
});
