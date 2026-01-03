import { CPU } from './CPU';
import { Instruction } from './types';
import { to8Bit, to16Bit, toSigned8 } from '@/utils/bits';

/**
 * GameBoy CPU Instruction Set
 * 256 primary opcodes (0x00-0xFF)
 *
 * This file implements the most common ~50 opcodes to get started.
 * Unimplemented opcodes return null and will be logged as errors.
 */

export const instructions: (Instruction | null)[] = new Array(256).fill(null);

// Helper to define instruction
const def = (opcode: number, mnemonic: string, cycles: number, handler: (cpu: CPU) => number) => {
  instructions[opcode] = { mnemonic, cycles, handler };
};

// ============================================================================
// 0x00-0x0F: Misc and 8-bit loads
// ============================================================================

// 0x00: NOP
def(0x00, 'NOP', 4, () => 4);

// 0x01: LD BC, nn
def(0x01, 'LD BC, nn', 12, (cpu) => {
  const value = cpu.read16PC();
  cpu.registers.setBC(value);
  return 12;
});

// 0x02: LD (BC), A
def(0x02, 'LD (BC), A', 8, (cpu) => {
  cpu.mmu.write(cpu.registers.getBC(), cpu.registers.a);
  return 8;
});

// 0x03: INC BC
def(0x03, 'INC BC', 8, (cpu) => {
  cpu.registers.setBC(to16Bit(cpu.registers.getBC() + 1));
  return 8;
});

// 0x04: INC B
def(0x04, 'INC B', 4, (cpu) => {
  cpu.registers.b = to8Bit(cpu.registers.b + 1);
  cpu.updateZeroFlag(cpu.registers.b);
  cpu.updateSubtractFlag(false);
  cpu.updateHalfCarryFlag(cpu.registers.b - 1, 1);
  return 4;
});

// 0x05: DEC B
def(0x05, 'DEC B', 4, (cpu) => {
  cpu.registers.b = to8Bit(cpu.registers.b - 1);
  cpu.updateZeroFlag(cpu.registers.b);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(cpu.registers.b + 1, 1, true);
  return 4;
});

// 0x06: LD B, n
def(0x06, 'LD B, n', 8, (cpu) => {
  cpu.registers.b = cpu.readPC();
  return 8;
});

// 0x08: LD (nn), SP
def(0x08, 'LD (nn), SP', 20, (cpu) => {
  const addr = cpu.read16PC();
  cpu.mmu.write(addr, cpu.registers.sp & 0xFF);
  cpu.mmu.write(to16Bit(addr + 1), (cpu.registers.sp >> 8) & 0xFF);
  return 20;
});

// 0x09: ADD HL, BC
def(0x09, 'ADD HL, BC', 8, (cpu) => {
  const hl = cpu.registers.getHL();
  const bc = cpu.registers.getBC();
  const result = hl + bc;
  cpu.registers.setHL(to16Bit(result));
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag((hl & 0xFFF) + (bc & 0xFFF) > 0xFFF);
  cpu.registers.setCarryFlag(result > 0xFFFF);
  return 8;
});

// 0x0B: DEC BC
def(0x0B, 'DEC BC', 8, (cpu) => {
  cpu.registers.setBC(to16Bit(cpu.registers.getBC() - 1));
  return 8;
});

// 0x0C: INC C
def(0x0C, 'INC C', 4, (cpu) => {
  cpu.registers.c = to8Bit(cpu.registers.c + 1);
  cpu.updateZeroFlag(cpu.registers.c);
  cpu.updateSubtractFlag(false);
  cpu.updateHalfCarryFlag(cpu.registers.c - 1, 1);
  return 4;
});

// 0x0D: DEC C
def(0x0D, 'DEC C', 4, (cpu) => {
  cpu.registers.c = to8Bit(cpu.registers.c - 1);
  cpu.updateZeroFlag(cpu.registers.c);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(cpu.registers.c + 1, 1, true);
  return 4;
});

// 0x0E: LD C, n
def(0x0E, 'LD C, n', 8, (cpu) => {
  cpu.registers.c = cpu.readPC();
  return 8;
});

// 0x10: STOP
def(0x10, 'STOP', 4, (cpu) => {
  cpu.stopped = true;
  cpu.readPC(); // STOP is 2 bytes (STOP 0x00)
  return 4;
});

// ============================================================================
// 0x10-0x1F: More loads and rotates
// ============================================================================

// 0x11: LD DE, nn
def(0x11, 'LD DE, nn', 12, (cpu) => {
  const value = cpu.read16PC();
  cpu.registers.setDE(value);
  return 12;
});

// 0x13: INC DE
def(0x13, 'INC DE', 8, (cpu) => {
  cpu.registers.setDE(to16Bit(cpu.registers.getDE() + 1));
  return 8;
});

// 0x14: INC D
def(0x14, 'INC D', 4, (cpu) => {
  cpu.registers.d = to8Bit(cpu.registers.d + 1);
  cpu.updateZeroFlag(cpu.registers.d);
  cpu.updateSubtractFlag(false);
  cpu.updateHalfCarryFlag(cpu.registers.d - 1, 1);
  return 4;
});

// 0x15: DEC D
def(0x15, 'DEC D', 4, (cpu) => {
  cpu.registers.d = to8Bit(cpu.registers.d - 1);
  cpu.updateZeroFlag(cpu.registers.d);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(cpu.registers.d + 1, 1, true);
  return 4;
});

// 0x16: LD D, n
def(0x16, 'LD D, n', 8, (cpu) => {
  cpu.registers.d = cpu.readPC();
  return 8;
});

// 0x17: RLA (Rotate A left through carry)
def(0x17, 'RLA', 4, (cpu) => {
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const newCarry = (cpu.registers.a & 0x80) !== 0;
  cpu.registers.a = to8Bit((cpu.registers.a << 1) | carry);
  cpu.registers.setZeroFlag(false);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(newCarry);
  return 4;
});

// 0x18: JR n (Relative jump)
def(0x18, 'JR n', 12, (cpu) => {
  const offset = toSigned8(cpu.readPC());
  cpu.registers.pc = to16Bit(cpu.registers.pc + offset);
  return 12;
});

// 0x19: ADD HL, DE
def(0x19, 'ADD HL, DE', 8, (cpu) => {
  const hl = cpu.registers.getHL();
  const de = cpu.registers.getDE();
  const result = hl + de;
  cpu.registers.setHL(to16Bit(result));
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag((hl & 0xFFF) + (de & 0xFFF) > 0xFFF);
  cpu.registers.setCarryFlag(result > 0xFFFF);
  return 8;
});

// 0x1A: LD A, (DE)
def(0x1A, 'LD A, (DE)', 8, (cpu) => {
  cpu.registers.a = cpu.mmu.read(cpu.registers.getDE());
  return 8;
});

// 0x1B: DEC DE
def(0x1B, 'DEC DE', 8, (cpu) => {
  cpu.registers.setDE(to16Bit(cpu.registers.getDE() - 1));
  return 8;
});

// 0x1C: INC E
def(0x1C, 'INC E', 4, (cpu) => {
  cpu.registers.e = to8Bit(cpu.registers.e + 1);
  cpu.updateZeroFlag(cpu.registers.e);
  cpu.updateSubtractFlag(false);
  cpu.updateHalfCarryFlag(cpu.registers.e - 1, 1);
  return 4;
});

// 0x1D: DEC E
def(0x1D, 'DEC E', 4, (cpu) => {
  cpu.registers.e = to8Bit(cpu.registers.e - 1);
  cpu.updateZeroFlag(cpu.registers.e);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(cpu.registers.e + 1, 1, true);
  return 4;
});

// 0x1E: LD E, n
def(0x1E, 'LD E, n', 8, (cpu) => {
  cpu.registers.e = cpu.readPC();
  return 8;
});

// ============================================================================
// 0x20-0x2F: Conditional jumps and more loads
// ============================================================================

// 0x20: JR NZ, n
def(0x20, 'JR NZ, n', 8, (cpu) => {
  const offset = toSigned8(cpu.readPC());
  if (!cpu.registers.getZeroFlag()) {
    cpu.registers.pc = to16Bit(cpu.registers.pc + offset);
    return 12; // Branch taken
  }
  return 8; // Branch not taken
});

// 0x21: LD HL, nn
def(0x21, 'LD HL, nn', 12, (cpu) => {
  const value = cpu.read16PC();
  cpu.registers.setHL(value);
  return 12;
});

// 0x22: LD (HL+), A (LDI (HL), A)
def(0x22, 'LD (HL+), A', 8, (cpu) => {
  cpu.mmu.write(cpu.registers.getHL(), cpu.registers.a);
  cpu.registers.setHL(to16Bit(cpu.registers.getHL() + 1));
  return 8;
});

// 0x23: INC HL
def(0x23, 'INC HL', 8, (cpu) => {
  cpu.registers.setHL(to16Bit(cpu.registers.getHL() + 1));
  return 8;
});

// 0x24: INC H
def(0x24, 'INC H', 4, (cpu) => {
  cpu.registers.h = to8Bit(cpu.registers.h + 1);
  cpu.updateZeroFlag(cpu.registers.h);
  cpu.updateSubtractFlag(false);
  cpu.updateHalfCarryFlag(cpu.registers.h - 1, 1);
  return 4;
});

// 0x25: DEC H
def(0x25, 'DEC H', 4, (cpu) => {
  cpu.registers.h = to8Bit(cpu.registers.h - 1);
  cpu.updateZeroFlag(cpu.registers.h);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(cpu.registers.h + 1, 1, true);
  return 4;
});

// 0x26: LD H, n
def(0x26, 'LD H, n', 8, (cpu) => {
  cpu.registers.h = cpu.readPC();
  return 8;
});

// 0x28: JR Z, n
def(0x28, 'JR Z, n', 8, (cpu) => {
  const offset = toSigned8(cpu.readPC());
  if (cpu.registers.getZeroFlag()) {
    cpu.registers.pc = to16Bit(cpu.registers.pc + offset);
    return 12;
  }
  return 8;
});

// 0x29: ADD HL, HL
def(0x29, 'ADD HL, HL', 8, (cpu) => {
  const hl = cpu.registers.getHL();
  const result = hl + hl;
  cpu.registers.setHL(to16Bit(result));
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag((hl & 0xFFF) + (hl & 0xFFF) > 0xFFF);
  cpu.registers.setCarryFlag(result > 0xFFFF);
  return 8;
});

// 0x2A: LD A, (HL+) (LDI A, (HL))
def(0x2A, 'LD A, (HL+)', 8, (cpu) => {
  cpu.registers.a = cpu.mmu.read(cpu.registers.getHL());
  cpu.registers.setHL(to16Bit(cpu.registers.getHL() + 1));
  return 8;
});

// 0x2B: DEC HL
def(0x2B, 'DEC HL', 8, (cpu) => {
  cpu.registers.setHL(to16Bit(cpu.registers.getHL() - 1));
  return 8;
});

// 0x2C: INC L
def(0x2C, 'INC L', 4, (cpu) => {
  cpu.registers.l = to8Bit(cpu.registers.l + 1);
  cpu.updateZeroFlag(cpu.registers.l);
  cpu.updateSubtractFlag(false);
  cpu.updateHalfCarryFlag(cpu.registers.l - 1, 1);
  return 4;
});

// 0x2D: DEC L
def(0x2D, 'DEC L', 4, (cpu) => {
  cpu.registers.l = to8Bit(cpu.registers.l - 1);
  cpu.updateZeroFlag(cpu.registers.l);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(cpu.registers.l + 1, 1, true);
  return 4;
});

// 0x2E: LD L, n
def(0x2E, 'LD L, n', 8, (cpu) => {
  cpu.registers.l = cpu.readPC();
  return 8;
});

// 0x30: JR NC, n
def(0x30, 'JR NC, n', 8, (cpu) => {
  const offset = toSigned8(cpu.readPC());
  if (!cpu.registers.getCarryFlag()) {
    cpu.registers.pc = to16Bit(cpu.registers.pc + offset);
    return 12;
  }
  return 8;
});

// ============================================================================
// 0x30-0x3F: More instructions
// ============================================================================

// 0x31: LD SP, nn
def(0x31, 'LD SP, nn', 12, (cpu) => {
  cpu.registers.sp = cpu.read16PC();
  return 12;
});

// 0x32: LD (HL-), A (LDD (HL), A)
def(0x32, 'LD (HL-), A', 8, (cpu) => {
  cpu.mmu.write(cpu.registers.getHL(), cpu.registers.a);
  cpu.registers.setHL(to16Bit(cpu.registers.getHL() - 1));
  return 8;
});

// 0x3D: DEC A
def(0x3D, 'DEC A', 4, (cpu) => {
  cpu.registers.a = to8Bit(cpu.registers.a - 1);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(cpu.registers.a + 1, 1, true);
  return 4;
});

// 0x3E: LD A, n
def(0x3E, 'LD A, n', 8, (cpu) => {
  cpu.registers.a = cpu.readPC();
  return 8;
});

// ============================================================================
// 0x40-0x7F: 8-bit register loads (LD r, r')
// ============================================================================

// LD B, B through LD B, A (0x40-0x47)
def(0x40, 'LD B, B', 4, (cpu) => { cpu.registers.b = cpu.registers.b; return 4; });
def(0x41, 'LD B, C', 4, (cpu) => { cpu.registers.b = cpu.registers.c; return 4; });
def(0x42, 'LD B, D', 4, (cpu) => { cpu.registers.b = cpu.registers.d; return 4; });
def(0x43, 'LD B, E', 4, (cpu) => { cpu.registers.b = cpu.registers.e; return 4; });
def(0x44, 'LD B, H', 4, (cpu) => { cpu.registers.b = cpu.registers.h; return 4; });
def(0x45, 'LD B, L', 4, (cpu) => { cpu.registers.b = cpu.registers.l; return 4; });
def(0x46, 'LD B, (HL)', 8, (cpu) => {
  cpu.registers.b = cpu.mmu.read(cpu.registers.getHL());
  return 8;
});
def(0x47, 'LD B, A', 4, (cpu) => { cpu.registers.b = cpu.registers.a; return 4; });

// LD C, r (0x48-0x4F)
def(0x4F, 'LD C, A', 4, (cpu) => {
  cpu.registers.c = cpu.registers.a;
  return 4;
});

// LD A, r (0x78-0x7F)
def(0x78, 'LD A, B', 4, (cpu) => {
  cpu.registers.a = cpu.registers.b;
  return 4;
});

def(0x7B, 'LD A, E', 4, (cpu) => {
  cpu.registers.a = cpu.registers.e;
  return 4;
});

def(0x7C, 'LD A, H', 4, (cpu) => {
  cpu.registers.a = cpu.registers.h;
  return 4;
});

def(0x7D, 'LD A, L', 4, (cpu) => {
  cpu.registers.a = cpu.registers.l;
  return 4;
});

// 0x77: LD (HL), A
def(0x77, 'LD (HL), A', 8, (cpu) => {
  cpu.mmu.write(cpu.registers.getHL(), cpu.registers.a);
  return 8;
});

// ============================================================================
// 0x80-0xBF: ALU operations
// ============================================================================

// 0x84: ADD A, H
def(0x84, 'ADD A, H', 4, (cpu) => {
  const a = cpu.registers.a;
  const h = cpu.registers.h;
  const result = a + h;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.updateHalfCarryFlag(a, h);
  cpu.updateCarryFlag(result);
  return 4;
});

// 0x85: ADD A, L
def(0x85, 'ADD A, L', 4, (cpu) => {
  const a = cpu.registers.a;
  const l = cpu.registers.l;
  const result = a + l;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.updateHalfCarryFlag(a, l);
  cpu.updateCarryFlag(result);
  return 4;
});

// 0x88: ADC A, B
def(0x88, 'ADC A, B', 4, (cpu) => {
  const a = cpu.registers.a;
  const b = cpu.registers.b;
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a + b + carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag((a & 0xF) + (b & 0xF) + carry > 0xF);
  cpu.updateCarryFlag(result);
  return 4;
});

// 0x89: ADC A, C
def(0x89, 'ADC A, C', 4, (cpu) => {
  const a = cpu.registers.a;
  const c = cpu.registers.c;
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a + c + carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag((a & 0xF) + (c & 0xF) + carry > 0xF);
  cpu.updateCarryFlag(result);
  return 4;
});

// 0x8A: ADC A, D
def(0x8A, 'ADC A, D', 4, (cpu) => {
  const a = cpu.registers.a;
  const d = cpu.registers.d;
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a + d + carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag((a & 0xF) + (d & 0xF) + carry > 0xF);
  cpu.updateCarryFlag(result);
  return 4;
});

// 0x8B: ADC A, E
def(0x8B, 'ADC A, E', 4, (cpu) => {
  const a = cpu.registers.a;
  const e = cpu.registers.e;
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a + e + carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag((a & 0xF) + (e & 0xF) + carry > 0xF);
  cpu.updateCarryFlag(result);
  return 4;
});

// 0x8C: ADC A, H
def(0x8C, 'ADC A, H', 4, (cpu) => {
  const a = cpu.registers.a;
  const h = cpu.registers.h;
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a + h + carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag((a & 0xF) + (h & 0xF) + carry > 0xF);
  cpu.updateCarryFlag(result);
  return 4;
});

// 0x8D: ADC A, L
def(0x8D, 'ADC A, L', 4, (cpu) => {
  const a = cpu.registers.a;
  const l = cpu.registers.l;
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a + l + carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag((a & 0xF) + (l & 0xF) + carry > 0xF);
  cpu.updateCarryFlag(result);
  return 4;
});

// 0x8E: ADC A, (HL)
def(0x8E, 'ADC A, (HL)', 8, (cpu) => {
  const a = cpu.registers.a;
  const value = cpu.mmu.read(cpu.registers.getHL());
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a + value + carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag((a & 0xF) + (value & 0xF) + carry > 0xF);
  cpu.updateCarryFlag(result);
  return 8;
});

// 0x8F: ADC A, A
def(0x8F, 'ADC A, A', 4, (cpu) => {
  const a = cpu.registers.a;
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a + a + carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag((a & 0xF) + (a & 0xF) + carry > 0xF);
  cpu.updateCarryFlag(result);
  return 4;
});

// 0x91: SUB C
def(0x91, 'SUB C', 4, (cpu) => {
  const a = cpu.registers.a;
  const c = cpu.registers.c;
  const result = a - c;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(a, c, true);
  cpu.updateCarryFlagSubtract(a, c);
  return 4;
});

// 0x92: SUB D
def(0x92, 'SUB D', 4, (cpu) => {
  const a = cpu.registers.a;
  const d = cpu.registers.d;
  const result = a - d;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(a, d, true);
  cpu.updateCarryFlagSubtract(a, d);
  return 4;
});

// 0x93: SUB E
def(0x93, 'SUB E', 4, (cpu) => {
  const a = cpu.registers.a;
  const e = cpu.registers.e;
  const result = a - e;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(a, e, true);
  cpu.updateCarryFlagSubtract(a, e);
  return 4;
});

// 0x94: SUB H
def(0x94, 'SUB H', 4, (cpu) => {
  const a = cpu.registers.a;
  const h = cpu.registers.h;
  const result = a - h;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(a, h, true);
  cpu.updateCarryFlagSubtract(a, h);
  return 4;
});

// 0x95: SUB L
def(0x95, 'SUB L', 4, (cpu) => {
  const a = cpu.registers.a;
  const l = cpu.registers.l;
  const result = a - l;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(a, l, true);
  cpu.updateCarryFlagSubtract(a, l);
  return 4;
});

// 0x96: SUB (HL)
def(0x96, 'SUB (HL)', 8, (cpu) => {
  const a = cpu.registers.a;
  const value = cpu.mmu.read(cpu.registers.getHL());
  const result = a - value;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(a, value, true);
  cpu.updateCarryFlagSubtract(a, value);
  return 8;
});

// 0x98: SBC A, B
def(0x98, 'SBC A, B', 4, (cpu) => {
  const a = cpu.registers.a;
  const b = cpu.registers.b;
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a - b - carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.registers.setHalfCarryFlag((a & 0xF) < (b & 0xF) + carry);
  cpu.registers.setCarryFlag(result < 0);
  return 4;
});

// 0x99: SBC A, C
def(0x99, 'SBC A, C', 4, (cpu) => {
  const a = cpu.registers.a;
  const c = cpu.registers.c;
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a - c - carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.registers.setHalfCarryFlag((a & 0xF) < (c & 0xF) + carry);
  cpu.registers.setCarryFlag(result < 0);
  return 4;
});

// 0x9A: SBC A, D
def(0x9A, 'SBC A, D', 4, (cpu) => {
  const a = cpu.registers.a;
  const d = cpu.registers.d;
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a - d - carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.registers.setHalfCarryFlag((a & 0xF) < (d & 0xF) + carry);
  cpu.registers.setCarryFlag(result < 0);
  return 4;
});

// 0x9B: SBC A, E
def(0x9B, 'SBC A, E', 4, (cpu) => {
  const a = cpu.registers.a;
  const e = cpu.registers.e;
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a - e - carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.registers.setHalfCarryFlag((a & 0xF) < (e & 0xF) + carry);
  cpu.registers.setCarryFlag(result < 0);
  return 4;
});

// 0x9C: SBC A, H
def(0x9C, 'SBC A, H', 4, (cpu) => {
  const a = cpu.registers.a;
  const h = cpu.registers.h;
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a - h - carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.registers.setHalfCarryFlag((a & 0xF) < (h & 0xF) + carry);
  cpu.registers.setCarryFlag(result < 0);
  return 4;
});

// 0x9D: SBC A, L
def(0x9D, 'SBC A, L', 4, (cpu) => {
  const a = cpu.registers.a;
  const l = cpu.registers.l;
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a - l - carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.registers.setHalfCarryFlag((a & 0xF) < (l & 0xF) + carry);
  cpu.registers.setCarryFlag(result < 0);
  return 4;
});

// 0x9E: SBC A, (HL)
def(0x9E, 'SBC A, (HL)', 8, (cpu) => {
  const a = cpu.registers.a;
  const value = cpu.mmu.read(cpu.registers.getHL());
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a - value - carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.registers.setHalfCarryFlag((a & 0xF) < (value & 0xF) + carry);
  cpu.registers.setCarryFlag(result < 0);
  return 8;
});

// 0x9F: SBC A, A
def(0x9F, 'SBC A, A', 4, (cpu) => {
  const a = cpu.registers.a;
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a - a - carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.registers.setHalfCarryFlag((a & 0xF) < (a & 0xF) + carry);
  cpu.registers.setCarryFlag(result < 0);
  return 4;
});

// 0xA0: AND A, B (already implemented as part of AND instructions)
def(0xA0, 'AND A, B', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a & cpu.registers.b;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(true);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xA1: AND A, C
def(0xA1, 'AND A, C', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a & cpu.registers.c;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(true);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xA2: AND A, D
def(0xA2, 'AND A, D', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a & cpu.registers.d;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(true);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xA3: AND A, E
def(0xA3, 'AND A, E', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a & cpu.registers.e;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(true);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xA4: AND A, H
def(0xA4, 'AND A, H', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a & cpu.registers.h;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(true);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xA5: AND A, L
def(0xA5, 'AND A, L', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a & cpu.registers.l;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(true);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xA6: AND A, (HL)
def(0xA6, 'AND A, (HL)', 8, (cpu) => {
  cpu.registers.a = cpu.registers.a & cpu.mmu.read(cpu.registers.getHL());
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(true);
  cpu.registers.setCarryFlag(false);
  return 8;
});

// 0xA7: AND A, A
def(0xA7, 'AND A, A', 4, (cpu) => {
  // A & A = A, so this just sets flags
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(true);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xA8: XOR A, B
def(0xA8, 'XOR A, B', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a ^ cpu.registers.b;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xA9: XOR A, C
def(0xA9, 'XOR A, C', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a ^ cpu.registers.c;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xAA: XOR A, D
def(0xAA, 'XOR A, D', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a ^ cpu.registers.d;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xAB: XOR A, E
def(0xAB, 'XOR A, E', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a ^ cpu.registers.e;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xAC: XOR A, H
def(0xAC, 'XOR A, H', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a ^ cpu.registers.h;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xAD: XOR A, L
def(0xAD, 'XOR A, L', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a ^ cpu.registers.l;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xAE: XOR A, (HL)
def(0xAE, 'XOR A, (HL)', 8, (cpu) => {
  cpu.registers.a = cpu.registers.a ^ cpu.mmu.read(cpu.registers.getHL());
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 8;
});

// 0xAF: XOR A (common way to zero A)
def(0xAF, 'XOR A', 4, (cpu) => {
  cpu.registers.a = 0;
  cpu.registers.setZeroFlag(true);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xB0: OR A, B
def(0xB0, 'OR A, B', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a | cpu.registers.b;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xB1: OR A, C
def(0xB1, 'OR A, C', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a | cpu.registers.c;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xB2: OR A, D
def(0xB2, 'OR A, D', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a | cpu.registers.d;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xB3: OR A, E
def(0xB3, 'OR A, E', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a | cpu.registers.e;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xB4: OR A, H
def(0xB4, 'OR A, H', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a | cpu.registers.h;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xB5: OR A, L
def(0xB5, 'OR A, L', 4, (cpu) => {
  cpu.registers.a = cpu.registers.a | cpu.registers.l;
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xB6: OR A, (HL)
def(0xB6, 'OR A, (HL)', 8, (cpu) => {
  cpu.registers.a = cpu.registers.a | cpu.mmu.read(cpu.registers.getHL());
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 8;
});

// 0xB7: OR A, A
def(0xB7, 'OR A, A', 4, (cpu) => {
  // A | A = A, so this just sets flags
  cpu.registers.setZeroFlag(cpu.registers.a === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// 0xB8: CP A, B
def(0xB8, 'CP A, B', 4, (cpu) => {
  const a = cpu.registers.a;
  const b = cpu.registers.b;
  const result = a - b;
  cpu.registers.setZeroFlag(to8Bit(result) === 0);
  cpu.registers.setSubtractFlag(true);
  cpu.updateHalfCarryFlag(a, b, true);
  cpu.registers.setCarryFlag(a < b);
  return 4;
});

// 0xB9: CP A, C
def(0xB9, 'CP A, C', 4, (cpu) => {
  const a = cpu.registers.a;
  const c = cpu.registers.c;
  const result = a - c;
  cpu.registers.setZeroFlag(to8Bit(result) === 0);
  cpu.registers.setSubtractFlag(true);
  cpu.updateHalfCarryFlag(a, c, true);
  cpu.registers.setCarryFlag(a < c);
  return 4;
});

// 0xBA: CP A, D
def(0xBA, 'CP A, D', 4, (cpu) => {
  const a = cpu.registers.a;
  const d = cpu.registers.d;
  const result = a - d;
  cpu.registers.setZeroFlag(to8Bit(result) === 0);
  cpu.registers.setSubtractFlag(true);
  cpu.updateHalfCarryFlag(a, d, true);
  cpu.registers.setCarryFlag(a < d);
  return 4;
});

// 0xBB: CP A, E
def(0xBB, 'CP A, E', 4, (cpu) => {
  const a = cpu.registers.a;
  const e = cpu.registers.e;
  const result = a - e;
  cpu.registers.setZeroFlag(to8Bit(result) === 0);
  cpu.registers.setSubtractFlag(true);
  cpu.updateHalfCarryFlag(a, e, true);
  cpu.registers.setCarryFlag(a < e);
  return 4;
});

// 0xBC: CP A, H
def(0xBC, 'CP A, H', 4, (cpu) => {
  const a = cpu.registers.a;
  const h = cpu.registers.h;
  const result = a - h;
  cpu.registers.setZeroFlag(to8Bit(result) === 0);
  cpu.registers.setSubtractFlag(true);
  cpu.updateHalfCarryFlag(a, h, true);
  cpu.registers.setCarryFlag(a < h);
  return 4;
});

// 0xBD: CP A, L
def(0xBD, 'CP A, L', 4, (cpu) => {
  const a = cpu.registers.a;
  const l = cpu.registers.l;
  const result = a - l;
  cpu.registers.setZeroFlag(to8Bit(result) === 0);
  cpu.registers.setSubtractFlag(true);
  cpu.updateHalfCarryFlag(a, l, true);
  cpu.registers.setCarryFlag(a < l);
  return 4;
});

// 0xBE: CP A, (HL)
def(0xBE, 'CP A, (HL)', 8, (cpu) => {
  const a = cpu.registers.a;
  const value = cpu.mmu.read(cpu.registers.getHL());
  const result = a - value;
  cpu.registers.setZeroFlag(to8Bit(result) === 0);
  cpu.registers.setSubtractFlag(true);
  cpu.updateHalfCarryFlag(a, value, true);
  cpu.registers.setCarryFlag(a < value);
  return 8;
});

// 0xBF: CP A, A
def(0xBF, 'CP A, A', 4, (cpu) => {
  // A - A = 0, always sets Zero flag
  cpu.registers.setZeroFlag(true);
  cpu.registers.setSubtractFlag(true);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// ============================================================================
// 0xC0-0xFF: Control flow and special instructions
// ============================================================================

// 0xC1: POP BC
def(0xC1, 'POP BC', 12, (cpu) => {
  cpu.registers.setBC(cpu.popStack());
  return 12;
});

// 0xC3: JP nn (Absolute jump)
def(0xC3, 'JP nn', 16, (cpu) => {
  cpu.registers.pc = cpu.read16PC();
  return 16;
});

// 0xC5: PUSH BC
def(0xC5, 'PUSH BC', 16, (cpu) => {
  cpu.pushStack(cpu.registers.getBC());
  return 16;
});

// 0xC9: RET
def(0xC9, 'RET', 16, (cpu) => {
  cpu.registers.pc = cpu.popStack();
  return 16;
});

// 0xCB: PREFIX (Extended instruction set)
def(0xCB, 'PREFIX CB', 0, (_cpu) => {
  // This is handled in CPU.ts step() method
  // The opcode is read and handled separately
  throw new Error('CB prefix should be handled in CPU.step()');
});

// 0xCD: CALL nn
def(0xCD, 'CALL nn', 24, (cpu) => {
  const address = cpu.read16PC();
  cpu.pushStack(cpu.registers.pc);
  cpu.registers.pc = address;
  return 24;
});

// 0xD4: CALL NC, a16
def(0xD4, 'CALL NC, a16', 12, (cpu) => {
  const address = cpu.read16PC();
  if (!cpu.registers.getCarryFlag()) {
    cpu.pushStack(cpu.registers.pc);
    cpu.registers.pc = address;
    return 24;
  }
  return 12;
});

// 0xD9: RETI (Return from interrupt)
def(0xD9, 'RETI', 16, (cpu) => {
  cpu.registers.pc = cpu.popStack();
  cpu.ime = true; // Re-enable interrupts
  return 16;
});

// 0xDC: CALL C, a16
def(0xDC, 'CALL C, a16', 12, (cpu) => {
  const address = cpu.read16PC();
  if (cpu.registers.getCarryFlag()) {
    cpu.pushStack(cpu.registers.pc);
    cpu.registers.pc = address;
    return 24;
  }
  return 12;
});

// 0xDE: SBC A, n8
def(0xDE, 'SBC A, n8', 8, (cpu) => {
  const a = cpu.registers.a;
  const value = cpu.readPC();
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = a - value - carry;
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.registers.setHalfCarryFlag((a & 0xF) < (value & 0xF) + carry);
  cpu.registers.setCarryFlag(result < 0);
  return 8;
});

// 0xE0: LD (0xFF00+n), A
def(0xE0, 'LD (FF00+n), A', 12, (cpu) => {
  const offset = cpu.readPC();
  cpu.mmu.write(0xFF00 + offset, cpu.registers.a);
  return 12;
});

// 0xE2: LD (0xFF00+C), A
def(0xE2, 'LD (FF00+C), A', 8, (cpu) => {
  cpu.mmu.write(0xFF00 + cpu.registers.c, cpu.registers.a);
  return 8;
});

// 0xE8: ADD SP, e8
def(0xE8, 'ADD SP, e8', 16, (cpu) => {
  const sp = cpu.registers.sp;
  const value = cpu.readPC();
  // Treat as signed 8-bit
  const signed = value > 127 ? value - 256 : value;
  const result = sp + signed;
  
  cpu.registers.sp = to16Bit(result);
  cpu.registers.setZeroFlag(false);
  cpu.registers.setSubtractFlag(false);
  // Half-carry and carry are calculated on lower 8 bits
  cpu.registers.setHalfCarryFlag(((sp & 0xF) + (value & 0xF)) > 0xF);
  cpu.registers.setCarryFlag(((sp & 0xFF) + (value & 0xFF)) > 0xFF);
  return 16;
});

// 0xEA: LD (nn), A
def(0xEA, 'LD (nn), A', 16, (cpu) => {
  const address = cpu.read16PC();
  cpu.mmu.write(address, cpu.registers.a);
  return 16;
});

// 0xF0: LD A, (0xFF00+n)
def(0xF0, 'LD A, (FF00+n)', 12, (cpu) => {
  const offset = cpu.readPC();
  cpu.registers.a = cpu.mmu.read(0xFF00 + offset);
  return 12;
});

// 0xF2: LDH A, (C) (LD A, (0xFF00+C))
def(0xF2, 'LDH A, (C)', 8, (cpu) => {
  cpu.registers.a = cpu.mmu.read(0xFF00 + cpu.registers.c);
  return 8;
});

// 0xF3: DI (Disable interrupts)
def(0xF3, 'DI', 4, (cpu) => {
  cpu.ime = false;
  return 4;
});

// 0xF8: LD HL, SP+e8
def(0xF8, 'LD HL, SP+e8', 12, (cpu) => {
  const sp = cpu.registers.sp;
  const value = cpu.readPC();
  // Treat as signed 8-bit
  const signed = value > 127 ? value - 256 : value;
  const result = sp + signed;
  
  cpu.registers.setHL(to16Bit(result));
  cpu.registers.setZeroFlag(false);
  cpu.registers.setSubtractFlag(false);
  // Half-carry and carry are calculated on lower 8 bits
  cpu.registers.setHalfCarryFlag(((sp & 0xF) + (value & 0xF)) > 0xF);
  cpu.registers.setCarryFlag(((sp & 0xFF) + (value & 0xFF)) > 0xFF);
  return 12;
});

// 0xFA: LD A, (nn)
def(0xFA, 'LD A, (nn)', 16, (cpu) => {
  const addr = cpu.read16PC();
  cpu.registers.a = cpu.mmu.read(addr);
  return 16;
});

// 0xFB: EI (Enable interrupts)
def(0xFB, 'EI', 4, (cpu) => {
  cpu.imeScheduled = true; // Takes effect after next instruction
  return 4;
});

// 0xFE: CP n (Compare A with n)
def(0xFE, 'CP n', 8, (cpu) => {
  const n = cpu.readPC();
  const result = cpu.registers.a - n;
  cpu.updateZeroFlag(result);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(cpu.registers.a, n, true);
  cpu.updateCarryFlagSubtract(cpu.registers.a, n);
  return 8;
});

// 0x76: HALT
def(0x76, 'HALT', 4, (cpu) => {
  cpu.halted = true;
  return 4;
});

// ============================================================================
// Additional Instructions (Phase 9)
// ============================================================================

// 0x07: RLCA (Rotate A left)
def(0x07, 'RLCA', 4, (cpu) => {
  const carry = (cpu.registers.a & 0x80) !== 0;
  cpu.registers.a = to8Bit((cpu.registers.a << 1) | (carry ? 1 : 0));
  cpu.registers.setZeroFlag(false);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(carry);
  return 4;
});

// 0x0F: RRCA (Rotate A right)
def(0x0F, 'RRCA', 4, (cpu) => {
  const carry = (cpu.registers.a & 0x01) !== 0;
  cpu.registers.a = to8Bit((cpu.registers.a >> 1) | (carry ? 0x80 : 0));
  cpu.registers.setZeroFlag(false);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(carry);
  return 4;
});

// 0x0A: LD A, (BC)
def(0x0A, 'LD A, (BC)', 8, (cpu) => {
  cpu.registers.a = cpu.mmu.read(cpu.registers.getBC());
  return 8;
});

// 0x12: LD (DE), A
def(0x12, 'LD (DE), A', 8, (cpu) => {
  cpu.mmu.write(cpu.registers.getDE(), cpu.registers.a);
  return 8;
});

// 0x1F: RRA (Rotate A right through carry)
def(0x1F, 'RRA', 4, (cpu) => {
  const oldCarry = cpu.registers.getCarryFlag() ? 0x80 : 0;
  const newCarry = (cpu.registers.a & 0x01) !== 0;
  cpu.registers.a = to8Bit((cpu.registers.a >> 1) | oldCarry);
  cpu.registers.setZeroFlag(false);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(newCarry);
  return 4;
});

// 0x27: DAA (Decimal Adjust Accumulator)
def(0x27, 'DAA', 4, (cpu) => {
  let a = cpu.registers.a;

  if (!cpu.registers.getSubtractFlag()) {
    if (cpu.registers.getCarryFlag() || a > 0x99) {
      a = to8Bit(a + 0x60);
      cpu.registers.setCarryFlag(true);
    }
    if (cpu.registers.getHalfCarryFlag() || (a & 0x0F) > 0x09) {
      a = to8Bit(a + 0x06);
    }
  } else {
    if (cpu.registers.getCarryFlag()) {
      a = to8Bit(a - 0x60);
    }
    if (cpu.registers.getHalfCarryFlag()) {
      a = to8Bit(a - 0x06);
    }
  }

  cpu.registers.a = a;
  cpu.updateZeroFlag(a);
  cpu.registers.setHalfCarryFlag(false);
  return 4;
});

// 0x2F: CPL (Complement A)
def(0x2F, 'CPL', 4, (cpu) => {
  cpu.registers.a = to8Bit(~cpu.registers.a);
  cpu.registers.setSubtractFlag(true);
  cpu.registers.setHalfCarryFlag(true);
  return 4;
});

// 0x33: INC SP
def(0x33, 'INC SP', 8, (cpu) => {
  cpu.registers.sp = to16Bit(cpu.registers.sp + 1);
  return 8;
});

// 0x34: INC (HL)
def(0x34, 'INC (HL)', 12, (cpu) => {
  const addr = cpu.registers.getHL();
  let value = cpu.mmu.read(addr);
  value = to8Bit(value + 1);
  cpu.mmu.write(addr, value);
  cpu.updateZeroFlag(value);
  cpu.updateSubtractFlag(false);
  cpu.updateHalfCarryFlag(value - 1, 1);
  return 12;
});

// 0x35: DEC (HL)
def(0x35, 'DEC (HL)', 12, (cpu) => {
  const addr = cpu.registers.getHL();
  let value = cpu.mmu.read(addr);
  value = to8Bit(value - 1);
  cpu.mmu.write(addr, value);
  cpu.updateZeroFlag(value);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(value + 1, 1, true);
  return 12;
});

// 0x36: LD (HL), n
def(0x36, 'LD (HL), n', 12, (cpu) => {
  const value = cpu.readPC();
  cpu.mmu.write(cpu.registers.getHL(), value);
  return 12;
});

// 0x37: SCF (Set Carry Flag)
def(0x37, 'SCF', 4, (cpu) => {
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(true);
  return 4;
});

// 0x38: JR C, n
def(0x38, 'JR C, n', 8, (cpu) => {
  const offset = toSigned8(cpu.readPC());
  if (cpu.registers.getCarryFlag()) {
    cpu.registers.pc = to16Bit(cpu.registers.pc + offset);
    return 12;
  }
  return 8;
});

// 0x39: ADD HL, SP
def(0x39, 'ADD HL, SP', 8, (cpu) => {
  const hl = cpu.registers.getHL();
  const sp = cpu.registers.sp;
  const result = hl + sp;
  cpu.registers.setHL(to16Bit(result));
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag((hl & 0xFFF) + (sp & 0xFFF) > 0xFFF);
  cpu.registers.setCarryFlag(result > 0xFFFF);
  return 8;
});

// 0x3A: LD A, (HL-)
def(0x3A, 'LD A, (HL-)', 8, (cpu) => {
  cpu.registers.a = cpu.mmu.read(cpu.registers.getHL());
  cpu.registers.setHL(to16Bit(cpu.registers.getHL() - 1));
  return 8;
});

// 0x3B: DEC SP
def(0x3B, 'DEC SP', 8, (cpu) => {
  cpu.registers.sp = to16Bit(cpu.registers.sp - 1);
  return 8;
});

// 0x3C: INC A
def(0x3C, 'INC A', 4, (cpu) => {
  cpu.registers.a = to8Bit(cpu.registers.a + 1);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.updateHalfCarryFlag(cpu.registers.a - 1, 1);
  return 4;
});

// 0x3F: CCF (Complement Carry Flag)
def(0x3F, 'CCF', 4, (cpu) => {
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(!cpu.registers.getCarryFlag());
  return 4;
});

// More LD r, r' instructions (0x48-0x75)
def(0x48, 'LD C, B', 4, (cpu) => { cpu.registers.c = cpu.registers.b; return 4; });
def(0x49, 'LD C, C', 4, (cpu) => { cpu.registers.c = cpu.registers.c; return 4; });
def(0x4A, 'LD C, D', 4, (cpu) => { cpu.registers.c = cpu.registers.d; return 4; });
def(0x4B, 'LD C, E', 4, (cpu) => { cpu.registers.c = cpu.registers.e; return 4; });
def(0x4C, 'LD C, H', 4, (cpu) => { cpu.registers.c = cpu.registers.h; return 4; });
def(0x4D, 'LD C, L', 4, (cpu) => { cpu.registers.c = cpu.registers.l; return 4; });
def(0x4E, 'LD C, (HL)', 8, (cpu) => { cpu.registers.c = cpu.mmu.read(cpu.registers.getHL()); return 8; });

def(0x50, 'LD D, B', 4, (cpu) => { cpu.registers.d = cpu.registers.b; return 4; });
def(0x51, 'LD D, C', 4, (cpu) => { cpu.registers.d = cpu.registers.c; return 4; });
def(0x52, 'LD D, D', 4, (cpu) => { cpu.registers.d = cpu.registers.d; return 4; });
def(0x53, 'LD D, E', 4, (cpu) => { cpu.registers.d = cpu.registers.e; return 4; });
def(0x54, 'LD D, H', 4, (cpu) => { cpu.registers.d = cpu.registers.h; return 4; });
def(0x55, 'LD D, L', 4, (cpu) => { cpu.registers.d = cpu.registers.l; return 4; });
def(0x56, 'LD D, (HL)', 8, (cpu) => { cpu.registers.d = cpu.mmu.read(cpu.registers.getHL()); return 8; });
def(0x57, 'LD D, A', 4, (cpu) => { cpu.registers.d = cpu.registers.a; return 4; });

def(0x58, 'LD E, B', 4, (cpu) => { cpu.registers.e = cpu.registers.b; return 4; });
def(0x59, 'LD E, C', 4, (cpu) => { cpu.registers.e = cpu.registers.c; return 4; });
def(0x5A, 'LD E, D', 4, (cpu) => { cpu.registers.e = cpu.registers.d; return 4; });
def(0x5B, 'LD E, E', 4, (cpu) => { cpu.registers.e = cpu.registers.e; return 4; });
def(0x5C, 'LD E, H', 4, (cpu) => { cpu.registers.e = cpu.registers.h; return 4; });
def(0x5D, 'LD E, L', 4, (cpu) => { cpu.registers.e = cpu.registers.l; return 4; });
def(0x5E, 'LD E, (HL)', 8, (cpu) => { cpu.registers.e = cpu.mmu.read(cpu.registers.getHL()); return 8; });
def(0x5F, 'LD E, A', 4, (cpu) => { cpu.registers.e = cpu.registers.a; return 4; });

def(0x60, 'LD H, B', 4, (cpu) => { cpu.registers.h = cpu.registers.b; return 4; });
def(0x61, 'LD H, C', 4, (cpu) => { cpu.registers.h = cpu.registers.c; return 4; });
def(0x62, 'LD H, D', 4, (cpu) => { cpu.registers.h = cpu.registers.d; return 4; });
def(0x63, 'LD H, E', 4, (cpu) => { cpu.registers.h = cpu.registers.e; return 4; });
def(0x64, 'LD H, H', 4, (cpu) => { cpu.registers.h = cpu.registers.h; return 4; });
def(0x65, 'LD H, L', 4, (cpu) => { cpu.registers.h = cpu.registers.l; return 4; });
def(0x66, 'LD H, (HL)', 8, (cpu) => { cpu.registers.h = cpu.mmu.read(cpu.registers.getHL()); return 8; });
def(0x67, 'LD H, A', 4, (cpu) => { cpu.registers.h = cpu.registers.a; return 4; });

def(0x68, 'LD L, B', 4, (cpu) => { cpu.registers.l = cpu.registers.b; return 4; });
def(0x69, 'LD L, C', 4, (cpu) => { cpu.registers.l = cpu.registers.c; return 4; });
def(0x6A, 'LD L, D', 4, (cpu) => { cpu.registers.l = cpu.registers.d; return 4; });
def(0x6B, 'LD L, E', 4, (cpu) => { cpu.registers.l = cpu.registers.e; return 4; });
def(0x6C, 'LD L, H', 4, (cpu) => { cpu.registers.l = cpu.registers.h; return 4; });
def(0x6D, 'LD L, L', 4, (cpu) => { cpu.registers.l = cpu.registers.l; return 4; });
def(0x6E, 'LD L, (HL)', 8, (cpu) => { cpu.registers.l = cpu.mmu.read(cpu.registers.getHL()); return 8; });
def(0x6F, 'LD L, A', 4, (cpu) => { cpu.registers.l = cpu.registers.a; return 4; });

def(0x70, 'LD (HL), B', 8, (cpu) => { cpu.mmu.write(cpu.registers.getHL(), cpu.registers.b); return 8; });
def(0x71, 'LD (HL), C', 8, (cpu) => { cpu.mmu.write(cpu.registers.getHL(), cpu.registers.c); return 8; });
def(0x72, 'LD (HL), D', 8, (cpu) => { cpu.mmu.write(cpu.registers.getHL(), cpu.registers.d); return 8; });
def(0x73, 'LD (HL), E', 8, (cpu) => { cpu.mmu.write(cpu.registers.getHL(), cpu.registers.e); return 8; });
def(0x74, 'LD (HL), H', 8, (cpu) => { cpu.mmu.write(cpu.registers.getHL(), cpu.registers.h); return 8; });
def(0x75, 'LD (HL), L', 8, (cpu) => { cpu.mmu.write(cpu.registers.getHL(), cpu.registers.l); return 8; });

def(0x79, 'LD A, C', 4, (cpu) => { cpu.registers.a = cpu.registers.c; return 4; });
def(0x7A, 'LD A, D', 4, (cpu) => { cpu.registers.a = cpu.registers.d; return 4; });
def(0x7E, 'LD A, (HL)', 8, (cpu) => { cpu.registers.a = cpu.mmu.read(cpu.registers.getHL()); return 8; });
def(0x7F, 'LD A, A', 4, (cpu) => { cpu.registers.a = cpu.registers.a; return 4; });

// ALU operations: ADD, ADC, SUB, SBC, AND, XOR, OR, CP (0x80-0xBF)
// ADD A, r
def(0x80, 'ADD A, B', 4, (cpu) => {
  const result = cpu.registers.a + cpu.registers.b;
  cpu.updateHalfCarryFlag(cpu.registers.a, cpu.registers.b);
  cpu.updateCarryFlagAdd(cpu.registers.a, cpu.registers.b);
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  return 4;
});

def(0x81, 'ADD A, C', 4, (cpu) => {
  const result = cpu.registers.a + cpu.registers.c;
  cpu.updateHalfCarryFlag(cpu.registers.a, cpu.registers.c);
  cpu.updateCarryFlagAdd(cpu.registers.a, cpu.registers.c);
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  return 4;
});

def(0x82, 'ADD A, D', 4, (cpu) => {
  const result = cpu.registers.a + cpu.registers.d;
  cpu.updateHalfCarryFlag(cpu.registers.a, cpu.registers.d);
  cpu.updateCarryFlagAdd(cpu.registers.a, cpu.registers.d);
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  return 4;
});

def(0x83, 'ADD A, E', 4, (cpu) => {
  const result = cpu.registers.a + cpu.registers.e;
  cpu.updateHalfCarryFlag(cpu.registers.a, cpu.registers.e);
  cpu.updateCarryFlagAdd(cpu.registers.a, cpu.registers.e);
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  return 4;
});

def(0x86, 'ADD A, (HL)', 8, (cpu) => {
  const value = cpu.mmu.read(cpu.registers.getHL());
  cpu.updateHalfCarryFlag(cpu.registers.a, value);
  cpu.updateCarryFlagAdd(cpu.registers.a, value);
  cpu.registers.a = to8Bit(cpu.registers.a + value);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  return 8;
});

def(0x87, 'ADD A, A', 4, (cpu) => {
  const result = cpu.registers.a + cpu.registers.a;
  cpu.updateHalfCarryFlag(cpu.registers.a, cpu.registers.a);
  cpu.updateCarryFlagAdd(cpu.registers.a, cpu.registers.a);
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  return 4;
});

// SUB A, r
def(0x90, 'SUB B', 4, (cpu) => {
  cpu.updateHalfCarryFlag(cpu.registers.a, cpu.registers.b, true);
  cpu.updateCarryFlagSubtract(cpu.registers.a, cpu.registers.b);
  cpu.registers.a = to8Bit(cpu.registers.a - cpu.registers.b);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  return 4;
});

def(0x97, 'SUB A', 4, (cpu) => {
  cpu.registers.a = 0;
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// AND A, r
def(0xA0, 'AND B', 4, (cpu) => {
  cpu.registers.a = to8Bit(cpu.registers.a & cpu.registers.b);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(true);
  cpu.registers.setCarryFlag(false);
  return 4;
});

def(0xA7, 'AND A', 4, (cpu) => {
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(true);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// OR A, r
def(0xB0, 'OR B', 4, (cpu) => {
  cpu.registers.a = to8Bit(cpu.registers.a | cpu.registers.b);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

def(0xB1, 'OR C', 4, (cpu) => {
  cpu.registers.a = to8Bit(cpu.registers.a | cpu.registers.c);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

def(0xB7, 'OR A', 4, (cpu) => {
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// CP A, r
def(0xB8, 'CP B', 4, (cpu) => {
  const result = cpu.registers.a - cpu.registers.b;
  cpu.updateZeroFlag(result);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(cpu.registers.a, cpu.registers.b, true);
  cpu.updateCarryFlagSubtract(cpu.registers.a, cpu.registers.b);
  return 4;
});

def(0xBE, 'CP (HL)', 8, (cpu) => {
  const value = cpu.mmu.read(cpu.registers.getHL());
  const result = cpu.registers.a - value;
  cpu.updateZeroFlag(result);
  cpu.updateSubtractFlag(true);
  cpu.updateHalfCarryFlag(cpu.registers.a, value, true);
  cpu.updateCarryFlagSubtract(cpu.registers.a, value);
  return 8;
});

def(0xBF, 'CP A', 4, (cpu) => {
  cpu.registers.setZeroFlag(true);
  cpu.updateSubtractFlag(true);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 4;
});

// Conditional returns (0xC0, 0xC8, 0xD0, 0xD8)
def(0xC0, 'RET NZ', 8, (cpu) => {
  if (!cpu.registers.getZeroFlag()) {
    cpu.registers.pc = cpu.popStack();
    return 20;
  }
  return 8;
});

def(0xC8, 'RET Z', 8, (cpu) => {
  if (cpu.registers.getZeroFlag()) {
    cpu.registers.pc = cpu.popStack();
    return 20;
  }
  return 8;
});

def(0xD0, 'RET NC', 8, (cpu) => {
  if (!cpu.registers.getCarryFlag()) {
    cpu.registers.pc = cpu.popStack();
    return 20;
  }
  return 8;
});

def(0xD8, 'RET C', 8, (cpu) => {
  if (cpu.registers.getCarryFlag()) {
    cpu.registers.pc = cpu.popStack();
    return 20;
  }
  return 8;
});

// PUSH/POP
def(0xC1, 'POP BC', 12, (cpu) => {
  cpu.registers.setBC(cpu.popStack());
  return 12;
});

def(0xD1, 'POP DE', 12, (cpu) => {
  cpu.registers.setDE(cpu.popStack());
  return 12;
});

def(0xE1, 'POP HL', 12, (cpu) => {
  cpu.registers.setHL(cpu.popStack());
  return 12;
});

def(0xF1, 'POP AF', 12, (cpu) => {
  cpu.registers.setAF(cpu.popStack());
  return 12;
});

def(0xD5, 'PUSH DE', 16, (cpu) => {
  cpu.pushStack(cpu.registers.getDE());
  return 16;
});

def(0xE5, 'PUSH HL', 16, (cpu) => {
  cpu.pushStack(cpu.registers.getHL());
  return 16;
});

def(0xF5, 'PUSH AF', 16, (cpu) => {
  cpu.pushStack(cpu.registers.getAF());
  return 16;
});

// Conditional jumps (0xC2, 0xCA, 0xD2, 0xDA)
def(0xC2, 'JP NZ, nn', 12, (cpu) => {
  const address = cpu.read16PC();
  if (!cpu.registers.getZeroFlag()) {
    cpu.registers.pc = address;
    return 16;
  }
  return 12;
});

def(0xCA, 'JP Z, nn', 12, (cpu) => {
  const address = cpu.read16PC();
  if (cpu.registers.getZeroFlag()) {
    cpu.registers.pc = address;
    return 16;
  }
  return 12;
});

def(0xD2, 'JP NC, nn', 12, (cpu) => {
  const address = cpu.read16PC();
  if (!cpu.registers.getCarryFlag()) {
    cpu.registers.pc = address;
    return 16;
  }
  return 12;
});

def(0xDA, 'JP C, nn', 12, (cpu) => {
  const address = cpu.read16PC();
  if (cpu.registers.getCarryFlag()) {
    cpu.registers.pc = address;
    return 16;
  }
  return 12;
});

// Conditional calls (0xC4, 0xCC, 0xD4, 0xDC)
def(0xC4, 'CALL NZ, nn', 12, (cpu) => {
  const address = cpu.read16PC();
  if (!cpu.registers.getZeroFlag()) {
    cpu.pushStack(cpu.registers.pc);
    cpu.registers.pc = address;
    return 24;
  }
  return 12;
});

def(0xCC, 'CALL Z, nn', 12, (cpu) => {
  const address = cpu.read16PC();
  if (cpu.registers.getZeroFlag()) {
    cpu.pushStack(cpu.registers.pc);
    cpu.registers.pc = address;
    return 24;
  }
  return 12;
});

def(0xC6, 'ADD A, n', 8, (cpu) => {
  const value = cpu.readPC();
  cpu.updateHalfCarryFlag(cpu.registers.a, value);
  cpu.updateCarryFlagAdd(cpu.registers.a, value);
  cpu.registers.a = to8Bit(cpu.registers.a + value);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  return 8;
});

def(0xCE, 'ADC A, n', 8, (cpu) => {
  const value = cpu.readPC();
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const result = cpu.registers.a + value + carry;
  cpu.updateHalfCarryFlag(cpu.registers.a, value + carry);
  cpu.registers.setCarryFlag(result > 0xFF);
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  return 8;
});

def(0xD6, 'SUB n', 8, (cpu) => {
  const value = cpu.readPC();
  cpu.updateHalfCarryFlag(cpu.registers.a, value, true);
  cpu.updateCarryFlagSubtract(cpu.registers.a, value);
  cpu.registers.a = to8Bit(cpu.registers.a - value);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(true);
  return 8;
});

def(0xE6, 'AND n', 8, (cpu) => {
  const value = cpu.readPC();
  cpu.registers.a = to8Bit(cpu.registers.a & value);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(true);
  cpu.registers.setCarryFlag(false);
  return 8;
});

def(0xEE, 'XOR n', 8, (cpu) => {
  const value = cpu.readPC();
  cpu.registers.a = to8Bit(cpu.registers.a ^ value);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 8;
});

def(0xF6, 'OR n', 8, (cpu) => {
  const value = cpu.readPC();
  cpu.registers.a = to8Bit(cpu.registers.a | value);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);
  return 8;
});

def(0xE9, 'JP (HL)', 4, (cpu) => {
  cpu.registers.pc = cpu.registers.getHL();
  return 4;
});

def(0xF9, 'LD SP, HL', 8, (cpu) => {
  cpu.registers.sp = cpu.registers.getHL();
  return 8;
});

def(0xC7, 'RST 00H', 16, (cpu) => {
  cpu.pushStack(cpu.registers.pc);
  cpu.registers.pc = 0x00;
  return 16;
});

def(0xCF, 'RST 08H', 16, (cpu) => {
  cpu.pushStack(cpu.registers.pc);
  cpu.registers.pc = 0x08;
  return 16;
});

def(0xD7, 'RST 10H', 16, (cpu) => {
  cpu.pushStack(cpu.registers.pc);
  cpu.registers.pc = 0x10;
  return 16;
});

def(0xDF, 'RST 18H', 16, (cpu) => {
  cpu.pushStack(cpu.registers.pc);
  cpu.registers.pc = 0x18;
  return 16;
});

def(0xE7, 'RST 20H', 16, (cpu) => {
  cpu.pushStack(cpu.registers.pc);
  cpu.registers.pc = 0x20;
  return 16;
});

def(0xEF, 'RST 28H', 16, (cpu) => {
  cpu.pushStack(cpu.registers.pc);
  cpu.registers.pc = 0x28;
  return 16;
});

def(0xF7, 'RST 30H', 16, (cpu) => {
  cpu.pushStack(cpu.registers.pc);
  cpu.registers.pc = 0x30;
  return 16;
});

def(0xFF, 'RST 38H', 16, (cpu) => {
  cpu.pushStack(cpu.registers.pc);
  cpu.registers.pc = 0x38;
  return 16;
});

// ============================================================================
// Illegal/Undefined opcodes - These should never be executed in valid ROMs
// ============================================================================

def(0xD3, 'ILLEGAL_D3', 0, () => {
  throw new Error('Illegal opcode 0xD3 executed');
});

def(0xDB, 'ILLEGAL_DB', 0, () => {
  throw new Error('Illegal opcode 0xDB executed');
});

def(0xDD, 'ILLEGAL_DD', 0, () => {
  throw new Error('Illegal opcode 0xDD executed');
});

def(0xE3, 'ILLEGAL_E3', 0, () => {
  throw new Error('Illegal opcode 0xE3 executed');
});

def(0xE4, 'ILLEGAL_E4', 0, () => {
  throw new Error('Illegal opcode 0xE4 executed');
});

def(0xEB, 'ILLEGAL_EB', 0, () => {
  throw new Error('Illegal opcode 0xEB executed');
});

def(0xEC, 'ILLEGAL_EC', 0, () => {
  throw new Error('Illegal opcode 0xEC executed');
});

def(0xED, 'ILLEGAL_ED', 0, () => {
  throw new Error('Illegal opcode 0xED executed');
});

def(0xF4, 'ILLEGAL_F4', 0, () => {
  throw new Error('Illegal opcode 0xF4 executed');
});

def(0xFC, 'ILLEGAL_FC', 0, () => {
  throw new Error('Illegal opcode 0xFC executed');
});

def(0xFD, 'ILLEGAL_FD', 0, () => {
  throw new Error('Illegal opcode 0xFD executed');
});
