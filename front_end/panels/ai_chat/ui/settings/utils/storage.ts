// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Get a value from localStorage
 */
export function getStorageItem(key: string, defaultValue: string = ''): string {
  return localStorage.getItem(key) || defaultValue;
}

/**
 * Set a value in localStorage, or remove it if empty
 */
export function setStorageItem(key: string, value: string): void {
  if (value.trim()) {
    localStorage.setItem(key, value);
  } else {
    localStorage.removeItem(key);
  }
}

/**
 * Get a boolean value from localStorage
 */
export function getStorageBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = localStorage.getItem(key);
  if (value === null) {
    return defaultValue;
  }
  return value === 'true';
}

/**
 * Set a boolean value in localStorage
 */
export function setStorageBoolean(key: string, value: boolean): void {
  localStorage.setItem(key, value.toString());
}

/**
 * Get a JSON value from localStorage
 */
export function getStorageJSON<T>(key: string, defaultValue: T): T {
  try {
    const value = localStorage.getItem(key);
    if (value === null) {
      return defaultValue;
    }
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Set a JSON value in localStorage
 */
export function setStorageJSON<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Remove a value from localStorage
 */
export function removeStorageItem(key: string): void {
  localStorage.removeItem(key);
}

/**
 * Check if Vector DB is enabled
 */
export function isVectorDBEnabled(): boolean {
  return getStorageBoolean('ai_chat_vector_db_enabled', false);
}
