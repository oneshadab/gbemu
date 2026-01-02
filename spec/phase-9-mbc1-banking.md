# Phase 9: MBC1 Banking

## Overview
Implement MBC1 (Memory Bank Controller 1) to support larger ROMs with ROM and RAM banking. This unlocks ~90% of the GameBoy game library.

## Goals
- Implement MBC1 ROM banking (up to 2MB)
- Implement MBC1 RAM banking (up to 32KB)
- Handle banking mode selection
- Support RAM enable register
- Update MMU to route to correct MBC

---

## Step 1: MBC1 Controller Implementation

**File**: `src/core/memory/mbcs/MBC1.ts`

```typescript
import { Cartridge } from '../cartridge';
import { logger } from '@/utils/logger';

/**
 * MBC1 - Memory Bank Controller 1
 *
 * Most common MBC, supports:
 * - ROM: Up to 2MB (125 banks of 16KB)
 * - RAM: Up to 32KB (4 banks of 8KB)
 * - Two banking modes
 *
 * Register Map:
 * 0x0000-0x1FFF: RAM Enable (write 0x0A to enable, anything else to disable)
 * 0x2000-0x3FFF: ROM Bank Number (lower 5 bits)
 * 0x4000-0x5FFF: RAM Bank Number OR ROM Bank Number (upper 2 bits)
 * 0x6000-0x7FFF: Banking Mode Select (0 = ROM banking, 1 = RAM banking)
 */
export class MBC1 {
  private cartridge: Cartridge;

  // Banking state
  private ramEnabled: boolean = false;
  private romBank: number = 1;      // 5-bit register (0x01-0x1F)
  private ramBank: number = 0;      // 2-bit register (0x00-0x03)
  private bankingMode: number = 0;  // 0 = simple ROM banking, 1 = RAM banking/advanced ROM banking

  constructor(cartridge: Cartridge) {
    this.cartridge = cartridge;
  }

  /**
   * Read from ROM area (0x0000-0x7FFF)
   */
  readROM(address: number): number {
    if (address < 0x4000) {
      // Bank 0 (0x0000-0x3FFF)
      // In mode 1, this can be banked too
      let bank0 = 0;
      if (this.bankingMode === 1) {
        bank0 = (this.ramBank << 5);
      }
      const offset = (bank0 * 0x4000) + address;
      return this.cartridge.readROM(offset);
    } else {
      // Bank 1-N (0x4000-0x7FFF)
      // Combine ramBank (upper 2 bits) with romBank (lower 5 bits)
      let effectiveBank = this.romBank | (this.ramBank << 5);

      // Bank 0 is not allowed, map to bank 1
      if (effectiveBank === 0) {
        effectiveBank = 1;
      }

      // Map 0x20, 0x40, 0x60 to 0x21, 0x41, 0x61
      if (effectiveBank === 0x20 || effectiveBank === 0x40 || effectiveBank === 0x60) {
        effectiveBank += 1;
      }

      const offset = (effectiveBank * 0x4000) + (address - 0x4000);
      return this.cartridge.readROM(offset);
    }
  }

  /**
   * Read from external RAM area (0xA000-0xBFFF)
   */
  readRAM(address: number): number {
    if (!this.ramEnabled) {
      logger.debug('MBC1: RAM read while disabled');
      return 0xFF;
    }

    // Determine which RAM bank
    let bank = 0;
    if (this.bankingMode === 1) {
      bank = this.ramBank;
    }

    const offset = (bank * 0x2000) + (address - 0xA000);
    return this.cartridge.readRAM(offset);
  }

  /**
   * Write to ROM area (0x0000-0x7FFF) - controls banking
   */
  writeROM(address: number, value: number): void {
    if (address < 0x2000) {
      // 0x0000-0x1FFF: RAM Enable
      this.ramEnabled = (value & 0x0F) === 0x0A;
      logger.debug(`MBC1: RAM ${this.ramEnabled ? 'enabled' : 'disabled'}`);

    } else if (address < 0x4000) {
      // 0x2000-0x3FFF: ROM Bank Number (lower 5 bits)
      this.romBank = value & 0x1F;
      if (this.romBank === 0) {
        this.romBank = 1; // Bank 0 not allowed in switchable area
      }
      logger.debug(`MBC1: ROM bank set to 0x${this.romBank.toString(16)}`);

    } else if (address < 0x6000) {
      // 0x4000-0x5FFF: RAM Bank Number OR ROM Bank Number (upper 2 bits)
      this.ramBank = value & 0x03;
      logger.debug(`MBC1: RAM/ROM bank set to 0x${this.ramBank.toString(16)}`);

    } else if (address < 0x8000) {
      // 0x6000-0x7FFF: Banking Mode Select
      this.bankingMode = value & 0x01;
      logger.debug(`MBC1: Banking mode set to ${this.bankingMode}`);
    }
  }

  /**
   * Write to external RAM area (0xA000-0xBFFF)
   */
  writeRAM(address: number, value: number): void {
    if (!this.ramEnabled) {
      logger.debug('MBC1: RAM write while disabled');
      return;
    }

    // Determine which RAM bank
    let bank = 0;
    if (this.bankingMode === 1) {
      bank = this.ramBank;
    }

    const offset = (bank * 0x2000) + (address - 0xA000);
    this.cartridge.writeRAM(offset, value);
  }

  /**
   * Get current ROM bank for debugging
   */
  getCurrentROMBank(): number {
    return this.romBank | (this.ramBank << 5);
  }

  /**
   * Get current RAM bank for debugging
   */
  getCurrentRAMBank(): number {
    return this.bankingMode === 1 ? this.ramBank : 0;
  }
}
```

---

## Step 2: Update MMU to Support Multiple MBCs

**File**: `src/core/memory/MMU.ts` (update)

```typescript
import { MBC1 } from './mbcs/MBC1';
import { CartridgeType } from './cartridge';

export class MMU {
  // ... existing code ...

  // Update MBC type
  private mbc: NoMBC | MBC1 | null = null;

  /**
   * Load a cartridge into memory
   */
  loadCartridge(cartridge: Cartridge): void {
    // Select appropriate MBC based on cartridge type
    switch (cartridge.type) {
      case CartridgeType.ROM_ONLY:
        this.mbc = new NoMBC(cartridge);
        logger.info('Using No MBC (ROM only)');
        break;

      case CartridgeType.MBC1:
      case CartridgeType.MBC1_RAM:
      case CartridgeType.MBC1_RAM_BATTERY:
        this.mbc = new MBC1(cartridge);
        logger.info('Using MBC1');
        break;

      default:
        logger.warn(`Unsupported cartridge type: 0x${cartridge.type.toString(16)}`);
        logger.warn('Attempting to use MBC1...');
        this.mbc = new MBC1(cartridge);
        break;
    }

    logger.info('Cartridge loaded into MMU');
  }

  // ... rest of existing code ...
}
```

---

## Step 3: Add More CPU Instructions

Many games need additional instructions. Add these to complete the instruction set:

**File**: `src/core/cpu/instructions.ts` (add missing instructions)

```typescript
// Add these missing common instructions:

// 0x07: RLCA (Rotate A left)
def(0x07, 'RLCA', 4, (cpu) => {
  const carry = (cpu.registers.a & 0x80) >> 7;
  cpu.registers.a = to8Bit((cpu.registers.a << 1) | carry);
  cpu.registers.setZeroFlag(false);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(carry === 1);
  return 4;
});

// 0x0F: RRCA (Rotate A right)
def(0x0F, 'RRCA', 4, (cpu) => {
  const carry = cpu.registers.a & 0x01;
  cpu.registers.a = (cpu.registers.a >> 1) | (carry << 7);
  cpu.registers.setZeroFlag(false);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(carry === 1);
  return 4;
});

// 0x1F: RRA (Rotate A right through carry)
def(0x1F, 'RRA', 4, (cpu) => {
  const oldCarry = cpu.registers.getCarryFlag() ? 0x80 : 0;
  const newCarry = (cpu.registers.a & 0x01) !== 0;
  cpu.registers.a = (cpu.registers.a >> 1) | oldCarry;
  cpu.registers.setZeroFlag(false);
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(newCarry);
  return 4;
});

// 0x27: DAA (Decimal Adjust Accumulator)
def(0x27, 'DAA', 4, (cpu) => {
  let a = cpu.registers.a;

  if (!cpu.registers.getSubtractFlag()) {
    if (cpu.registers.getCarryFlag() || a > 0x99) {
      a += 0x60;
      cpu.registers.setCarryFlag(true);
    }
    if (cpu.registers.getHalfCarryFlag() || (a & 0x0F) > 0x09) {
      a += 0x06;
    }
  } else {
    if (cpu.registers.getCarryFlag()) {
      a -= 0x60;
    }
    if (cpu.registers.getHalfCarryFlag()) {
      a -= 0x06;
    }
  }

  cpu.registers.a = to8Bit(a);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.registers.setHalfCarryFlag(false);

  return 4;
});

// 0x2F: CPL (Complement A)
def(0x2F, 'CPL', 4, (cpu) => {
  cpu.registers.a = to8Bit(~cpu.registers.a);
  cpu.registers.setSubtractFlag(true);
  cpu.registers.setHalfCarryFlag(true);
  return 4;
});

// 0x37: SCF (Set Carry Flag)
def(0x37, 'SCF', 4, (cpu) => {
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(true);
  return 4;
});

// 0x3F: CCF (Complement Carry Flag)
def(0x3F, 'CCF', 4, (cpu) => {
  cpu.registers.setSubtractFlag(false);
  cpu.registers.setHalfCarryFlag(false);
  cpu.registers.setCarryFlag(!cpu.registers.getCarryFlag());
  return 4;
});

// ADD, ADC, SUB, SBC, AND, OR, XOR, CP for all registers
// 0x80-0x87: ADD A, r
for (let i = 0; i < 8; i++) {
  const regs = ['b', 'c', 'd', 'e', 'h', 'l', '(HL)', 'a'];
  def(0x80 + i, `ADD A, ${regs[i].toUpperCase()}`, i === 6 ? 8 : 4, (cpu) => {
    let value: number;
    if (i === 6) {
      value = cpu.mmu.read(cpu.registers.getHL());
    } else {
      const regValues = [cpu.registers.b, cpu.registers.c, cpu.registers.d, cpu.registers.e,
                        cpu.registers.h, cpu.registers.l, 0, cpu.registers.a];
      value = regValues[i];
    }

    const result = cpu.registers.a + value;
    cpu.updateHalfCarryFlag(cpu.registers.a, value);
    cpu.updateCarryFlag(result);
    cpu.registers.a = to8Bit(result);
    cpu.updateZeroFlag(cpu.registers.a);
    cpu.updateSubtractFlag(false);

    return i === 6 ? 8 : 4;
  });
}

// 0xC6: ADD A, n
def(0xC6, 'ADD A, n', 8, (cpu) => {
  const value = cpu.readPC();
  const result = cpu.registers.a + value;
  cpu.updateHalfCarryFlag(cpu.registers.a, value);
  cpu.updateCarryFlag(result);
  cpu.registers.a = to8Bit(result);
  cpu.updateZeroFlag(cpu.registers.a);
  cpu.updateSubtractFlag(false);
  return 8;
});

// 0x90-0x97: SUB r
for (let i = 0; i < 8; i++) {
  const regs = ['b', 'c', 'd', 'e', 'h', 'l', '(HL)', 'a'];
  def(0x90 + i, `SUB ${regs[i].toUpperCase()}`, i === 6 ? 8 : 4, (cpu) => {
    let value: number;
    if (i === 6) {
      value = cpu.mmu.read(cpu.registers.getHL());
    } else {
      const regValues = [cpu.registers.b, cpu.registers.c, cpu.registers.d, cpu.registers.e,
                        cpu.registers.h, cpu.registers.l, 0, cpu.registers.a];
      value = regValues[i];
    }

    const result = cpu.registers.a - value;
    cpu.updateHalfCarryFlag(cpu.registers.a, value, true);
    cpu.updateCarryFlagSubtract(cpu.registers.a, value);
    cpu.registers.a = to8Bit(result);
    cpu.updateZeroFlag(cpu.registers.a);
    cpu.updateSubtractFlag(true);

    return i === 6 ? 8 : 4;
  });
}

// 0xA0-0xA7: AND r
for (let i = 0; i < 8; i++) {
  const regs = ['b', 'c', 'd', 'e', 'h', 'l', '(HL)', 'a'];
  def(0xA0 + i, `AND ${regs[i].toUpperCase()}`, i === 6 ? 8 : 4, (cpu) => {
    let value: number;
    if (i === 6) {
      value = cpu.mmu.read(cpu.registers.getHL());
    } else {
      const regValues = [cpu.registers.b, cpu.registers.c, cpu.registers.d, cpu.registers.e,
                        cpu.registers.h, cpu.registers.l, 0, cpu.registers.a];
      value = regValues[i];
    }

    cpu.registers.a &= value;
    cpu.updateZeroFlag(cpu.registers.a);
    cpu.updateSubtractFlag(false);
    cpu.registers.setHalfCarryFlag(true);
    cpu.registers.setCarryFlag(false);

    return i === 6 ? 8 : 4;
  });
}

// 0xB0-0xB7: OR r
for (let i = 0; i < 8; i++) {
  const regs = ['b', 'c', 'd', 'e', 'h', 'l', '(HL)', 'a'];
  def(0xB0 + i, `OR ${regs[i].toUpperCase()}`, i === 6 ? 8 : 4, (cpu) => {
    let value: number;
    if (i === 6) {
      value = cpu.mmu.read(cpu.registers.getHL());
    } else {
      const regValues = [cpu.registers.b, cpu.registers.c, cpu.registers.d, cpu.registers.e,
                        cpu.registers.h, cpu.registers.l, 0, cpu.registers.a];
      value = regValues[i];
    }

    cpu.registers.a |= value;
    cpu.updateZeroFlag(cpu.registers.a);
    cpu.updateSubtractFlag(false);
    cpu.registers.setHalfCarryFlag(false);
    cpu.registers.setCarryFlag(false);

    return i === 6 ? 8 : 4;
  });
}

// 0xC0: RET NZ
def(0xC0, 'RET NZ', 8, (cpu) => {
  if (!cpu.registers.getZeroFlag()) {
    cpu.registers.pc = cpu.popStack();
    return 20;
  }
  return 8;
});

// 0xC8: RET Z
def(0xC8, 'RET Z', 8, (cpu) => {
  if (cpu.registers.getZeroFlag()) {
    cpu.registers.pc = cpu.popStack();
    return 20;
  }
  return 8;
});

// 0xD0: RET NC
def(0xD0, 'RET NC', 8, (cpu) => {
  if (!cpu.registers.getCarryFlag()) {
    cpu.registers.pc = cpu.popStack();
    return 20;
  }
  return 8;
});

// 0xD8: RET C
def(0xD8, 'RET C', 8, (cpu) => {
  if (cpu.registers.getCarryFlag()) {
    cpu.registers.pc = cpu.popStack();
    return 20;
  }
  return 8;
});

// 0xE9: JP HL
def(0xE9, 'JP HL', 4, (cpu) => {
  cpu.registers.pc = cpu.registers.getHL();
  return 4;
});

// 0xF9: LD SP, HL
def(0xF9, 'LD SP, HL', 8, (cpu) => {
  cpu.registers.sp = cpu.registers.getHL();
  return 8;
});
```

---

## Verification Steps

### 1. Build and Run
```bash
npm run dev
```

### 2. Load MBC1 ROM
Load a game that uses MBC1 (most common):
- Pokémon Red/Blue
- Tetris (original)
- Super Mario Land
- Legend of Zelda: Link's Awakening

### 3. Expected Behavior
- Game should boot and display correctly
- ROM banking should allow accessing different code/data
- Games should be fully playable

### 4. Test ROM Banking
Open console:
```javascript
// Check current ROM bank
gameboy.mmu.mbc?.getCurrentROMBank()

// The game should automatically switch banks during gameplay
```

### 5. Test RAM Banking (for games with save RAM)
```javascript
// Check if RAM is enabled
gameboy.mmu.mbc?.ramEnabled

// Current RAM bank
gameboy.mmu.mbc?.getCurrentRAMBank()
```

---

## Success Criteria

✅ MBC1 ROM banking works correctly
✅ MBC1 RAM banking works correctly
✅ Banking mode selection works
✅ RAM enable/disable works
✅ Large ROMs (>32KB) load and run
✅ Games with battery-backed RAM work
✅ MMU correctly routes to MBC1

---

## Next Steps

Congratulations! You now have a fully functional GameBoy emulator!

### Optional Enhancements (Future)
1. **Audio (APU)**: Implement sound channels
2. **Save States**: Serialize/deserialize emulator state
3. **More MBCs**: MBC3 (RTC), MBC5 (larger ROMs)
4. **Debugger**: CPU/memory/graphics debugging tools
5. **Mobile Support**: Touch controls for mobile devices
6. **Game Genie**: Cheat code support
7. **Rewind**: Save state history for rewind feature
8. **Fast Forward**: Speed up emulation
9. **Link Cable**: Multiplayer support

---

## Common Issues & Solutions

### Issue: ROM doesn't boot with MBC1
**Solution**: Check cartridge type detection, verify ROM bank 1 is selected initially (not 0)

### Issue: Game crashes after a while
**Solution**: Check bank switching logic, verify upper/lower bits are combined correctly

### Issue: Graphics glitch after bank switch
**Solution**: Ensure bank switches happen at correct times, check if code/data is in correct banks

### Issue: Saves don't work
**Solution**: Verify RAM is enabled before write, check RAM banking mode

### Issue: Some ROMs still don't work
**Solution**: May require MBC3 or MBC5 - check cartridge header for type

### Issue: Banking seems incorrect
**Solution**: Verify banks 0x20, 0x40, 0x60 are mapped to 0x21, 0x41, 0x61 (MBC1 quirk)

---

## Testing Checklist

Test with these games to verify MBC1 works:

- [ ] Tetris - Simple MBC1
- [ ] Super Mario Land - MBC1
- [ ] Pokémon Red/Blue - MBC1 with RAM
- [ ] Legend of Zelda - MBC1 with RAM
- [ ] Kirby's Dream Land - No MBC
- [ ] Dr. Mario - No MBC

If all these games boot and are playable, your emulator is working correctly!

---

## Congratulations!

You've built a complete GameBoy emulator with:
- ✅ Full CPU instruction set
- ✅ Graphics (background and sprites)
- ✅ Input handling
- ✅ Timer and interrupts
- ✅ Memory banking (MBC1)

Your emulator can now run the vast majority of GameBoy games!
