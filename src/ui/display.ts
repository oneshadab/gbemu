import { Renderer } from '@/core/ppu/Renderer';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '@/core/ppu/constants';

/**
 * Display Manager - handles canvas setup and scaling
 */
export class DisplayManager {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private scale: number;

  constructor(canvasId: string, scale: number = 3) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Canvas element with id "${canvasId}" not found`);
    }

    this.canvas = canvas;
    this.scale = scale;

    // Set canvas to native GameBoy resolution
    this.canvas.width = SCREEN_WIDTH;
    this.canvas.height = SCREEN_HEIGHT;

    // Scale display using CSS
    this.canvas.style.width = `${SCREEN_WIDTH * scale}px`;
    this.canvas.style.height = `${SCREEN_HEIGHT * scale}px`;

    // Create renderer
    this.renderer = new Renderer(this.canvas);
  }

  getRenderer(): Renderer {
    return this.renderer;
  }

  setScale(scale: number): void {
    this.scale = scale;
    this.canvas.style.width = `${SCREEN_WIDTH * scale}px`;
    this.canvas.style.height = `${SCREEN_HEIGHT * scale}px`;
  }
}
