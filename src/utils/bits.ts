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
