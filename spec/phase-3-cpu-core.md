# Phase 3: CPU Core

## Overview
Implement the Sharp LR35902 CPU (similar to Z80) with registers, flags, and instruction execution. This is the heart of the emulator that drives all other components.

## Goals
- Implement CPU registers and flags
- Create instruction set with lookup table
- Implement ~30 most common opcodes initially
- Build fetch-decode-execute loop
- Handle basic control flow (JP, CALL, RET)

---

## Step 1: CPU Registers

**File**: `src/core/cpu/registers.ts`

```typescript
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
```

---

## Step 2: CPU Instruction Type

**File**: `src/core/cpu/types.ts`

```typescript
import { CPU } from './CPU';

/**
 * Instruction handler function type
 * Takes CPU instance and returns number of cycles consumed
 */
export type InstructionHandler = (cpu: CPU) => number;

/**
 * Instruction metadata
 */
export interface Instruction {
  mnemonic: string;      // Human-readable name (e.g., "LD A, B")
  handler: InstructionHandler;
  cycles: number;        // Base cycle count
}
```

---

## Step 3: CPU Core Implementation

**File**: `src/core/cpu/CPU.ts`

```typescript
import { MMU } from '../memory/MMU';
import { Registers } from './registers';
import { instructions } from './instructions';
import { cbInstructions } from './cbInstructions';
import { logger } from '@/utils/logger';
import { to8Bit, to16Bit, toSigned8 } from '@/utils/bits';

export class CPU {
  registers: Registers;
  mmu: MMU;

  // CPU state
  halted: boolean = false;
  stopped: boolean = false;
  ime: boolean = false; // Interrupt Master Enable

  // Interrupt enable delay (EI instruction enables interrupts after next instruction)
  private imeScheduled: boolean = false;

  constructor(mmu: MMU) {
    this.registers = new Registers();
    this.mmu = mmu;
  }

  /**
   * Reset CPU to initial state
   */
  reset(): void {
    this.registers.reset();
    this.halted = false;
    this.stopped = false;
    this.ime = false;
    this.imeScheduled = false;
  }

  /**
   * Execute one instruction and return cycles consumed
   */
  step(): number {
    // Check for scheduled IME
    if (this.imeScheduled) {
      this.ime = true;
      this.imeScheduled = false;
    }

    // Handle interrupts
    const interruptCycles = this.handleInterrupts();
    if (interruptCycles > 0) {
      this.halted = false;
      return interruptCycles;
    }

    // If halted, consume 4 cycles without executing
    if (this.halted) {
      return 4;
    }

    // Fetch opcode
    const opcode = this.readPC();

    // Handle CB-prefixed instructions
    if (opcode === 0xCB) {
      const cbOpcode = this.readPC();
      const instruction = cbInstructions[cbOpcode];

      if (!instruction) {
        logger.error(`Unimplemented CB opcode: 0xCB ${cbOpcode.toString(16).padStart(2, '0')}`);
        return 4;
      }

      return instruction.handler(this);
    }

    // Execute normal instruction
    const instruction = instructions[opcode];

    if (!instruction) {
      logger.error(`Unimplemented opcode: 0x${opcode.toString(16).padStart(2, '0')} at PC: 0x${(this.registers.pc - 1).toString(16)}`);
      return 4;
    }

    return instruction.handler(this);
  }

  /**
   * Handle interrupts if any are pending
   */
  private handleInterrupts(): number {
    if (!this.ime) {
      return 0;
    }

    const interruptEnable = this.mmu.getInterruptEnable();
    const interruptFlag = this.mmu.getInterruptFlag();
    const triggered = interruptEnable & interruptFlag;

    if (triggered === 0) {
      return 0;
    }

    // Check each interrupt in priority order
    const interrupts = [
      { bit: 0, address: 0x40 }, // VBlank
      { bit: 1, address: 0x48 }, // LCD STAT
      { bit: 2, address: 0x50 }, // Timer
      { bit: 3, address: 0x58 }, // Serial
      { bit: 4, address: 0x60 }, // Joypad
    ];

    for (const interrupt of interrupts) {
      if ((triggered & (1 << interrupt.bit)) !== 0) {
        // Disable IME
        this.ime = false;

        // Clear interrupt flag
        this.mmu.setInterruptFlag(interruptFlag & ~(1 << interrupt.bit));

        // Push PC onto stack
        this.pushStack(this.registers.pc);

        // Jump to interrupt handler
        this.registers.pc = interrupt.address;

        logger.debug(`Interrupt serviced: bit ${interrupt.bit} -> 0x${interrupt.address.toString(16)}`);

        // Interrupt handling takes 20 cycles
        return 20;
      }
    }

    return 0;
  }

  /**
   * Request an interrupt
   */
  requestInterrupt(bit: number): void {
    const interruptFlag = this.mmu.getInterruptFlag();
    this.mmu.setInterruptFlag(interruptFlag | (1 << bit));
  }

  // Memory access helpers

  readPC(): number {
    const value = this.mmu.read(this.registers.pc);
    this.registers.pc = to16Bit(this.registers.pc + 1);
    return value;
  }

  read16PC(): number {
    const low = this.readPC();
    const high = this.readPC();
    return (high << 8) | low;
  }

  // Stack operations

  pushStack(value: number): void {
    this.registers.sp = to16Bit(this.registers.sp - 1);
    this.mmu.write(this.registers.sp, (value >> 8) & 0xFF);
    this.registers.sp = to16Bit(this.registers.sp - 1);
    this.mmu.write(this.registers.sp, value & 0xFF);
  }

  popStack(): number {
    const low = this.mmu.read(this.registers.sp);
    this.registers.sp = to16Bit(this.registers.sp + 1);
    const high = this.mmu.read(this.registers.sp);
    this.registers.sp = to16Bit(this.registers.sp + 1);
    return (high << 8) | low;
  }

  // Flag helper functions

  updateZeroFlag(value: number): void {
    this.registers.setZeroFlag((value & 0xFF) === 0);
  }

  updateSubtractFlag(value: boolean): void {
    this.registers.setSubtractFlag(value);
  }

  updateHalfCarryFlag(a: number, b: number, isSubtract: boolean = false): void {
    if (isSubtract) {
      this.registers.setHalfCarryFlag((a & 0x0F) < (b & 0x0F));
    } else {
      this.registers.setHalfCarryFlag((a & 0x0F) + (b & 0x0F) > 0x0F);
    }
  }

  updateCarryFlag(value: number): void {
    this.registers.setCarryFlag(value > 0xFF);
  }

  updateCarryFlagSubtract(a: number, b: number): void {
    this.registers.setCarryFlag(a < b);
  }
}
```

---

## Step 4: Start of Instruction Set

**File**: `src/core/cpu/instructions.ts`

```typescript
import { CPU } from './CPU';
import { Instruction } from './types';
import { to8Bit, to16Bit, toSigned8 } from '@/utils/bits';
import { Registers } from './registers';

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
def(0x00, 'NOP', 4, (cpu) => {
  return 4;
});

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

// Helper function for LD r, r' instructions
const ldRegReg = (getDest: (cpu: CPU) => number, setDest: (cpu: CPU, val: number) => void, getSrc: (cpu: CPU) => number) => {
  return (cpu: CPU) => {
    setDest(cpu, getSrc(cpu));
    return 4;
  };
};

// LD B, B through LD B, A (0x40-0x47)
def(0x40, 'LD B, B', 4, ldRegReg(c => c.registers.b, (c, v) => c.registers.b = v, c => c.registers.b));
def(0x41, 'LD B, C', 4, ldRegReg(c => c.registers.b, (c, v) => c.registers.b = v, c => c.registers.c));
def(0x42, 'LD B, D', 4, ldRegReg(c => c.registers.b, (c, v) => c.registers.b = v, c => c.registers.d));
def(0x43, 'LD B, E', 4, ldRegReg(c => c.registers.b, (c, v) => c.registers.b = v, c => c.registers.e));
def(0x44, 'LD B, H', 4, ldRegReg(c => c.registers.b, (c, v) => c.registers.b = v, c => c.registers.h));
def(0x45, 'LD B, L', 4, ldRegReg(c => c.registers.b, (c, v) => c.registers.b = v, c => c.registers.l));
def(0x47, 'LD B, A', 4, ldRegReg(c => c.registers.b, (c, v) => c.registers.b = v, c => c.registers.a));

// 0x46: LD B, (HL)
def(0x46, 'LD B, (HL)', 8, (cpu) => {
  cpu.registers.b = cpu.mmu.read(cpu.registers.getHL());
  return 8;
});

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
```

---

## Step 5: CB-Prefixed Instructions (Stub)

**File**: `src/core/cpu/cbInstructions.ts`

```typescript
import { CPU } from './CPU';
import { Instruction } from './types';
import { to8Bit } from '@/utils/bits';

/**
 * CB-prefixed instructions (bit operations)
 * Will be fully implemented later, adding stubs for now
 */

export const cbInstructions: (Instruction | null)[] = new Array(256).fill(null);

// Helper
const defCB = (opcode: number, mnemonic: string, cycles: number, handler: (cpu: CPU) => number) => {
  cbInstructions[opcode] = { mnemonic, cycles, handler };
};

// Example: 0xCB 0x7C: BIT 7, H
defCB(0x7C, 'BIT 7, H', 8, (cpu) => {
  const bit = (cpu.registers.h >> 7) & 1;
  cpu.registers.setZeroFlag(bit === 0);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(true);
  return 8;
});

// 0xCB 0x11: RL C
defCB(0x11, 'RL C', 8, (cpu) => {
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const newCarry = (cpu.registers.c & 0x80) !== 0;
  cpu.registers.c = to8Bit((cpu.registers.c << 1) | carry);
  cpu.updateZeroFlag(cpu.registers.c);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(newCarry);
  return 8;
});

// More CB instructions will be added as needed
```

---

## Verification Steps

### 1. Create Test Program

Add to `src/main.ts`:

```typescript
// After loading cartridge
import { CPU } from '@/core/cpu/CPU';

const cpu = new CPU(mmu);
logger.info('CPU initialized');
logger.info(cpu.registers.toString());

// Execute a few instructions
for (let i = 0; i < 10; i++) {
  const cycles = cpu.step();
  logger.debug(`Executed instruction, cycles: ${cycles}`);
  logger.debug(cpu.registers.toString());
}
```

### 2. Expected Output
```
[INFO] CPU initialized
[INFO] A:01 F:b0 B:00 C:13 D:00 E:d8 H:01 L:4d SP:fffe PC:0100 [ZN-C]
[DEBUG] Executed instruction, cycles: 4
[DEBUG] A:01 F:b0 B:00 C:13 D:00 E:d8 H:01 L:4d SP:fffe PC:0101 [ZN-C]
```

---

## Success Criteria

✅ CPU registers implemented
✅ Basic instruction execution working
✅ PC increments correctly
✅ Stack operations (PUSH/POP) work
✅ Flags update properly
✅ At least 30 opcodes implemented

---

## Next Phase

Proceed to **Phase 4: Basic PPU** to implement graphics rendering.

---

## Notes

- This implements ~40 of the most common opcodes
- More instructions will be added incrementally as needed
- CB-prefixed instructions are mostly stubs (will be filled in Phase 8)
- Focus on getting basic programs running first
