# GameBoy Emulator - Implementation Specifications

This directory contains detailed phase-by-phase implementation specifications for building a complete GameBoy (DMG) emulator in TypeScript that runs in the browser.

## Overview

The implementation is divided into 9 phases, each building on the previous one. Each phase includes:
- Complete code samples ready to copy and paste
- Step-by-step instructions
- Verification procedures
- Success criteria
- Troubleshooting guide

## Phase Index

### [Phase 1: Project Setup](./phase-1-project-setup.md)
**Goal**: Set up TypeScript project with Vite, HTML interface, and build system

**Key Files**:
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Build configuration
- `public/index.html` - UI shell
- `src/main.ts` - Entry point

**Estimated Time**: 30 minutes

---

### [Phase 2: Memory Foundation](./phase-2-memory-foundation.md)
**Goal**: Implement MMU, cartridge loading, and memory map

**Key Files**:
- `src/core/memory/MMU.ts` - Memory Management Unit
- `src/core/memory/cartridge.ts` - ROM loading and header parsing
- `src/core/memory/mbcs/NoMBC.ts` - Simple ROM-only support
- `src/utils/bits.ts` - Bit manipulation helpers
- `src/utils/logger.ts` - Logging utility

**Estimated Time**: 1-2 hours

---

### [Phase 3: CPU Core](./phase-3-cpu-core.md)
**Goal**: Implement CPU with registers, flags, and instruction execution

**Key Files**:
- `src/core/cpu/registers.ts` - CPU registers (A, B, C, D, E, F, H, L, SP, PC)
- `src/core/cpu/CPU.ts` - Fetch-decode-execute loop
- `src/core/cpu/types.ts` - Instruction types
- `src/core/cpu/instructions.ts` - ~50 most common opcodes
- `src/core/cpu/cbInstructions.ts` - CB-prefixed instructions (stubs)

**Estimated Time**: 3-4 hours

---

### [Phase 4: Basic PPU (Graphics)](./phase-4-basic-ppu.md)
**Goal**: Implement graphics rendering with background support

**Key Files**:
- `src/core/ppu/constants.ts` - PPU constants and timing
- `src/core/ppu/PPU.ts` - Picture Processing Unit
- `src/core/ppu/Renderer.ts` - Canvas rendering

**Key Features**:
- LCD mode state machine (modes 0-3)
- Background rendering
- Scroll registers (SCX, SCY)
- VBlank interrupt

**Estimated Time**: 3-4 hours

---

### [Phase 5: Main Emulator Loop](./phase-5-main-emulator-loop.md)
**Goal**: Create orchestrator class and polish the emulation loop

**Key Files**:
- `src/emulator/GameBoy.ts` - Main orchestrator
- `src/ui/interface.ts` - UI controller
- `src/ui/display.ts` - Display manager
- `src/main.ts` - Updated entry point

**Key Features**:
- Frame-based execution
- FPS counter
- Reset/pause functionality
- Clean separation of concerns

**Estimated Time**: 2 hours

---

### [Phase 6: Timer & Interrupts](./phase-6-timer-interrupts.md)
**Goal**: Implement timer system and complete interrupt handling

**Key Files**:
- `src/core/timer/Timer.ts` - DIV, TIMA, TMA, TAC registers
- Updated `src/core/cpu/CPU.ts` - Complete interrupt handling
- Updated `src/emulator/GameBoy.ts` - Integrate timer

**Key Features**:
- DIV register (16384 Hz)
- Configurable TIMA timer
- Timer interrupts
- Complete interrupt priority handling

**Estimated Time**: 1-2 hours

---

### [Phase 7: Input Handling](./phase-7-input-handling.md)
**Goal**: Implement joypad support with keyboard controls

**Key Files**:
- `src/core/input/Joypad.ts` - P1 register and button handling
- `src/ui/input.ts` - Keyboard input manager
- Updated `src/emulator/GameBoy.ts` - Integrate joypad

**Key Features**:
- P1 register (0xFF00)
- Keyboard mapping (arrows, Z, X, Enter, Shift)
- Joypad interrupts
- Button press/release events

**Estimated Time**: 1-2 hours

---

### [Phase 8: Sprite Rendering](./phase-8-sprite-rendering.md)
**Goal**: Add sprite (OBJ) rendering to PPU

**Key Files**:
- `src/core/ppu/types.ts` - Sprite data structures
- Updated `src/core/ppu/PPU.ts` - Sprite rendering
- Updated `src/core/cpu/cbInstructions.ts` - Complete CB instructions

**Key Features**:
- 8x8 and 8x16 sprite modes
- 10 sprites per scanline limit
- Sprite priority and palettes
- Horizontal/vertical flipping
- Complete CB instruction set (BIT, SET, RES, rotates, shifts)

**Estimated Time**: 2-3 hours

---

### [Phase 9: MBC1 Banking](./phase-9-mbc1-banking.md)
**Goal**: Implement MBC1 for larger ROM support

**Key Files**:
- `src/core/memory/mbcs/MBC1.ts` - MBC1 implementation
- Updated `src/core/memory/MMU.ts` - MBC routing
- Updated `src/core/cpu/instructions.ts` - Additional opcodes

**Key Features**:
- ROM banking (up to 2MB)
- RAM banking (up to 32KB)
- Banking mode selection
- RAM enable register
- Additional CPU instructions for compatibility

**Estimated Time**: 2-3 hours

---

## Implementation Order

**Recommended sequence**:
1. ✅ Phase 1: Project Setup
2. ✅ Phase 2: Memory Foundation
3. ✅ Phase 3: CPU Core
4. ✅ Phase 4: Basic PPU
5. ✅ Phase 5: Main Emulator Loop
6. ✅ Phase 6: Timer & Interrupts
7. ✅ Phase 7: Input Handling
8. ✅ Phase 8: Sprite Rendering
9. ✅ Phase 9: MBC1 Banking

**Total Estimated Time**: 18-24 hours of focused development

---

## Milestones

### Milestone 1: "CPU Executes" (After Phase 3)
- CPU can run basic programs
- Memory reads/writes work
- First instructions executing

### Milestone 2: "Something on Screen" (After Phase 4)
- Background graphics render
- Visual feedback working
- Main loop at 60 FPS

### Milestone 3: "Interactive" (After Phase 7)
- Keyboard input works
- Can interact with ROMs
- Timer and interrupts functional

### Milestone 4: "Tetris Playable" (After Phase 8)
- Sprites rendering
- Games fully playable
- Most features complete

### Milestone 5: "Library Support" (After Phase 9)
- MBC1 banking works
- Can run 90% of GameBoy library
- Full emulator complete!

---

## Testing ROMs

### Phase-by-Phase Testing

**After Phase 4** (PPU):
- dmg-acid2.gb - Visual rendering test
- Simple homebrew ROMs

**After Phase 7** (Input):
- Tetris - Simple but complete game
- Dr. Mario - Tests sprites and input

**After Phase 9** (MBC1):
- Super Mario Land - MBC1 game
- Pokémon Red/Blue - MBC1 with RAM
- Legend of Zelda - Large MBC1 game

### Test ROM Sources

**Blargg's Test Suite**:
- cpu_instrs.gb - CPU instruction tests
- instr_timing.gb - Instruction timing tests
- mem_timing.gb - Memory timing tests

**Visual Tests**:
- dmg-acid2.gb - PPU rendering accuracy

**Where to Get Test ROMs**:
- https://github.com/retrio/gb-test-roms
- https://gbdev.gg8.se/files/roms/blargg-gb-tests/

---

## Development Tips

### Best Practices

1. **Test Early, Test Often**
   - Verify each phase before moving to the next
   - Use console logging extensively
   - Check registers and memory state

2. **Read Specifications**
   - Reference Pan Docs: https://gbdev.io/pandocs/
   - Opcode reference: https://gbdev.io/gb-opcodes/
   - CPU manual: http://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf

3. **Incremental Implementation**
   - Implement ~30 common opcodes first
   - Add more as needed when games fail
   - Use test ROMs to identify missing instructions

4. **Debugging Strategy**
   - Log PC, opcode, and registers for each instruction
   - Compare traces against known-good emulators
   - Use browser devtools for performance profiling

5. **Performance**
   - Use TypedArrays (Uint8Array, Uint8ClampedArray)
   - Avoid allocations in hot loops
   - Batch rendering (once per frame)
   - Pre-compute lookup tables

### Common Pitfalls

❌ **Don't**:
- Implement all 512 opcodes at once (do incrementally)
- Skip reading the specs (they're essential)
- Ignore timing (cycle counts matter)
- Forget to handle edge cases (bank 0, overflow, etc.)

✅ **Do**:
- Start with basic opcodes, add more as needed
- Reference Pan Docs frequently
- Track cycles accurately
- Test with real ROMs constantly

---

## Architecture Overview

```
┌─────────────────────────────────────┐
│         Browser / UI Layer          │
│  - Canvas Rendering                 │
│  - Input Handling                   │
│  - UI Controls                      │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│        GameBoy Orchestrator         │
│  - Frame execution                  │
│  - Component coordination           │
│  - Lifecycle management             │
└──┬──────┬──────┬──────┬─────────────┘
   │      │      │      │
   ▼      ▼      ▼      ▼
 ┌───┐ ┌───┐ ┌───┐ ┌──────┐
 │CPU│ │PPU│ │TMR│ │JOYPAD│
 └─┬─┘ └─┬─┘ └─┬─┘ └───┬──┘
   │     │     │        │
   └─────┴─────┴────────┴───────┐
                                 ▼
                          ┌────────────┐
                          │    MMU     │
                          │  (Memory)  │
                          └──────┬─────┘
                                 │
                  ┌──────────────┼──────────────┐
                  ▼              ▼              ▼
              ┌──────┐      ┌──────┐      ┌──────┐
              │ ROM  │      │ RAM  │      │ I/O  │
              │(MBC) │      │      │      │      │
              └──────┘      └──────┘      └──────┘
```

---

## Resources

### Essential Documentation
- **Pan Docs**: https://gbdev.io/pandocs/ (comprehensive GameBoy specs)
- **Opcode Table**: https://gbdev.io/gb-opcodes/ (instruction reference)
- **CPU Manual**: http://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf
- **gbdev.io**: https://gbdev.io/ (community hub)

### Community
- **r/EmuDev**: https://reddit.com/r/EmuDev
- **gbdev Discord**: https://gbdev.io/chat.html

### Reference Emulators
- **BGB**: High accuracy, great debugger (Windows)
- **SameBoy**: Cycle-accurate, open source
- **Gambatte**: Well-documented, accurate

---

## File Structure Summary

After completing all phases, your project will have this structure:

```
gbemu/
├── spec/                          # This directory
│   ├── README.md                  # This file
│   ├── implementation-plan.md     # High-level overview
│   ├── phase-1-project-setup.md
│   ├── phase-2-memory-foundation.md
│   ├── phase-3-cpu-core.md
│   ├── phase-4-basic-ppu.md
│   ├── phase-5-main-emulator-loop.md
│   ├── phase-6-timer-interrupts.md
│   ├── phase-7-input-handling.md
│   ├── phase-8-sprite-rendering.md
│   └── phase-9-mbc1-banking.md
├── src/
│   ├── core/
│   │   ├── cpu/
│   │   │   ├── CPU.ts
│   │   │   ├── registers.ts
│   │   │   ├── types.ts
│   │   │   ├── instructions.ts
│   │   │   └── cbInstructions.ts
│   │   ├── memory/
│   │   │   ├── MMU.ts
│   │   │   ├── cartridge.ts
│   │   │   └── mbcs/
│   │   │       ├── NoMBC.ts
│   │   │       └── MBC1.ts
│   │   ├── ppu/
│   │   │   ├── PPU.ts
│   │   │   ├── Renderer.ts
│   │   │   ├── constants.ts
│   │   │   └── types.ts
│   │   ├── timer/
│   │   │   └── Timer.ts
│   │   └── input/
│   │       └── Joypad.ts
│   ├── emulator/
│   │   └── GameBoy.ts
│   ├── ui/
│   │   ├── interface.ts
│   │   ├── display.ts
│   │   └── input.ts
│   ├── utils/
│   │   ├── bits.ts
│   │   └── logger.ts
│   └── main.ts
├── public/
│   └── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .gitignore
```

**Total Files**: ~25 TypeScript files + config files

---

## Success Criteria

Your emulator is complete when:

- ✅ Tetris is fully playable
- ✅ Super Mario Land runs correctly
- ✅ Pokémon Red/Blue boots and plays
- ✅ dmg-acid2 test passes
- ✅ FPS stays at ~60
- ✅ Input is responsive
- ✅ Graphics render correctly

---

## What's Next?

After completing all 9 phases, you'll have a fully functional GameBoy emulator!

**Optional enhancements** you could add:
1. Audio (APU) - Sound channels 1-4
2. Save states - Serialize/deserialize state
3. More MBCs - MBC3 (RTC), MBC5 (larger games)
4. Debugger - CPU/memory viewer
5. Game Boy Color support
6. Mobile touch controls
7. Rewind feature
8. Fast forward
9. Link cable emulation

---

## Getting Help

If you get stuck:

1. **Check the troubleshooting section** in each phase spec
2. **Compare your code** with the samples in the specs
3. **Use test ROMs** to identify specific issues
4. **Enable debug logging** to see what's happening
5. **Ask in r/EmuDev** or gbdev Discord

---

## Credits

This specification guide was created to help developers learn emulation by building a complete GameBoy emulator from scratch.

Happy emulating! 🎮
