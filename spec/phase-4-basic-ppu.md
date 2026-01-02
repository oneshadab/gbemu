# Phase 4: Basic PPU (Graphics)

## Overview
Implement the Picture Processing Unit (PPU) with LCD mode state machine and background rendering. This phase gets pixels on screen!

## Goals
- Implement PPU mode state machine (modes 0-3)
- Render background layer
- Handle scroll registers (SCX, SCY)
- Output to 160x144 framebuffer
- Display on canvas

---

## Step 1: PPU Constants

**File**: `src/core/ppu/constants.ts`

```typescript
/**
 * PPU Constants and Timing
 */

// Screen dimensions
export const SCREEN_WIDTH = 160;
export const SCREEN_HEIGHT = 144;

// Timing constants (in CPU cycles)
export const OAM_SCAN_CYCLES = 80;    // Mode 2
export const DRAWING_CYCLES = 172;     // Mode 3
export const HBLANK_CYCLES = 204;      // Mode 0
export const SCANLINE_CYCLES = 456;    // Total per scanline (80 + 172 + 204)
export const VBLANK_LINES = 10;
export const TOTAL_LINES = 154;        // 144 visible + 10 VBlank
export const FRAME_CYCLES = 70224;     // 154 lines * 456 cycles

// LCD Modes
export enum LCDMode {
  HBLANK = 0,
  VBLANK = 1,
  OAM_SCAN = 2,
  DRAWING = 3,
}

// LCDC (LCD Control) register bits
export const LCDC_ENABLE = 7;          // LCD enabled
export const LCDC_WIN_TILEMAP = 6;     // Window tile map (0=9800-9BFF, 1=9C00-9FFF)
export const LCDC_WIN_ENABLE = 5;      // Window enabled
export const LCDC_BG_WIN_TILES = 4;    // BG/Window tile data (0=8800-97FF, 1=8000-8FFF)
export const LCDC_BG_TILEMAP = 3;      // BG tile map (0=9800-9BFF, 1=9C00-9FFF)
export const LCDC_OBJ_SIZE = 2;        // Sprite size (0=8x8, 1=8x16)
export const LCDC_OBJ_ENABLE = 1;      // Sprites enabled
export const LCDC_BG_ENABLE = 0;       // Background enabled

// STAT (LCD Status) register bits
export const STAT_LYC_INT = 6;         // LYC=LY interrupt enable
export const STAT_MODE2_INT = 5;       // Mode 2 OAM interrupt enable
export const STAT_MODE1_INT = 4;       // Mode 1 VBlank interrupt enable
export const STAT_MODE0_INT = 3;       // Mode 0 HBlank interrupt enable
export const STAT_LYC_FLAG = 2;        // LYC=LY flag
export const STAT_MODE_MASK = 0x03;    // Current mode (bits 0-1)

// Interrupt flags
export const INT_VBLANK = 0;
export const INT_STAT = 1;

// DMG Palette colors (shades of green)
export const DMG_COLORS = [
  [0x9B, 0xBC, 0x0F],  // Lightest
  [0x8B, 0xAC, 0x0F],  // Light
  [0x30, 0x62, 0x30],  // Dark
  [0x0F, 0x38, 0x0F],  // Darkest
];
```

---

## Step 2: PPU Implementation

**File**: `src/core/ppu/PPU.ts`

```typescript
import { MMU } from '../memory/MMU';
import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  LCDMode,
  OAM_SCAN_CYCLES,
  DRAWING_CYCLES,
  HBLANK_CYCLES,
  LCDC_ENABLE,
  LCDC_BG_TILEMAP,
  LCDC_BG_WIN_TILES,
  LCDC_BG_ENABLE,
  INT_VBLANK,
  INT_STAT,
  DMG_COLORS,
} from './constants';
import { logger } from '@/utils/logger';
import { getBit } from '@/utils/bits';

export class PPU {
  private mmu: MMU;

  // Framebuffer (RGBA format: 160x144x4 bytes)
  framebuffer: Uint8ClampedArray;

  // PPU state
  private mode: LCDMode = LCDMode.OAM_SCAN;
  private cycles: number = 0;
  private line: number = 0;  // Current scanline (LY register)

  // Frame ready flag
  frameReady: boolean = false;

  constructor(mmu: MMU) {
    this.mmu = mmu;
    this.framebuffer = new Uint8ClampedArray(SCREEN_WIDTH * SCREEN_HEIGHT * 4);
    this.clearFramebuffer();
  }

  /**
   * Reset PPU state
   */
  reset(): void {
    this.mode = LCDMode.OAM_SCAN;
    this.cycles = 0;
    this.line = 0;
    this.frameReady = false;
    this.clearFramebuffer();
  }

  /**
   * Clear framebuffer to darkest green
   */
  private clearFramebuffer(): void {
    const color = DMG_COLORS[3]; // Darkest
    for (let i = 0; i < this.framebuffer.length; i += 4) {
      this.framebuffer[i] = color[0];     // R
      this.framebuffer[i + 1] = color[1]; // G
      this.framebuffer[i + 2] = color[2]; // B
      this.framebuffer[i + 3] = 255;      // A
    }
  }

  /**
   * Step PPU by given number of CPU cycles
   */
  step(cpuCycles: number): void {
    this.cycles += cpuCycles;

    // Check if LCD is enabled
    const lcdc = this.mmu.getIO(0x40);
    if (!getBit(lcdc, LCDC_ENABLE)) {
      return;
    }

    // Update LY register
    this.mmu.setIO(0x44, this.line);

    // State machine
    switch (this.mode) {
      case LCDMode.OAM_SCAN:
        if (this.cycles >= OAM_SCAN_CYCLES) {
          this.cycles -= OAM_SCAN_CYCLES;
          this.setMode(LCDMode.DRAWING);
        }
        break;

      case LCDMode.DRAWING:
        if (this.cycles >= DRAWING_CYCLES) {
          this.cycles -= DRAWING_CYCLES;
          this.renderScanline();
          this.setMode(LCDMode.HBLANK);
        }
        break;

      case LCDMode.HBLANK:
        if (this.cycles >= HBLANK_CYCLES) {
          this.cycles -= HBLANK_CYCLES;
          this.line++;

          if (this.line >= SCREEN_HEIGHT) {
            // Enter VBlank
            this.setMode(LCDMode.VBLANK);
            this.requestInterrupt(INT_VBLANK);
            this.frameReady = true;
          } else {
            // Next scanline
            this.setMode(LCDMode.OAM_SCAN);
          }
        }
        break;

      case LCDMode.VBLANK:
        if (this.cycles >= 456) { // One scanline worth of cycles
          this.cycles -= 456;
          this.line++;

          if (this.line > 153) {
            // Frame complete, restart
            this.line = 0;
            this.setMode(LCDMode.OAM_SCAN);
          }
        }
        break;
    }
  }

  /**
   * Set LCD mode and update STAT register
   */
  private setMode(mode: LCDMode): void {
    this.mode = mode;

    // Update mode bits in STAT register
    const stat = this.mmu.getIO(0x41);
    this.mmu.setIO(0x41, (stat & 0xFC) | mode);
  }

  /**
   * Render current scanline
   */
  private renderScanline(): void {
    const lcdc = this.mmu.getIO(0x40);

    // Check if background is enabled
    if (getBit(lcdc, LCDC_BG_ENABLE)) {
      this.renderBackground();
    }
  }

  /**
   * Render background for current scanline
   */
  private renderBackground(): void {
    const lcdc = this.mmu.getIO(0x40);
    const scx = this.mmu.getIO(0x43); // Scroll X
    const scy = this.mmu.getIO(0x42); // Scroll Y
    const bgp = this.mmu.getIO(0x47); // Background palette

    // Calculate which tile map to use
    const tileMapBase = getBit(lcdc, LCDC_BG_TILEMAP) ? 0x9C00 : 0x9800;

    // Calculate which tile data to use
    const tileDataBase = getBit(lcdc, LCDC_BG_WIN_TILES) ? 0x8000 : 0x8800;
    const useSigned = !getBit(lcdc, LCDC_BG_WIN_TILES);

    // Y position in background map
    const y = (this.line + scy) & 0xFF;
    const tileY = (y >> 3) & 31; // Which tile row (0-31)
    const tilePixelY = y & 7;     // Which pixel row within tile (0-7)

    // Render each pixel in the scanline
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      // X position in background map
      const bgX = (x + scx) & 0xFF;
      const tileX = (bgX >> 3) & 31; // Which tile column (0-31)
      const tilePixelX = bgX & 7;     // Which pixel column within tile (0-7)

      // Get tile number from tile map
      const tileMapAddress = tileMapBase + (tileY * 32) + tileX;
      let tileNum = this.mmu.read(tileMapAddress);

      // Calculate tile data address
      let tileDataAddress: number;
      if (useSigned) {
        // Signed tile numbers (-128 to 127)
        const signedTileNum = tileNum > 127 ? tileNum - 256 : tileNum;
        tileDataAddress = tileDataBase + (signedTileNum * 16);
      } else {
        // Unsigned tile numbers (0-255)
        tileDataAddress = tileDataBase + (tileNum * 16);
      }

      // Each tile is 16 bytes (8x8 pixels, 2 bits per pixel)
      // Each row is 2 bytes
      const rowDataAddress = tileDataAddress + (tilePixelY * 2);
      const byte1 = this.mmu.read(rowDataAddress);
      const byte2 = this.mmu.read(rowDataAddress + 1);

      // Get color index (0-3) for this pixel
      const bitPosition = 7 - tilePixelX;
      const colorBit0 = (byte1 >> bitPosition) & 1;
      const colorBit1 = (byte2 >> bitPosition) & 1;
      const colorIndex = (colorBit1 << 1) | colorBit0;

      // Apply palette
      const paletteColor = (bgp >> (colorIndex * 2)) & 0x03;

      // Get RGB color
      const color = DMG_COLORS[paletteColor];

      // Write to framebuffer
      const fbIndex = (this.line * SCREEN_WIDTH + x) * 4;
      this.framebuffer[fbIndex] = color[0];     // R
      this.framebuffer[fbIndex + 1] = color[1]; // G
      this.framebuffer[fbIndex + 2] = color[2]; // B
      this.framebuffer[fbIndex + 3] = 255;      // A
    }
  }

  /**
   * Request an interrupt
   */
  private requestInterrupt(interrupt: number): void {
    const interruptFlag = this.mmu.getInterruptFlag();
    this.mmu.setInterruptFlag(interruptFlag | (1 << interrupt));
  }
}
```

---

## Step 3: Renderer

**File**: `src/core/ppu/Renderer.ts`

```typescript
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
```

---

## Step 4: Update Main to Use PPU

**File**: `src/main.ts` (update)

```typescript
import { MMU } from '@/core/memory/MMU';
import { Cartridge } from '@/core/memory/cartridge';
import { CPU } from '@/core/cpu/CPU';
import { PPU } from '@/core/ppu/PPU';
import { Renderer } from '@/core/ppu/Renderer';
import { logger, LogLevel } from '@/utils/logger';

logger.setLevel(LogLevel.INFO);

console.log('🎮 GameBoy Emulator Starting...');

// Initialize components
const canvas = document.getElementById('display') as HTMLCanvasElement;
const mmu = new MMU();
const cpu = new CPU(mmu);
const ppu = new PPU(mmu);
const renderer = new Renderer(canvas);

renderer.clear();

console.log('✅ All components initialized');

// UI elements
const romFileInput = document.getElementById('rom-file') as HTMLInputElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

let isRunning = false;
let isPaused = false;

/**
 * Main emulation loop - runs one frame
 */
function runFrame(): void {
  const frameCycles = 70224; // Total cycles per frame
  let cycles = 0;

  while (cycles < frameCycles) {
    // Execute one CPU instruction
    const cpuCycles = cpu.step();

    // Update PPU
    ppu.step(cpuCycles);

    cycles += cpuCycles;
  }

  // Render if frame is ready
  if (ppu.frameReady) {
    renderer.drawFrame(ppu.framebuffer);
    ppu.frameReady = false;
  }
}

/**
 * Main loop using requestAnimationFrame
 */
function mainLoop(): void {
  if (!isRunning || isPaused) return;

  try {
    runFrame();
  } catch (error) {
    logger.error('Error in main loop:', error);
    isRunning = false;
    statusDiv.textContent = 'Error during emulation';
    statusDiv.className = 'status error';
    return;
  }

  requestAnimationFrame(mainLoop);
}

// ROM loading
romFileInput.addEventListener('change', async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const romData = new Uint8Array(arrayBuffer);

    const cartridge = new Cartridge(romData);
    mmu.loadCartridge(cartridge);

    cpu.reset();
    ppu.reset();

    statusDiv.textContent = `Ready: ${cartridge.title}`;
    statusDiv.className = 'status ready';

    resetBtn.disabled = false;
    pauseBtn.disabled = false;

    // Start emulation
    isRunning = true;
    isPaused = false;
    requestAnimationFrame(mainLoop);

    statusDiv.textContent = `Running: ${cartridge.title}`;
    statusDiv.className = 'status running';

  } catch (error) {
    logger.error('Error loading ROM:', error);
    statusDiv.textContent = 'Error loading ROM';
    statusDiv.className = 'status error';
  }
});

resetBtn.addEventListener('click', () => {
  logger.info('Reset');
  cpu.reset();
  ppu.reset();
  isPaused = false;
  if (isRunning) {
    requestAnimationFrame(mainLoop);
  }
});

pauseBtn.addEventListener('click', () => {
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? '▶️ Resume' : '⏸️ Pause';

  if (!isPaused && isRunning) {
    requestAnimationFrame(mainLoop);
  }
});
```

---

## Verification Steps

### 1. Build and Run
```bash
npm run dev
```

### 2. Load a ROM
- Load a GameBoy ROM file
- Should see graphics rendering
- Background should scroll and display tiles

### 3. Expected Behavior
- Screen updates at ~60 FPS
- Background tiles render correctly
- Scroll registers (SCX, SCY) affect display
- Console shows frame execution

### 4. Test with Simple ROMs
Good test ROMs:
- `dmg-acid2.gb` - Visual rendering test
- Simple homebrew ROMs
- Tetris (once more instructions are added)

---

## Success Criteria

✅ PPU state machine works (modes 0-3)
✅ Background rendering displays correctly
✅ Framebuffer updates each frame
✅ Canvas shows GameBoy graphics
✅ VBlank interrupt fires
✅ Scroll registers (SCX, SCY) work
✅ No visual glitches or tearing

---

## Next Phase

Proceed to **Phase 5: Main Emulator Loop** to create the GameBoy orchestrator class and polish the execution flow.

---

## Common Issues & Solutions

### Issue: Screen is all one color
**Solution**: Check if LCDC bit 0 (BG_ENABLE) is set, verify tile data is being read correctly

### Issue: Garbage/random pixels
**Solution**: Verify tile data addressing, check signed vs unsigned tile numbers

### Issue: Performance is slow
**Solution**: Ensure framebuffer is Uint8ClampedArray, check that rendering only happens once per frame

### Issue: Nothing displays
**Solution**: Check LCDC register bit 7 (LCD enabled), verify VBlank interrupt is firing

### Issue: Display is offset/scrolled wrong
**Solution**: Check SCX/SCY register handling, verify wraparound at 256 pixels
