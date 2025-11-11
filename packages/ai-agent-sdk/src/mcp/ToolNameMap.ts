// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tool name mapping utilities for MCP tools
 * Handles name sanitization and conflict resolution
 */

const nameMap = new Map<string, string>();
const reverseMap = new Map<string, Set<string>>();

export function addMapping(original: string, sanitized?: string): void {
  const clean = sanitized || original;
  nameMap.set(original, clean);

  if (!reverseMap.has(clean)) {
    reverseMap.set(clean, new Set());
  }
  reverseMap.get(clean)!.add(original);
}

export function getSanitized(original: string): string {
  return nameMap.get(original) || original;
}

export function resolveOriginal(sanitized: string): string | undefined {
  const originals = reverseMap.get(sanitized);
  if (!originals || originals.size === 0) {
    return undefined;
  }
  return Array.from(originals)[0];
}

export function clear(): void {
  nameMap.clear();
  reverseMap.clear();
}
