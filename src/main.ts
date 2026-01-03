import { GameBoy } from '@/emulator/GameBoy';
import { DisplayManager } from '@/ui/display';
import { UIController } from '@/ui/interface';
import { logger, LogLevel } from '@/utils/logger';

// Configure logging
logger.setLevel(LogLevel.INFO);

console.log('🎮 GameBoy Emulator Starting...');

// Initialize display
const displayManager = new DisplayManager('display', 3);
const renderer = displayManager.getRenderer();

// Initialize emulator
const gameboy = new GameBoy();

// Initialize UI controller
const ui = new UIController(gameboy, renderer);

console.log('✅ Emulator ready');

// Expose for debugging
(window as any).gameboy = gameboy;
(window as any).logger = logger;
(window as any).ui = ui;

// Debug helper
(window as any).debug = {
  getCPUState: () => {
    return {
      pc: '0x' + gameboy.cpu.registers.pc.toString(16).padStart(4, '0'),
      sp: '0x' + gameboy.cpu.registers.sp.toString(16).padStart(4, '0'),
      a: '0x' + gameboy.cpu.registers.a.toString(16).padStart(2, '0'),
      bc: '0x' + gameboy.cpu.registers.getBC().toString(16).padStart(4, '0'),
      de: '0x' + gameboy.cpu.registers.getDE().toString(16).padStart(4, '0'),
      hl: '0x' + gameboy.cpu.registers.getHL().toString(16).padStart(4, '0'),
      flags: {
        z: gameboy.cpu.registers.getZeroFlag(),
        n: gameboy.cpu.registers.getSubtractFlag(),
        h: gameboy.cpu.registers.getHalfCarryFlag(),
        c: gameboy.cpu.registers.getCarryFlag(),
      },
      halted: gameboy.cpu.halted,
      ime: gameboy.cpu.ime,
    };
  },
  readMem: (addr: number) => {
    const value = gameboy.mmu.read(addr);
    console.log(`Read [0x${addr.toString(16).padStart(4, '0')}] = 0x${value.toString(16).padStart(2, '0')}`);
    return value;
  },
  stepCPU: (count: number = 1) => {
    for (let i = 0; i < count; i++) {
      const cycles = gameboy.cpu.step();
      console.log(`Step ${i + 1}: ${cycles} cycles, PC now at 0x${gameboy.cpu.registers.pc.toString(16).padStart(4, '0')}`);
    }
    return (window as any).debug.getCPUState();
  },
  getLCDC: () => {
    const lcdc = gameboy.mmu.getIO(0x40);
    return {
      value: '0x' + lcdc.toString(16).padStart(2, '0'),
      binary: lcdc.toString(2).padStart(8, '0'),
      lcdEnabled: !!(lcdc & 0x80),
      bgEnabled: !!(lcdc & 0x01),
      objEnabled: !!(lcdc & 0x02),
      windowEnabled: !!(lcdc & 0x20),
      bgTileMap: (lcdc & 0x08) ? '0x9C00' : '0x9800',
      bgTileData: (lcdc & 0x10) ? '0x8000' : '0x8800',
    };
  },
  forceRender: () => {
    // Force render the current framebuffer
    renderer.drawFrame(gameboy.ppu.framebuffer);
    console.log('Frame rendered');
  },
  waitAndCheck: (ms = 1000) => {
    return new Promise(resolve => {
      setTimeout(() => {
        const result = {
          lcdc: (window as any).debug.getLCDC(),
          cpuState: (window as any).debug.getCPUState(),
          frameReady: gameboy.ppu.frameReady,
        };
        console.log('After waiting:', result);
        resolve(result);
      }, ms);
    });
  },
  traceUntilLCD: (maxSteps = 10000) => {
    // Step through instructions until LCD is enabled or max steps reached
    let steps = 0;
    let lcdc = gameboy.mmu.getIO(0x40);
    const startPC = gameboy.cpu.registers.pc;

    console.log(`Starting trace from PC: 0x${startPC.toString(16).padStart(4, '0')}, LCDC: 0x${lcdc.toString(16).padStart(2, '0')}`);

    while (steps < maxSteps && !(lcdc & 0x80)) {
      const pc = gameboy.cpu.registers.pc;
      const opcode = gameboy.mmu.read(pc);

      // Check if this is a write to LCDC (0xFF40)
      if ((opcode === 0xE0 || opcode === 0xEA) || (opcode === 0x32 && gameboy.cpu.registers.getHL() === 0xFF40)) {
        console.log(`Step ${steps}: PC=0x${pc.toString(16).padStart(4, '0')}, Opcode=0x${opcode.toString(16).padStart(2, '0')} - Potential LCDC write`);
      }

      gameboy.cpu.step();
      lcdc = gameboy.mmu.getIO(0x40);
      steps++;
    }

    const endPC = gameboy.cpu.registers.pc;
    console.log(`Trace complete after ${steps} steps`);
    console.log(`End PC: 0x${endPC.toString(16).padStart(4, '0')}, LCDC: 0x${lcdc.toString(16).padStart(2, '0')}`);
    console.log('LCD enabled:', !!(lcdc & 0x80));

    return {
      steps,
      lcdEnabled: !!(lcdc & 0x80),
      lcdc: (window as any).debug.getLCDC(),
      cpuState: (window as any).debug.getCPUState(),
    };
  },
  checkInterrupts: () => {
    const ie = gameboy.mmu.getInterruptEnable();
    const iflag = gameboy.mmu.getInterruptFlag();
    return {
      IE: '0x' + ie.toString(16).padStart(2, '0'),
      IF: '0x' + iflag.toString(16).padStart(2, '0'),
      IME: gameboy.cpu.ime,
      halted: gameboy.cpu.halted,
      vblank: { enabled: !!(ie & 0x01), pending: !!(iflag & 0x01) },
      lcdStat: { enabled: !!(ie & 0x02), pending: !!(iflag & 0x02) },
      timer: { enabled: !!(ie & 0x04), pending: !!(iflag & 0x04) },
    };
  },
  testLoop: () => {
    // Test the problematic loop
    console.log('Before loop test:');
    console.log('B =', gameboy.cpu.registers.b.toString(16).padStart(2, '0'));
    console.log('Z flag =', gameboy.cpu.registers.getZeroFlag());

    // Execute DEC B (0x05)
    for (let i = 0; i < 5; i++) {
      const pc = gameboy.cpu.registers.pc;
      const opcode = gameboy.mmu.read(pc);
      console.log(`\nStep ${i + 1}: PC=0x${pc.toString(16).padStart(4, '0')}, Opcode=0x${opcode.toString(16).padStart(2, '0')}`);
      console.log('  Before: B=0x' + gameboy.cpu.registers.b.toString(16).padStart(2, '0') + ', Z=' + gameboy.cpu.registers.getZeroFlag());

      gameboy.cpu.step();

      console.log('  After:  B=0x' + gameboy.cpu.registers.b.toString(16).padStart(2, '0') + ', Z=' + gameboy.cpu.registers.getZeroFlag());
    }

    return (window as any).debug.getCPUState();
  },
  findUnimplemented: () => {
    // Run for a while and track any unimplemented opcodes
    const unimplemented = new Set<string>();
    const pcWhenFound = new Map<string, string>();

    for (let i = 0; i < 10000; i++) {
      const pc = gameboy.cpu.registers.pc;
      const opcode = gameboy.mmu.read(pc);

      // Check if this opcode is implemented
      const instruction = (gameboy.cpu as any).constructor.prototype.instructions?.[opcode];

      // Try to step - if it fails or returns 4 cycles for unknown, it might be unimplemented
      const cyclesBefore = gameboy.cpu.step();

      // Check for common unimplemented patterns
      if (cyclesBefore === 4 && opcode !== 0x00) {
        const key = '0x' + opcode.toString(16).padStart(2, '0');
        if (!unimplemented.has(key)) {
          unimplemented.add(key);
          pcWhenFound.set(key, '0x' + pc.toString(16).padStart(4, '0'));
        }
      }
    }

    console.log('Potentially unimplemented opcodes found:');
    unimplemented.forEach(opcode => {
      console.log(`  ${opcode} at PC ${pcWhenFound.get(opcode)}`);
    });

    return { unimplemented: Array.from(unimplemented), locations: Object.fromEntries(pcWhenFound) };
  },
  disassemble: (addr: number, count: number = 10) => {
    // Disassemble instructions at a given address
    const opcodeNames: { [key: number]: string } = {
      0x00: 'NOP', 0x01: 'LD BC,nn', 0x02: 'LD (BC),A', 0x03: 'INC BC',
      0x04: 'INC B', 0x05: 'DEC B', 0x06: 'LD B,n', 0x08: 'LD (nn),SP',
      0x0B: 'DEC BC', 0x0C: 'INC C', 0x0D: 'DEC C', 0x0E: 'LD C,n',
      0x11: 'LD DE,nn', 0x12: 'LD (DE),A', 0x13: 'INC DE', 0x15: 'DEC D',
      0x16: 'LD D,n', 0x17: 'RLA', 0x18: 'JR n', 0x1A: 'LD A,(DE)',
      0x1E: 'LD E,n', 0x20: 'JR NZ,n', 0x21: 'LD HL,nn', 0x22: 'LD (HL+),A',
      0x23: 'INC HL', 0x28: 'JR Z,n', 0x2E: 'LD L,n', 0x31: 'LD SP,nn',
      0x32: 'LD (HL-),A', 0x3E: 'LD A,n', 0x47: 'LD B,A', 0x4F: 'LD C,A',
      0x57: 'LD D,A', 0x5F: 'LD E,A', 0x67: 'LD H,A', 0x6F: 'LD L,A',
      0x77: 'LD (HL),A', 0x78: 'LD A,B', 0x7B: 'LD A,E', 0x7C: 'LD A,H',
      0x7D: 'LD A,L', 0x86: 'ADD A,(HL)', 0x90: 'SUB B', 0xA9: 'XOR C',
      0xAF: 'XOR A', 0xB1: 'OR C', 0xC1: 'POP BC', 0xC3: 'JP nn',
      0xC5: 'PUSH BC', 0xC9: 'RET', 0xCD: 'CALL nn', 0xE0: 'LDH (n),A',
      0xE2: 'LDH (C),A', 0xEA: 'LD (nn),A', 0xF0: 'LDH A,(n)', 0xF3: 'DI',
      0xFE: 'CP n', 0xFB: 'EI',
    };

    let currentAddr = addr;
    const result = [];

    for (let i = 0; i < count; i++) {
      const opcode = gameboy.mmu.read(currentAddr);
      const name = opcodeNames[opcode] || `Unknown(0x${opcode.toString(16).padStart(2, '0')})`;
      let bytes = `${opcode.toString(16).padStart(2, '0')}`;
      let size = 1;

      // Read additional bytes for multi-byte instructions
      if ([0x01, 0x08, 0x11, 0x21, 0x31, 0xC3, 0xCD, 0xEA].includes(opcode)) {
        const b1 = gameboy.mmu.read(currentAddr + 1);
        const b2 = gameboy.mmu.read(currentAddr + 2);
        bytes += ` ${b1.toString(16).padStart(2, '0')} ${b2.toString(16).padStart(2, '0')}`;
        size = 3;
      } else if ([0x06, 0x0E, 0x16, 0x18, 0x1E, 0x20, 0x28, 0x2E, 0x3E, 0xE0, 0xF0, 0xFE].includes(opcode)) {
        const b1 = gameboy.mmu.read(currentAddr + 1);
        bytes += ` ${b1.toString(16).padStart(2, '0')}`;
        size = 2;
      }

      result.push(`0x${currentAddr.toString(16).padStart(4, '0')}: ${bytes.padEnd(9)} ${name}`);
      currentAddr += size;
    }

    console.log(result.join('\n'));
    return result;
  },
};
