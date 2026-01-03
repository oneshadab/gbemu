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
