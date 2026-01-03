import { SCREEN_WIDTH, SCREEN_HEIGHT } from './constants';

/**
 * Renderer - handles drawing framebuffer to canvas
 */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = ctx;

    // Create ImageData for fast pixel manipulation
    this.imageData = this.ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
  }

  /**
   * Draw framebuffer to canvas
   */
  drawFrame(framebuffer: Uint8ClampedArray): void {
    // Copy framebuffer to ImageData
    this.imageData.data.set(framebuffer);

    // Draw to canvas
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  /**
   * Clear canvas
   */
  clear(): void {
    this.ctx.fillStyle = '#0f380f'; // Darkest GameBoy green
    this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }
}
