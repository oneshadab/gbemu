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
