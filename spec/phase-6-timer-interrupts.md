# Phase 6: Timer & Interrupts

## Overview
Implement the Timer system with DIV, TIMA, TMA, and TAC registers. Complete interrupt handling in the CPU.

## Goals
- Implement Timer class with all registers
- Handle timer interrupts
- Update DIV register at correct frequency
- Make TIMA configurable via TAC
- Integrate timer into main emulation loop

---

## Step 1: Timer Implementation

**File**: `src/core/timer/Timer.ts`

```typescript
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
```

---

## Step 2: Update GameBoy to Include Timer

**File**: `src/emulator/GameBoy.ts` (update)

Add timer to the GameBoy class:

```typescript
import { Timer } from '@/core/timer/Timer';

export class GameBoy {
  // Components
  mmu: MMU;
  cpu: CPU;
  ppu: PPU;
  timer: Timer; // Add this

  constructor() {
    this.mmu = new MMU();
    this.cpu = new CPU(this.mmu);
    this.ppu = new PPU(this.mmu);
    this.timer = new Timer(this.mmu); // Add this

    logger.info('GameBoy emulator initialized');
  }

  reset(): void {
    this.cpu.reset();
    this.ppu.reset();
    this.timer.reset(); // Add this
    this.frameCount = 0;
    this.fps = 0;

    logger.info('Emulator reset');
  }

  frame(): void {
    if (!this.loaded) {
      return;
    }

    const frameCycles = 70224;
    let cyclesThisFrame = 0;

    while (cyclesThisFrame < frameCycles) {
      const cpuCycles = this.cpu.step();

      this.ppu.step(cpuCycles);
      this.timer.step(cpuCycles); // Add this

      cyclesThisFrame += cpuCycles;
    }

    // Update FPS counter
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }

  step(): number {
    if (!this.loaded) {
      return 0;
    }

    const cycles = this.cpu.step();
    this.ppu.step(cycles);
    this.timer.step(cycles); // Add this

    return cycles;
  }
}
```

---

## Step 3: Complete CPU Interrupt Handling

The interrupt handling is already implemented in CPU.ts from Phase 3, but let's verify it's complete:

**File**: `src/core/cpu/CPU.ts` (verify these methods exist)

```typescript
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
```

---

## Step 4: Add Missing CPU Instructions for Interrupts

**File**: `src/core/cpu/instructions.ts` (add if missing)

Ensure these interrupt-related instructions are implemented:

```typescript
// 0xD9: RETI (Return from interrupt)
def(0xD9, 'RETI', 16, (cpu) => {
  cpu.registers.pc = cpu.popStack();
  cpu.ime = true; // Re-enable interrupts
  return 16;
});

// 0xF3: DI (Disable interrupts) - already implemented
// 0xFB: EI (Enable interrupts) - already implemented
```

---

## Step 5: Test Timer Functionality

Add test code to verify timer works (temporary, for testing):

**File**: `src/main.ts` (add after gameboy initialization, remove after testing)

```typescript
// Test timer
setTimeout(() => {
  const div = gameboy.mmu.getIO(0x04);
  const tima = gameboy.mmu.getIO(0x05);
  const tac = gameboy.mmu.getIO(0x07);

  logger.info(`Timer test - DIV: 0x${div.toString(16)}, TIMA: 0x${tima.toString(16)}, TAC: 0x${tac.toString(16)}`);
}, 1000);
```

---

## Verification Steps

### 1. Build and Run
```bash
npm run dev
```

### 2. Load a ROM
- Load any GameBoy ROM
- Timer should start automatically

### 3. Check Timer Registers
Open browser console and check:
```javascript
// DIV should be incrementing
gameboy.mmu.getIO(0x04)

// Enable timer and check TIMA
gameboy.mmu.setIO(0x07, 0x04) // Enable timer at 4096 Hz
setTimeout(() => {
  console.log('TIMA:', gameboy.mmu.getIO(0x05))
}, 1000)
```

### 4. Test Timer Interrupt
```javascript
// Set up timer to overflow quickly
gameboy.mmu.setIO(0x05, 0xFF) // TIMA = 255 (will overflow soon)
gameboy.mmu.setIO(0x06, 0x00) // TMA = 0
gameboy.mmu.setIO(0x07, 0x05) // Enable timer at 262144 Hz
gameboy.mmu.setInterruptEnable(0x04) // Enable timer interrupt
```

Watch console for "Timer interrupt requested" messages.

---

## Success Criteria

✅ DIV register increments at 16384 Hz
✅ TIMA increments at frequency set by TAC
✅ TIMA overflows and resets to TMA
✅ Timer interrupt fires on TIMA overflow
✅ CPU handles timer interrupts correctly
✅ No performance impact on emulation

---

## Next Phase

Proceed to **Phase 7: Input Handling** to implement joypad support for keyboard controls.

---

## Common Issues & Solutions

### Issue: DIV doesn't increment
**Solution**: Check divCounter is being updated in step(), verify 256 cycle threshold

### Issue: TIMA doesn't increment
**Solution**: Verify TAC bit 2 (enable) is set, check frequency calculation

### Issue: Timer runs too fast/slow
**Solution**: Verify frequency constants match specifications, check cycle counting

### Issue: Interrupts not firing
**Solution**: Check interrupt enable register (IE at 0xFFFF), verify IME flag is set

### Issue: Game freezes after interrupt
**Solution**: Ensure RETI instruction enables interrupts again, check stack operations
