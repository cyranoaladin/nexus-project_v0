import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountActions } from '@/components/dashboard/core-v2/AccountActions';
import type { PublicUser } from '@/components/dashboard/core-v2/api';

const user: PublicUser = { id: 'synthetic-user', role: 'PARENT', firstName: 'Synthetic', lastName: 'Parent', email: 'synthetic@example.test', phone: null, accountStatus: 'PENDING_ACTIVATION', activatedAt: null, createdAt: '2026-10-04T00:00:00Z', updatedAt: '2026-10-04T00:00:00Z' };

test('a lost resend response retains its command identity; a confirmed new resend gets a new identity', async () => {
  const ids: Array<string | null> = [];
  global.fetch = jest.fn(async (_input, init) => {
    ids.push(new Headers(init?.headers).get('idempotency-key'));
    if (ids.length === 1) throw new Error('synthetic transport failure');
    return { ok: true, status: 201, json: async () => ({ ok: true, data: {} }) } as Response;
  });
  render(<AccountActions user={user} can={() => true} onChanged={async () => {}} />);
  const browser = userEvent.setup();
  await browser.click(screen.getByRole('button', { name: 'Renvoyer l’invitation' }));
  await screen.findByText('Réseau indisponible. Réessayez.');
  await browser.click(screen.getByRole('button', { name: 'Renvoyer l’invitation' }));
  await screen.findByText('Nouvelle invitation mise en file d’envoi ; l’ancienne est révoquée.');
  expect(ids[0] !== null).toBe(true);
  expect(ids[1] === ids[0]).toBe(true);
  await browser.click(screen.getByRole('button', { name: 'Renvoyer l’invitation' }));
  expect(ids[2] !== ids[1]).toBe(true);
});
