import { Cartridge } from './cartridge';
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

  // Cartridge (contains MBC internally)
  private cartridge: Cartridge | null = null;

  // Timer reference (set after construction)
  private timer: any = null;

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
   * Set timer reference (called after Timer is constructed)
   */
  setTimer(timer: any): void {
    this.timer = timer;
  }

  /**
   * Load a cartridge into memory
   */
  loadCartridge(cartridge: Cartridge): void {
    this.cartridge = cartridge;
    logger.info('Cartridge loaded into MMU');
  }

  /**
   * Read a byte from memory
   */
  read(address: number): number {
    const addr = address & 0xFFFF; // Ensure 16-bit address

    // ROM Bank 0 (0x0000-0x3FFF)
    if (addr < 0x4000) {
      if (!this.cartridge) {
        logger.error('Attempted to read ROM but no cartridge loaded');
        return 0xFF;
      }
      return this.cartridge.readROMBank0(addr);
    }

    // ROM Bank 1-N (0x4000-0x7FFF)
    if (addr >= 0x4000 && addr < 0x8000) {
      if (!this.cartridge) {
        logger.error('Attempted to read ROM but no cartridge loaded');
        return 0xFF;
      }
      return this.cartridge.readROMBank1(addr - 0x4000);
    }

    // VRAM (0x8000-0x9FFF)
    if (addr >= 0x8000 && addr < 0xA000) {
      return this.vram[addr - 0x8000];
    }

    // External RAM (0xA000-0xBFFF)
    if (addr >= 0xA000 && addr < 0xC000) {
      if (!this.cartridge) {
        return 0xFF;
      }
      return this.cartridge.readRAM(addr - 0xA000);
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

    // ROM area (0x0000-0x7FFF) - MBC control registers
    if (addr < 0x8000) {
      if (this.cartridge) {
        this.cartridge.writeControl(addr, val);
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
      if (this.cartridge) {
        this.cartridge.writeRAM(addr - 0xA000, val);
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
      case 0xFF05: // TIMA - Timer counter
      case 0xFF07: // TAC - Timer control
        // Notify timer of register write so it can update internal state
        if (this.timer) {
          this.timer.handleRegisterWrite(address, value);
        }
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
