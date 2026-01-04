// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Helper to get CDP adapter from context or SDK
 *
 * Tools should use this helper instead of directly accessing SDK.TargetManager.
 * This enables tools to work in both DevTools context and eval runner context.
 */

import type { CDPSessionAdapter } from './CDPSessionAdapter.js';

// Detect if we're in a Node.js environment (eval runner, tests)
const isNodeEnvironment = typeof window === 'undefined' || typeof document === 'undefined';

// Lazy-loaded browser-only dependencies
let SDK: typeof import('../../../core/sdk/sdk.js') | null = null;
let SDKTargetAdapter: typeof import('./SDKTargetAdapter.js').SDKTargetAdapter | null = null;
let browserDepsInitialized = false;

/**
 * Ensures browser dependencies (SDK, SDKTargetAdapter) are loaded.
 * Returns false in Node.js environment or if loading fails.
 */
async function ensureBrowserDeps(): Promise<boolean> {
  if (isNodeEnvironment) {
    return false;
  }
  if (!browserDepsInitialized) {
    browserDepsInitialized = true;
    try {
      const [sdkModule, adapterModule] = await Promise.all([
        import('../../../core/sdk/sdk.js'),
        import('./SDKTargetAdapter.js'),
      ]);
      SDK = sdkModule;
      SDKTargetAdapter = adapterModule.SDKTargetAdapter;
    } catch {
      return false;
    }
  }
  return SDK !== null && SDKTargetAdapter !== null;
}

/**
 * Context that may contain a CDP adapter
 */
export interface AdapterContext {
  cdpAdapter?: CDPSessionAdapter;
}

/**
 * Get the CDP adapter from context, falling back to SDK.Target for DevTools context.
 * This is an async function that lazily loads SDK dependencies.
 *
 * @param ctx - Optional context that may contain a cdpAdapter
 * @returns CDPSessionAdapter or null if no adapter is available
 *
 * @example
 * ```typescript
 * async execute(args: any, ctx?: LLMContext) {
 *   const adapter = await getAdapter(ctx);
 *   if (!adapter) {
 *     return { error: 'No browser connection available' };
 *   }
 *   const tree = await getAccessibilityTree(adapter);
 *   // ...
 * }
 * ```
 */
export async function getAdapter(ctx?: AdapterContext): Promise<CDPSessionAdapter | null> {
  // First try to get adapter from context (for eval runner / external contexts)
  if (ctx?.cdpAdapter) {
    return ctx.cdpAdapter;
  }

  // In Node environment or if SDK not available, return null
  const depsLoaded = await ensureBrowserDeps();
  if (!depsLoaded || !SDK || !SDKTargetAdapter) {
    return null;
  }

  // Fall back to SDK.Target for DevTools context
  const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
  if (!target) {
    return null;
  }

  return new SDKTargetAdapter(target);
}

/**
 * Synchronous version of getAdapter for backward compatibility.
 * Only works if browser deps are already loaded (call ensureBrowserDeps first).
 * Returns null in Node.js environment.
 */
export function getAdapterSync(ctx?: AdapterContext): CDPSessionAdapter | null {
  // First try to get adapter from context (for eval runner / external contexts)
  if (ctx?.cdpAdapter) {
    return ctx.cdpAdapter;
  }

  // In Node environment or if SDK not loaded yet, return null
  if (isNodeEnvironment || !SDK || !SDKTargetAdapter) {
    return null;
  }

  // Fall back to SDK.Target for DevTools context
  const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
  if (!target) {
    return null;
  }

  return new SDKTargetAdapter(target);
}

/**
 * Get the CDP adapter, throwing if not available.
 * Use this when adapter is required for the operation.
 */
export async function getAdapterOrThrow(ctx?: AdapterContext): Promise<CDPSessionAdapter> {
  const adapter = await getAdapter(ctx);
  if (!adapter) {
    throw new Error('No CDP adapter available. Ensure a browser target is connected.');
  }
  return adapter;
}

/**
 * Get the SDK target directly (for operations that need SDK-specific features).
 * Prefer using getAdapter() when possible for better portability.
 * Returns null in Node.js environment.
 */
export async function getSDKTarget(): Promise<any | null> {
  const depsLoaded = await ensureBrowserDeps();
  if (!depsLoaded || !SDK) {
    return null;
  }
  return SDK.TargetManager.TargetManager.instance().primaryPageTarget();
}

/**
 * Export the ensureBrowserDeps function so other modules can preload dependencies
 */
export { ensureBrowserDeps };
