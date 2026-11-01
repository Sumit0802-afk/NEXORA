import { analyzeFacade, type PixelImage } from "./image-analysis";

/** Runs the pixel reading off the main thread, so the studio stays responsive while several views are read. */
self.onmessage = (event: MessageEvent<{ id: string; image: PixelImage }>) => {
  const { id, image } = event.data;
  try {
    self.postMessage({ id, analysis: analyzeFacade(image) });
  } catch {
    self.postMessage({ id, error: true });
  }
};
