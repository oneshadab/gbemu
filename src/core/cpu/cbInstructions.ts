import { CPU } from './CPU';
import { Instruction } from './types';
import { to8Bit } from '@/utils/bits';

/**
 * CB-prefixed instructions (bit operations)
 * Complete implementation of all 256 CB opcodes
 */

export const cbInstructions: (Instruction | null)[] = new Array(256).fill(null);

// Helper
const defCB = (opcode: number, mnemonic: string, cycles: number, handler: (cpu: CPU) => number) => {
  cbInstructions[opcode] = { mnemonic, cycles, handler };
};

// Helper functions for getting/setting register values
const getRegister = (cpu: CPU, reg: number): number => {
  switch (reg) {
    case 0: return cpu.registers.b;
    case 1: return cpu.registers.c;
    case 2: return cpu.registers.d;
    case 3: return cpu.registers.e;
    case 4: return cpu.registers.h;
    case 5: return cpu.registers.l;
    case 6: return cpu.mmu.read(cpu.registers.getHL());
    case 7: return cpu.registers.a;
    default: return 0;
  }
};

const setRegister = (cpu: CPU, reg: number, value: number): void => {
  value = to8Bit(value);
  switch (reg) {
    case 0: cpu.registers.b = value; break;
    case 1: cpu.registers.c = value; break;
    case 2: cpu.registers.d = value; break;
    case 3: cpu.registers.e = value; break;
    case 4: cpu.registers.h = value; break;
    case 5: cpu.registers.l = value; break;
    case 6: cpu.mmu.write(cpu.registers.getHL(), value); break;
    case 7: cpu.registers.a = value; break;
  }
};

const getRegName = (reg: number): string => {
  return ['B', 'C', 'D', 'E', 'H', 'L', '(HL)', 'A'][reg];
};

// ============================================================================
// RLC - Rotate Left Circular (0x00-0x07)
// ============================================================================
for (let r = 0; r < 8; r++) {
  defCB(0x00 + r, `RLC ${getRegName(r)}`, r === 6 ? 16 : 8, (cpu) => {
    let value = getRegister(cpu, r);
    const carry = (value & 0x80) !== 0;
    value = to8Bit((value << 1) | (carry ? 1 : 0));
    setRegister(cpu, r, value);
    cpu.updateZeroFlag(value);
    cpu.registers.setSubtractFlag(false);
    cpu.registers.setHalfCarryFlag(false);
    cpu.registers.setCarryFlag(carry);
    return r === 6 ? 16 : 8;
  });
}

// ============================================================================
// RRC - Rotate Right Circular (0x08-0x0F)
// ============================================================================
for (let r = 0; r < 8; r++) {
  defCB(0x08 + r, `RRC ${getRegName(r)}`, r === 6 ? 16 : 8, (cpu) => {
    let value = getRegister(cpu, r);
    const carry = (value & 0x01) !== 0;
    value = to8Bit((value >> 1) | (carry ? 0x80 : 0));
    setRegister(cpu, r, value);
    cpu.updateZeroFlag(value);
    cpu.registers.setSubtractFlag(false);
    cpu.registers.setHalfCarryFlag(false);
    cpu.registers.setCarryFlag(carry);
    return r === 6 ? 16 : 8;
  });
}

// ============================================================================
// RL - Rotate Left through Carry (0x10-0x17)
// ============================================================================
for (let r = 0; r < 8; r++) {
  defCB(0x10 + r, `RL ${getRegName(r)}`, r === 6 ? 16 : 8, (cpu) => {
    let value = getRegister(cpu, r);
    const oldCarry = cpu.registers.getCarryFlag() ? 1 : 0;
    const newCarry = (value & 0x80) !== 0;
    value = to8Bit((value << 1) | oldCarry);
    setRegister(cpu, r, value);
    cpu.updateZeroFlag(value);
    cpu.registers.setSubtractFlag(false);
    cpu.registers.setHalfCarryFlag(false);
    cpu.registers.setCarryFlag(newCarry);
    return r === 6 ? 16 : 8;
  });
}

// ============================================================================
// RR - Rotate Right through Carry (0x18-0x1F)
// ============================================================================
for (let r = 0; r < 8; r++) {
  defCB(0x18 + r, `RR ${getRegName(r)}`, r === 6 ? 16 : 8, (cpu) => {
    let value = getRegister(cpu, r);
    const oldCarry = cpu.registers.getCarryFlag() ? 0x80 : 0;
    const newCarry = (value & 0x01) !== 0;
    value = to8Bit((value >> 1) | oldCarry);
    setRegister(cpu, r, value);
    cpu.updateZeroFlag(value);
    cpu.registers.setSubtractFlag(false);
    cpu.registers.setHalfCarryFlag(false);
    cpu.registers.setCarryFlag(newCarry);
    return r === 6 ? 16 : 8;
  });
}

// ============================================================================
// SLA - Shift Left Arithmetic (0x20-0x27)
// ============================================================================
for (let r = 0; r < 8; r++) {
  defCB(0x20 + r, `SLA ${getRegName(r)}`, r === 6 ? 16 : 8, (cpu) => {
    let value = getRegister(cpu, r);
    const carry = (value & 0x80) !== 0;
    value = to8Bit(value << 1);
    setRegister(cpu, r, value);
    cpu.updateZeroFlag(value);
    cpu.registers.setSubtractFlag(false);
    cpu.registers.setHalfCarryFlag(false);
    cpu.registers.setCarryFlag(carry);
    return r === 6 ? 16 : 8;
  });
}

// ============================================================================
// SRA - Shift Right Arithmetic (0x28-0x2F)
// ============================================================================
for (let r = 0; r < 8; r++) {
  defCB(0x28 + r, `SRA ${getRegName(r)}`, r === 6 ? 16 : 8, (cpu) => {
    let value = getRegister(cpu, r);
    const carry = (value & 0x01) !== 0;
    const msb = value & 0x80;
    value = to8Bit((value >> 1) | msb);
    setRegister(cpu, r, value);
    cpu.updateZeroFlag(value);
    cpu.registers.setSubtractFlag(false);
    cpu.registers.setHalfCarryFlag(false);
    cpu.registers.setCarryFlag(carry);
    return r === 6 ? 16 : 8;
  });
}

// ============================================================================
// SWAP - Swap nibbles (0x30-0x37)
// ============================================================================
for (let r = 0; r < 8; r++) {
  defCB(0x30 + r, `SWAP ${getRegName(r)}`, r === 6 ? 16 : 8, (cpu) => {
    let value = getRegister(cpu, r);
    value = to8Bit(((value & 0x0F) << 4) | ((value & 0xF0) >> 4));
    setRegister(cpu, r, value);
    cpu.updateZeroFlag(value);
    cpu.registers.setSubtractFlag(false);
    cpu.registers.setHalfCarryFlag(false);
    cpu.registers.setCarryFlag(false);
    return r === 6 ? 16 : 8;
  });
}

// ============================================================================
// SRL - Shift Right Logical (0x38-0x3F)
// ============================================================================
for (let r = 0; r < 8; r++) {
  defCB(0x38 + r, `SRL ${getRegName(r)}`, r === 6 ? 16 : 8, (cpu) => {
    let value = getRegister(cpu, r);
    const carry = (value & 0x01) !== 0;
    value = to8Bit(value >> 1);
    setRegister(cpu, r, value);
    cpu.updateZeroFlag(value);
    cpu.registers.setSubtractFlag(false);
    cpu.registers.setHalfCarryFlag(false);
    cpu.registers.setCarryFlag(carry);
    return r === 6 ? 16 : 8;
  });
}

// ============================================================================
// BIT - Test bit (0x40-0x7F)
// ============================================================================
for (let bit = 0; bit < 8; bit++) {
  for (let r = 0; r < 8; r++) {
    defCB(0x40 + (bit * 8) + r, `BIT ${bit}, ${getRegName(r)}`, r === 6 ? 12 : 8, (cpu) => {
      const value = getRegister(cpu, r);
      const testBit = (value >> bit) & 1;
      cpu.registers.setZeroFlag(testBit === 0);
      cpu.registers.setSubtractFlag(false);
      cpu.registers.setHalfCarryFlag(true);
      return r === 6 ? 12 : 8;
    });
  }
}

// ============================================================================
// RES - Reset bit (0x80-0xBF)
// ============================================================================
for (let bit = 0; bit < 8; bit++) {
  for (let r = 0; r < 8; r++) {
    defCB(0x80 + (bit * 8) + r, `RES ${bit}, ${getRegName(r)}`, r === 6 ? 16 : 8, (cpu) => {
      let value = getRegister(cpu, r);
      value = to8Bit(value & ~(1 << bit));
      setRegister(cpu, r, value);
      return r === 6 ? 16 : 8;
    });
  }
}

// ============================================================================
// SET - Set bit (0xC0-0xFF)
// ============================================================================
for (let bit = 0; bit < 8; bit++) {
  for (let r = 0; r < 8; r++) {
    defCB(0xC0 + (bit * 8) + r, `SET ${bit}, ${getRegName(r)}`, r === 6 ? 16 : 8, (cpu) => {
      let value = getRegister(cpu, r);
      value = to8Bit(value | (1 << bit));
      setRegister(cpu, r, value);
      return r === 6 ? 16 : 8;
    });
  }
}
