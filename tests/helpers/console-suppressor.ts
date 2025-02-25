/**
 * Utility for suppressing console errors and logs in tests.
 * This is useful for tests that expect errors to be thrown and logged.
 */

/**
 * Options for the console suppressor
 */
export interface ConsoleSuppressorOptions {
  /** Whether to suppress console.error. Default: true */
  suppressError?: boolean;
  /** Whether to suppress console.log. Default: true */
  suppressLog?: boolean;
  /** Whether to suppress console.warn. Default: false */
  suppressWarn?: boolean;
  /** Whether to track if errors were logged. Default: true */
  trackErrors?: boolean;
}

/**
 * Result of the console suppressor
 */
export interface ConsoleSuppressorResult {
  /** Object containing flags for logged messages */
  flags: {
    /** Whether any errors were logged */
    errorLogged: boolean;
    /** Whether any logs were logged */
    logLogged: boolean;
    /** Whether any warnings were logged */
    warnLogged: boolean;
  };
  /** Restore the original console functions */
  restore: () => void;
}

/**
 * Suppresses console output during test execution.
 * Returns an object with flags indicating if errors/logs were logged
 * and a restore function to restore the original console functions.
 *
 * @example
 * ```
 * it("should handle errors gracefully", () => {
 *   const { flags, restore } = suppressConsole();
 *
 *   // Test code that might log errors
 *
 *   expect(flags.errorLogged).to.be.true;
 *   restore();
 * });
 * ```
 */
export function suppressConsole(options: ConsoleSuppressorOptions = {}): ConsoleSuppressorResult {
  const { suppressError = true, suppressLog = true, suppressWarn = false, trackErrors = true } = options;

  // Store original console functions
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;

  // Create tracking flags object (passed by reference)
  const flags = {
    errorLogged: false,
    logLogged: false,
    warnLogged: false,
  };

  // Replace console functions
  if (suppressError) {
    console.error = (...args) => {
      if (trackErrors) {
        flags.errorLogged = true;
      }
    };
  }

  if (suppressLog) {
    console.log = (...args) => {
      if (trackErrors) {
        flags.logLogged = true;
      }
    };
  }

  if (suppressWarn) {
    console.warn = (...args) => {
      if (trackErrors) {
        flags.warnLogged = true;
      }
    };
  }

  // Return result with restore function
  return {
    flags,
    restore: () => {
      console.error = originalConsoleError;
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
    },
  };
}
