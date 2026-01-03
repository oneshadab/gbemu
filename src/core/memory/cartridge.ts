import { logger } from '@/utils/logger';
import { MemoryBankController } from './mbcs/types';
import { NoMBC } from './mbcs/NoMBC';
import { MBC1 } from './mbcs/MBC1';

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
  private mbc: MemoryBankController;

  // Header info
  title: string = '';
  type: CartridgeType = CartridgeType.ROM_ONLY;
  romSize: number = 0;
  ramSize: number = 0;

  constructor(romData: Uint8Array) {
    this.rom = romData;
    this.parseHeader();

    // Create appropriate MBC controller
    this.mbc = this.createMBC();

    logger.info(`Cartridge loaded: "${this.title}"`);
    logger.info(`  Type: 0x${this.type.toString(16).padStart(2, '0')}`);
    logger.info(`  ROM: ${this.romSize / 1024}KB`);
    logger.info(`  RAM: ${this.ramSize / 1024}KB`);
  }

  /**
   * Create appropriate Memory Bank Controller based on cartridge type
   */
  private createMBC(): MemoryBankController {
    switch (this.type) {
      case CartridgeType.ROM_ONLY:
        return new NoMBC(this.rom, this.ramSize);

      case CartridgeType.MBC1:
      case CartridgeType.MBC1_RAM:
      case CartridgeType.MBC1_RAM_BATTERY:
        return new MBC1(this.rom, this.ramSize);

      default:
        logger.warn(`Unsupported cartridge type 0x${this.type.toString(16)}, using NoMBC`);
        return new NoMBC(this.rom, this.ramSize);
    }
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
   * Read byte from ROM bank 0 (0x0000-0x3FFF)
   */
  readROMBank0(address: number): number {
    return this.mbc.readROMBank0(address);
  }

  /**
   * Read byte from switchable ROM bank (0x4000-0x7FFF)
   */
  readROMBank1(address: number): number {
    return this.mbc.readROMBank1(address);
  }

  /**
   * Read byte from RAM (0xA000-0xBFFF)
   */
  readRAM(address: number): number {
    return this.mbc.readRAM(address);
  }

  /**
   * Write byte to RAM (0xA000-0xBFFF)
   */
  writeRAM(address: number, value: number): void {
    this.mbc.writeRAM(address, value);
  }

  /**
   * Write to MBC control registers (0x0000-0x7FFF)
   */
  writeControl(address: number, value: number): void {
    this.mbc.writeControl(address, value);
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
