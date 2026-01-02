// GameBoy Emulator - Main Entry Point
console.log('🎮 GameBoy Emulator Starting...');

// Initialize canvas
const canvas = document.getElementById('display') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');

if (!ctx) {
  throw new Error('Could not get canvas context');
}

// Fill canvas with GameBoy green as a test
ctx.fillStyle = '#0f380f';
ctx.fillRect(0, 0, 160, 144);

// Test pattern: white square in center
ctx.fillStyle = '#9bbc0f';
ctx.fillRect(60, 52, 40, 40);

console.log('✅ Canvas initialized');

// ROM file loading
const romFileInput = document.getElementById('rom-file') as HTMLInputElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLElement;

romFileInput.addEventListener('change', async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const romData = new Uint8Array(arrayBuffer);

    console.log(`📦 ROM loaded: ${file.name} (${romData.length} bytes)`);
    statusDiv.textContent = `Loaded: ${file.name}`;
    statusDiv.className = 'status ready';

    // Enable buttons
    resetBtn.disabled = false;
    pauseBtn.disabled = false;

    // TODO: Load ROM into emulator
  } catch (error) {
    console.error('❌ Error loading ROM:', error);
    statusDiv.textContent = 'Error loading ROM';
    statusDiv.className = 'status error';
  }
});

resetBtn.addEventListener('click', () => {
  console.log('🔄 Reset requested');
  // TODO: Reset emulator
});

pauseBtn.addEventListener('click', () => {
  console.log('⏸️ Pause/Resume requested');
  // TODO: Toggle pause
});

console.log('✅ UI event handlers registered');
