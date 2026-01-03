import { MMU } from '../memory/MMU';
import { logger } from '@/utils/logger';

/**
 * Timer and Divider Register
 *
 * Registers:
 * 0xFF04 - DIV: Divider register (increments at 16384 Hz)
 * 0xFF05 - TIMA: Timer counter (increments at frequency set by TAC)
 * 0xFF06 - TMA: Timer modulo (TIMA is reset to this value on overflow)
 * 0xFF07 - TAC: Timer control
 */
export class Timer {
  private mmu: MMU;

  // Internal counters
  private divCounter: number = 0;
  private timaCounter: number = 0;

  // Timer frequencies in CPU cycles
  private readonly FREQ_4096 = 1024;   // CPU cycles per TIMA increment
  private readonly FREQ_262144 = 16;   // CPU cycles per TIMA increment
  private readonly FREQ_65536 = 64;    // CPU cycles per TIMA increment
  private readonly FREQ_16384 = 256;   // CPU cycles per TIMA increment

  constructor(mmu: MMU) {
    this.mmu = mmu;
  }

  /**
   * Reset timer state
   */
  reset(): void {
    this.divCounter = 0;
    this.timaCounter = 0;

    this.mmu.setIO(0x04, 0); // DIV
    this.mmu.setIO(0x05, 0); // TIMA
    this.mmu.setIO(0x06, 0); // TMA
    this.mmu.setIO(0x07, 0); // TAC
  }

  /**
   * Step timer by given number of CPU cycles
   */
  step(cycles: number): void {
    this.updateDivider(cycles);
    this.updateTimer(cycles);
  }

  /**
   * Update DIV register (increments at 16384 Hz = every 256 CPU cycles)
   */
  private updateDivider(cycles: number): void {
    this.divCounter += cycles;

    // DIV increments every 256 CPU cycles (16384 Hz)
    while (this.divCounter >= 256) {
      this.divCounter -= 256;
      const div = this.mmu.getIO(0x04);
      this.mmu.setIO(0x04, (div + 1) & 0xFF);
    }
  }

  /**
   * Update TIMA register based on TAC settings
   */
  private updateTimer(cycles: number): void {
    const tac = this.mmu.getIO(0x07);

    // Check if timer is enabled (bit 2 of TAC)
    const timerEnabled = (tac & 0x04) !== 0;
    if (!timerEnabled) {
      return;
    }

    // Get frequency from bits 0-1 of TAC
    const frequency = this.getTimerFrequency(tac & 0x03);

    this.timaCounter += cycles;

    while (this.timaCounter >= frequency) {
      this.timaCounter -= frequency;

      // Increment TIMA
      let tima = this.mmu.getIO(0x05);
      tima = (tima + 1) & 0xFF;

      // Check for overflow
      if (tima === 0) {
        // Reset to TMA value
        const tma = this.mmu.getIO(0x06);
        this.mmu.setIO(0x05, tma);

        // Request timer interrupt
        this.requestTimerInterrupt();
      } else {
        this.mmu.setIO(0x05, tima);
      }
    }
  }

  /**
   * Get timer frequency based on TAC bits 0-1
   */
  private getTimerFrequency(bits: number): number {
    switch (bits) {
      case 0: return this.FREQ_4096;   // 4096 Hz
      case 1: return this.FREQ_262144; // 262144 Hz
      case 2: return this.FREQ_65536;  // 65536 Hz
      case 3: return this.FREQ_16384;  // 16384 Hz
      default: return this.FREQ_4096;
    }
  }

  /**
   * Request timer interrupt
   */
  private requestTimerInterrupt(): void {
    const interruptFlag = this.mmu.getInterruptFlag();
    this.mmu.setInterruptFlag(interruptFlag | (1 << 2)); // Bit 2 = Timer interrupt
    logger.debug('Timer interrupt requested');
  }
}
