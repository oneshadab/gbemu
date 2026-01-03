import { MemoryBankController } from './types';

/**
 * MBC3 - Memory Bank Controller 3
 * Common in Pokemon games (Red, Blue, Yellow, Gold, Silver, Crystal)
 * Supports up to 2MB ROM and 32KB RAM
 *
 * Memory map:
 * 0x0000-0x1FFF: RAM Enable (write only)
 * 0x2000-0x3FFF: ROM Bank Number (write only, 7 bits)
 * 0x4000-0x5FFF: RAM Bank Number (write only, 2 bits) or RTC register
 * 0x6000-0x7FFF: Latch Clock Data (write only, for RTC - not implemented)
 *
 * Note: This is a basic MBC3 implementation without RTC support
 */
export class MBC3 implements MemoryBankController {
  private rom: Uint8Array;
  private ram: Uint8Array;
  private ramEnabled: boolean = false;

  // Banking registers
  private romBank: number = 0x01; // 7 bits (0x00 treated as 0x01)
  private ramBank: number = 0x00; // 2 bits

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
   * Always reads from bank 0 in MBC3
   */
  readROMBank0(address: number): number {
    return this.rom[address];
  }

  /**
   * Read from switchable ROM bank (0x4000-0x7FFF)
   */
  readROMBank1(address: number): number {
    // Use current ROM bank (1-127)
    const bank = this.romBank & (this.romBankCount - 1);
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

    // Check if accessing RTC register (0x08-0x0C)
    // For basic MBC3 without RTC, just return 0xFF
    if (this.ramBank >= 0x08 && this.ramBank <= 0x0C) {
      return 0xFF; // RTC not implemented
    }

    // Normal RAM access
    const bank = this.ramBank & (this.ramBankCount - 1);
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

    // Check if accessing RTC register (0x08-0x0C)
    // For basic MBC3 without RTC, ignore writes
    if (this.ramBank >= 0x08 && this.ramBank <= 0x0C) {
      return; // RTC not implemented
    }

    // Normal RAM write
    const bank = this.ramBank & (this.ramBankCount - 1);
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
      // ROM Bank Number (7 bits)
      this.romBank = value & 0x7F;

      // Bank 0x00 can't be selected, translate to 0x01
      if (this.romBank === 0x00) {
        this.romBank = 0x01;
      }
    }
    else if (address >= 0x4000 && address <= 0x5FFF) {
      // RAM Bank Number (0x00-0x03) or RTC Register Select (0x08-0x0C)
      this.ramBank = value;
    }
    else if (address >= 0x6000 && address <= 0x7FFF) {
      // Latch Clock Data (for RTC)
      // Not implemented in basic MBC3, ignore
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

