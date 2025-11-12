// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * SDK Integration Test
 *
 * This file verifies that the Browser Operator SDK is properly integrated
 * and can be imported in the DevTools environment.
 */

import * as SDK from '../../third_party/browser-operator-sdk/browser-operator-sdk.js';
import {devToolsRuntimeContext} from './DevToolsRuntimeContext.js';

/**
 * Verify SDK is available and exports expected modules
 */
export function verifySDKIntegration(): boolean {
  try {
    // Check main SDK exports
    if (!SDK) {
      console.error('SDK not available');
      return false;
    }

    // Check submodule exports
    const modules = ['LLM', 'Tools', 'Agent', 'Workflows', 'State', 'Memory'];
    for (const module of modules) {
      if (!(module in SDK)) {
        console.error(`SDK.${module} not available`);
        return false;
      }
    }

    // Check Zod is available
    if (!SDK.z) {
      console.error('Zod (z) not available from SDK');
      return false;
    }

    // Check RuntimeContext is available
    if (!devToolsRuntimeContext) {
      console.error('DevToolsRuntimeContext not available');
      return false;
    }

    console.log('✓ SDK integration verified successfully');
    console.log('Available modules:', modules.join(', '));
    console.log('RuntimeContext platform:', devToolsRuntimeContext.environment.platform);

    return true;
  } catch (error) {
    console.error('SDK integration verification failed:', error);
    return false;
  }
}

/**
 * Example: Creating an LLM provider using the SDK
 */
export function createSDKLLMProvider(apiKey: string): SDK.LLM.OpenAIProvider {
  return new SDK.LLM.OpenAIProvider(apiKey);
}

/**
 * Example: Creating a tool using the SDK
 */
export function createSDKTool() {
  return SDK.Tools.createTool({
    name: 'example_tool',
    description: 'An example tool to verify SDK integration',
    parameters: SDK.z.object({
      input: SDK.z.string().describe('Example input'),
    }),
    execute: async (params, context) => {
      // Using the injected runtime context
      context.logger.info('Example tool executed with input:', params.input);
      return {success: true, data: `Processed: ${params.input}`};
    },
  });
}
