import { LogData, LogLevel } from "./types";

/**
 * Logger utility class
 * Provides structured logging with configurable log levels
 */
export class Logger {
  private readonly logLevel: LogLevel;
  private readonly logLevels: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  };

  constructor(logLevel: LogLevel = "INFO") {
    this.logLevel = logLevel;
  }

  /**
   * Check if a log level should be logged
   * @param level - Log level to check
   * @returns True if the level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] >= this.logLevels[this.logLevel];
  }

  /**
   * Format log message as JSON string
   * @param level - Log level
   * @param message - Log message
   * @param data - Additional data to include
   * @returns Formatted log string
   */
  private formatMessage(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
  ): string {
    const logData: LogData = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...data,
    };
    return JSON.stringify(logData);
  }

  /**
   * Log debug message
   * @param message - Debug message
   * @param data - Additional data
   */
  debug(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog("DEBUG")) {
      console.log(this.formatMessage("DEBUG", message, data));
    }
  }

  /**
   * Log info message
   * @param message - Info message
   * @param data - Additional data
   */
  info(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog("INFO")) {
      console.log(this.formatMessage("INFO", message, data));
    }
  }

  /**
   * Log warning message
   * @param message - Warning message
   * @param data - Additional data
   */
  warn(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog("WARN")) {
      console.warn(this.formatMessage("WARN", message, data));
    }
  }

  /**
   * Log error message
   * @param message - Error message
   * @param error - Error object or additional data
   */
  error(message: string, error?: Error | Record<string, unknown>): void {
    if (this.shouldLog("ERROR")) {
      const errorData =
        error instanceof Error
          ? {
              error: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error;
      console.error(this.formatMessage("ERROR", message, errorData));
    }
  }
}
