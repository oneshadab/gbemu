# Phase 1: Project Setup

## Overview
Set up the TypeScript project structure with Vite as the build tool. This phase establishes the foundation for all future development.

## Goals
- Initialize npm project with TypeScript
- Configure Vite for fast development
- Set up basic HTML structure
- Create initial directory structure
- Verify the build system works

---

## Step 1: Initialize package.json

**File**: `package.json`

```json
{
  "name": "gbemu",
  "version": "0.1.0",
  "description": "GameBoy (DMG) emulator in TypeScript",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "lint": "eslint src --ext .ts"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "eslint": "^8.55.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  },
  "dependencies": {}
}
```

**Command to run**:
```bash
npm install
```

---

## Step 2: TypeScript Configuration

**File**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true,

    /* Path mapping */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Purpose**:
- Target ES2020 for modern browser features
- Strict type checking for better code quality
- Path mapping for cleaner imports

---

## Step 3: Vite Configuration

**File**: `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
  },
});
```

**Purpose**:
- Alias `@/` to `src/` for cleaner imports
- Dev server on port 3000
- Source maps for debugging

---

## Step 4: HTML Shell

**File**: `public/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GameBoy Emulator</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 30px;
      max-width: 800px;
      width: 100%;
    }

    h1 {
      color: #333;
      margin-bottom: 20px;
      text-align: center;
    }

    .emulator-screen {
      background: #0f380f;
      border: 8px solid #8bac0f;
      border-radius: 8px;
      margin: 20px auto;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
      box-shadow: inset 0 4px 8px rgba(0, 0, 0, 0.3);
    }

    #display {
      image-rendering: pixelated;
      image-rendering: -moz-crisp-edges;
      image-rendering: crisp-edges;
      width: 480px;
      height: 432px;
      background: #0f380f;
    }

    .controls {
      display: flex;
      flex-direction: column;
      gap: 15px;
      margin-top: 20px;
    }

    .control-group {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    button {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      flex: 1;
    }

    button:hover {
      background: #5568d3;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    button:active {
      transform: translateY(0);
    }

    button:disabled {
      background: #ccc;
      cursor: not-allowed;
      transform: none;
    }

    input[type="file"] {
      display: none;
    }

    .file-input-label {
      background: #48bb78;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      flex: 1;
      text-align: center;
    }

    .file-input-label:hover {
      background: #38a169;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(72, 187, 120, 0.4);
    }

    .info {
      margin-top: 20px;
      padding: 15px;
      background: #f7fafc;
      border-radius: 8px;
      font-size: 14px;
      color: #4a5568;
    }

    .info p {
      margin: 5px 0;
    }

    .status {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      text-align: center;
      margin-top: 10px;
    }

    .status.ready {
      background: #c6f6d5;
      color: #22543d;
    }

    .status.running {
      background: #bee3f8;
      color: #2c5282;
    }

    .status.error {
      background: #fed7d7;
      color: #742a2a;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎮 GameBoy Emulator</h1>

    <div class="emulator-screen">
      <canvas id="display" width="160" height="144"></canvas>
    </div>

    <div class="controls">
      <div class="control-group">
        <label for="rom-file" class="file-input-label">
          📁 Load ROM
        </label>
        <input type="file" id="rom-file" accept=".gb" />
      </div>

      <div class="control-group">
        <button id="reset-btn" disabled>🔄 Reset</button>
        <button id="pause-btn" disabled>⏸️ Pause</button>
      </div>
    </div>

    <div class="info">
      <p><strong>Controls:</strong></p>
      <p>Arrow Keys = D-Pad | Z = A | X = B | Enter = Start | Shift = Select</p>
      <div id="status" class="status ready">Ready - Load a ROM to start</div>
    </div>
  </div>

  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

**Purpose**:
- Clean, GameBoy-themed UI
- Canvas element for display (160x144 native resolution, scaled 3x)
- File input for ROM loading
- Control buttons for reset/pause
- Status display

---

## Step 5: Create Directory Structure

Create the following directories:

```bash
mkdir -p src/core/cpu
mkdir -p src/core/memory/mbcs
mkdir -p src/core/ppu
mkdir -p src/core/timer
mkdir -p src/core/input
mkdir -p src/emulator
mkdir -p src/ui
mkdir -p src/utils
mkdir -p tests/cpu
mkdir -p public
```

---

## Step 6: Main Entry Point (Stub)

**File**: `src/main.ts`

```typescript
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
const statusDiv = document.getElementById('status') as HTMLDivElement;

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
```

**Purpose**:
- Verify canvas is working with test pattern
- Set up ROM file loading
- Prepare UI event handlers
- Logging for debugging

---

## Step 7: ESLint Configuration (Optional but Recommended)

**File**: `.eslintrc.json`

```json
{
  "env": {
    "browser": true,
    "es2021": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

---

## Step 8: .gitignore

**File**: `.gitignore`

```
# Dependencies
node_modules/

# Build output
dist/
*.local

# Editor
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# ROMs (don't commit copyrighted material)
*.gb
*.gbc
roms/

# Test output
coverage/
.nyc_output/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

---

## Verification Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Expected Results
- Browser opens to `http://localhost:3000`
- You see a GameBoy-themed UI
- Canvas shows green background with a lighter green square in the center
- Console shows:
  ```
  🎮 GameBoy Emulator Starting...
  ✅ Canvas initialized
  ✅ UI event handlers registered
  ```

### 4. Test File Loading
- Click "Load ROM" button
- Select any `.gb` file (or create a dummy file)
- Console should show file loaded message
- Reset and Pause buttons should become enabled

---

## Success Criteria

✅ Project builds without errors
✅ Dev server starts and opens browser
✅ Canvas displays test pattern
✅ File input accepts .gb files
✅ Console logging works
✅ TypeScript strict mode enabled
✅ All directories created

---

## Next Phase

Once this phase is complete, proceed to **Phase 2: Memory Foundation** where we'll implement the Memory Management Unit (MMU) and cartridge loading system.

---

## Common Issues & Solutions

### Issue: Port 3000 already in use
**Solution**: Change port in `vite.config.ts` or stop other service using port 3000

### Issue: TypeScript errors about DOM types
**Solution**: Ensure `tsconfig.json` includes `"DOM"` in lib array

### Issue: Canvas not displaying
**Solution**: Check browser console for errors, verify canvas element ID matches

### Issue: Module resolution errors
**Solution**: Verify `"type": "module"` in package.json and moduleResolution in tsconfig.json
