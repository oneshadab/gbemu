import { Joypad, Button } from '@/core/input/Joypad';
import { logger } from '@/utils/logger';

/**
 * Input Manager - Maps keyboard input to GameBoy buttons
 *
 * Default key mapping:
 * - Arrow Keys: D-Pad (Up, Down, Left, Right)
 * - Z: A button
 * - X: B button
 * - Enter: Start
 * - Shift: Select
 */

interface KeyMapping {
  [key: string]: Button;
}

export class InputManager {
  private joypad: Joypad;
  private keyMapping: KeyMapping;
  private pressedKeys: Set<string> = new Set();

  constructor(joypad: Joypad) {
    this.joypad = joypad;

    // Default key mapping
    this.keyMapping = {
      'ArrowUp': Button.UP,
      'ArrowDown': Button.DOWN,
      'ArrowLeft': Button.LEFT,
      'ArrowRight': Button.RIGHT,
      'z': Button.A,
      'x': Button.B,
      'Enter': Button.START,
      'Shift': Button.SELECT,
    };

    this.setupEventListeners();
    logger.info('Input manager initialized');
  }

  /**
   * Set up keyboard event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    // Prevent default behavior for arrow keys and space
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
    });

    logger.debug('Input event listeners registered');
  }

  /**
   * Handle key down event
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    const key = event.key;

    // Ignore repeat events
    if (this.pressedKeys.has(key)) {
      return;
    }

    // Check if key is mapped to a button
    const button = this.keyMapping[key];
    if (button !== undefined) {
      this.pressedKeys.add(key);
      this.joypad.pressButton(button);
    }
  };

  /**
   * Handle key up event
   */
  private handleKeyUp = (event: KeyboardEvent): void => {
    const key = event.key;

    // Remove from pressed keys
    this.pressedKeys.delete(key);

    // Check if key is mapped to a button
    const button = this.keyMapping[key];
    if (button !== undefined) {
      this.joypad.releaseButton(button);
    }
  };

  /**
   * Update key mapping
   */
  setKeyMapping(key: string, button: Button): void {
    this.keyMapping[key] = button;
    logger.info(`Key mapping updated: ${key} -> ${Button[button]}`);
  }

  /**
   * Get current key mapping
   */
  getKeyMapping(): KeyMapping {
    return { ...this.keyMapping };
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    logger.info('Input manager destroyed');
  }
}
