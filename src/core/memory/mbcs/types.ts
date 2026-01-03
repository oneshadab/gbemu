/**
 * Memory Bank Controller Interface
 * All MBCs must implement this interface
 */
export interface MemoryBankController {
  /**
   * Read from ROM bank 0 (0x0000-0x3FFF)
   */
  readROMBank0(address: number): number;

  /**
   * Read from switchable ROM bank (0x4000-0x7FFF)
   * Address should be offset from 0x4000 (0x0000-0x3FFF range)
   */
  readROMBank1(address: number): number;

  /**
   * Read from external RAM (0xA000-0xBFFF)
   * Address should be offset from 0xA000 (0x0000-0x1FFF range)
   */
  readRAM(address: number): number;

  /**
   * Write to external RAM (0xA000-0xBFFF)
   * Address should be offset from 0xA000 (0x0000-0x1FFF range)
   */
  writeRAM(address: number, value: number): void;

  /**
   * Write to MBC control registers (0x0000-0x7FFF)
   * Used for bank switching and RAM enable
   */
  writeControl(address: number, value: number): void;
}
