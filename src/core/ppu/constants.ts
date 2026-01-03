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

// Sprite (OBJ) constants
export const OAM_BASE = 0xFE00;
export const OAM_SIZE = 160; // 40 sprites * 4 bytes each
export const MAX_SPRITES = 40;
export const MAX_SPRITES_PER_LINE = 10;

// Sprite attribute flags (byte 3 of OAM entry)
export const OBJ_PRIORITY = 7;    // 0=Above BG, 1=Behind BG colors 1-3
export const OBJ_FLIP_Y = 6;      // Vertical flip
export const OBJ_FLIP_X = 5;      // Horizontal flip
export const OBJ_PALETTE = 4;     // Palette (0=OBP0, 1=OBP1)

// DMG Palette colors (shades of green)
export const DMG_COLORS = [
  [0x9B, 0xBC, 0x0F],  // Lightest
  [0x8B, 0xAC, 0x0F],  // Light
  [0x30, 0x62, 0x30],  // Dark
  [0x0F, 0x38, 0x0F],  // Darkest
];
