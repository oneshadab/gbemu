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
