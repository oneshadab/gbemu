import { MemoryBankController } from './types';
import { logger } from '@/utils/logger';

/**
 * No Memory Bank Controller (ROM only, up to 32KB)
 * Used for simple games that fit in 32KB
 */
export class NoMBC implements MemoryBankController {
  private rom: Uint8Array;
  private ram: Uint8Array;

  constructor(rom: Uint8Array, ramSize: number) {
    this.rom = rom;
    this.ram = new Uint8Array(ramSize || 0);
  }

  /**
   * Read from ROM bank 0 (0x0000-0x3FFF)
   */
  readROMBank0(address: number): number {
    if (address >= 0x4000) {
      logger.warn(`NoMBC: Invalid address for bank 0: 0x${address.toString(16)}`);
      return 0xFF;
    }
    if (address >= this.rom.length) {
      return 0xFF;
    }
    return this.rom[address];
  }

  /**
   * Read from ROM bank 1 (0x4000-0x7FFF)
   * For NoMBC, this just reads from 0x4000-0x7FFF of the ROM
   */
  readROMBank1(address: number): number {
    const actualAddress = 0x4000 + address;
    if (actualAddress >= this.rom.length) {
      return 0xFF;
    }
    return this.rom[actualAddress];
  }

  /**
   * Read from external RAM (0xA000-0xBFFF)
   */
  readRAM(address: number): number {
    if (this.ram.length === 0) {
      return 0xFF;
    }
    if (address >= this.ram.length) {
      return 0xFF;
    }
    return this.ram[address];
  }

  /**
   * Write to external RAM (0xA000-0xBFFF)
   */
  writeRAM(address: number, value: number): void {
    if (this.ram.length === 0) {
      return;
    }
    if (address >= this.ram.length) {
      return;
    }
    this.ram[address] = value & 0xFF;
  }

  /**
   * Write to ROM area (0x0000-0x7FFF) - MBC control
   * ROM-only cartridges have no banking, so writes are ignored
   */
  writeControl(address: number, value: number): void {
    // NoMBC ignores all writes to ROM area
    logger.debug(`NoMBC: Ignored write to 0x${address.toString(16)} = 0x${value.toString(16)}`);
  }
}
