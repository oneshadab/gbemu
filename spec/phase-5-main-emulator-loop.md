# Phase 5: Main Emulator Loop

## Overview
Create the GameBoy orchestrator class that coordinates all components (CPU, PPU, Timer, Joypad) and manages the emulation lifecycle.

## Goals
- Create GameBoy orchestrator class
- Implement frame-based execution
- Polish main loop with proper timing
- Add UI state management
- Create proper reset/pause functionality

---

## Step 1: GameBoy Orchestrator

**File**: `src/emulator/GameBoy.ts`

```typescript
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
```

---

## Step 2: UI Controller

**File**: `src/ui/interface.ts`

```typescript
import { GameBoy } from '@/emulator/GameBoy';
import { Renderer } from '@/core/ppu/Renderer';
import { logger } from '@/utils/logger';

/**
 * UI Controller - manages UI state and user interactions
 */
export class UIController {
  private gameboy: GameBoy;
  private renderer: Renderer;

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

    // Get UI elements
    this.romFileInput = document.getElementById('rom-file') as HTMLInputElement;
    this.resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
    this.pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
    this.statusDiv = document.getElementById('status') as HTMLElement;
    this.fpsDisplay = document.getElementById('fps');

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

      // Render if frame is ready
      if (this.gameboy.isFrameReady()) {
        this.renderer.drawFrame(this.gameboy.getFramebuffer());
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
```

---

## Step 3: Display Manager

**File**: `src/ui/display.ts`

```typescript
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
```

---

## Step 4: Updated Main Entry Point

**File**: `src/main.ts` (complete rewrite)

```typescript
import { GameBoy } from '@/emulator/GameBoy';
import { DisplayManager } from '@/ui/display';
import { UIController } from '@/ui/interface';
import { logger, LogLevel } from '@/utils/logger';

// Configure logging
logger.setLevel(LogLevel.INFO);

console.log('🎮 GameBoy Emulator Starting...');

// Initialize display
const displayManager = new DisplayManager('display', 3);
const renderer = displayManager.getRenderer();

// Initialize emulator
const gameboy = new GameBoy();

// Initialize UI controller
const ui = new UIController(gameboy, renderer);

console.log('✅ Emulator ready');

// Expose for debugging
(window as any).gameboy = gameboy;
(window as any).logger = logger;
```

---

## Step 5: Update HTML (Add FPS Counter)

**File**: `public/index.html` (update the info section)

Replace the `.info` div content with:

```html
<div class="info">
  <p><strong>Controls:</strong></p>
  <p>Arrow Keys = D-Pad | Z = A | X = B | Enter = Start | Shift = Select</p>
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <div id="status" class="status ready">Ready - Load a ROM to start</div>
    <div id="fps" style="font-weight: 600; color: #4a5568;">FPS: 0</div>
  </div>
</div>
```

---

## Verification Steps

### 1. Build and Run
```bash
npm run dev
```

### 2. Load ROM
- Select a GameBoy ROM
- Should automatically start running
- FPS counter should show ~60 FPS

### 3. Test Controls
- **Reset button**: Should restart ROM
- **Pause button**: Should pause/resume emulation
- **FPS counter**: Should display current frame rate

### 4. Check Performance
Open browser console:
```javascript
gameboy.fps // Should be ~60
gameboy.getCartridgeInfo() // Should show ROM details
```

---

## Success Criteria

✅ GameBoy class orchestrates all components
✅ Frame-based execution works smoothly
✅ FPS counter displays ~60 FPS
✅ Reset button works
✅ Pause/resume works
✅ Clean separation between emulator and UI
✅ No memory leaks in main loop

---

## Next Phase

Proceed to **Phase 6: Timer & Interrupts** to implement the timer system and complete interrupt handling.

---

## Common Issues & Solutions

### Issue: FPS is much lower than 60
**Solution**: Check if running in debug mode, verify no infinite loops, check browser performance

### Issue: FPS is much higher than 60
**Solution**: requestAnimationFrame should cap at ~60 FPS naturally, check if frame() is being called correctly

### Issue: Emulation runs but nothing displays
**Solution**: Verify renderer.drawFrame() is being called when frameReady is true

### Issue: Pause button doesn't work
**Solution**: Check isPaused flag is being checked in mainLoop, verify event listener is attached

### Issue: Memory usage grows over time
**Solution**: Check for memory leaks, ensure cancelAnimationFrame is called when stopping
