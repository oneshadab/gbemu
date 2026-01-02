# GameBoy Emulator Implementation Plan

## Project Overview
Build a TypeScript-based GameBoy (DMG) emulator that runs in the browser, focused on getting a quick playable prototype working.

**Target**: Original GameBoy (DMG) emulation
**Technology**: TypeScript + Vite
**Goal**: Core features first - get basic games (Tetris) playable quickly
**Scope**: v1.0 excludes audio, save states, debugger, mobile support

---

## Project Structure

```
src/
├── core/
│   ├── cpu/
│   │   ├── CPU.ts              # Main CPU class with fetch-decode-execute
│   │   ├── instructions.ts     # All 512 instruction implementations
│   │   ├── opcodes.ts          # Opcode lookup table
│   │   └── registers.ts        # Register management (A,B,C,D,E,F,H,L,SP,PC)
│   ├── memory/
│   │   ├── MMU.ts              # Memory Management Unit (routing)
│   │   ├── cartridge.ts        # ROM loading and header parsing
│   │   └── mbcs/
│   │       ├── MBC1.ts         # MBC1 banking controller
│   │       └── NoMBC.ts        # Simple ROM-only (32KB games)
│   ├── ppu/
│   │   ├── PPU.ts              # Picture Processing Unit (graphics)
│   │   ├── Renderer.ts         # Canvas rendering
│   │   └── constants.ts        # PPU timing constants
│   ├── timer/
│   │   └── Timer.ts            # Timer, DIV register, interrupts
│   └── input/
│       └── Joypad.ts           # Keyboard input handling
├── emulator/
│   └── GameBoy.ts              # Main orchestrator
├── ui/
│   ├── interface.ts            # ROM loading, controls
│   └── display.ts              # Canvas setup and display
├── utils/
│   ├── bits.ts                 # Bit manipulation helpers
│   └── logger.ts               # Debug logging
└── main.ts                     # Browser entry point

public/
└── index.html                  # HTML shell
```

---

## Implementation Order (Critical Path)

### Phase 1: Project Setup
**Files to create:**
- `package.json` - Dependencies: TypeScript, Vite, Vitest
- `tsconfig.json` - Target ES2020, strict mode
- `vite.config.ts` - Simple dev server config
- `public/index.html` - Basic HTML with canvas element

**Dependencies:**
```json
{
  "typescript": "^5.0.0",
  "vite": "^5.0.0",
  "vitest": "^1.0.0"
}
```

### Phase 2: Memory Foundation
**Critical file: `src/core/memory/MMU.ts`**

Implement memory map (0x0000-0xFFFF):
- 0x0000-0x7FFF: ROM (cartridge)
- 0x8000-0x9FFF: VRAM (PPU)
- 0xA000-0xBFFF: External RAM
- 0xC000-0xDFFF: Work RAM
- 0xFE00-0xFE9F: OAM (sprite data)
- 0xFF00-0xFF7F: I/O registers
- 0xFF80-0xFFFE: HRAM
- 0xFFFF: Interrupt Enable

**Also create:**
- `src/core/memory/cartridge.ts` - ROM loading from Uint8Array
- `src/core/memory/mbcs/NoMBC.ts` - Simple ROM reading (no banking)

### Phase 3: CPU Core
**Critical files:**
1. `src/core/cpu/registers.ts` - Register state management
2. `src/core/cpu/CPU.ts` - Fetch-decode-execute loop
3. `src/core/cpu/opcodes.ts` - Opcode lookup table (512 entries)
4. `src/core/cpu/instructions.ts` - Instruction implementations

**Implementation strategy:**
- Start with ~30 most common opcodes (covers 80% of usage):
  - Loads: LD r,r / LD r,n / LD r,(HL) / LD (HL),r
  - ALU: ADD, SUB, AND, OR, XOR, CP, INC, DEC
  - Jumps: JP, JR, CALL, RET (conditional/unconditional)
  - Stack: PUSH, POP
  - NOP, HALT, DI, EI
- Use lookup table (not giant switch statement)
- Each instruction returns cycle count
- Log unimplemented opcodes for incremental development

**CPU.step() pseudo-code:**
```typescript
step(): number {
  if (halted) return 4;
  handleInterrupts();
  const opcode = mmu.read(pc++);
  const cycles = instructions[opcode](this);
  return cycles;
}
```

### Phase 4: Basic PPU (Graphics)
**Critical file: `src/core/ppu/PPU.ts`**

Implement LCD mode state machine:
- Mode 2 (OAM scan): 80 cycles
- Mode 3 (Drawing): 172 cycles
- Mode 0 (HBlank): 204 cycles
- Mode 1 (VBlank): 4560 cycles (10 scanlines)

**Initial rendering (background only):**
- 160x144 pixel display
- Read tile map from VRAM (0x9800-0x9BFF)
- Fetch tile data (0x8000-0x97FF)
- Apply scroll registers (SCX, SCY)
- Render to Uint8Array framebuffer

**Skip sprites initially** - many games work without them

**Also create:**
- `src/core/ppu/Renderer.ts` - Canvas rendering
- `src/core/ppu/constants.ts` - Screen dimensions, timing

### Phase 5: Main Emulator Loop
**Critical files:**
1. `src/emulator/GameBoy.ts` - Orchestrator
2. `src/ui/display.ts` - Canvas setup
3. `src/main.ts` - Browser integration

**GameBoy class structure:**
```typescript
class GameBoy {
  cpu: CPU;
  mmu: MMU;
  ppu: PPU;
  timer: Timer;
  joypad: Joypad;

  loadROM(data: Uint8Array): void;
  reset(): void;
  frame(): void; // Run one frame (~70224 cycles)
}
```

**Main loop (requestAnimationFrame at 60 FPS):**
```typescript
function mainLoop() {
  gameboy.frame();
  renderer.drawFrame(gameboy.ppu.framebuffer);
  requestAnimationFrame(mainLoop);
}
```

### Phase 6: Timer & Interrupts
**Critical file: `src/core/timer/Timer.ts`**

Implement:
- DIV register (increments at 16384 Hz)
- TIMA/TMA/TAC registers
- Timer interrupt (INT 0x50)
- VBlank interrupt from PPU (INT 0x40)

Update CPU to handle interrupt requests.

### Phase 7: Input Handling
**Critical file: `src/core/input/Joypad.ts`**

Implement:
- P1 register (0xFF00)
- Button states: Up, Down, Left, Right, A, B, Start, Select
- Keyboard mapping (arrows + Z/X/Enter/Shift)
- Joypad interrupt (INT 0x60)

### Phase 8: Sprite Rendering
**Extend `src/core/ppu/PPU.ts`**

Add sprite support:
- Read OAM (40 sprites, 4 bytes each)
- 10 sprites per scanline limit
- 8x8 and 8x16 modes
- Priority handling
- Horizontal flip

### Phase 9: MBC1 Banking
**Critical file: `src/core/memory/mbcs/MBC1.ts`**

Implement ROM/RAM banking:
- ROM banking (up to 2MB, 125 banks)
- External RAM banking (up to 32KB)
- Banking mode selection
- RAM enable register

This unlocks ~90% of GameBoy game library.

---

## Key Architecture Decisions

### Component Communication
- **CPU drives timing** - all components stepped with CPU cycles
- **Event-based interrupts** - PPU/Timer raise interrupt flags
- **Memory-mapped I/O** - MMU routes to appropriate component

### Performance Optimizations
1. **Use TypedArrays** - Uint8Array for memory, Uint32Array for framebuffer
2. **Opcode lookup table** - Pre-computed array of function pointers
3. **Batch rendering** - Only update canvas at frame end
4. **Avoid allocations** - Pre-allocate all arrays

### Testing Strategy
1. **Unit tests** - Individual CPU instructions
2. **Test ROMs** - Blargg's cpu_instrs.gb, dmg-acid2.gb
3. **Real games** - Tetris, Dr. Mario for validation

---

## Critical Files (Implementation Priority)

1. **`src/core/memory/MMU.ts`** - Foundation for all memory access
2. **`src/core/cpu/CPU.ts`** - Heart of emulator, drives all components
3. **`src/core/cpu/instructions.ts`** - All 512 opcodes (most time-consuming)
4. **`src/core/ppu/PPU.ts`** - Graphics rendering and LCD timing
5. **`src/emulator/GameBoy.ts`** - Orchestrates everything
6. **`src/main.ts`** - Browser integration entry point

---

## Development Milestones

### Milestone 1: CPU Executes Code
- CPU can run basic programs
- Memory reads/writes work
- ~30 common opcodes implemented

### Milestone 2: Something on Screen
- PPU renders background
- Canvas displays pixels
- Main loop running at 60 FPS

### Milestone 3: Interactive
- Input handling works
- Timer and interrupts functional
- Can interact with ROM

### Milestone 4: Tetris Playable
- Sprites rendering
- Full CPU instruction set
- Complete gameplay loop

### Milestone 5: Library Support
- MBC1 banking working
- Larger games boot and play
- v1.0 complete!

---

## Implementation Notes

### Memory Map Details
```
ROM Bank 0:  0x0000-0x3FFF (16KB, fixed)
ROM Bank N:  0x4000-0x7FFF (16KB, switchable via MBC)
VRAM:        0x8000-0x9FFF (8KB)
Ext RAM:     0xA000-0xBFFF (8KB, switchable)
Work RAM:    0xC000-0xDFFF (8KB)
Echo RAM:    0xE000-0xFDFF (mirror of C000-DDFF)
OAM:         0xFE00-0xFE9F (160 bytes, 40 sprites)
I/O:         0xFF00-0xFF7F (128 bytes)
HRAM:        0xFF80-0xFFFE (127 bytes)
IE:          0xFFFF (1 byte)
```

### CPU Instruction Groups
- **8-bit loads**: LD r,r / LD r,n / LD r,(HL) / LD (HL),r
- **16-bit loads**: LD rr,nn / LD SP,HL / PUSH/POP
- **ALU**: ADD, ADC, SUB, SBC, AND, OR, XOR, CP
- **Inc/Dec**: INC r / DEC r / INC rr / DEC rr
- **Jumps**: JP / JR / CALL / RET / RST
- **Bit operations** (CB prefix): BIT, SET, RES, RL, RR, SLA, SRA
- **Misc**: NOP, HALT, STOP, DI, EI, DAA, CPL, CCF, SCF

### PPU Timing
- **Scanline**: 456 cycles total
  - OAM scan (mode 2): 80 cycles
  - Drawing (mode 3): 172 cycles
  - HBlank (mode 0): 204 cycles
- **Frame**: 154 scanlines (144 visible + 10 VBlank)
- **VBlank**: Lines 144-153 (mode 1)
- **Total frame**: 70224 cycles (~59.73 Hz)

### Interrupts (Priority Order)
1. VBlank (0x40) - Raised after line 144
2. LCD STAT (0x48) - Various LCD conditions
3. Timer (0x50) - TIMA overflow
4. Serial (0x58) - Transfer complete (not needed for v1)
5. Joypad (0x60) - Button press

---

## Resources

**Essential Documentation:**
- Pan Docs: https://gbdev.io/pandocs/
- Opcode reference: https://gbdev.io/gb-opcodes/
- CPU manual: http://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf

**Test ROMs:**
- Blargg's test suite: cpu_instrs.gb, instr_timing.gb
- dmg-acid2.gb: PPU visual test
- Simple games: Tetris, Dr. Mario

---

## Next Steps After Plan Approval

1. Set up project structure (package.json, tsconfig, vite config)
2. Create HTML shell and build system
3. Implement MMU and cartridge loading
4. Build CPU with basic instructions
5. Add PPU background rendering
6. Wire up main loop and display
7. Incrementally add remaining features
8. Test with ROMs and debug

**Estimated effort:** Core playable emulator achievable in focused development sessions, with Tetris playable after implementing all core components.
