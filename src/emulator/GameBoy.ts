import { MMU } from '@/core/memory/MMU';
import { CPU } from '@/core/cpu/CPU';
import { PPU } from '@/core/ppu/PPU';
import { Cartridge } from '@/core/memory/cartridge';
import { logger } from '@/utils/logger';

/**
 * GameBoy Emulator Main Class
 * Orchestrates all components
 */
export class GameBoy {
  // Components
  mmu: MMU;
  cpu: CPU;
  ppu: PPU;

  // State
  private loaded: boolean = false;
  private cartridge: Cartridge | null = null;

  // Performance tracking
  private frameCount: number = 0;
  private lastFpsTime: number = 0;
  fps: number = 0;

  constructor() {
    this.mmu = new MMU();
    this.cpu = new CPU(this.mmu);
    this.ppu = new PPU(this.mmu);

    logger.info('GameBoy emulator initialized');
  }

  /**
   * Load a ROM cartridge
   */
  loadROM(romData: Uint8Array): void {
    try {
      this.cartridge = new Cartridge(romData);
      this.mmu.loadCartridge(this.cartridge);
      this.reset();
      this.loaded = true;

      logger.info(`ROM loaded: ${this.cartridge.title}`);
    } catch (error) {
      logger.error('Failed to load ROM:', error);
      throw error;
    }
  }

  /**
   * Reset emulator to initial state
   */
  reset(): void {
    this.cpu.reset();
    this.ppu.reset();
    this.frameCount = 0;
    this.fps = 0;

    logger.info('Emulator reset');
  }

  /**
   * Execute one frame worth of cycles (~70224 cycles)
   */
  frame(): void {
    if (!this.loaded) {
      return;
    }

    const frameCycles = 70224; // Total CPU cycles per frame
    let cyclesThisFrame = 0;

    while (cyclesThisFrame < frameCycles) {
      // Execute one CPU instruction
      const cpuCycles = this.cpu.step();

      // Update PPU with same number of cycles
      this.ppu.step(cpuCycles);

      // TODO: Update Timer (Phase 6)
      // this.timer.step(cpuCycles);

      cyclesThisFrame += cpuCycles;
    }

    // Update FPS counter
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }

  /**
   * Execute one CPU instruction (for debugging/stepping)
   */
  step(): number {
    if (!this.loaded) {
      return 0;
    }

    const cycles = this.cpu.step();
    this.ppu.step(cycles);
    // TODO: this.timer.step(cycles);

    return cycles;
  }

  /**
   * Check if a frame is ready to be rendered
   */
  isFrameReady(): boolean {
    return this.ppu.frameReady;
  }

  /**
   * Get framebuffer for rendering
   */
  getFramebuffer(): Uint8ClampedArray {
    return this.ppu.framebuffer;
  }

  /**
   * Mark frame as consumed (after rendering)
   */
  consumeFrame(): void {
    this.ppu.frameReady = false;
  }

  /**
   * Check if ROM is loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get cartridge info
   */
  getCartridgeInfo(): { title: string; type: number; romSize: number; ramSize: number } | null {
    if (!this.cartridge) {
      return null;
    }

    return {
      title: this.cartridge.title,
      type: this.cartridge.type,
      romSize: this.cartridge.romSize,
      ramSize: this.cartridge.ramSize,
    };
  }
}
