import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnexionForm } from '@/app/espace/connexion/ConnexionForm';
import { CredentialForm } from '@/components/espace/shared/CredentialForm';

const signIn = jest.fn().mockResolvedValue({error:'CredentialsSignin'});
jest.mock('next/navigation',()=>({useRouter:()=>({replace:jest.fn(),refresh:jest.fn()})}));
jest.mock('next-auth/react',()=>({signIn:(...args:unknown[])=>signIn(...args),signOut:jest.fn()}));

describe('secret forms before hydration',()=>{
  it.each<[string, React.ReactElement, string]>([
    ['connexion',<ConnexionForm />, 'btn-connexion'],
    ['student credential',<CredentialForm kind="code" />, 'btn-credential'],
    ['teacher password',<CredentialForm kind="password" />, 'btn-credential'],
  ])('%s does not offer an active native GET submit in server HTML',(_label,component,testId)=>{
    const container=document.createElement('div');container.innerHTML=renderToStaticMarkup(component);
    expect(container.querySelector('form')).toHaveAttribute('method','post');
    expect(container.querySelector(`[data-testid="${testId}"]`)).toBeDisabled();
  });
  it('enables the login after hydration and still submits using NextAuth',async()=>{
    render(<ConnexionForm />);
    await waitFor(()=>expect(screen.getByTestId('btn-connexion')).toBeEnabled());
    fireEvent.change(screen.getByTestId('input-username'),{target:{value:'eleve.fictif'}});
    fireEvent.change(screen.getByTestId('input-secret'),{target:{value:'CodeExemple42'}});
    fireEvent.click(screen.getByTestId('btn-connexion'));
    await waitFor(()=>expect(signIn).toHaveBeenCalledWith('espace',{username:'eleve.fictif',secret:'CodeExemple42',redirect:false}));
  });
  it('enables credential changes only after hydration',async()=>{
    render(<CredentialForm kind="code" />);
    await waitFor(()=>expect(screen.getByTestId('btn-credential')).toBeEnabled());
  });
});
