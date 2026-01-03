import { GameBoy } from '@/emulator/GameBoy';
import { Renderer } from '@/core/ppu/Renderer';
import { InputManager } from './InputManager';
import { logger } from '@/utils/logger';

/**
 * UI Controller - manages UI state and user interactions
 */
export class UIController {
  private gameboy: GameBoy;
  private renderer: Renderer;
  private inputManager: InputManager;

  // UI elements
  private romFileInput: HTMLInputElement;
  private resetBtn: HTMLButtonElement;
  private pauseBtn: HTMLButtonElement;
  private statusDiv: HTMLElement;
  private fpsDisplay: HTMLElement | null;

  // State
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private animationFrameId: number | null = null;

  constructor(gameboy: GameBoy, renderer: Renderer) {
    this.gameboy = gameboy;
    this.renderer = renderer;

    // Initialize input manager
    this.inputManager = new InputManager(gameboy.joypad);

    // Get UI elements
    this.romFileInput = document.getElementById('rom-file') as HTMLInputElement;
    this.resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
    this.pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
    this.statusDiv = document.getElementById('status') as HTMLElement;
    this.fpsDisplay = document.getElementById('fps');

    // Clear canvas initially
    this.renderer.clear();

    this.setupEventListeners();
  }

  /**
   * Set up all event listeners
   */
  private setupEventListeners(): void {
    // ROM file loading
    this.romFileInput.addEventListener('change', async (event) => {
      await this.handleROMLoad(event);
    });

    // Reset button
    this.resetBtn.addEventListener('click', () => {
      this.handleReset();
    });

    // Pause button
    this.pauseBtn.addEventListener('click', () => {
      this.handlePause();
    });
  }

  /**
   * Handle ROM file loading
   */
  private async handleROMLoad(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      this.updateStatus('Loading...', 'ready');

      const arrayBuffer = await file.arrayBuffer();
      const romData = new Uint8Array(arrayBuffer);

      this.gameboy.loadROM(romData);

      const info = this.gameboy.getCartridgeInfo();
      if (info) {
        this.updateStatus(`Loaded: ${info.title}`, 'ready');
      }

      // Enable buttons
      this.resetBtn.disabled = false;
      this.pauseBtn.disabled = false;

      // Render initial framebuffer (cleared to dark green)
      this.renderer.drawFrame(this.gameboy.getFramebuffer());

      // Start emulation
      this.start();

    } catch (error) {
      logger.error('Error loading ROM:', error);
      this.updateStatus('Error loading ROM', 'error');
    }
  }

  /**
   * Handle reset button
   */
  private handleReset(): void {
    logger.info('Reset requested');
    this.gameboy.reset();
    this.isPaused = false;
    this.pauseBtn.textContent = '⏸️ Pause';

    if (this.isRunning) {
      this.updateStatus('Running', 'running');
    }
  }

  /**
   * Handle pause/resume button
   */
  private handlePause(): void {
    this.isPaused = !this.isPaused;
    this.pauseBtn.textContent = this.isPaused ? '▶️ Resume' : '⏸️ Pause';

    if (this.isPaused) {
      this.updateStatus('Paused', 'ready');
    } else {
      this.updateStatus('Running', 'running');
      if (this.isRunning) {
        this.mainLoop();
      }
    }
  }

  /**
   * Start emulation
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.isPaused = false;
    this.updateStatus('Running', 'running');

    // Start main loop
    this.mainLoop();
  }

  /**
   * Stop emulation
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.updateStatus('Stopped', 'ready');
  }

  /**
   * Main emulation loop
   */
  private mainLoop = (): void => {
    if (!this.isRunning || this.isPaused) {
      return;
    }

    try {
      // Run one frame
      this.gameboy.frame();

      // Always render the current framebuffer (even if frame isn't complete)
      // This ensures we see something on screen even during partial frames
      this.renderer.drawFrame(this.gameboy.getFramebuffer());

      // Clear frame ready flag if it was set
      if (this.gameboy.isFrameReady()) {
        this.gameboy.consumeFrame();
      }

      // Update FPS display
      if (this.fpsDisplay) {
        this.fpsDisplay.textContent = `FPS: ${this.gameboy.fps}`;
      }

      // Schedule next frame
      this.animationFrameId = requestAnimationFrame(this.mainLoop);

    } catch (error) {
      logger.error('Error in main loop:', error);
      this.stop();
      this.updateStatus('Emulation error', 'error');
    }
  };

  /**
   * Update status display
   */
  private updateStatus(message: string, className: 'ready' | 'running' | 'error'): void {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status ${className}`;
  }
}
