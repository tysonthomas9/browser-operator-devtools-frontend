// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * DevTools implementation of Browser Operator SDK RuntimeContext
 *
 * This adapter provides DevTools-specific implementations of browser APIs
 * for use with the SDK's tool system and agent framework.
 */

import type {RuntimeContext} from '../../third_party/browser-operator-sdk/browser-operator-sdk.js';

/**
 * Create a RuntimeContext for DevTools environment
 */
export function createDevToolsRuntimeContext(): RuntimeContext {
  return {
    // Clipboard operations
    copyToClipboard: async (text: string): Promise<void> => {
      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        throw new Error('Clipboard write failed');
      }
    },

    readFromClipboard: async (): Promise<string> => {
      try {
        return await navigator.clipboard.readText();
      } catch (error) {
        console.error('Failed to read from clipboard:', error);
        throw new Error('Clipboard read failed');
      }
    },

    // User prompts - using DevTools-specific dialogs would be better
    // but using standard browser APIs for now
    alert: async (message: string): Promise<void> => {
      // In production, this should use DevTools' dialog system
      // For now, using console logging as DevTools doesn't have standard alerts
      console.log('[Alert]', message);
    },

    confirm: async (message: string): Promise<boolean> => {
      // In production, this should use DevTools' dialog system
      // For now, always returning true as a safe default
      console.log('[Confirm]', message);
      return true;
    },

    prompt: async (message: string, defaultValue?: string): Promise<string | null> => {
      // In production, this should use DevTools' input dialog
      console.log('[Prompt]', message, defaultValue);
      return defaultValue ?? null;
    },

    // Storage operations - using DevTools settings storage
    // In production, these should integrate with Settings.settingForName
    storage: {
      get: async (key: string): Promise<string | null> => {
        try {
          return localStorage.getItem(`devtools_sdk_${key}`);
        } catch (error) {
          console.error('Storage get failed:', error);
          return null;
        }
      },

      set: async (key: string, value: string): Promise<void> => {
        try {
          localStorage.setItem(`devtools_sdk_${key}`, value);
        } catch (error) {
          console.error('Storage set failed:', error);
          throw new Error('Storage write failed');
        }
      },

      remove: async (key: string): Promise<void> => {
        try {
          localStorage.removeItem(`devtools_sdk_${key}`);
        } catch (error) {
          console.error('Storage remove failed:', error);
        }
      },

      clear: async (): Promise<void> => {
        try {
          // Only clear SDK-prefixed keys
          const keys = Object.keys(localStorage);
          for (const key of keys) {
            if (key.startsWith('devtools_sdk_')) {
              localStorage.removeItem(key);
            }
          }
        } catch (error) {
          console.error('Storage clear failed:', error);
        }
      },
    },

    // Network operations - using standard fetch
    fetch: async (url: string, options?: RequestInit): Promise<Response> => {
      return fetch(url, options);
    },

    // Logging - using DevTools console
    logger: {
      debug: (...args: unknown[]): void => {
        console.debug('[SDK]', ...args);
      },

      info: (...args: unknown[]): void => {
        console.info('[SDK]', ...args);
      },

      warn: (...args: unknown[]): void => {
        console.warn('[SDK]', ...args);
      },

      error: (...args: unknown[]): void => {
        console.error('[SDK]', ...args);
      },
    },

    // Timer operations
    setTimeout: (callback: () => void, ms: number): number => {
      return window.setTimeout(callback, ms) as number;
    },

    clearTimeout: (id: number): void => {
      window.clearTimeout(id);
    },

    setInterval: (callback: () => void, ms: number): number => {
      return window.setInterval(callback, ms) as number;
    },

    clearInterval: (id: number): void => {
      window.clearInterval(id);
    },

    // Current timestamp
    now: (): number => {
      return Date.now();
    },

    // Random number generation
    random: (): number => {
      return Math.random();
    },

    // Environment info
    environment: {
      platform: 'devtools' as const,
      userAgent: navigator.userAgent,
      language: navigator.language,
      isOnline: navigator.onLine,
    },
  };
}

/**
 * Singleton instance of DevTools RuntimeContext
 * Can be imported and used directly across the ai_chat panel
 */
export const devToolsRuntimeContext = createDevToolsRuntimeContext();
