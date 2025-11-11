// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Logger, LogLevel, createLogger, setGlobalLogLevel, getGlobalLogLevel } from '../../src/observability/Logger';

describe('Logger', () => {
  let consoleDebugSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Logging', () => {
    it('should create a logger with default settings', () => {
      const logger = new Logger('test');
      expect(logger).toBeDefined();
      expect(logger.getLevel()).toBe(LogLevel.INFO);
    });

    it('should log info messages by default', () => {
      const logger = new Logger('test');
      logger.info('test message');
      expect(consoleInfoSpy).toHaveBeenCalled();
    });

    it('should not log debug messages by default', () => {
      const logger = new Logger('test');
      logger.debug('test message');
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      const logger = new Logger('test');
      logger.warn('test warning');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      const logger = new Logger('test');
      logger.error('test error');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Log Levels', () => {
    it('should respect DEBUG log level', () => {
      const logger = new Logger('test', { level: LogLevel.DEBUG });
      logger.debug('debug message');
      expect(consoleDebugSpy).toHaveBeenCalled();
    });

    it('should respect WARN log level', () => {
      const logger = new Logger('test', { level: LogLevel.WARN });
      logger.info('info message');
      logger.warn('warn message');
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should respect ERROR log level', () => {
      const logger = new Logger('test', { level: LogLevel.ERROR });
      logger.warn('warn message');
      logger.error('error message');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should respect NONE log level', () => {
      const logger = new Logger('test', { level: LogLevel.NONE });
      logger.error('error message');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should allow changing log level', () => {
      const logger = new Logger('test', { level: LogLevel.INFO });
      logger.debug('debug1');
      expect(consoleDebugSpy).not.toHaveBeenCalled();

      logger.setLevel(LogLevel.DEBUG);
      logger.debug('debug2');
      expect(consoleDebugSpy).toHaveBeenCalled();
    });
  });

  describe('Message Formatting', () => {
    it('should include logger name in messages', () => {
      const logger = new Logger('TestLogger');
      logger.info('test');
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestLogger]'),
        'test'
      );
    });

    it('should include log level in messages', () => {
      const logger = new Logger('test');
      logger.info('test');
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        'test'
      );
    });

    it('should include timestamp when enabled', () => {
      const logger = new Logger('test', { timestamp: true });
      logger.info('test');
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T/),
        'test'
      );
    });

    it('should not include timestamp when disabled', () => {
      const logger = new Logger('test', { timestamp: false });
      logger.info('test');
      const call = consoleInfoSpy.mock.calls[0][0];
      expect(call).not.toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('createLogger Factory', () => {
    it('should create a logger', () => {
      const logger = createLogger('factory-test');
      expect(logger).toBeInstanceOf(Logger);
      logger.info('test');
      expect(consoleInfoSpy).toHaveBeenCalled();
    });

    it('should accept configuration', () => {
      const logger = createLogger('factory-test', { level: LogLevel.DEBUG });
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);
    });
  });

  describe('Global Log Level', () => {
    it('should get and set global log level', () => {
      const original = getGlobalLogLevel();
      setGlobalLogLevel(LogLevel.ERROR);
      expect(getGlobalLogLevel()).toBe(LogLevel.ERROR);
      setGlobalLogLevel(original); // Restore
    });
  });

  describe('Multiple Arguments', () => {
    it('should support multiple arguments', () => {
      const logger = new Logger('test');
      logger.info('message', { data: 'value' }, 123);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        'message',
        { data: 'value' },
        123
      );
    });
  });
});
