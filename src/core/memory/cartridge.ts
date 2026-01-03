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
