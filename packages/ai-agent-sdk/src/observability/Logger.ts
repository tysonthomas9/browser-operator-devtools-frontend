// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Log levels for the logger
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
}

/**
 * Simple logger implementation for the SDK
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;
  private timestamp: boolean;

  constructor(name: string, config: LoggerConfig = {}) {
    this.prefix = name;
    this.level = config.level ?? LogLevel.INFO;
    this.timestamp = config.timestamp ?? true;
  }

  private formatMessage(level: string): string {
    const timestamp = this.timestamp ? `[${new Date().toISOString()}]` : '';
    return `${timestamp}[${level}][${this.prefix}]`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  debug(...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage('DEBUG'), ...args);
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('INFO'), ...args);
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN'), ...args);
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR'), ...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }
}

/**
 * Create a logger instance
 */
export function createLogger(name: string, config?: LoggerConfig): Logger {
  return new Logger(name, config);
}

/**
 * Global logger configuration
 */
let globalLogLevel: LogLevel = LogLevel.INFO;

export function setGlobalLogLevel(level: LogLevel): void {
  globalLogLevel = level;
}

export function getGlobalLogLevel(): LogLevel {
  return globalLogLevel;
}
