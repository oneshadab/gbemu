# Phase 2: Memory Foundation

## Overview
Implement the Memory Management Unit (MMU), cartridge loading system, and basic ROM support. This is the foundation that all other components will use.

## Goals
- Create MMU with complete GameBoy memory map
- Implement cartridge ROM loading and header parsing
- Support for ROM-only cartridges (No MBC)
- Utility functions for bit manipulation

---

## Step 1: Bit Manipulation Utilities

**File**: `src/utils/bits.ts`

```typescript
/**
 * Bit manipulation utility functions
 */

/**
 * Check if a specific bit is set
 */
export function getBit(value: number, bit: number): number {
  return (value >> bit) & 1;
}

/**
 * Set a specific bit to 1
 */
export function setBit(value: number, bit: number): number {
  return value | (1 << bit);
}

/**
 * Clear a specific bit to 0
 */
export function clearBit(value: number, bit: number): number {
  return value & ~(1 << bit);
}

/**
 * Toggle a specific bit
 */
export function toggleBit(value: number, bit: number): number {
  return value ^ (1 << bit);
}

/**
 * Combine two bytes into a 16-bit word (little-endian)
 */
export function combineBytes(low: number, high: number): number {
  return ((high & 0xFF) << 8) | (low & 0xFF);
}

/**
 * Get low byte of a 16-bit word
 */
export function getLowByte(word: number): number {
  return word & 0xFF;
}

/**
 * Get high byte of a 16-bit word
 */
export function getHighByte(word: number): number {
  return (word >> 8) & 0xFF;
}

/**
 * Convert signed 8-bit value to signed number
 */
export function toSigned8(value: number): number {
  return value > 0x7F ? value - 0x100 : value;
}

/**
 * Convert signed 16-bit value to signed number
 */
export function toSigned16(value: number): number {
  return value > 0x7FFF ? value - 0x10000 : value;
}

/**
 * Ensure value is within 8-bit range
 */
export function to8Bit(value: number): number {
  return value & 0xFF;
}

/**
 * Ensure value is within 16-bit range
 */
export function to16Bit(value: number): number {
  return value & 0xFFFF;
}
```

---

## Step 2: Logger Utility

**File**: `src/utils/logger.ts`

```typescript
/**
 * Simple logging utility with levels
 */

export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  error(...args: unknown[]): void {
    if (this.level >= LogLevel.ERROR) {
      console.error('[ERROR]', ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.level >= LogLevel.WARN) {
      console.warn('[WARN]', ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.level >= LogLevel.INFO) {
      console.log('[INFO]', ...args);
    }
  }

  debug(...args: unknown[]): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  }

  /**
   * Log instruction execution (useful for CPU debugging)
   */
  instruction(pc: number, opcode: number, mnemonic: string): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(`[CPU] ${pc.toString(16).padStart(4, '0')}: ${opcode.toString(16).padStart(2, '0')} ${mnemonic}`);
    }
  }
}

export const logger = new Logger();
```

---

## Step 3: Cartridge Implementation

**File**: `src/core/memory/cartridge.ts`

```typescript
import { logger } from '@/utils/logger';

/**
 * Cartridge types (based on byte 0x0147)
 */
export enum CartridgeType {
  ROM_ONLY = 0x00,
  MBC1 = 0x01,
  MBC1_RAM = 0x02,
  MBC1_RAM_BATTERY = 0x03,
  MBC3 = 0x11,
  MBC3_RAM = 0x12,
  MBC3_RAM_BATTERY = 0x13,
  MBC5 = 0x19,
  MBC5_RAM = 0x1A,
  MBC5_RAM_BATTERY = 0x1B,
}

/**
 * ROM size mapping (byte 0x0148)
 */
const ROM_SIZES: Record<number, number> = {
  0x00: 32 * 1024,      // 32 KiB (2 banks)
  0x01: 64 * 1024,      // 64 KiB (4 banks)
  0x02: 128 * 1024,     // 128 KiB (8 banks)
  0x03: 256 * 1024,     // 256 KiB (16 banks)
  0x04: 512 * 1024,     // 512 KiB (32 banks)
  0x05: 1024 * 1024,    // 1 MiB (64 banks)
  0x06: 2 * 1024 * 1024, // 2 MiB (128 banks)
};

/**
 * RAM size mapping (byte 0x0149)
 */
const RAM_SIZES: Record<number, number> = {
  0x00: 0,              // No RAM
  0x01: 2 * 1024,       // 2 KiB (partial bank)
  0x02: 8 * 1024,       // 8 KiB (1 bank)
  0x03: 32 * 1024,      // 32 KiB (4 banks)
  0x04: 128 * 1024,     // 128 KiB (16 banks)
  0x05: 64 * 1024,      // 64 KiB (8 banks)
};

export class Cartridge {
  private rom: Uint8Array;
  private ram: Uint8Array;

  // Header info
  title: string = '';
  type: CartridgeType = CartridgeType.ROM_ONLY;
  romSize: number = 0;
  ramSize: number = 0;

  constructor(romData: Uint8Array) {
    this.rom = romData;
    this.parseHeader();

    // Allocate RAM if needed
    this.ram = new Uint8Array(this.ramSize);

    logger.info(`Cartridge loaded: "${this.title}"`);
    logger.info(`  Type: 0x${this.type.toString(16).padStart(2, '0')}`);
    logger.info(`  ROM: ${this.romSize / 1024}KB`);
    logger.info(`  RAM: ${this.ramSize / 1024}KB`);
  }

  /**
   * Parse cartridge header (0x0100-0x014F)
   */
  private parseHeader(): void {
    // Title is at 0x0134-0x0143
    const titleBytes: number[] = [];
    for (let i = 0x0134; i <= 0x0143; i++) {
      const byte = this.rom[i];
      if (byte === 0) break; // Null terminator
      titleBytes.push(byte);
    }
    this.title = String.fromCharCode(...titleBytes);

    // Cartridge type at 0x0147
    this.type = this.rom[0x0147];

    // ROM size at 0x0148
    const romSizeCode = this.rom[0x0148];
    this.romSize = ROM_SIZES[romSizeCode] || 32 * 1024;

    // RAM size at 0x0149
    const ramSizeCode = this.rom[0x0149];
    this.ramSize = RAM_SIZES[ramSizeCode] || 0;
  }

  /**
   * Read byte from ROM
   */
  readROM(address: number): number {
    if (address >= this.rom.length) {
      logger.warn(`ROM read out of bounds: 0x${address.toString(16)}`);
      return 0xFF;
    }
    return this.rom[address];
  }

  /**
   * Read byte from RAM
   */
  readRAM(address: number): number {
    if (this.ramSize === 0) {
      logger.warn('Attempted to read from non-existent RAM');
      return 0xFF;
    }
    if (address >= this.ram.length) {
      logger.warn(`RAM read out of bounds: 0x${address.toString(16)}`);
      return 0xFF;
    }
    return this.ram[address];
  }

  /**
   * Write byte to RAM
   */
  writeRAM(address: number, value: number): void {
    if (this.ramSize === 0) {
      logger.warn('Attempted to write to non-existent RAM');
      return;
    }
    if (address >= this.ram.length) {
      logger.warn(`RAM write out of bounds: 0x${address.toString(16)}`);
      return;
    }
    this.ram[address] = value & 0xFF;
  }

  /**
   * Get total number of ROM banks
   */
  getROMBankCount(): number {
    return this.romSize / 0x4000; // Each bank is 16KB
  }

  /**
   * Get total number of RAM banks
   */
  getRAMBankCount(): number {
    return this.ramSize / 0x2000; // Each bank is 8KB
  }
}
```

---

## Step 4: No-MBC Controller

**File**: `src/core/memory/mbcs/NoMBC.ts`

```typescript
import { Cartridge } from '../cartridge';
import { logger } from '@/utils/logger';

/**
 * No Memory Bank Controller (ROM only, up to 32KB)
 * Used for simple games that fit in 32KB
 */
export class NoMBC {
  private cartridge: Cartridge;

  constructor(cartridge: Cartridge) {
    this.cartridge = cartridge;
  }

  /**
   * Read from ROM area (0x0000-0x7FFF)
   */
  readROM(address: number): number {
    // ROM-only supports addresses 0x0000-0x7FFF (32KB max)
    if (address > 0x7FFF) {
      logger.warn(`NoMBC: Read from invalid ROM address 0x${address.toString(16)}`);
      return 0xFF;
    }
    return this.cartridge.readROM(address);
  }

  /**
   * Read from external RAM area (0xA000-0xBFFF)
   */
  readRAM(address: number): number {
    const ramAddress = address - 0xA000;
    return this.cartridge.readRAM(ramAddress);
  }

  /**
   * Write to ROM area (0x0000-0x7FFF)
   * ROM-only cartridges ignore writes
   */
  writeROM(address: number, value: number): void {
    logger.debug(`NoMBC: Ignored write to ROM address 0x${address.toString(16)} = 0x${value.toString(16)}`);
  }

  /**
   * Write to external RAM area (0xA000-0xBFFF)
   */
  writeRAM(address: number, value: number): void {
    const ramAddress = address - 0xA000;
    this.cartridge.writeRAM(ramAddress, value);
  }
}
```

---

## Step 5: Memory Management Unit (MMU)

**File**: `src/core/memory/MMU.ts`

```typescript
import { Cartridge } from './cartridge';
import { NoMBC } from './mbcs/NoMBC';
import { logger } from '@/utils/logger';

/**
 * Memory Management Unit
 *
 * Memory Map:
 * 0x0000-0x3FFF: ROM Bank 0 (16KB)
 * 0x4000-0x7FFF: ROM Bank 1-N (16KB, switchable)
 * 0x8000-0x9FFF: VRAM (8KB)
 * 0xA000-0xBFFF: External RAM (8KB, switchable)
 * 0xC000-0xCFFF: Work RAM Bank 0 (4KB)
 * 0xD000-0xDFFF: Work RAM Bank 1 (4KB)
 * 0xE000-0xFDFF: Echo RAM (mirror of C000-DDFF)
 * 0xFE00-0xFE9F: OAM (Sprite Attribute Table, 160 bytes)
 * 0xFEA0-0xFEFF: Not Usable
 * 0xFF00-0xFF7F: I/O Registers
 * 0xFF80-0xFFFE: High RAM (HRAM, 127 bytes)
 * 0xFFFF: Interrupt Enable Register
 */
export class MMU {
  // Memory regions
  private vram: Uint8Array;           // 8KB
  private wram: Uint8Array;           // 8KB (two 4KB banks)
  private oam: Uint8Array;            // 160 bytes
  private hram: Uint8Array;           // 127 bytes
  private io: Uint8Array;             // 128 bytes

  // Interrupt Enable register
  private interruptEnable: number = 0;

  // Memory Bank Controller
  private mbc: NoMBC | null = null;

  constructor() {
    this.vram = new Uint8Array(0x2000);  // 8KB
    this.wram = new Uint8Array(0x2000);  // 8KB
    this.oam = new Uint8Array(0xA0);     // 160 bytes
    this.hram = new Uint8Array(0x7F);    // 127 bytes
    this.io = new Uint8Array(0x80);      // 128 bytes

    // Initialize I/O registers to default values
    this.initializeIO();
  }

  /**
   * Load a cartridge into memory
   */
  loadCartridge(cartridge: Cartridge): void {
    // For now, only support ROM-only cartridges
    // In Phase 9, we'll add MBC1, MBC3, MBC5 support
    this.mbc = new NoMBC(cartridge);
    logger.info('Cartridge loaded into MMU');
  }

  /**
   * Read a byte from memory
   */
  read(address: number): number {
    const addr = address & 0xFFFF; // Ensure 16-bit address

    // ROM Bank 0 & 1 (0x0000-0x7FFF)
    if (addr < 0x8000) {
      if (!this.mbc) {
        logger.error('Attempted to read ROM but no cartridge loaded');
        return 0xFF;
      }
      return this.mbc.readROM(addr);
    }

    // VRAM (0x8000-0x9FFF)
    if (addr >= 0x8000 && addr < 0xA000) {
      return this.vram[addr - 0x8000];
    }

    // External RAM (0xA000-0xBFFF)
    if (addr >= 0xA000 && addr < 0xC000) {
      if (!this.mbc) {
        return 0xFF;
      }
      return this.mbc.readRAM(addr);
    }

    // Work RAM (0xC000-0xDFFF)
    if (addr >= 0xC000 && addr < 0xE000) {
      return this.wram[addr - 0xC000];
    }

    // Echo RAM (0xE000-0xFDFF) - mirror of Work RAM
    if (addr >= 0xE000 && addr < 0xFE00) {
      return this.wram[addr - 0xE000];
    }

    // OAM (0xFE00-0xFE9F)
    if (addr >= 0xFE00 && addr < 0xFEA0) {
      return this.oam[addr - 0xFE00];
    }

    // Unusable memory (0xFEA0-0xFEFF)
    if (addr >= 0xFEA0 && addr < 0xFF00) {
      return 0xFF;
    }

    // I/O Registers (0xFF00-0xFF7F)
    if (addr >= 0xFF00 && addr < 0xFF80) {
      return this.readIO(addr);
    }

    // HRAM (0xFF80-0xFFFE)
    if (addr >= 0xFF80 && addr < 0xFFFF) {
      return this.hram[addr - 0xFF80];
    }

    // Interrupt Enable (0xFFFF)
    if (addr === 0xFFFF) {
      return this.interruptEnable;
    }

    logger.warn(`Read from unknown address: 0x${addr.toString(16)}`);
    return 0xFF;
  }

  /**
   * Write a byte to memory
   */
  write(address: number, value: number): void {
    const addr = address & 0xFFFF;
    const val = value & 0xFF;

    // ROM Bank 0 & 1 (0x0000-0x7FFF) - passed to MBC
    if (addr < 0x8000) {
      if (this.mbc) {
        this.mbc.writeROM(addr, val);
      }
      return;
    }

    // VRAM (0x8000-0x9FFF)
    if (addr >= 0x8000 && addr < 0xA000) {
      this.vram[addr - 0x8000] = val;
      return;
    }

    // External RAM (0xA000-0xBFFF)
    if (addr >= 0xA000 && addr < 0xC000) {
      if (this.mbc) {
        this.mbc.writeRAM(addr, val);
      }
      return;
    }

    // Work RAM (0xC000-0xDFFF)
    if (addr >= 0xC000 && addr < 0xE000) {
      this.wram[addr - 0xC000] = val;
      return;
    }

    // Echo RAM (0xE000-0xFDFF) - mirror of Work RAM
    if (addr >= 0xE000 && addr < 0xFE00) {
      this.wram[addr - 0xE000] = val;
      return;
    }

    // OAM (0xFE00-0xFE9F)
    if (addr >= 0xFE00 && addr < 0xFEA0) {
      this.oam[addr - 0xFE00] = val;
      return;
    }

    // Unusable memory (0xFEA0-0xFEFF)
    if (addr >= 0xFEA0 && addr < 0xFF00) {
      return; // Ignore writes
    }

    // I/O Registers (0xFF00-0xFF7F)
    if (addr >= 0xFF00 && addr < 0xFF80) {
      this.writeIO(addr, val);
      return;
    }

    // HRAM (0xFF80-0xFFFE)
    if (addr >= 0xFF80 && addr < 0xFFFF) {
      this.hram[addr - 0xFF80] = val;
      return;
    }

    // Interrupt Enable (0xFFFF)
    if (addr === 0xFFFF) {
      this.interruptEnable = val;
      return;
    }

    logger.warn(`Write to unknown address: 0x${addr.toString(16)} = 0x${val.toString(16)}`);
  }

  /**
   * Initialize I/O registers to power-up values
   */
  private initializeIO(): void {
    // These are the values after boot ROM execution
    this.io[0x00] = 0xCF; // P1 (Joypad)
    this.io[0x01] = 0x00; // SB (Serial transfer data)
    this.io[0x02] = 0x7E; // SC (Serial transfer control)
    this.io[0x04] = 0xAB; // DIV (Divider register)
    this.io[0x05] = 0x00; // TIMA (Timer counter)
    this.io[0x06] = 0x00; // TMA (Timer modulo)
    this.io[0x07] = 0xF8; // TAC (Timer control)
    this.io[0x0F] = 0xE1; // IF (Interrupt flag)

    // Sound registers (all initialized to 0 for now)
    for (let i = 0x10; i <= 0x26; i++) {
      this.io[i] = 0x00;
    }

    // LCD registers
    this.io[0x40] = 0x91; // LCDC (LCD control)
    this.io[0x41] = 0x85; // STAT (LCD status)
    this.io[0x42] = 0x00; // SCY (Scroll Y)
    this.io[0x43] = 0x00; // SCX (Scroll X)
    this.io[0x44] = 0x00; // LY (LCD Y coordinate)
    this.io[0x45] = 0x00; // LYC (LY compare)
    this.io[0x47] = 0xFC; // BGP (Background palette)
    this.io[0x48] = 0x00; // OBP0 (Object palette 0)
    this.io[0x49] = 0x00; // OBP1 (Object palette 1)
    this.io[0x4A] = 0x00; // WY (Window Y)
    this.io[0x4B] = 0x00; // WX (Window X)
  }

  /**
   * Read from I/O register
   */
  private readIO(address: number): number {
    const offset = address - 0xFF00;

    // Special handling for certain registers
    switch (address) {
      case 0xFF44: // LY - will be updated by PPU
        return this.io[offset];

      default:
        return this.io[offset];
    }
  }

  /**
   * Write to I/O register
   */
  private writeIO(address: number, value: number): void {
    const offset = address - 0xFF00;

    // Special handling for certain registers
    switch (address) {
      case 0xFF04: // DIV - writing any value resets to 0
        this.io[offset] = 0;
        break;

      case 0xFF44: // LY - read-only, ignore writes
        break;

      case 0xFF46: // DMA - will be handled in PPU phase
        this.io[offset] = value;
        // TODO: Trigger DMA transfer
        break;

      default:
        this.io[offset] = value;
    }
  }

  /**
   * Direct access methods for other components
   */

  getVRAM(): Uint8Array {
    return this.vram;
  }

  getOAM(): Uint8Array {
    return this.oam;
  }

  getIO(offset: number): number {
    return this.io[offset & 0x7F];
  }

  setIO(offset: number, value: number): void {
    this.io[offset & 0x7F] = value & 0xFF;
  }

  getInterruptEnable(): number {
    return this.interruptEnable;
  }

  setInterruptEnable(value: number): void {
    this.interruptEnable = value & 0xFF;
  }

  /**
   * Get interrupt flag register (IF at 0xFF0F)
   */
  getInterruptFlag(): number {
    return this.io[0x0F];
  }

  /**
   * Set interrupt flag register
   */
  setInterruptFlag(value: number): void {
    this.io[0x0F] = value & 0xFF;
  }
}
```

---

## Step 6: Update Main Entry Point

**File**: `src/main.ts` (update)

```typescript
import { MMU } from '@/core/memory/MMU';
import { Cartridge } from '@/core/memory/cartridge';
import { logger, LogLevel } from '@/utils/logger';

// Set log level
logger.setLevel(LogLevel.INFO);

console.log('🎮 GameBoy Emulator Starting...');

// Initialize canvas
const canvas = document.getElementById('display') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');

if (!ctx) {
  throw new Error('Could not get canvas context');
}

// Initialize MMU
const mmu = new MMU();

// Test pattern
ctx.fillStyle = '#0f380f';
ctx.fillRect(0, 0, 160, 144);
ctx.fillStyle = '#9bbc0f';
ctx.fillRect(60, 52, 40, 40);

console.log('✅ Canvas and MMU initialized');

// UI elements
const romFileInput = document.getElementById('rom-file') as HTMLInputElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

romFileInput.addEventListener('change', async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const romData = new Uint8Array(arrayBuffer);

    // Create cartridge and load into MMU
    const cartridge = new Cartridge(romData);
    mmu.loadCartridge(cartridge);

    statusDiv.textContent = `Loaded: ${cartridge.title}`;
    statusDiv.className = 'status ready';

    resetBtn.disabled = false;
    pauseBtn.disabled = false;

    // Test: Read first few bytes of ROM
    logger.info('First 16 bytes of ROM:');
    const bytes: string[] = [];
    for (let i = 0; i < 16; i++) {
      bytes.push(mmu.read(i).toString(16).padStart(2, '0'));
    }
    logger.info(bytes.join(' '));

  } catch (error) {
    logger.error('Error loading ROM:', error);
    statusDiv.textContent = 'Error loading ROM';
    statusDiv.className = 'status error';
  }
});

resetBtn.addEventListener('click', () => {
  logger.info('Reset requested');
});

pauseBtn.addEventListener('click', () => {
  logger.info('Pause/Resume requested');
});
```

---

## Verification Steps

### 1. Build and Run
```bash
npm run dev
```

### 2. Load a ROM
- Get a test ROM or create a dummy .gb file with a header
- Click "Load ROM"
- Check console for cartridge info

### 3. Expected Console Output
```
🎮 GameBoy Emulator Starting...
✅ Canvas and MMU initialized
[INFO] Cartridge loaded: "GAME TITLE"
[INFO]   Type: 0x00
[INFO]   ROM: 32KB
[INFO]   RAM: 0KB
[INFO] Cartridge loaded into MMU
[INFO] First 16 bytes of ROM:
[INFO] 00 c3 50 01 ce ed 66 66 cc 0d 00 0b 03 73 00 83
```

### 4. Test Memory Operations
Add this test code to verify memory works:

```typescript
// Test memory write/read
mmu.write(0xC000, 0x42); // Write to Work RAM
const value = mmu.read(0xC000);
logger.info(`Memory test: wrote 0x42, read 0x${value.toString(16)}`);

// Test echo RAM
const echo = mmu.read(0xE000); // Should be same as 0xC000
logger.info(`Echo RAM test: 0x${echo.toString(16)}`);
```

---

## Success Criteria

✅ Cartridge header parsing works
✅ Memory map correctly routes reads/writes
✅ VRAM, WRAM, OAM accessible
✅ I/O registers initialized
✅ ROM data readable
✅ Echo RAM mirrors Work RAM
✅ No TypeScript errors

---

## Next Phase

Proceed to **Phase 3: CPU Core** where we'll implement the Sharp LR35902 CPU with registers and instruction execution.

---

## Common Issues & Solutions

### Issue: "Cannot read ROM but no cartridge loaded"
**Solution**: Ensure cartridge is loaded with `mmu.loadCartridge(cartridge)` before reading

### Issue: Memory reads return wrong values
**Solution**: Check address ranges in MMU.read() - ensure no overlapping conditions

### Issue: Cartridge title shows garbage
**Solution**: Verify ROM file has valid header at 0x0134-0x014F

### Issue: Import errors with @ alias
**Solution**: Ensure vite.config.ts has correct alias configuration
