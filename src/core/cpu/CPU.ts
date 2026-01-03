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
