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
  LCDC_WIN_TILEMAP,
  LCDC_WIN_ENABLE,
  LCDC_OBJ_ENABLE,
  LCDC_OBJ_SIZE,
  INT_VBLANK,
  INT_STAT,
  DMG_COLORS,
  OAM_BASE,
  MAX_SPRITES_PER_LINE,
  OBJ_PRIORITY,
  OBJ_FLIP_Y,
  OBJ_FLIP_X,
  OBJ_PALETTE,
  STAT_LYC_INT,
  STAT_MODE2_INT,
  STAT_MODE1_INT,
  STAT_MODE0_INT,
  STAT_LYC_FLAG,
} from './constants';
import { logger } from '@/utils/logger';
import { getBit } from '@/utils/bits';

export class PPU {
  private mmu: MMU;

  // Framebuffer (RGBA format: 160x144x4 bytes)
  framebuffer: Uint8ClampedArray;

  // Background color index buffer for sprite priority (160x144, stores color index 0-3)
  private bgColorIndices: Uint8Array;

  // PPU state
  mode: LCDMode = LCDMode.OAM_SCAN; // Made public for MMU access restrictions
  private cycles: number = 0;
  private line: number = 0;  // Current scanline (LY register)
  private windowLineCounter: number = 0; // Internal window line counter
  private lycTriggered: boolean = false; // Track if LYC interrupt was already triggered this line

  // Frame ready flag
  frameReady: boolean = false;

  constructor(mmu: MMU) {
    this.mmu = mmu;
    this.framebuffer = new Uint8ClampedArray(SCREEN_WIDTH * SCREEN_HEIGHT * 4);
    this.bgColorIndices = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
    this.clearFramebuffer();
  }

  /**
   * Reset PPU state
   */
  reset(): void {
    this.mode = LCDMode.OAM_SCAN;
    this.cycles = 0;
    this.line = 0;
    this.windowLineCounter = 0;
    this.lycTriggered = false;
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
    // Clear color indices
    this.bgColorIndices.fill(0);
  }

  /**
   * Step PPU by given number of CPU cycles
   */
  step(cpuCycles: number): void {
    // Check if LCD is enabled
    const lcdc = this.mmu.getIO(0x40);
    const lcdEnabled = getBit(lcdc, LCDC_ENABLE);

    // If LCD is disabled, reset PPU state and don't process
    if (!lcdEnabled) {
      // When LCD is disabled, LY is reset to 0 and PPU stops
      if (this.line !== 0 || this.mode !== LCDMode.OAM_SCAN) {
        this.line = 0;
        this.cycles = 0;
        this.mode = LCDMode.OAM_SCAN;
        this.mmu.setIO(0x44, 0);
      }
      return;
    }

    // Accumulate cycles
    this.cycles += cpuCycles;

    // Process state machine until all cycles are consumed
    // This ensures we process multiple state transitions if many cycles accumulated
    let maxIterations = 1000; // Safety limit to prevent infinite loops
    
    while (this.cycles > 0 && maxIterations > 0) {
      maxIterations--;

      // Update LY register and check LYC coincidence
      this.mmu.setIO(0x44, this.line);
      this.checkLYCCoincidence();

      let stateChanged = false;

      // State machine
      switch (this.mode) {
        case LCDMode.OAM_SCAN:
          if (this.cycles >= OAM_SCAN_CYCLES) {
            this.cycles -= OAM_SCAN_CYCLES;
            this.setMode(LCDMode.DRAWING);
            stateChanged = true;
          }
          break;

        case LCDMode.DRAWING:
          if (this.cycles >= DRAWING_CYCLES) {
            this.cycles -= DRAWING_CYCLES;
            this.renderScanline();
            this.setMode(LCDMode.HBLANK);
            stateChanged = true;
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
            stateChanged = true;
          }
          break;

        case LCDMode.VBLANK:
          if (this.cycles >= 456) { // One scanline worth of cycles
            this.cycles -= 456;
            this.line++;

            if (this.line > 153) {
              // Frame complete, restart
              this.line = 0;
              this.windowLineCounter = 0; // Reset window line counter for new frame
              this.frameReady = false; // Reset frame ready flag for new frame
              this.setMode(LCDMode.OAM_SCAN);
            }
            stateChanged = true;
          }
          break;
      }

      // If no state change occurred, we don't have enough cycles yet
      if (!stateChanged) {
        break;
      }
    }
  }

  /**
   * Set LCD mode and update STAT register, triggering interrupts if enabled
   */
  private setMode(mode: LCDMode): void {
    this.mode = mode;

    // Update mode bits in STAT register
    let stat = this.mmu.getIO(0x41);
    stat = (stat & 0xFC) | mode;
    this.mmu.setIO(0x41, stat);

    // Check for STAT interrupt based on mode
    let requestStatInt = false;
    switch (mode) {
      case LCDMode.HBLANK:
        if (getBit(stat, STAT_MODE0_INT)) {
          requestStatInt = true;
        }
        break;
      case LCDMode.VBLANK:
        if (getBit(stat, STAT_MODE1_INT)) {
          requestStatInt = true;
        }
        break;
      case LCDMode.OAM_SCAN:
        if (getBit(stat, STAT_MODE2_INT)) {
          requestStatInt = true;
        }
        break;
    }

    if (requestStatInt) {
      this.requestInterrupt(INT_STAT);
    }
  }

  /**
   * Check LY=LYC coincidence and update STAT register
   */
  private checkLYCCoincidence(): void {
    const lyc = this.mmu.getIO(0x45); // LYC register
    let stat = this.mmu.getIO(0x41);

    if (this.line === lyc) {
      // Set coincidence flag
      stat |= (1 << STAT_LYC_FLAG);
      this.mmu.setIO(0x41, stat);

      // Request STAT interrupt only once per line when coincidence first occurs
      if (!this.lycTriggered && getBit(stat, STAT_LYC_INT)) {
        this.requestInterrupt(INT_STAT);
        this.lycTriggered = true;
      }
    } else {
      // Clear coincidence flag and reset trigger
      stat &= ~(1 << STAT_LYC_FLAG);
      this.mmu.setIO(0x41, stat);
      this.lycTriggered = false;
    }
  }

  /**
   * Render current scanline
   */
  private renderScanline(): void {
    const lcdc = this.mmu.getIO(0x40);

    // On DMG, LCDC bit 0 controls BG/Window visibility (not just priority like CGB)
    // When bit 0 = 0, background and window are blank (color 0/white)
    if (getBit(lcdc, LCDC_BG_ENABLE)) {
      this.renderBackground();
      // Render window if enabled (window has priority over background)
      this.renderWindow();
    } else {
      // BG disabled - fill with color 0 and set all color indices to 0
      const color = DMG_COLORS[0];
      for (let x = 0; x < SCREEN_WIDTH; x++) {
        const fbIndex = (this.line * SCREEN_WIDTH + x) * 4;
        this.framebuffer[fbIndex] = color[0];
        this.framebuffer[fbIndex + 1] = color[1];
        this.framebuffer[fbIndex + 2] = color[2];
        this.framebuffer[fbIndex + 3] = 255;
        this.bgColorIndices[this.line * SCREEN_WIDTH + x] = 0;
      }
    }

    // Check if sprites are enabled
    if (getBit(lcdc, LCDC_OBJ_ENABLE)) {
      this.renderSprites();
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
        // In signed mode, tile 0 is at 0x9000, not 0x8800
        // Tile -128 is at 0x8800, tile 0 is at 0x9000, tile 127 is at 0x97F0
        const signedTileNum = tileNum > 127 ? tileNum - 256 : tileNum;
        tileDataAddress = 0x9000 + (signedTileNum * 16);
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

      // Store color index for sprite priority
      const pixelIndex = this.line * SCREEN_WIDTH + x;
      this.bgColorIndices[pixelIndex] = colorIndex;
    }
  }

  /**
   * Render window for current scanline
   * Window is a second background layer that can be positioned on screen
   */
  private renderWindow(): void {
    const lcdc = this.mmu.getIO(0x40);
    const wy = this.mmu.getIO(0x4A); // Window Y position
    const wx = this.mmu.getIO(0x4B); // Window X position + 7
    const bgp = this.mmu.getIO(0x47); // Background palette (window uses same palette)

    // Check if window is enabled and visible on this line
    if (!getBit(lcdc, LCDC_WIN_ENABLE)) {
      return;
    }

    // Window is only visible if WY <= current line
    if (this.line < wy) {
      return;
    }

    // Calculate which tile map to use for window
    const tileMapBase = getBit(lcdc, LCDC_WIN_TILEMAP) ? 0x9C00 : 0x9800;

    // Window uses same tile data as background
    const tileDataBase = getBit(lcdc, LCDC_BG_WIN_TILES) ? 0x8000 : 0x8800;
    const useSigned = !getBit(lcdc, LCDC_BG_WIN_TILES);

    // Window uses internal line counter, not LY
    const tileY = (this.windowLineCounter >> 3) & 31; // Which tile row (0-31)
    const tilePixelY = this.windowLineCounter & 7;     // Which pixel row within tile (0-7)

    // Window X position: WX=7 means window starts at screen X=0
    const windowX = wx - 7;

    // Track if we rendered any window pixels on this line
    let renderedWindow = false;

    // Render each pixel in the scanline
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      // Skip if we're before the window X position
      if (x < windowX) {
        continue;
      }

      renderedWindow = true;

      // X position in window (relative to window start)
      const winX = x - windowX;
      const tileX = (winX >> 3) & 31; // Which tile column (0-31)
      const tilePixelX = winX & 7;     // Which pixel column within tile (0-7)

      // Get tile number from tile map
      const tileMapAddress = tileMapBase + (tileY * 32) + tileX;
      let tileNum = this.mmu.read(tileMapAddress);

      // Calculate tile data address
      let tileDataAddress: number;
      if (useSigned) {
        // Signed tile numbers (-128 to 127)
        const signedTileNum = tileNum > 127 ? tileNum - 256 : tileNum;
        tileDataAddress = 0x9000 + (signedTileNum * 16);
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

      // Write to framebuffer (window overwrites background)
      const fbIndex = (this.line * SCREEN_WIDTH + x) * 4;
      this.framebuffer[fbIndex] = color[0];     // R
      this.framebuffer[fbIndex + 1] = color[1]; // G
      this.framebuffer[fbIndex + 2] = color[2]; // B
      this.framebuffer[fbIndex + 3] = 255;      // A

      // Store color index for sprite priority
      const pixelIndex = this.line * SCREEN_WIDTH + x;
      this.bgColorIndices[pixelIndex] = colorIndex;
    }

    // Increment window line counter only if we rendered window pixels
    if (renderedWindow) {
      this.windowLineCounter++;
    }
  }

  /**
   * Render sprites for current scanline
   */
  private renderSprites(): void {
    const lcdc = this.mmu.getIO(0x40);
    const spriteHeight = getBit(lcdc, LCDC_OBJ_SIZE) ? 16 : 8;

    // Sprite data structure:
    // Byte 0: Y position (minus 16)
    // Byte 1: X position (minus 8)
    // Byte 2: Tile number
    // Byte 3: Attributes/flags

    // Collect sprites that are visible on this scanline
    interface Sprite {
      x: number;
      y: number;
      tile: number;
      flags: number;
      oamIndex: number;
    }

    const spritesOnLine: Sprite[] = [];

    // Scan OAM for sprites on this line
    for (let i = 0; i < 40; i++) {
      const oamAddr = OAM_BASE + (i * 4);
      const y = this.mmu.read(oamAddr) - 16;
      const x = this.mmu.read(oamAddr + 1) - 8;
      const tile = this.mmu.read(oamAddr + 2);
      const flags = this.mmu.read(oamAddr + 3);

      // Check if sprite is on this scanline
      if (this.line >= y && this.line < y + spriteHeight) {
        spritesOnLine.push({ x, y, tile, flags, oamIndex: i });

        // Limit to 10 sprites per scanline
        if (spritesOnLine.length >= MAX_SPRITES_PER_LINE) {
          break;
        }
      }
    }

    // Sort sprites by X coordinate (lower X = higher priority)
    // When X is equal, lower OAM index = higher priority
    // We sort so highest priority is LAST (drawn on top)
    spritesOnLine.sort((a, b) => {
      if (a.x !== b.x) {
        return b.x - a.x; // Higher X first (lower priority)
      }
      return b.oamIndex - a.oamIndex; // Higher OAM index first (lower priority)
    });

    // Get sprite palettes
    const obp0 = this.mmu.getIO(0x48); // OBP0
    const obp1 = this.mmu.getIO(0x49); // OBP1

    // Render each sprite
    for (const sprite of spritesOnLine) {
      const { x, y, tile, flags } = sprite;

      // Get sprite attributes
      const priority = getBit(flags, OBJ_PRIORITY);
      const flipY = getBit(flags, OBJ_FLIP_Y);
      const flipX = getBit(flags, OBJ_FLIP_X);
      const palette = getBit(flags, OBJ_PALETTE) ? obp1 : obp0;

      // Calculate which row of the sprite to render
      let spriteRow = this.line - y;
      if (flipY) {
        spriteRow = (spriteHeight - 1) - spriteRow;
      }

      // Get tile data address (sprites always use 0x8000 addressing)
      let tileNum = tile;
      if (spriteHeight === 16) {
        // In 8x16 mode, bit 0 is ignored
        tileNum = tile & 0xFE;
        // If we're in the bottom half, use next tile
        if (spriteRow >= 8) {
          tileNum |= 0x01;
          spriteRow -= 8;
        }
      }

      const tileDataAddress = 0x8000 + (tileNum * 16) + (spriteRow * 2);
      const byte1 = this.mmu.read(tileDataAddress);
      const byte2 = this.mmu.read(tileDataAddress + 1);

      // Render each pixel in the sprite
      for (let px = 0; px < 8; px++) {
        const screenX = x + px;

        // Skip if off screen
        if (screenX < 0 || screenX >= SCREEN_WIDTH) {
          continue;
        }

        // Calculate bit position (handle horizontal flip)
        const bitPosition = flipX ? px : (7 - px);
        const colorBit0 = (byte1 >> bitPosition) & 1;
        const colorBit1 = (byte2 >> bitPosition) & 1;
        const colorIndex = (colorBit1 << 1) | colorBit0;

        // Color 0 is transparent for sprites
        if (colorIndex === 0) {
          continue;
        }

        // Check priority
        if (priority) {
          // Sprite is behind background colors 1-3
          // Check if background pixel color index is not 0
          const pixelIndex = this.line * SCREEN_WIDTH + screenX;
          const bgColorIndex = this.bgColorIndices[pixelIndex];
          // If background is not color 0, sprite is hidden
          if (bgColorIndex !== 0) {
            continue;
          }
        }

        // Apply palette
        const paletteColor = (palette >> (colorIndex * 2)) & 0x03;
        const color = DMG_COLORS[paletteColor];

        // Write to framebuffer
        const fbIndex = (this.line * SCREEN_WIDTH + screenX) * 4;
        this.framebuffer[fbIndex] = color[0];     // R
        this.framebuffer[fbIndex + 1] = color[1]; // G
        this.framebuffer[fbIndex + 2] = color[2]; // B
        this.framebuffer[fbIndex + 3] = 255;      // A
      }
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
