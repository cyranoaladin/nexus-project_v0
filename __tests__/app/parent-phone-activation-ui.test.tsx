import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Page from '@/app/auth/parent-phone/page';
const replace=jest.fn();
let mockToken = 'ppact_' + 'a'.repeat(43);
beforeEach(() => { mockToken = 'ppact_' + 'a'.repeat(43); replace.mockClear(); });
jest.mock('next/navigation',()=>({useRouter:()=>({replace}),useSearchParams:()=>new URLSearchParams({ token: mockToken })}));
afterEach(()=>jest.restoreAllMocks());
it('lets a parent without email choose a password and continue to family completion',async()=>{
 const fetchMock=jest.spyOn(global,'fetch').mockResolvedValueOnce({ok:true,json:async()=>({valid:true,purpose:'ACTIVATION',phoneHint:'•••• 2829'})} as Response).mockResolvedValueOnce({ok:true,json:async()=>({success:true})} as Response);
 render(<Page/>);
 await screen.findByLabelText('Nouveau mot de passe');
 expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Nouveau mot de passe'),{target:{value:'Strong-password-2026'}});
 fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'),{target:{value:'Strong-password-2026'}});
 fireEvent.click(screen.getByRole('button',{name:'Valider mon accès'}));
 await waitFor(()=>expect(replace).toHaveBeenCalledWith('/auth/signin?activated=true&callbackUrl=%2Fdashboard%2Fparent%2Finscription'));
 expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/parent-phone');
});
it('shows an expired-link state without account information',async()=>{
 jest.spyOn(global,'fetch').mockResolvedValue({ok:true,json:async()=>({valid:false})} as Response);
 render(<Page/>);
 expect(await screen.findByText(/Ce lien est invalide/)).toBeVisible();
 expect(screen.queryByLabelText('Nouveau mot de passe')).not.toBeInTheDocument();
});

it('renews an expired activation through WhatsApp without exposing account existence', async () => {
 const fetchMock = jest.spyOn(global, 'fetch')
  .mockResolvedValueOnce({ ok: true, json: async () => ({ valid: false }) } as Response)
  .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response);
 render(<Page />);
 fireEvent.change(await screen.findByLabelText('Numéro WhatsApp du parent'), { target: { value: '+21699192829' } });
 fireEvent.click(screen.getByRole('button', { name: 'Demander un nouveau lien d’activation' }));
 await screen.findByText('Si ce numéro permet de retrouver votre compte, un lien personnel sera envoyé sur WhatsApp.');
 expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/parent-phone/recovery');
 expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ identifier: '+21699192829', purpose: 'ACTIVATION' });
});
it('shows a retryable generic error when renewal is unavailable', async () => {
 jest.spyOn(global, 'fetch')
  .mockResolvedValueOnce({ ok: true, json: async () => ({ valid: false }) } as Response)
  .mockResolvedValueOnce({ ok: false, status: 429 } as Response);
 render(<Page />);
 fireEvent.change(await screen.findByLabelText('Numéro WhatsApp du parent'), { target: { value: '+21699192829' } });
 fireEvent.click(screen.getByRole('button', { name: 'Demander un nouveau lien d’activation' }));
 expect(await screen.findByRole('alert')).toHaveTextContent('La demande n’a pas pu être traitée. Veuillez réessayer plus tard.');
 expect(screen.getByRole('button', { name: 'Demander un nouveau lien d’activation' })).toBeEnabled();
});
it('clears passwords and ignores a former submission when the link changes', async () => {
 let resolveSubmission!: (value: Response) => void;
 jest.spyOn(global, 'fetch')
  .mockResolvedValueOnce({ ok: true, json: async () => ({ valid: true, purpose: 'ACTIVATION', phoneHint: '•••• 2829' }) } as Response)
  .mockImplementationOnce(() => new Promise(resolve => { resolveSubmission = resolve; }))
  .mockResolvedValueOnce({ ok: true, json: async () => ({ valid: true, purpose: 'ACTIVATION', phoneHint: '•••• 1234' }) } as Response);
 const view = render(<Page />);
 fireEvent.change(await screen.findByLabelText('Nouveau mot de passe'), { target: { value: 'Strong-password-2026' } });
 fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'Strong-password-2026' } });
 fireEvent.click(screen.getByRole('button', { name: 'Valider mon accès' }));
 mockToken = 'ppact_' + 'b'.repeat(43);
 view.rerender(<Page />);
 expect(await screen.findByLabelText('Nouveau mot de passe')).toHaveValue('');
 expect(screen.getByLabelText('Confirmer le mot de passe')).toHaveValue('');
 await act(async () => { resolveSubmission({ ok: true, json: async () => ({ success: true }) } as Response); });
 expect(replace).not.toHaveBeenCalled();
});

it('renews an invalid recovery link as recovery without treating its prefix as proof', async () => {
 mockToken = 'pprst_' + 'x'.repeat(43);
 const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => ({ valid: false }) } as Response).mockResolvedValueOnce({ ok: true } as Response);
 render(<Page />);
 fireEvent.change(await screen.findByLabelText('Numéro WhatsApp du parent'), { target: { value: '+21699192829' } });
 expect(screen.queryByLabelText('Nouveau mot de passe')).not.toBeInTheDocument();
 expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Retrouver mon accès');
 fireEvent.click(screen.getByRole('button', { name: 'Demander un nouveau lien de récupération' }));
 await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
 expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ identifier: '+21699192829', purpose: 'RECOVERY' });
});
