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

// 0x1A: LD A, (DE)
def(0x1A, 'LD A, (DE)', 8, (cpu) => {
  cpu.registers.a = cpu.mmu.read(cpu.registers.getDE());
  return 8;
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

// 0x28: JR Z, n
def(0x28, 'JR Z, n', 8, (cpu) => {
  const offset = toSigned8(cpu.readPC());
  if (cpu.registers.getZeroFlag()) {
    cpu.registers.pc = to16Bit(cpu.registers.pc + offset);
    return 12;
  }
  return 8;
});

// 0x2E: LD L, n
def(0x2E, 'LD L, n', 8, (cpu) => {
  cpu.registers.l = cpu.readPC();
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

// 0xAF: XOR A (common way to zero A)
def(0xAF, 'XOR A', 4, (cpu) => {
  cpu.registers.a = 0;
  cpu.registers.setZeroFlag(true);
  cpu.registers.setSubtractFlag(false);
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

// 0xCD: CALL nn
def(0xCD, 'CALL nn', 24, (cpu) => {
  const address = cpu.read16PC();
  cpu.pushStack(cpu.registers.pc);
  cpu.registers.pc = address;
  return 24;
});

// 0xD9: RETI (Return from interrupt)
def(0xD9, 'RETI', 16, (cpu) => {
  cpu.registers.pc = cpu.popStack();
  cpu.ime = true; // Re-enable interrupts
  return 16;
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

// 0xF3: DI (Disable interrupts)
def(0xF3, 'DI', 4, (cpu) => {
  cpu.ime = false;
  return 4;
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
