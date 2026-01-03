import { combineBytes, getHighByte, getLowByte } from '@/utils/bits';

/**
 * CPU Registers for Sharp LR35902
 *
 * 8-bit registers: A, B, C, D, E, F, H, L
 * 16-bit registers: AF, BC, DE, HL, SP, PC
 * Flags (in F register): Z N H C (bits 7-4)
 */
export class Registers {
  // 8-bit registers
  a: number = 0x01;  // Accumulator
  b: number = 0x00;
  c: number = 0x13;
  d: number = 0x00;
  e: number = 0xD8;
  f: number = 0xB0;  // Flags: Z N H C - - - -
  h: number = 0x01;
  l: number = 0x4D;

  // 16-bit registers
  sp: number = 0xFFFE;  // Stack Pointer
  pc: number = 0x0100;  // Program Counter (starts after boot ROM)

  /**
   * Flag bit positions in F register
   */
  static readonly FLAG_Z = 7;  // Zero flag
  static readonly FLAG_N = 6;  // Subtract flag
  static readonly FLAG_H = 5;  // Half-carry flag
  static readonly FLAG_C = 4;  // Carry flag

  // 16-bit register pairs

  getAF(): number {
    return combineBytes(this.f, this.a);
  }

  setAF(value: number): void {
    this.a = getHighByte(value);
    this.f = getLowByte(value) & 0xF0; // Lower 4 bits always 0
  }

  getBC(): number {
    return combineBytes(this.c, this.b);
  }

  setBC(value: number): void {
    this.b = getHighByte(value);
    this.c = getLowByte(value);
  }

  getDE(): number {
    return combineBytes(this.e, this.d);
  }

  setDE(value: number): void {
    this.d = getHighByte(value);
    this.e = getLowByte(value);
  }

  getHL(): number {
    return combineBytes(this.l, this.h);
  }

  setHL(value: number): void {
    this.h = getHighByte(value);
    this.l = getLowByte(value);
  }

  // Flag operations

  getFlag(bit: number): boolean {
    return ((this.f >> bit) & 1) === 1;
  }

  setFlag(bit: number, value: boolean): void {
    if (value) {
      this.f |= (1 << bit);
    } else {
      this.f &= ~(1 << bit);
    }
  }

  getZeroFlag(): boolean {
    return this.getFlag(Registers.FLAG_Z);
  }

  setZeroFlag(value: boolean): void {
    this.setFlag(Registers.FLAG_Z, value);
  }

  getSubtractFlag(): boolean {
    return this.getFlag(Registers.FLAG_N);
  }

  setSubtractFlag(value: boolean): void {
    this.setFlag(Registers.FLAG_N, value);
  }

  getHalfCarryFlag(): boolean {
    return this.getFlag(Registers.FLAG_H);
  }

  setHalfCarryFlag(value: boolean): void {
    this.setFlag(Registers.FLAG_H, value);
  }

  getCarryFlag(): boolean {
    return this.getFlag(Registers.FLAG_C);
  }

  setCarryFlag(value: boolean): void {
    this.setFlag(Registers.FLAG_C, value);
  }

  /**
   * Reset to power-up state (after boot ROM)
   */
  reset(): void {
    this.a = 0x01;
    this.b = 0x00;
    this.c = 0x13;
    this.d = 0x00;
    this.e = 0xD8;
    this.f = 0xB0;
    this.h = 0x01;
    this.l = 0x4D;
    this.sp = 0xFFFE;
    this.pc = 0x0100;
  }

  /**
   * Get register state as string (for debugging)
   */
  toString(): string {
    return `A:${this.a.toString(16).padStart(2, '0')} ` +
           `F:${this.f.toString(16).padStart(2, '0')} ` +
           `B:${this.b.toString(16).padStart(2, '0')} ` +
           `C:${this.c.toString(16).padStart(2, '0')} ` +
           `D:${this.d.toString(16).padStart(2, '0')} ` +
           `E:${this.e.toString(16).padStart(2, '0')} ` +
           `H:${this.h.toString(16).padStart(2, '0')} ` +
           `L:${this.l.toString(16).padStart(2, '0')} ` +
           `SP:${this.sp.toString(16).padStart(4, '0')} ` +
           `PC:${this.pc.toString(16).padStart(4, '0')} ` +
           `[${this.getZeroFlag() ? 'Z' : '-'}${this.getSubtractFlag() ? 'N' : '-'}${this.getHalfCarryFlag() ? 'H' : '-'}${this.getCarryFlag() ? 'C' : '-'}]`;
  }
}
