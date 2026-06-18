'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

type PdfInlinePreviewProps = {
  src: string;
  title: string;
};

export function PdfInlinePreview({ src, title }: PdfInlinePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfRef = useRef<any>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setStatus('loading');
    setError(null);
    setPageNumber(1);
    setPageCount(0);
    pdfRef.current = null;

    let loadingTask: any = null;

    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc =
          'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.worker.min.mjs';

        loadingTask = pdfjs.getDocument({ url: src });
        const pdf = await loadingTask.promise;

        if (cancelled) {
          void (pdf as any).destroy?.();
          return;
        }

        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
        setStatus('ready');
      } catch (err: unknown) {
        if (cancelled) return;
        console.error('[PdfInlinePreview] load failed', err);
        setStatus('error');
        setError('Impossible de charger l’aperçu du PDF.');
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      void loadingTask?.destroy().catch(() => {});
      if ((pdfRef.current as any)?.destroy) {
        void (pdfRef.current as any).destroy().catch(() => {});
      }
      pdfRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!pdf || !canvas || !container || status !== 'ready') {
      return;
    }

    let cancelled = false;

    const renderPage = async () => {
      try {
        renderTaskRef.current?.cancel();

        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(320, container.clientWidth - 32);
        const scale = Math.min(1.6, availableWidth / viewport.width);
        const renderedViewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;

        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Canvas context unavailable');
        }

        canvas.width = Math.floor(renderedViewport.width * outputScale);
        canvas.height = Math.floor(renderedViewport.height * outputScale);
        canvas.style.width = `${Math.floor(renderedViewport.width)}px`;
        canvas.style.height = `${Math.floor(renderedViewport.height)}px`;

        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

        const renderTask = page.render({
          canvasContext: context,
          viewport: renderedViewport,
        });
        renderTaskRef.current = renderTask;

        await renderTask.promise;
      } catch (err) {
        if (cancelled) return;
        if ((err as { name?: string })?.name === 'RenderingCancelledException') {
          return;
        }
        console.error('[PdfInlinePreview] render failed', err);
        setStatus('error');
        setError('L’aperçu du PDF n’a pas pu être rendu.');
      }
    };

    const scheduleRender = () => {
      window.requestAnimationFrame(() => {
        if (!cancelled) {
          void renderPage();
        }
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleRender();
    });

    resizeObserver.observe(container);
    resizeObserverRef.current = resizeObserver;
    scheduleRender();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pageNumber, status, title, src]);

  const canGoPrev = pageNumber > 1;
  const canGoNext = pageNumber < pageCount;

  return (
    <div ref={containerRef} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-lux-line/70 bg-lux-ink px-4 py-3 text-lux-ivory sm:px-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-lux-gold-wash">
            Aperçu du document
          </p>
          <p className="mt-1 text-sm text-lux-ivory/70">
            {title} - page {pageNumber}{pageCount > 0 ? ` / ${pageCount}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPageNumber(1)}
            className="inline-flex items-center rounded-lg border border-lux-line/30 bg-white/5 px-3 py-2 text-sm font-semibold text-lux-ivory transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canGoPrev}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Revenir au début
          </button>
          <button
            type="button"
            onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
            className="inline-flex items-center rounded-lg border border-lux-line/30 bg-white/5 px-3 py-2 text-sm font-semibold text-lux-ivory transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canGoPrev}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Page précédente
          </button>
          <button
            type="button"
            onClick={() => setPageNumber((value) => Math.min(pageCount || 1, value + 1))}
            className="inline-flex items-center rounded-lg border border-lux-line/30 bg-white/5 px-3 py-2 text-sm font-semibold text-lux-ivory transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canGoNext}
          >
            Page suivante
            <ChevronRight className="ml-2 h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-b-2xl bg-lux-paper p-4">
        {status === 'loading' ? (
          <div className="flex min-h-[760px] items-center justify-center rounded-2xl border border-dashed border-lux-line/70 bg-lux-white px-6 text-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-lux-gold-deep">
                Chargement
              </p>
              <p className="mt-3 max-w-md text-sm leading-7 text-lux-slate">
                L’aperçu PDF se prépare. Le chargement peut prendre quelques secondes.
              </p>
            </div>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="flex min-h-[760px] items-center justify-center rounded-2xl border border-dashed border-lux-line/70 bg-lux-white px-6 text-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">
                Aperçu indisponible
              </p>
              <p className="mt-3 max-w-md text-sm leading-7 text-lux-slate">
                {error ?? 'L’aperçu du PDF n’a pas pu être rendu.'}
              </p>
            </div>
          </div>
        ) : null}

        <div
          className={`overflow-auto rounded-2xl border border-lux-line/70 bg-lux-white ${
            status !== 'ready' ? 'hidden' : ''
          }`}
        >
          <div className="flex min-h-[760px] justify-center px-4 py-6 sm:px-6">
            <canvas
              ref={canvasRef}
              aria-label={`Aperçu rendu de ${title}`}
              className="max-w-full rounded-lg bg-white shadow-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
