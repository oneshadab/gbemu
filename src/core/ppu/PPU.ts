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
