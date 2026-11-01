import { getGalleryDesign } from "./gallery";
import { MAX_ANALYSIS_SIDE, analyzeFacade } from "./image-analysis";
import { designFromAnalysis, type DeepReading } from "./interpret";
import { cloneDesign, type HouseDesign, type ReadingSummary, type ReferenceImage } from "./schema";
import { categoryLabel } from "./styles";

/** The steps from a chosen picture to a design. Browser only. */

export type GenerationStage = "preparing" | "reading" | "refining" | "composing";

export const STAGE_LABEL: Record<GenerationStage, string> = {
  preparing: "Preparing the image",
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
  const canvas = drawScaled(img, 1024);
  return { kind: "upload", name, src: canvas.toDataURL("image/jpeg", 0.82), width: img.naturalWidth, height: img.naturalHeight };
}

export function referenceFromGallery(id: string): ReferenceImage | null {
  const entry = getGalleryDesign(id);
  return entry ? { kind: "gallery", name: entry.name, src: entry.image, width: 1600, height: 900, galleryId: id } : null;
}

export type GenerationResult = { design: HouseDesign; reading: ReadingSummary };

export async function generateFromReference(
  reference: ReferenceImage,
  options: { levels: number; deepRead?: (image: string) => Promise<DeepReading | null>; onStage?: (stage: GenerationStage) => void }
): Promise<GenerationResult> {
  const { levels, deepRead, onStage } = options;
  onStage?.("preparing");
  await nextFrame();

  // A gallery design is already a complete specification, so nothing has to be inferred from its picture.
  const preset = getGalleryDesign(reference.galleryId);
  if (preset) {
    onStage?.("composing");
    await nextFrame();
    return {
      design: cloneDesign(preset.design),
      reading: {
        attributes: [{ id: "style", label: "Architectural style", value: categoryLabel(preset.category), confidence: 1, section: "facade" }],
        palette: [],
        notes: [],
        deepRead: false,
      },
    };
  }

  const img = await loadImage(reference.src);
  const small = drawScaled(img, MAX_ANALYSIS_SIDE);
  const pixels = small.getContext("2d")!.getImageData(0, 0, small.width, small.height);
  onStage?.("reading");
  await nextFrame();
  const analysis = analyzeFacade(pixels);

  let deep: DeepReading | null = null;
  if (deepRead) {
    onStage?.("refining");
    await nextFrame();
    deep = await deepRead(drawScaled(img, 768).toDataURL("image/jpeg", 0.8));
  }

  onStage?.("composing");
  await nextFrame();
  return designFromAnalysis(analysis, { levels, deep });
}
