// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Shared SDK dependency loader for tools that only need the SDK module.
 * Returns the SDK module directly instead of a boolean, enabling proper
 * TypeScript type narrowing.
 */

const isNodeEnvironment = typeof window === 'undefined' || typeof document === 'undefined';

export type SDKModule = typeof import('../../../core/sdk/sdk.js');

export type SDKDeps = {
  SDK: SDKModule;
};

let cachedSDK: SDKDeps | null = null;
let sdkLoading: Promise<SDKDeps | null> | null = null;

/**
 * Gets the SDK module. Returns null in Node.js environment or if loading fails.
 * Uses caching and prevents concurrent loading.
 */
export async function getSDK(): Promise<SDKDeps | null> {
  if (isNodeEnvironment) return null;
  if (cachedSDK) return cachedSDK;
  if (sdkLoading) return sdkLoading;

  sdkLoading = (async () => {
    try {
      const SDK = await import('../../../core/sdk/sdk.js');
      cachedSDK = { SDK };
      sdkLoading = null;
      return cachedSDK;
    } catch {
      sdkLoading = null;
      return null;
    }
  })();

  return sdkLoading;
}
