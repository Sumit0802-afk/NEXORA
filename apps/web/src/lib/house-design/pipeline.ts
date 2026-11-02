import type { FloorPlan } from "@houseplan/design-schema";
import { composeDesign, type Composition, type ViewReading } from "./design-engine";
import { getCatalogDesign, previewImage } from "./catalog";
import { MAX_ANALYSIS_SIDE, analyzeFacade, type FacadeAnalysis, type PixelImage } from "./image-analysis";
import type { DeepReading } from "./interpret";
import type { Elevation, ReferenceImage } from "./schema";

/** The steps from chosen pictures to a design. Browser only. */

export type GenerationStage = "preparing" | "reading" | "refining" | "composing";

export const STAGE_LABEL: Record<GenerationStage, string> = {
  preparing: "Preparing the images",
  reading: "Reading the facade, roof and materials",
  refining: "Checking the details",
  composing: "Composing your design",
};

/** Gives the page a chance to paint progress. Animation frames stop in background tabs, so a timer backs it up. */
const nextFrame = () =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 120);
    requestAnimationFrame(() => {
      clearTimeout(timer);
      setTimeout(resolve, 0);
    });
  });

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image could not be read."));
    img.src = src;
  });
}

function drawScaled(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Keeps a smaller copy of an upload with the project. The original file stays on the device. */
export async function referenceFromUpload(url: string, name: string): Promise<ReferenceImage> {
  const img = await loadImage(url);
  const canvas = drawScaled(img, 900);
  const id = `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return { id, kind: "upload", name, src: canvas.toDataURL("image/jpeg", 0.8), width: img.naturalWidth, height: img.naturalHeight };
}

export function referenceFromGallery(id: string): ReferenceImage | null {
  const entry = getCatalogDesign(id);
  return entry ? { id: `gallery-${id}`, kind: "gallery", name: entry.name, src: previewImage(entry), width: 1600, height: 900, galleryId: id } : null;
}

/** Reads one image off the main thread where the browser allows it. */
function readInWorker(image: ImageData): Promise<FacadeAnalysis> {
  if (typeof Worker === "undefined") return Promise.resolve(analyzeFacade(image));
  return new Promise((resolve) => {
    const fallback = () => resolve(analyzeFacade(image));
    let worker: Worker;
    try {
      worker = new Worker(new URL("./analysis.worker.ts", import.meta.url));
    } catch {
      fallback();
      return;
    }
    const finish = (run: () => void) => {
      worker.terminate();
      run();
    };
    worker.onmessage = (event: MessageEvent<{ analysis?: FacadeAnalysis }>) => finish(() => (event.data.analysis ? resolve(event.data.analysis) : fallback()));
    worker.onerror = () => finish(fallback);
    const message: { id: string; image: PixelImage } = { id: "view", image: { width: image.width, height: image.height, data: image.data } };
    worker.postMessage(message);
  });
}

async function readPixels(src: string): Promise<FacadeAnalysis> {
  const small = drawScaled(await loadImage(src), MAX_ANALYSIS_SIDE);
  return readInWorker(small.getContext("2d")!.getImageData(0, 0, small.width, small.height));
}

/** Reads a render of the model the same way a reference is read. */
export const readImage = readPixels;

export type GenerationView = { elevation: Elevation; image: ReferenceImage };

/** Copies of the views for the optional server reading, keyed by side. */
export type DeepReader = (images: { elevation: Elevation; image: string }[]) => Promise<Partial<Record<Elevation, DeepReading>> | null>;

export async function generateFromReferences(
  views: GenerationView[],
  options: { plan: FloorPlan; deepRead?: DeepReader; onStage?: (stage: GenerationStage) => void }
): Promise<Composition> {
  const { plan, deepRead, onStage } = options;
  onStage?.("preparing");
  await nextFrame();

  // A gallery design is already a complete specification, so nothing has to be inferred from its picture.
  const gallery = views.map((v) => ({ view: v, entry: getCatalogDesign(v.image.galleryId) })).find((g) => g.entry);
  const photos = views.filter((v) => !v.image.galleryId);

  onStage?.("reading");
  await nextFrame();
  const analyses: { elevation: Elevation; analysis: FacadeAnalysis }[] = [];
  for (const view of photos) {
    analyses.push({ elevation: view.elevation, analysis: await readPixels(view.image.src) });
    await nextFrame();
  }

  let deep: Partial<Record<Elevation, DeepReading>> | null = null;
  if (deepRead && photos.length) {
    onStage?.("refining");
    await nextFrame();
    const copies = await Promise.all(photos.map(async (v) => ({ elevation: v.elevation, image: drawScaled(await loadImage(v.image.src), 768).toDataURL("image/jpeg", 0.8) })));
    deep = await deepRead(copies);
  }

  onStage?.("composing");
  await nextFrame();
  const readings: ViewReading[] = analyses.map((a) => ({ ...a, deep: deep?.[a.elevation] ?? null }));
  return composeDesign({ plan, views: readings, preset: gallery?.entry ? { design: gallery.entry.design, views: [gallery.view.elevation] } : null });
}
