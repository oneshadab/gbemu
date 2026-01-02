# Phase 8: Sprite Rendering

## Overview
Add sprite (OBJ/object) rendering to the PPU. Sprites are used for characters, enemies, and moving objects in games.

## Goals
- Render sprites from OAM (Object Attribute Memory)
- Handle sprite priorities and palettes
- Implement 8x8 and 8x16 sprite modes
- Respect 10-sprite-per-scanline limit
- Handle sprite flipping (horizontal/vertical)

---

## Step 1: Sprite Data Structure

**File**: `src/core/ppu/types.ts` (new file)

```typescript
/**
 * Sprite attribute data from OAM
 */
export interface Sprite {
  y: number;          // Y position on screen (actual Y = value - 16)
  x: number;          // X position on screen (actual X = value - 8)
  tileIndex: number;  // Tile number
  flags: number;      // Attributes/flags
}

/**
 * Sprite flag bits
 */
export const SPRITE_PRIORITY = 7;    // 0 = above BG, 1 = behind BG colors 1-3
export const SPRITE_Y_FLIP = 6;      // Vertical flip
export const SPRITE_X_FLIP = 5;      // Horizontal flip
export const SPRITE_PALETTE = 4;     // Palette (0 = OBP0, 1 = OBP1)
```

---

## Step 2: Update PPU with Sprite Rendering

**File**: `src/core/ppu/PPU.ts` (update renderScanline method)

Add sprite rendering after background:

```typescript
import { Sprite, SPRITE_PRIORITY, SPRITE_Y_FLIP, SPRITE_X_FLIP, SPRITE_PALETTE } from './types';
import { LCDC_OBJ_ENABLE, LCDC_OBJ_SIZE } from './constants';

export class PPU {
  // ... existing code ...

  /**
   * Render current scanline
   */
  private renderScanline(): void {
    const lcdc = this.mmu.getIO(0x40);

    // Render background
    if (getBit(lcdc, LCDC_BG_ENABLE)) {
      this.renderBackground();
    }

    // Render sprites
    if (getBit(lcdc, LCDC_OBJ_ENABLE)) {
      this.renderSprites();
    }
  }

  /**
   * Render sprites for current scanline
   */
  private renderSprites(): void {
    const lcdc = this.mmu.getIO(0x40);
    const spriteHeight = getBit(lcdc, LCDC_OBJ_SIZE) ? 16 : 8;

    // Get all sprites from OAM
    const sprites = this.getSpritesForScanline(spriteHeight);

    // GameBoy can only render 10 sprites per scanline
    const visibleSprites = sprites.slice(0, 10);

    // Render sprites in reverse order (lower priority sprites first)
    for (let i = visibleSprites.length - 1; i >= 0; i--) {
      this.renderSprite(visibleSprites[i], spriteHeight);
    }
  }

  /**
   * Get sprites that should be rendered on current scanline
   */
  private getSpritesForScanline(spriteHeight: number): Sprite[] {
    const oam = this.mmu.getOAM();
    const sprites: Sprite[] = [];

    // OAM contains 40 sprites (4 bytes each)
    for (let i = 0; i < 40; i++) {
      const offset = i * 4;

      const sprite: Sprite = {
        y: oam[offset],
        x: oam[offset + 1],
        tileIndex: oam[offset + 2],
        flags: oam[offset + 3],
      };

      // Check if sprite is on this scanline
      // Sprite Y position is offset by 16
      const spriteY = sprite.y - 16;
      if (this.line >= spriteY && this.line < spriteY + spriteHeight) {
        sprites.push(sprite);
      }
    }

    // Sort by X position (lower X has priority)
    sprites.sort((a, b) => a.x - b.x);

    return sprites;
  }

  /**
   * Render a single sprite
   */
  private renderSprite(sprite: Sprite, spriteHeight: number): void {
    const obp0 = this.mmu.getIO(0x48); // Object palette 0
    const obp1 = this.mmu.getIO(0x49); // Object palette 1

    // Get sprite properties
    const spriteX = sprite.x - 8;
    const spriteY = sprite.y - 16;
    const palette = getBit(sprite.flags, SPRITE_PALETTE) ? obp1 : obp0;
    const priority = getBit(sprite.flags, SPRITE_PRIORITY);
    const xFlip = getBit(sprite.flags, SPRITE_X_FLIP);
    const yFlip = getBit(sprite.flags, SPRITE_Y_FLIP);

    // Calculate which row of the sprite we're rendering
    let tileRow = this.line - spriteY;
    if (yFlip) {
      tileRow = spriteHeight - 1 - tileRow;
    }

    // Get tile index (for 8x16 mode, bit 0 is ignored)
    let tileIndex = sprite.tileIndex;
    if (spriteHeight === 16) {
      if (tileRow >= 8) {
        tileIndex = (sprite.tileIndex & 0xFE) + 1;
        tileRow -= 8;
      } else {
        tileIndex = sprite.tileIndex & 0xFE;
      }
    }

    // Get tile data from VRAM (sprites always use 0x8000-0x8FFF)
    const tileAddress = 0x8000 + (tileIndex * 16) + (tileRow * 2);
    const byte1 = this.mmu.read(tileAddress);
    const byte2 = this.mmu.read(tileAddress + 1);

    // Render each pixel of the sprite
    for (let x = 0; x < 8; x++) {
      const pixelX = spriteX + x;

      // Skip if off-screen
      if (pixelX < 0 || pixelX >= SCREEN_WIDTH) {
        continue;
      }

      // Get color index for this pixel
      let bitPosition = 7 - x;
      if (xFlip) {
        bitPosition = x;
      }

      const colorBit0 = (byte1 >> bitPosition) & 1;
      const colorBit1 = (byte2 >> bitPosition) & 1;
      const colorIndex = (colorBit1 << 1) | colorBit0;

      // Color 0 is transparent for sprites
      if (colorIndex === 0) {
        continue;
      }

      // Check priority (if priority bit is set, sprite is behind BG colors 1-3)
      if (priority) {
        const fbIndex = (this.line * SCREEN_WIDTH + pixelX) * 4;
        const bgColor = this.framebuffer[fbIndex];

        // Check if BG pixel is not color 0 (darkest)
        // If BG is not transparent, skip this sprite pixel
        if (bgColor !== DMG_COLORS[3][0]) {
          continue;
        }
      }

      // Apply palette
      const paletteColor = (palette >> (colorIndex * 2)) & 0x03;
      const color = DMG_COLORS[paletteColor];

      // Write to framebuffer
      const fbIndex = (this.line * SCREEN_WIDTH + pixelX) * 4;
      this.framebuffer[fbIndex] = color[0];     // R
      this.framebuffer[fbIndex + 1] = color[1]; // G
      this.framebuffer[fbIndex + 2] = color[2]; // B
      this.framebuffer[fbIndex + 3] = 255;      // A
    }
  }
}
```

---

## Step 3: Add Complete CB Instructions

**File**: `src/core/cpu/cbInstructions.ts` (expand)

Many games use CB-prefixed bit instructions. Add more complete implementation:

```typescript
import { CPU } from './CPU';
import { Instruction } from './types';
import { to8Bit, getBit } from '@/utils/bits';

export const cbInstructions: (Instruction | null)[] = new Array(256).fill(null);

const defCB = (opcode: number, mnemonic: string, cycles: number, handler: (cpu: CPU) => number) => {
  cbInstructions[opcode] = { mnemonic, cycles, handler };
};

// Helper functions for bit operations
const rotate_left = (cpu: CPU, value: number, throughCarry: boolean): number => {
  const carry = cpu.registers.getCarryFlag() ? 1 : 0;
  const newCarry = (value & 0x80) !== 0;

  let result: number;
  if (throughCarry) {
    result = to8Bit((value << 1) | carry);
  } else {
    result = to8Bit((value << 1) | (value >> 7));
  }

  cpu.updateZeroFlag(result);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(newCarry);

  return result;
};

const rotate_right = (cpu: CPU, value: number, throughCarry: boolean): number => {
  const carry = cpu.registers.getCarryFlag() ? 0x80 : 0;
  const newCarry = (value & 0x01) !== 0;

  let result: number;
  if (throughCarry) {
    result = (value >> 1) | carry;
  } else {
    result = (value >> 1) | ((value & 1) << 7);
  }

  cpu.updateZeroFlag(result);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(newCarry);

  return result;
};

const shift_left = (cpu: CPU, value: number): number => {
  const newCarry = (value & 0x80) !== 0;
  const result = to8Bit(value << 1);

  cpu.updateZeroFlag(result);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(newCarry);

  return result;
};

const shift_right_arithmetic = (cpu: CPU, value: number): number => {
  const newCarry = (value & 0x01) !== 0;
  const result = (value >> 1) | (value & 0x80); // Keep MSB

  cpu.updateZeroFlag(result);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(newCarry);

  return result;
};

const shift_right_logical = (cpu: CPU, value: number): number => {
  const newCarry = (value & 0x01) !== 0;
  const result = value >> 1;

  cpu.updateZeroFlag(result);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(newCarry);

  return result;
};

const swap = (cpu: CPU, value: number): number => {
  const result = ((value & 0x0F) << 4) | ((value & 0xF0) >> 4);

  cpu.updateZeroFlag(result);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(false);

  return result;
};

// BIT n, r - Test bit n
for (let bit = 0; bit < 8; bit++) {
  for (let reg = 0; reg < 8; reg++) {
    const opcode = 0x40 + (bit * 8) + reg;
    const regName = ['B', 'C', 'D', 'E', 'H', 'L', '(HL)', 'A'][reg];

    defCB(opcode, `BIT ${bit}, ${regName}`, reg === 6 ? 12 : 8, (cpu) => {
      let value: number;

      if (reg === 6) {
        value = cpu.mmu.read(cpu.registers.getHL());
      } else {
        const regs = [cpu.registers.b, cpu.registers.c, cpu.registers.d, cpu.registers.e,
                      cpu.registers.h, cpu.registers.l, 0, cpu.registers.a];
        value = regs[reg];
      }

      const bitSet = getBit(value, bit) !== 0;
      cpu.registers.setZeroFlag(!bitSet);
      cpu.registers.setSubtractFlag(false);
      cpu.registers.setHalfCarryFlag(true);

      return reg === 6 ? 12 : 8;
    });
  }
}

// RES n, r - Reset bit n
for (let bit = 0; bit < 8; bit++) {
  for (let reg = 0; reg < 8; reg++) {
    const opcode = 0x80 + (bit * 8) + reg;
    const regName = ['B', 'C', 'D', 'E', 'H', 'L', '(HL)', 'A'][reg];

    defCB(opcode, `RES ${bit}, ${regName}`, reg === 6 ? 16 : 8, (cpu) => {
      const mask = ~(1 << bit);

      if (reg === 6) {
        const value = cpu.mmu.read(cpu.registers.getHL());
        cpu.mmu.write(cpu.registers.getHL(), value & mask);
      } else {
        switch (reg) {
          case 0: cpu.registers.b &= mask; break;
          case 1: cpu.registers.c &= mask; break;
          case 2: cpu.registers.d &= mask; break;
          case 3: cpu.registers.e &= mask; break;
          case 4: cpu.registers.h &= mask; break;
          case 5: cpu.registers.l &= mask; break;
          case 7: cpu.registers.a &= mask; break;
        }
      }

      return reg === 6 ? 16 : 8;
    });
  }
}

// SET n, r - Set bit n
for (let bit = 0; bit < 8; bit++) {
  for (let reg = 0; reg < 8; reg++) {
    const opcode = 0xC0 + (bit * 8) + reg;
    const regName = ['B', 'C', 'D', 'E', 'H', 'L', '(HL)', 'A'][reg];

    defCB(opcode, `SET ${bit}, ${regName}`, reg === 6 ? 16 : 8, (cpu) => {
      const mask = 1 << bit;

      if (reg === 6) {
        const value = cpu.mmu.read(cpu.registers.getHL());
        cpu.mmu.write(cpu.registers.getHL(), value | mask);
      } else {
        switch (reg) {
          case 0: cpu.registers.b |= mask; break;
          case 1: cpu.registers.c |= mask; break;
          case 2: cpu.registers.d |= mask; break;
          case 3: cpu.registers.e |= mask; break;
          case 4: cpu.registers.h |= mask; break;
          case 5: cpu.registers.l |= mask; break;
          case 7: cpu.registers.a |= mask; break;
        }
      }

      return reg === 6 ? 16 : 8;
    });
  }
}

// RL r - Rotate left through carry
defCB(0x10, 'RL B', 8, (cpu) => { cpu.registers.b = rotate_left(cpu, cpu.registers.b, true); return 8; });
defCB(0x11, 'RL C', 8, (cpu) => { cpu.registers.c = rotate_left(cpu, cpu.registers.c, true); return 8; });
defCB(0x12, 'RL D', 8, (cpu) => { cpu.registers.d = rotate_left(cpu, cpu.registers.d, true); return 8; });
defCB(0x13, 'RL E', 8, (cpu) => { cpu.registers.e = rotate_left(cpu, cpu.registers.e, true); return 8; });
defCB(0x14, 'RL H', 8, (cpu) => { cpu.registers.h = rotate_left(cpu, cpu.registers.h, true); return 8; });
defCB(0x15, 'RL L', 8, (cpu) => { cpu.registers.l = rotate_left(cpu, cpu.registers.l, true); return 8; });
defCB(0x17, 'RL A', 8, (cpu) => { cpu.registers.a = rotate_left(cpu, cpu.registers.a, true); return 8; });

// RR r - Rotate right through carry
defCB(0x18, 'RR B', 8, (cpu) => { cpu.registers.b = rotate_right(cpu, cpu.registers.b, true); return 8; });
defCB(0x19, 'RR C', 8, (cpu) => { cpu.registers.c = rotate_right(cpu, cpu.registers.c, true); return 8; });
defCB(0x1A, 'RR D', 8, (cpu) => { cpu.registers.d = rotate_right(cpu, cpu.registers.d, true); return 8; });
defCB(0x1B, 'RR E', 8, (cpu) => { cpu.registers.e = rotate_right(cpu, cpu.registers.e, true); return 8; });
defCB(0x1C, 'RR H', 8, (cpu) => { cpu.registers.h = rotate_right(cpu, cpu.registers.h, true); return 8; });
defCB(0x1D, 'RR L', 8, (cpu) => { cpu.registers.l = rotate_right(cpu, cpu.registers.l, true); return 8; });
defCB(0x1F, 'RR A', 8, (cpu) => { cpu.registers.a = rotate_right(cpu, cpu.registers.a, true); return 8; });

// SLA r - Shift left arithmetic
defCB(0x20, 'SLA B', 8, (cpu) => { cpu.registers.b = shift_left(cpu, cpu.registers.b); return 8; });
defCB(0x21, 'SLA C', 8, (cpu) => { cpu.registers.c = shift_left(cpu, cpu.registers.c); return 8; });
defCB(0x22, 'SLA D', 8, (cpu) => { cpu.registers.d = shift_left(cpu, cpu.registers.d); return 8; });
defCB(0x23, 'SLA E', 8, (cpu) => { cpu.registers.e = shift_left(cpu, cpu.registers.e); return 8; });
defCB(0x24, 'SLA H', 8, (cpu) => { cpu.registers.h = shift_left(cpu, cpu.registers.h); return 8; });
defCB(0x25, 'SLA L', 8, (cpu) => { cpu.registers.l = shift_left(cpu, cpu.registers.l); return 8; });
defCB(0x27, 'SLA A', 8, (cpu) => { cpu.registers.a = shift_left(cpu, cpu.registers.a); return 8; });

// SWAP r - Swap nibbles
defCB(0x30, 'SWAP B', 8, (cpu) => { cpu.registers.b = swap(cpu, cpu.registers.b); return 8; });
defCB(0x31, 'SWAP C', 8, (cpu) => { cpu.registers.c = swap(cpu, cpu.registers.c); return 8; });
defCB(0x32, 'SWAP D', 8, (cpu) => { cpu.registers.d = swap(cpu, cpu.registers.d); return 8; });
defCB(0x33, 'SWAP E', 8, (cpu) => { cpu.registers.e = swap(cpu, cpu.registers.e); return 8; });
defCB(0x34, 'SWAP H', 8, (cpu) => { cpu.registers.h = swap(cpu, cpu.registers.h); return 8; });
defCB(0x35, 'SWAP L', 8, (cpu) => { cpu.registers.l = swap(cpu, cpu.registers.l); return 8; });
defCB(0x37, 'SWAP A', 8, (cpu) => { cpu.registers.a = swap(cpu, cpu.registers.a); return 8; });

// SRL r - Shift right logical
defCB(0x38, 'SRL B', 8, (cpu) => { cpu.registers.b = shift_right_logical(cpu, cpu.registers.b); return 8; });
defCB(0x39, 'SRL C', 8, (cpu) => { cpu.registers.c = shift_right_logical(cpu, cpu.registers.c); return 8; });
defCB(0x3A, 'SRL D', 8, (cpu) => { cpu.registers.d = shift_right_logical(cpu, cpu.registers.d); return 8; });
defCB(0x3B, 'SRL E', 8, (cpu) => { cpu.registers.e = shift_right_logical(cpu, cpu.registers.e); return 8; });
defCB(0x3C, 'SRL H', 8, (cpu) => { cpu.registers.h = shift_right_logical(cpu, cpu.registers.h); return 8; });
defCB(0x3D, 'SRL L', 8, (cpu) => { cpu.registers.l = shift_right_logical(cpu, cpu.registers.l); return 8; });
defCB(0x3F, 'SRL A', 8, (cpu) => { cpu.registers.a = shift_right_logical(cpu, cpu.registers.a); return 8; });
```

---

## Verification Steps

### 1. Build and Run
```bash
npm run dev
```

### 2. Load a Game with Sprites
Load a ROM like Tetris, Dr. Mario, or any game with moving objects

### 3. Expected Behavior
- Sprites (game characters, objects) should render correctly
- Sprites should move smoothly
- Priority handling should work (sprites behind/in front of background)
- Flipping should work correctly

### 4. Test Sprite Features
- **8x8 sprites**: Most games use this mode
- **8x16 sprites**: Some games switch to this for larger objects
- **Transparency**: Color 0 of sprites should be transparent
- **Palettes**: OBP0 and OBP1 should produce different colors

---

## Success Criteria

✅ Sprites render on screen
✅ 10-sprite-per-scanline limit enforced
✅ Sprite priority works correctly
✅ Horizontal/vertical flipping works
✅ 8x8 and 8x16 modes work
✅ Color 0 is transparent
✅ Both palettes (OBP0, OBP1) work

---

## Next Phase

Proceed to **Phase 9: MBC1 Banking** to implement memory bank controller support for larger ROMs.

---

## Common Issues & Solutions

### Issue: Sprites don't appear
**Solution**: Check LCDC bit 1 (OBJ_ENABLE), verify OAM data is loaded, check Y/X offsets (-16/-8)

### Issue: Sprites appear in wrong position
**Solution**: Verify Y-16 and X-8 offset is applied, check coordinate system

### Issue: Sprites appear garbled
**Solution**: Check tile data addressing (always 0x8000-0x8FFF for sprites), verify bit unpacking

### Issue: Too many sprites render
**Solution**: Enforce 10-sprite-per-scanline limit in getSpritesForScanline()

### Issue: Sprite flipping doesn't work
**Solution**: Verify bit position calculation when X_FLIP or Y_FLIP is set

### Issue: Wrong colors on sprites
**Solution**: Check OBP0/OBP1 palette selection (bit 4 of sprite flags)
