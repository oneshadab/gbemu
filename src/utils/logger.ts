/**
 * Simple logging utility with levels
 */

export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  error(...args: unknown[]): void {
    if (this.level >= LogLevel.ERROR) {
      console.error('[ERROR]', ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.level >= LogLevel.WARN) {
      console.warn('[WARN]', ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.level >= LogLevel.INFO) {
      console.log('[INFO]', ...args);
    }
  }

  debug(...args: unknown[]): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  }

  /**
   * Log instruction execution (useful for CPU debugging)
   */
  instruction(pc: number, opcode: number, mnemonic: string): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(`[CPU] ${pc.toString(16).padStart(4, '0')}: ${opcode.toString(16).padStart(2, '0')} ${mnemonic}`);
    }
  }
}

export const logger = new Logger();
