import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileUploadZone } from '@/components/npc/coach/FileUploadZone';

describe('FileUploadZone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ document: { id: 'doc-1' } }),
    }) as jest.Mock;
  });

  it('shows document type selector and uploads to the existing submission', async () => {
    const user = userEvent.setup();
    render(<FileUploadZone submissionId="submission-1" />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['%PDF-1.4'], 'copie.pdf', { type: 'application/pdf' }));

    const fileRow = screen.getByText('copie.pdf').closest('[data-upload-file-row]');
    expect(fileRow).not.toBeNull();
    expect(within(fileRow as HTMLElement).getByLabelText('Type documentaire')).toHaveValue('STUDENT_COPY');

    await user.selectOptions(
      within(fileRow as HTMLElement).getByLabelText('Type documentaire'),
      'GRADING_RUBRIC'
    );
    await user.click(screen.getByRole('button', { name: /Uploader/ }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/npc/submissions/submission-1/documents',
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
      );
    });
    await screen.findByText('1 document(s) attaché(s) à la correction');

    const formData = (global.fetch as jest.Mock).mock.calls[0][1].body as FormData;
    expect(formData.get('documentType')).toBe('GRADING_RUBRIC');
  });

  it('disables the upload button while upload is running', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    (global.fetch as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const user = userEvent.setup();
    render(<FileUploadZone submissionId="submission-1" />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['%PDF-1.4'], 'copie.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: /Uploader/ }));

    expect(screen.getByRole('button', { name: /Upload en cours/ })).toBeDisabled();

    resolveFetch({
      ok: true,
      json: async () => ({ document: { id: 'doc-1' } }),
    });
    await screen.findByText('1 document(s) attaché(s) à la correction');
  });
});
