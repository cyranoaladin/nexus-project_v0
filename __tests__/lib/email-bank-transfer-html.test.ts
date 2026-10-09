const mockQueueCommittedEmail = jest.fn();
jest.mock('@/lib/email/queue', () => ({
  queueCommittedEmail: (...args: unknown[]) => mockQueueCommittedEmail(...args),
}));

import { sendStageBankTransferConfirmation } from '@/lib/email';

describe('bank-transfer acknowledgment HTML boundary', () => {
  beforeEach(() => mockQueueCommittedEmail.mockReset().mockResolvedValue({ id: 'synthetic-intent' }));

  test.each([
    { field: 'parent', value: '<img src=x onerror="alert(1)">Parent & Élève' },
    { field: 'student', value: '<a href="https://example.invalid">Student</a>' },
    { field: 'title', value: '<svg onload="alert(1)">Maths</svg>' },
  ])('renders $field as literal text without injected elements', async ({ field, value }) => {
    await sendStageBankTransferConfirmation('synthetic@example.test',
      field === 'parent' ? value : 'Synthetic Parent',
      field === 'student' ? value : 'Synthetic Student',
      field === 'title' ? value : 'Synthetic Stage', 42);
    const html: string = mockQueueCommittedEmail.mock.calls[0][0].html;
    const root = document.createElement('div');
    root.innerHTML = html;
    expect(root.querySelector('img, svg, a, script, [onerror], [onload]') !== null).toBe(false);
    expect(root.textContent?.includes(value)).toBe(true);
  });

  test('preserves ordinary Unicode text and an absent student', async () => {
    await sendStageBankTransferConfirmation('synthetic@example.test', 'Parent & Élève', null, 'Maths < avancées', 42);
    const root = document.createElement('div');
    root.innerHTML = mockQueueCommittedEmail.mock.calls[0][0].html;
    expect(root.textContent?.includes('Parent & Élève')).toBe(true);
    expect(root.textContent?.includes('Maths < avancées')).toBe(true);
    expect(root.textContent?.includes('élève :')).toBe(false);
    expect(mockQueueCommittedEmail).toHaveBeenCalledTimes(1);
  });

  test('propagates intent persistence failure without claiming delivery', async () => {
    mockQueueCommittedEmail.mockRejectedValueOnce(new Error('synthetic-outbox-unavailable'));
    await expect(sendStageBankTransferConfirmation('synthetic@example.test', 'Synthetic Parent',
      null, 'Synthetic Stage', 42)).rejects.toThrow('synthetic-outbox-unavailable');
  });
});
