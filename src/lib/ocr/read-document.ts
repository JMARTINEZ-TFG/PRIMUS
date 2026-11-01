// Lectura de comprobantes en el navegador: el archivo nunca sale del dispositivo.
//  - PDF digital → se usa el texto embebido (pdf.js), sin OCR.
//  - PDF escaneado o imagen (JPG/PNG/WebP) → OCR con Tesseract (modelo en español).
// Las librerías se importan dinámicamente para no cargarlas en el SSR ni en el
// bundle inicial; Tesseract descarga su motor y el modelo la primera vez.

import { needsInvertedPass } from "./extract-fields";

export type ReadProgress = "pdf" | "ocr-loading" | "ocr";

const MAX_PAGES = 3;
// Por debajo de esta cantidad de caracteres se considera que el PDF es escaneado
const MIN_PDF_TEXT = 80;

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

type TextItem = { str: string; transform: number[] };

// Agrupa los fragmentos de texto por coordenada vertical para reconstruir las líneas
function itemsToLines(items: TextItem[]): string[] {
  const rows = new Map<number, { x: number; s: string }[]>();
  for (const it of items) {
    if (!it.str?.trim()) continue;
    const y = Math.round(it.transform[5] / 3) * 3;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y)!.push({ x: it.transform[4], s: it.str });
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, r]) => r.sort((a, b) => a.x - b.x).map((t) => t.s).join(" ").replace(/\s+/g, " ").trim());
}

// Tesseract lee mal la letra chica: una página completa necesita ~1800 px de ancho.
// Las imágenes más chicas se amplían y las muy grandes se reducen (más rápido, sin
// perder precisión). Se pasan a escala de grises.
const OCR_MIN_WIDTH = 1800;
const OCR_MAX_WIDTH = 2400;

async function prepareForOcr(img: Blob | HTMLCanvasElement, invert = false): Promise<HTMLCanvasElement> {
  const source = img instanceof Blob ? await createImageBitmap(img) : img;
  const scale =
    source.width < OCR_MIN_WIDTH ? Math.min(3, OCR_MIN_WIDTH / source.width)
    : source.width > OCR_MAX_WIDTH ? OCR_MAX_WIDTH / source.width
    : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = invert ? "grayscale(1) invert(1)" : "grayscale(1)";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function ocrImages(
  images: (Blob | HTMLCanvasElement)[],
  onProgress?: (p: ReadProgress) => void,
): Promise<string> {
  onProgress?.("ocr-loading");
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa");
  try {
    onProgress?.("ocr");
    let text = "";
    for (const img of images) {
      const { data } = await worker.recognize(await prepareForOcr(img));
      text += data.text + "\n";
    }
    // Segunda pasada con la imagen invertida para el texto claro sobre fondos de color
    if (needsInvertedPass(text)) {
      for (const img of images) {
        const { data } = await worker.recognize(await prepareForOcr(img, true));
        text += data.text + "\n";
      }
    }
    return text;
  } finally {
    await worker.terminate();
  }
}

async function readPdf(file: File, onProgress?: (p: ReadProgress) => void): Promise<string> {
  onProgress?.("pdf");
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = Math.min(doc.numPages, MAX_PAGES);

  const lines: string[] = [];
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const { items } = await page.getTextContent();
    lines.push(...itemsToLines(items as TextItem[]));
  }
  const text = lines.join("\n");
  if (text.replace(/\s/g, "").length >= MIN_PDF_TEXT) return text;

  // PDF escaneado: se renderiza cada página y se aplica OCR
  const canvases: HTMLCanvasElement[] = [];
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas }).promise;
    canvases.push(canvas);
  }
  return ocrImages(canvases, onProgress);
}

export async function readDocumentText(
  file: File,
  onProgress?: (p: ReadProgress) => void,
): Promise<string> {
  if (file.type === "application/pdf") return readPdf(file, onProgress);
  if (/^image\/(jpeg|png|webp)$/.test(file.type)) return ocrImages([file], onProgress);
  throw new Error("Formato no soportado. Usá JPG, PNG o PDF.");
}
