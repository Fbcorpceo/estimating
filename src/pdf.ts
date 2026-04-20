import * as pdfjsLib from 'pdfjs-dist';
// Vite worker import — this is the recommended pattern.
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

export interface LoadedPdfPage {
  pageIndex: number; // 0-based
  width: number; // base CSS px at scale=1
  height: number;
}

export async function loadPdfMetadata(data: ArrayBuffer): Promise<LoadedPdfPage[]> {
  // pdf.js mutates/transfers the buffer; clone first so the caller still has data to persist.
  const buf = data.slice(0);
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const out: LoadedPdfPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    out.push({ pageIndex: i - 1, width: vp.width, height: vp.height });
  }
  return out;
}

export async function renderPdfPage(
  data: ArrayBuffer,
  pageIndex: number,
  scale: number
): Promise<HTMLCanvasElement> {
  const buf = data.slice(0);
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}
