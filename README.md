# 🎮 GameBoy Emulator

A fully functional GameBoy (DMG) emulator written in TypeScript that runs in the browser. Play classic GameBoy games directly in your web browser with accurate emulation of the original hardware.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg)

## ✨ Features

- **Full CPU Emulation**: Sharp LR35902 CPU with complete instruction set (256 unprefixed + 256 CB-prefixed opcodes)
- **Graphics**: Background and sprite rendering with accurate PPU timing
- **Input**: Keyboard controls mapped to GameBoy buttons
- **Timer**: Accurate timer and interrupt handling
- **Memory Banking**: MBC1 support for games with ROM banking
- **Performance**: Runs at 60 FPS with cycle-accurate emulation
- **Web-Based**: No installation needed - runs directly in your browser

## 🎯 Compatibility

The emulator currently supports:
- ✅ ROM-only cartridges (32KB)
- ✅ MBC1 cartridges (with ROM banking)
- 🚧 Additional MBC types coming soon

### Tested Games

| Game | Status | Notes |
|------|--------|-------|
| Tetris | ✅ Tested | ROM-only cartridge |

> **Note**: This emulator is actively under development. More games will be tested and compatibility will improve over time.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/gbemu.git
cd gbemu

# Install dependencies
npm install

# Start development server
npm run dev
```

The emulator will open in your browser at `http://localhost:5173` (default Vite port)

### Loading a ROM

1. Click the **"Load ROM"** button
2. Select a `.gb` file from your computer
3. The game will start automatically
4. Use keyboard controls to play

## 🎮 Controls

| GameBoy Button | Keyboard Key |
|----------------|--------------|
| D-Pad Up | ↑ Arrow Up |
| D-Pad Down | ↓ Arrow Down |
| D-Pad Left | ← Arrow Left |
| D-Pad Right | → Arrow Right |
| A Button | Z |
| B Button | X |
| Start | Enter |
| Select | Shift |

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│         Browser / UI Layer          │
│  - Canvas Rendering                 │
│  - Keyboard Input                   │
│  - ROM Loading                      │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│        GameBoy Orchestrator         │
│  - Frame Execution                  │
│  - Component Coordination           │
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

### Core Components

- **CPU**: Sharp LR35902 (Z80-like) processor emulation
- **PPU**: Picture Processing Unit for graphics rendering
- **MMU**: Memory Management Unit with banking support
- **Timer**: Configurable timer with interrupts
- **Joypad**: Input handling and P1 register emulation

## 📁 Project Structure

```
gbemu/
├── src/
│   ├── core/
│   │   ├── cpu/              # CPU emulation
│   │   │   ├── CPU.ts        # Main CPU class
│   │   │   ├── registers.ts  # Register management
│   │   │   ├── instructions.ts    # Opcode implementations
│   │   │   └── cbInstructions.ts  # CB-prefixed opcodes
│   │   ├── memory/           # Memory system
│   │   │   ├── MMU.ts        # Memory Management Unit
│   │   │   ├── cartridge.ts  # ROM loading
│   │   │   └── mbcs/         # Memory Bank Controllers
│   │   │       ├── NoMBC.ts  # ROM-only
│   │   │       └── MBC1.ts   # MBC1 banking
│   │   ├── ppu/              # Graphics
│   │   │   ├── PPU.ts        # Picture Processing Unit
│   │   │   ├── Renderer.ts   # Canvas rendering
│   │   │   └── constants.ts  # PPU constants
│   │   ├── timer/            # Timer system
│   │   │   └── Timer.ts
│   │   └── input/            # Input handling
│   │       └── Joypad.ts
│   ├── emulator/
│   │   └── GameBoy.ts        # Main orchestrator
│   ├── ui/                   # User interface
│   │   ├── interface.ts      # UI controls
│   │   ├── display.ts        # Display management
│   │   └── InputManager.ts   # Keyboard handling
│   ├── utils/                # Utilities
│   │   ├── bits.ts           # Bit manipulation
│   │   └── logger.ts         # Logging
│   └── main.ts               # Entry point
├── public/
│   └── index.html            # HTML shell
├── spec/                     # Implementation specs
│   ├── README.md             # Spec documentation
│   └── phase-*.md            # Phase-by-phase guides
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md                 # This file
```

## 🛠️ Development

### Available Scripts

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Lint code
npm run lint
```

### Building from Scratch

Want to build your own emulator? Check out the [implementation specifications](./spec/README.md) for a complete phase-by-phase guide with code samples.

The implementation is divided into 9 phases:
1. Project Setup
2. Memory Foundation
3. CPU Core
4. Basic PPU (Graphics)
5. Main Emulator Loop
6. Timer & Interrupts
7. Input Handling
8. Sprite Rendering
9. MBC1 Banking

Each phase includes complete code samples, verification steps, and troubleshooting guides.

## 🧪 Testing

### Test ROMs

The emulator is being tested with:
- ✅ **Tetris**: Fully playable
- 🚧 **Blargg's CPU Tests**: In progress
- 🚧 **Additional Test ROMs**: Coming soon

### Running Tests

```bash
# Run unit tests
npm test

# Run tests with UI
npm run test:ui
```

## 📊 Performance

- **Target**: 60 FPS (59.73 Hz actual GameBoy frequency)
- **Frame Budget**: ~16.7ms per frame
- **Cycles per Frame**: 70,224 CPU cycles
- **Typical Performance**: Steady 60 FPS on modern browsers

### Optimization Features

- TypedArrays for memory (Uint8Array, Uint8ClampedArray)
- Opcode lookup tables for fast instruction dispatch
- Single frame buffer update per render
- Efficient canvas rendering with ImageData

## 🔧 Technical Details

### Emulated Hardware

- **CPU**: Sharp LR35902 @ 4.194304 MHz
- **Display**: 160x144 pixels, 4 shades of gray
- **Color Palette**: DMG green tint
- **RAM**: 8KB work RAM
- **VRAM**: 8KB video RAM
- **Sprites**: 40 sprites, 10 per scanline
- **Sound**: Not implemented (future enhancement)

### Memory Map

```
0x0000-0x3FFF: ROM Bank 0 (16KB, fixed)
0x4000-0x7FFF: ROM Bank 1-N (16KB, switchable)
0x8000-0x9FFF: VRAM (8KB)
0xA000-0xBFFF: External RAM (8KB, switchable)
0xC000-0xDFFF: Work RAM (8KB)
0xE000-0xFDFF: Echo RAM
0xFE00-0xFE9F: OAM (Sprite attributes)
0xFF00-0xFF7F: I/O Registers
0xFF80-0xFFFE: High RAM
0xFFFF: Interrupt Enable
```

## 🐛 Known Issues

- MBC2/MBC3/MBC5 not yet implemented
- No audio emulation (APU not implemented)
- Save states not implemented
- External RAM (cartridge saves) not persisted
- Some edge cases in PPU timing may need refinement

## 🚧 Roadmap

- [ ] Audio (APU) emulation
- [ ] Save states
- [ ] MBC3 support (with RTC)
- [ ] MBC5 support
- [ ] Game Boy Color support
- [ ] Debugger UI
- [ ] Mobile touch controls
- [ ] Rewind feature
- [ ] Fast forward
- [ ] Link cable emulation

## 📚 Resources

### Documentation
- [Pan Docs](https://gbdev.io/pandocs/) - Comprehensive GameBoy documentation
- [Opcode Reference](https://gbdev.io/gb-opcodes/) - CPU instruction reference
- [CPU Manual](http://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf) - Original CPU documentation

### Community
- [r/EmuDev](https://reddit.com/r/EmuDev) - Emulation development community
- [gbdev.io](https://gbdev.io/) - GameBoy development resources

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

1. Follow existing code style
2. Add tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting PR

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Legal Notice

This emulator is for educational purposes only. You must own the physical cartridge of any ROM you use with this emulator. Downloading copyrighted ROMs you don't own is illegal.

## 🙏 Acknowledgments

- **gbdev Community**: For comprehensive documentation and support
- **Blargg**: For excellent test ROMs
- **Pan Docs Contributors**: For detailed GameBoy specifications
- **Reference Emulators**: BGB, SameBoy, Gambatte for accuracy validation

## 📬 Contact

For questions, issues, or suggestions:
- Open an issue on GitHub
- Join the [gbdev Discord](https://gbdev.io/chat.html)

---

Built with ❤️ and TypeScript. Happy emulating! 🎮
