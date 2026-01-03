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

// More CB instructions will be added in Phase 8
