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

  it('displays existing documents with their correct document types', () => {
    const existingDocuments = [
      {
        id: 'doc-1',
        documentType: 'STUDENT_COPY',
        originalFilename: 'copie.pdf',
        originalFilePath: '/uploads/copie.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'UPLOADED',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'doc-2',
        documentType: 'SUBJECT',
        originalFilename: 'sujet.pdf',
        originalFilePath: '/uploads/sujet.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        status: 'UPLOADED',
        createdAt: new Date().toISOString(),
      },
    ];

    render(<FileUploadZone submissionId="submission-1" existingDocuments={existingDocuments} />);

    expect(screen.getByText('copie.pdf')).toBeInTheDocument();
    expect(screen.getByText('sujet.pdf')).toBeInTheDocument();
    expect(screen.getByText('Documents déjà attachés (2)')).toBeInTheDocument();

    // Verify document type selectors exist and have correct values
    const doc1Select = document.getElementById('existing-document-type-doc-1');
    const doc2Select = document.getElementById('existing-document-type-doc-2');
    expect(doc1Select).not.toBeNull();
    expect(doc2Select).not.toBeNull();

    expect(doc1Select).toHaveValue('STUDENT_COPY');
    expect(doc2Select).toHaveValue('SUBJECT');

    // Verify labels in options
    expect(within(doc1Select as HTMLElement).getByText('Copie élève')).toBeInTheDocument();
    expect(within(doc2Select as HTMLElement).getByText('Sujet / énoncé')).toBeInTheDocument();
  });

  it('shows warning when subject or rubric is missing', () => {
    const existingDocuments = [
      {
        id: 'doc-1',
        documentType: 'STUDENT_COPY',
        originalFilename: 'copie.pdf',
        originalFilePath: '/uploads/copie.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'UPLOADED',
        createdAt: new Date().toISOString(),
      },
    ];

    render(<FileUploadZone submissionId="submission-1" existingDocuments={existingDocuments} />);

    expect(screen.getByText('Sujet et barème fortement recommandés pour une correction fiable.')).toBeInTheDocument();
  });

  it('shows generate button disabled without student copy', () => {
    const existingDocuments = [
      {
        id: 'doc-1',
        documentType: 'SUBJECT',
        originalFilename: 'sujet.pdf',
        originalFilePath: '/uploads/sujet.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'UPLOADED',
        createdAt: new Date().toISOString(),
      },
    ];

    render(<FileUploadZone submissionId="submission-1" existingDocuments={existingDocuments} />);

    const generateButton = screen.getByRole('button', { name: /Lancer la correction IA/ });
    expect(generateButton).toBeDisabled();
  });

  it('shows generate button enabled with student copy', () => {
    const existingDocuments = [
      {
        id: 'doc-1',
        documentType: 'STUDENT_COPY',
        originalFilename: 'copie.pdf',
        originalFilePath: '/uploads/copie.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'UPLOADED',
        createdAt: new Date().toISOString(),
      },
    ];

    render(<FileUploadZone submissionId="submission-1" existingDocuments={existingDocuments} />);

    const generateButton = screen.getByRole('button', { name: /Lancer la correction IA/ });
    expect(generateButton).not.toBeDisabled();
  });

  it('shows loading state when generating correction', async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: unknown) => void = () => {};

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/generate')) {
        return new Promise((resolve) => {
          resolveFetch = resolve;
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ document: { id: 'doc-1' } }),
      });
    });

    const existingDocuments = [
      {
        id: 'doc-1',
        documentType: 'STUDENT_COPY',
        originalFilename: 'copie.pdf',
        originalFilePath: '/uploads/copie.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'UPLOADED',
        createdAt: new Date().toISOString(),
      },
    ];

    render(<FileUploadZone submissionId="submission-1" existingDocuments={existingDocuments} />);

    const generateButton = screen.getByRole('button', { name: /Lancer la correction IA/ });
    await user.click(generateButton);

    expect(screen.getByText(/Lancement en cours.../)).toBeInTheDocument();

    resolveFetch({
      ok: true,
      json: async () => ({ success: true, jobId: 'job-1' }),
    });

    await waitFor(() => {
      expect(screen.getByText('Correction IA mise en file d\'attente. Le rapport apparaîtra ici lorsque l\'analyse sera terminée.')).toBeInTheDocument();
    });
  });

  it('allows changing document type for existing documents', async () => {
    const user = userEvent.setup();
    const existingDocuments = [
      {
        id: 'doc-1',
        documentType: 'STUDENT_COPY',
        originalFilename: 'copie.pdf',
        originalFilePath: '/uploads/copie.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'UPLOADED',
        createdAt: new Date().toISOString(),
      },
    ];

    (global.fetch as jest.Mock).mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/npc/submissions/submission-1/documents/doc-1' && options?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ document: { id: 'doc-1', documentType: 'SUBJECT' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ document: { id: 'doc-1' } }),
      });
    });

    render(<FileUploadZone submissionId="submission-1" existingDocuments={existingDocuments} />);

    const select = screen.getByLabelText('Type documentaire');
    await user.selectOptions(select, 'SUBJECT');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/npc/submissions/submission-1/documents/doc-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    // Verify the request body contains the correct documentType
    const lastCall = (global.fetch as jest.Mock).mock.calls.find(
      (call) => call[0] === '/api/npc/submissions/submission-1/documents/doc-1' && call[1]?.method === 'PATCH'
    );
    expect(lastCall).toBeDefined();
    const body = JSON.parse(lastCall![1].body as string);
    expect(body).toEqual({ documentType: 'SUBJECT' });
  });
});
