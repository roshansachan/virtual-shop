/**
 * Utility functions for capturing canvas/stage content for fullscreen display
 */

interface KonvaStage {
  toDataURL: (options?: { pixelRatio?: number; quality?: number }) => string;
}

/**
 * Captures Konva stage content as a data URL for fullscreen display
 */
export const captureKonvaStage = (stageRef: React.RefObject<KonvaStage>): string | null => {
  try {
    const stage = stageRef.current;
    if (!stage || typeof stage.toDataURL !== 'function') {
      console.error('Invalid Konva stage reference');
      return null;
    }

    return stage.toDataURL({
      pixelRatio: 2, // Higher quality for fullscreen
      quality: 1.0   // Maximum quality
    });
  } catch (error) {
    console.error('Error capturing Konva stage:', error);
    return null;
  }
};

/**
 * Captures DOM-based canvas content using Canvas API
 */
export const captureDOMCanvas = (
  containerRef: React.RefObject<HTMLElement | null>,
  scaledWidth: number,
  scaledHeight: number
): string | null => {
  try {
    const container = containerRef.current;
    if (!container) {
      console.error('Container reference not found');
      return null;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return null;
    }

    // Set canvas size
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;

    // Draw background image
    const bgImg = container.querySelector('.scene-bg-image') as HTMLImageElement;
    if (bgImg && bgImg.complete) {
      ctx.drawImage(bgImg, 0, 0, scaledWidth, scaledHeight);
    }

    // Draw all visible product images
    const productImages = container.querySelectorAll('.scene-product-image') as NodeListOf<HTMLImageElement>;
    productImages.forEach((img) => {
      if (img.complete && img.style.opacity !== '0') {
        const x = parseFloat(img.style.left) || 0;
        const y = parseFloat(img.style.top) || 0;
        const width = parseFloat(img.style.width) || 0;
        const height = parseFloat(img.style.height) || 0;
        ctx.drawImage(img, x, y, width, height);
      }
    });

    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error capturing DOM canvas:', error);
    return null;
  }
};

/**
 * Universal fullscreen capture function that works with both Konva and DOM
 */
export const captureCanvasForFullscreen = (
  konvaStageRef?: React.RefObject<KonvaStage>,
  domContainerRef?: React.RefObject<HTMLElement | null>,
  scaledWidth?: number,
  scaledHeight?: number
): string | null => {
  // Try Konva stage first (higher quality)
  if (konvaStageRef) {
    const konvaResult = captureKonvaStage(konvaStageRef);
    if (konvaResult) return konvaResult;
  }

  // Fallback to DOM capture
  if (domContainerRef && scaledWidth && scaledHeight) {
    return captureDOMCanvas(domContainerRef, scaledWidth, scaledHeight);
  }

  console.error('No valid capture method available');
  return null;
};