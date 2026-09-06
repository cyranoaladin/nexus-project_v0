import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ParentWhatsAppInvitation } from '@/components/dashboard/assistante/ParentWhatsAppInvitation';
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
const invitation = () => ({ whatsappUrl: 'https://wa.me/21622123456?text=invitation', expiresAt: new Date(Date.now() + 60000).toISOString(), purpose: 'ACTIVATION' });
it('prepares only on explicit request and opens WhatsApp without claiming delivery', async () => {
 const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => invitation() } as Response);
 const storage = jest.spyOn(Storage.prototype, 'setItem');
 render(<ParentWhatsAppInvitation parentUserId="parent-1" />);
 expect(fetchMock).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button', { name: 'Préparer l’invitation WhatsApp' }));
 const link = await screen.findByRole('link', { name: 'Envoyer l’invitation sur WhatsApp' });
 expect(fetchMock).toHaveBeenCalledWith('/api/assistante/parents/parent-1/whatsapp-invitation', expect.objectContaining({ method: 'POST' }));
 expect(link).toHaveAttribute('href', invitation().whatsappUrl);
 expect(link).toHaveAttribute('target', '_blank');
 expect(link).toHaveAttribute('rel', 'noopener noreferrer');
 expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
 expect(screen.getByText(/appuyez sur « Envoyer »/)).toBeVisible();
 fireEvent.click(link);
 expect(screen.queryByText(/Invitation envoyée|Invitation livrée/)).not.toBeInTheDocument();
 expect(storage).not.toHaveBeenCalled();
});
it('removes an expired link and prepares a replacement explicitly', async () => {
 jest.useFakeTimers();
 const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => ({ ok: true, json: async () => invitation() }) as Response);
 render(<ParentWhatsAppInvitation parentUserId="parent-1" />);
 fireEvent.click(screen.getByRole('button', { name: 'Préparer l’invitation WhatsApp' }));
 await screen.findByRole('link', { name: 'Envoyer l’invitation sur WhatsApp' });
 act(() => { jest.advanceTimersByTime(60001); });
 expect(screen.queryByRole('link', { name: 'Envoyer l’invitation sur WhatsApp' })).not.toBeInTheDocument();
 expect(screen.getByText(/Lien expiré/)).toBeVisible();
 fireEvent.click(screen.getByRole('button', { name: 'Renouveler l’invitation WhatsApp' }));
 await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
 await screen.findByRole('link', { name: 'Envoyer l’invitation sur WhatsApp' });
});
it('does not expose server errors or an old link after a refused preparation', async () => {
 jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, json: async () => ({ error: 'private-token' }) } as Response);
 render(<ParentWhatsAppInvitation parentUserId="parent-1" accountActivated />);
 fireEvent.click(screen.getByRole('button', { name: 'Préparer un lien de récupération WhatsApp' }));
 expect(await screen.findByRole('alert')).not.toHaveTextContent('private-token');
 expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('discards a former parent response when the selected parent changes', async () => {
 let resolve!: (value: Response) => void;
 jest.spyOn(global, 'fetch').mockImplementation(() => new Promise(done => { resolve = done; }));
 const view = render(<ParentWhatsAppInvitation parentUserId="parent-1" />);
 fireEvent.click(screen.getByRole('button', { name: 'Préparer l’invitation WhatsApp' }));
 view.rerender(<ParentWhatsAppInvitation parentUserId="parent-2" />);
 await act(async () => { resolve({ ok: true, json: async () => invitation() } as Response); });
 expect(screen.queryByRole('link')).not.toBeInTheDocument();
 expect(screen.getByRole('button', { name: 'Préparer l’invitation WhatsApp' })).toBeEnabled();
});
it('clears a prepared link if renewal fails', async () => {
 jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => invitation() } as Response).mockResolvedValueOnce({ ok: false } as Response);
 render(<ParentWhatsAppInvitation parentUserId="parent-1" />);
 fireEvent.click(screen.getByRole('button', { name: 'Préparer l’invitation WhatsApp' }));
 await screen.findByRole('link', { name: 'Envoyer l’invitation sur WhatsApp' });
 fireEvent.click(screen.getByRole('button', { name: 'Renouveler l’invitation WhatsApp' }));
 await screen.findByRole('alert');
 expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('refuses an unexpected external URL even in a successful response', async () => {
 jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ...invitation(), whatsappUrl: 'https://unexpected.example/invitation' }) } as Response);
 render(<ParentWhatsAppInvitation parentUserId="parent-1" />);
 fireEvent.click(screen.getByRole('button', { name: 'Préparer l’invitation WhatsApp' }));
 await screen.findByRole('alert');
 expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
