import { MemoryBankController } from './types';

/**
 * MBC1 - Memory Bank Controller 1
 * The most common MBC type, supporting up to 2MB ROM and 32KB RAM
 *
 * Memory map:
 * 0x0000-0x1FFF: RAM Enable (write only)
 * 0x2000-0x3FFF: ROM Bank Number (write only, lower 5 bits)
 * 0x4000-0x5FFF: RAM Bank Number or Upper ROM Bank bits (write only)
 * 0x6000-0x7FFF: Banking Mode Select (write only)
 *
 * Banking modes:
 * - Mode 0 (Simple): 16Mbit ROM / 8KB RAM
 * - Mode 1 (Advanced): 4Mbit ROM / 32KB RAM or 16Mbit ROM / 8KB RAM
 */
export class MBC1 implements MemoryBankController {
  private rom: Uint8Array;
  private ram: Uint8Array;
  private ramEnabled: boolean = false;

  // Banking registers
  private romBankLow: number = 0x01; // 5 bits (0x00 treated as 0x01)
  private ramBankOrRomBankHigh: number = 0x00; // 2 bits
  private bankingMode: number = 0; // 0 = simple, 1 = advanced

  // ROM/RAM sizes
  private romBankCount: number;
  private ramBankCount: number;

  constructor(rom: Uint8Array, ramSize: number) {
    this.rom = rom;
    this.romBankCount = rom.length / 0x4000; // Number of 16KB banks

    // Initialize RAM
    this.ramBankCount = ramSize > 0 ? ramSize / 0x2000 : 0; // Number of 8KB banks
    this.ram = new Uint8Array(ramSize || 0);
  }

  /**
   * Read from ROM bank 0 (0x0000-0x3FFF)
   */
  readROMBank0(address: number): number {
    // In advanced mode, upper bits can affect bank 0
    if (this.bankingMode === 1) {
      const bank = (this.ramBankOrRomBankHigh << 5) & (this.romBankCount - 1);
      return this.rom[bank * 0x4000 + address];
    }

    // Simple mode - always bank 0
    return this.rom[address];
  }

  /**
   * Read from switchable ROM bank (0x4000-0x7FFF)
   */
  readROMBank1(address: number): number {
    // Combine lower 5 bits and upper 2 bits
    let bank = (this.ramBankOrRomBankHigh << 5) | this.romBankLow;

    // Mask to valid ROM bank range
    bank = bank & (this.romBankCount - 1);

    // Calculate actual ROM address
    const romAddress = bank * 0x4000 + address;
    return this.rom[romAddress];
  }

  /**
   * Read from RAM (0xA000-0xBFFF)
   */
  readRAM(address: number): number {
    if (!this.ramEnabled || this.ramBankCount === 0) {
      return 0xFF;
    }

    // Determine RAM bank
    let bank = 0;
    if (this.bankingMode === 1 && this.ramBankCount > 1) {
      bank = this.ramBankOrRomBankHigh & (this.ramBankCount - 1);
    }

    const ramAddress = bank * 0x2000 + address;
    return this.ram[ramAddress];
  }

  /**
   * Write to RAM (0xA000-0xBFFF)
   */
  writeRAM(address: number, value: number): void {
    if (!this.ramEnabled || this.ramBankCount === 0) {
      return;
    }

    // Determine RAM bank
    let bank = 0;
    if (this.bankingMode === 1 && this.ramBankCount > 1) {
      bank = this.ramBankOrRomBankHigh & (this.ramBankCount - 1);
    }

    const ramAddress = bank * 0x2000 + address;
    this.ram[ramAddress] = value;
  }

  /**
   * Write to MBC control registers
   */
  writeControl(address: number, value: number): void {
    if (address >= 0x0000 && address <= 0x1FFF) {
      // RAM Enable
      // Any value with lower 4 bits as 0x0A enables RAM
      this.ramEnabled = (value & 0x0F) === 0x0A;
    }
    else if (address >= 0x2000 && address <= 0x3FFF) {
      // ROM Bank Number (lower 5 bits)
      this.romBankLow = value & 0x1F;

      // Banks 0x00, 0x20, 0x40, 0x60 can't be selected, translate to 0x01, 0x21, 0x41, 0x61
      if (this.romBankLow === 0x00) {
        this.romBankLow = 0x01;
      }
    }
    else if (address >= 0x4000 && address <= 0x5FFF) {
      // RAM Bank Number or Upper ROM Bank bits (2 bits)
      this.ramBankOrRomBankHigh = value & 0x03;
    }
    else if (address >= 0x6000 && address <= 0x7FFF) {
      // Banking Mode Select
      this.bankingMode = value & 0x01;
    }
  }

  /**
   * Get RAM data (for save states)
   */
  getRAM(): Uint8Array {
    return this.ram;
  }

  /**
   * Load RAM data (for save states)
   */
  loadRAM(data: Uint8Array): void {
    if (data.length === this.ram.length) {
      this.ram.set(data);
    }
  }
}
