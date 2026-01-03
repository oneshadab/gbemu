import { MMU } from '../memory/MMU';
import { logger } from '@/utils/logger';

/**
 * GameBoy Joypad Controller
 *
 * Handles input from 8 buttons via the P1/JOYP register (0xFF00)
 *
 * Buttons:
 * - Direction: Up, Down, Left, Right
 * - Action: A, B, Select, Start
 *
 * Register 0xFF00 (P1/JOYP):
 * Bit 7-6: Not used
 * Bit 5: P15 Select Button Keys (0=Select)
 * Bit 4: P14 Select Direction Keys (0=Select)
 * Bit 3: P13 Input Down or Start (0=Pressed)
 * Bit 2: P12 Input Up or Select (0=Pressed)
 * Bit 1: P11 Input Left or B (0=Pressed)
 * Bit 0: P10 Input Right or A (0=Pressed)
 */

export enum Button {
  RIGHT = 0,
  LEFT = 1,
  UP = 2,
  DOWN = 3,
  A = 4,
  B = 5,
  SELECT = 6,
  START = 7,
}

export class Joypad {
  private mmu: MMU;

  // Button states (true = pressed)
  private buttonStates: boolean[] = new Array(8).fill(false);

  // Previous button states for interrupt detection
  private previousStates: boolean[] = new Array(8).fill(false);

  constructor(mmu: MMU) {
    this.mmu = mmu;
  }

  /**
   * Reset joypad state
   */
  reset(): void {
    this.buttonStates.fill(false);
    this.previousStates.fill(false);
    this.updateJoypadRegister();
  }

  /**
   * Press a button
   */
  pressButton(button: Button): void {
    if (!this.buttonStates[button]) {
      this.buttonStates[button] = true;
      this.updateJoypadRegister();
      this.checkInterrupt();
      logger.debug(`Button pressed: ${Button[button]}`);
    }
  }

  /**
   * Release a button
   */
  releaseButton(button: Button): void {
    if (this.buttonStates[button]) {
      this.buttonStates[button] = false;
      this.updateJoypadRegister();
      logger.debug(`Button released: ${Button[button]}`);
    }
  }

  /**
   * Update the joypad register (0xFF00) based on current button states
   */
  updateJoypadRegister(): void {
    const p1 = this.mmu.read(0xFF00);

    // Get selection bits
    const selectButtons = (p1 & 0x20) === 0; // Bit 5
    const selectDirections = (p1 & 0x10) === 0; // Bit 4

    let result = p1 & 0xF0; // Keep bits 4-7

    if (selectButtons) {
      // Read action buttons (A, B, Select, Start)
      // Bit 3: Start, Bit 2: Select, Bit 1: B, Bit 0: A
      result |= 0x0F; // All buttons released by default
      if (this.buttonStates[Button.START]) result &= ~0x08;
      if (this.buttonStates[Button.SELECT]) result &= ~0x04;
      if (this.buttonStates[Button.B]) result &= ~0x02;
      if (this.buttonStates[Button.A]) result &= ~0x01;
    } else if (selectDirections) {
      // Read direction buttons (Up, Down, Left, Right)
      // Bit 3: Down, Bit 2: Up, Bit 1: Left, Bit 0: Right
      result |= 0x0F; // All buttons released by default
      if (this.buttonStates[Button.DOWN]) result &= ~0x08;
      if (this.buttonStates[Button.UP]) result &= ~0x04;
      if (this.buttonStates[Button.LEFT]) result &= ~0x02;
      if (this.buttonStates[Button.RIGHT]) result &= ~0x01;
    } else {
      // Nothing selected, return all 1s
      result |= 0x0F;
    }

    this.mmu.write(0xFF00, result);
  }

  /**
   * Check if any button was newly pressed and trigger joypad interrupt
   */
  private checkInterrupt(): void {
    // Check if any button transitioned from released to pressed
    let newPress = false;
    for (let i = 0; i < 8; i++) {
      if (this.buttonStates[i] && !this.previousStates[i]) {
        newPress = true;
        break;
      }
    }

    // Update previous states
    this.previousStates = [...this.buttonStates];

    // Request joypad interrupt if there was a new press
    if (newPress) {
      const interruptFlag = this.mmu.getInterruptFlag();
      this.mmu.setInterruptFlag(interruptFlag | (1 << 4)); // Bit 4 = Joypad interrupt
      logger.debug('Joypad interrupt requested');
    }
  }

  /**
   * Get current button state
   */
  isButtonPressed(button: Button): boolean {
    return this.buttonStates[button];
  }
}
