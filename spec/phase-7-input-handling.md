# Phase 7: Input Handling

## Overview
Implement joypad/input system to handle keyboard controls mapped to GameBoy buttons.

## Goals
- Implement Joypad class with P1 register handling
- Map keyboard keys to GameBoy buttons
- Handle button press/release events
- Request joypad interrupts
- Integrate into main emulation loop

---

## Step 1: Joypad Implementation

**File**: `src/core/input/Joypad.ts`

```typescript
import { MMU } from '../memory/MMU';
import { logger } from '@/utils/logger';

/**
 * GameBoy Joypad (P1 register at 0xFF00)
 *
 * Bit 7-6: Not used
 * Bit 5: P15 - Select button keys (0 = select)
 * Bit 4: P14 - Select direction keys (0 = select)
 * Bit 3: P13 - Down or Start (0 = pressed)
 * Bit 2: P12 - Up or Select (0 = pressed)
 * Bit 1: P11 - Left or B (0 = pressed)
 * Bit 0: P10 - Right or A (0 = pressed)
 *
 * Note: 0 = pressed, 1 = released (inverted logic)
 */

export enum JoypadButton {
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
  private buttons: boolean[] = new Array(8).fill(false);

  // Previous P1 value for interrupt detection
  private previousP1: number = 0xFF;

  constructor(mmu: MMU) {
    this.mmu = mmu;
  }

  /**
   * Reset joypad state
   */
  reset(): void {
    this.buttons.fill(false);
    this.previousP1 = 0xFF;
  }

  /**
   * Press a button
   */
  press(button: JoypadButton): void {
    if (!this.buttons[button]) {
      this.buttons[button] = true;
      this.updateP1();
      logger.debug(`Button pressed: ${JoypadButton[button]}`);
    }
  }

  /**
   * Release a button
   */
  release(button: JoypadButton): void {
    if (this.buttons[button]) {
      this.buttons[button] = false;
      this.updateP1();
      logger.debug(`Button released: ${JoypadButton[button]}`);
    }
  }

  /**
   * Check if button is pressed
   */
  isPressed(button: JoypadButton): boolean {
    return this.buttons[button];
  }

  /**
   * Update P1 register based on current button states
   */
  private updateP1(): void {
    const p1 = this.mmu.getIO(0x00);

    // Start with all buttons released (bits set to 1)
    let result = 0xCF; // Bits 7-6 always 1, bits 5-4 from P1, bits 3-0 = 1111

    // Keep bits 5-4 from current P1 (selection bits)
    result = (result & 0xC0) | (p1 & 0x30) | 0x0F;

    // Check which keys are selected
    const selectButtons = (p1 & 0x20) === 0; // Bit 5 = 0 selects button keys
    const selectDirection = (p1 & 0x10) === 0; // Bit 4 = 0 selects direction keys

    if (selectButtons) {
      // Button keys: Start, Select, B, A
      if (this.buttons[JoypadButton.START]) result &= ~0x08; // Bit 3
      if (this.buttons[JoypadButton.SELECT]) result &= ~0x04; // Bit 2
      if (this.buttons[JoypadButton.B]) result &= ~0x02; // Bit 1
      if (this.buttons[JoypadButton.A]) result &= ~0x01; // Bit 0
    }

    if (selectDirection) {
      // Direction keys: Down, Up, Left, Right
      if (this.buttons[JoypadButton.DOWN]) result &= ~0x08; // Bit 3
      if (this.buttons[JoypadButton.UP]) result &= ~0x04; // Bit 2
      if (this.buttons[JoypadButton.LEFT]) result &= ~0x02; // Bit 1
      if (this.buttons[JoypadButton.RIGHT]) result &= ~0x01; // Bit 0
    }

    // Check if any button changed from released to pressed
    const changed = this.previousP1 & ~result & 0x0F;
    if (changed !== 0) {
      // Request joypad interrupt
      this.requestJoypadInterrupt();
    }

    this.previousP1 = result;
    this.mmu.setIO(0x00, result);
  }

  /**
   * Request joypad interrupt
   */
  private requestJoypadInterrupt(): void {
    const interruptFlag = this.mmu.getInterruptFlag();
    this.mmu.setInterruptFlag(interruptFlag | (1 << 4)); // Bit 4 = Joypad interrupt
    logger.debug('Joypad interrupt requested');
  }

  /**
   * Step function (called each frame to update P1)
   */
  step(): void {
    // Update P1 register in case selection bits changed
    this.updateP1();
  }
}
```

---

## Step 2: Keyboard Input Manager

**File**: `src/ui/input.ts`

```typescript
import { Joypad, JoypadButton } from '@/core/input/Joypad';

/**
 * Keyboard Input Manager
 * Maps keyboard keys to GameBoy buttons
 */
export class InputManager {
  private joypad: Joypad;
  private keyMap: Map<string, JoypadButton>;

  constructor(joypad: Joypad) {
    this.joypad = joypad;

    // Default key mapping
    this.keyMap = new Map([
      ['ArrowRight', JoypadButton.RIGHT],
      ['ArrowLeft', JoypadButton.LEFT],
      ['ArrowUp', JoypadButton.UP],
      ['ArrowDown', JoypadButton.DOWN],
      ['z', JoypadButton.A],
      ['x', JoypadButton.B],
      ['Enter', JoypadButton.START],
      ['Shift', JoypadButton.SELECT],
      // Alternative mappings
      ['a', JoypadButton.A],
      ['s', JoypadButton.B],
    ]);

    this.setupEventListeners();
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
  }

  /**
   * Handle key down event
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    const button = this.keyMap.get(event.key);
    if (button !== undefined) {
      this.joypad.press(button);
      event.preventDefault();
    }
  };

  /**
   * Handle key up event
   */
  private handleKeyUp = (event: KeyboardEvent): void => {
    const button = this.keyMap.get(event.key);
    if (button !== undefined) {
      this.joypad.release(button);
      event.preventDefault();
    }
  };

  /**
   * Clean up event listeners
   */
  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  /**
   * Update key mapping
   */
  setKeyMapping(key: string, button: JoypadButton): void {
    this.keyMap.set(key, button);
  }

  /**
   * Get current key mapping
   */
  getKeyMapping(): Map<string, JoypadButton> {
    return new Map(this.keyMap);
  }
}
```

---

## Step 3: Update GameBoy to Include Joypad

**File**: `src/emulator/GameBoy.ts` (update)

```typescript
import { Joypad } from '@/core/input/Joypad';

export class GameBoy {
  // Components
  mmu: MMU;
  cpu: CPU;
  ppu: PPU;
  timer: Timer;
  joypad: Joypad; // Add this

  constructor() {
    this.mmu = new MMU();
    this.cpu = new CPU(this.mmu);
    this.ppu = new PPU(this.mmu);
    this.timer = new Timer(this.mmu);
    this.joypad = new Joypad(this.mmu); // Add this

    logger.info('GameBoy emulator initialized');
  }

  reset(): void {
    this.cpu.reset();
    this.ppu.reset();
    this.timer.reset();
    this.joypad.reset(); // Add this
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
      this.timer.step(cpuCycles);

      cyclesThisFrame += cpuCycles;
    }

    // Update joypad at end of frame
    this.joypad.step(); // Add this

    // Update FPS counter
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }
}
```

---

## Step 4: Update Main to Set Up Input

**File**: `src/main.ts` (update)

```typescript
import { InputManager } from '@/ui/input';

// ... existing code ...

// Initialize emulator
const gameboy = new GameBoy();

// Initialize input manager
const inputManager = new InputManager(gameboy.joypad);

// Initialize UI controller
const ui = new UIController(gameboy, renderer);

console.log('✅ Emulator ready');

// Expose for debugging
(window as any).gameboy = gameboy;
(window as any).inputManager = inputManager;
(window as any).logger = logger;
```

---

## Step 5: Update HTML for Better Input Instructions

**File**: `public/index.html` (update controls section)

```html
<div class="info">
  <p><strong>Controls:</strong></p>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin: 10px 0;">
    <div><kbd style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-family: monospace;">↑ ↓ ← →</kbd> D-Pad</div>
    <div><kbd style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-family: monospace;">Z</kbd> A Button</div>
    <div><kbd style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-family: monospace;">X</kbd> B Button</div>
    <div><kbd style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-family: monospace;">Enter</kbd> Start</div>
    <div><kbd style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-family: monospace;">Shift</kbd> Select</div>
  </div>
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <div id="status" class="status ready">Ready - Load a ROM to start</div>
    <div id="fps" style="font-weight: 600; color: #4a5568;">FPS: 0</div>
  </div>
</div>
```

---

## Step 6: Handle P1 Register Writes in MMU

**File**: `src/core/memory/MMU.ts` (update writeIO method)

Ensure P1 register writes preserve button selection bits:

```typescript
private writeIO(address: number, value: number): void {
  const offset = address - 0xFF00;

  switch (address) {
    case 0xFF00: // P1 - Joypad
      // Only bits 5-4 are writable (selection bits)
      // Bits 3-0 are read-only (button states)
      const current = this.io[offset];
      this.io[offset] = (value & 0x30) | (current & 0xCF);
      break;

    case 0xFF04: // DIV
      this.io[offset] = 0;
      break;

    case 0xFF44: // LY - read-only
      break;

    case 0xFF46: // DMA
      this.io[offset] = value;
      // TODO: Trigger DMA transfer
      break;

    default:
      this.io[offset] = value;
  }
}
```

---

## Verification Steps

### 1. Build and Run
```bash
npm run dev
```

### 2. Load a ROM
Load any GameBoy ROM that responds to input (like Tetris)

### 3. Test Controls
Press keys and verify:
- **Arrow keys**: Should control movement
- **Z (A button)**: Should trigger actions
- **X (B button)**: Should trigger actions
- **Enter (Start)**: Should pause/menu
- **Shift (Select)**: Should work in menus

### 4. Check P1 Register
Open browser console:
```javascript
// Press arrow right
gameboy.joypad.press(0)

// Check P1 register (should show button pressed)
gameboy.mmu.getIO(0x00).toString(2).padStart(8, '0')

// Release
gameboy.joypad.release(0)
```

### 5. Test Joypad Interrupt
```javascript
// Enable joypad interrupt
gameboy.mmu.setInterruptEnable(0x10)

// Press a button and check interrupt flag
gameboy.joypad.press(4) // Press A
gameboy.mmu.getInterruptFlag() & 0x10 // Should be non-zero
```

---

## Success Criteria

✅ Keyboard input registers correctly
✅ P1 register updates with button states
✅ Direction and button selection works
✅ Joypad interrupts fire on button press
✅ Games respond to input correctly
✅ No input lag or missed presses

---

## Next Phase

Proceed to **Phase 8: Sprite Rendering** to add sprite (OBJ) support to the PPU for rendering game characters and objects.

---

## Common Issues & Solutions

### Issue: Input doesn't work
**Solution**: Check P1 register selection bits (5-4), verify button mapping is correct

### Issue: Some buttons don't work
**Solution**: Verify key mapping in InputManager, check browser console for errors

### Issue: Input is delayed
**Solution**: Ensure joypad.step() is called each frame, check event listeners are attached

### Issue: Arrow keys scroll the page
**Solution**: Verify preventDefault() is called in keydown handler

### Issue: Multiple keys don't work together
**Solution**: Some keyboards have key rollover limits - try different key combinations

### Issue: Joypad interrupt not firing
**Solution**: Check interrupt enable register has bit 4 set, verify P1 register is updating
