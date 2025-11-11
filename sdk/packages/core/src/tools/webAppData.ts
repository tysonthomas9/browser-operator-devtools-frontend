// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { PageContentAccessor } from './interfaces.js';

export const webAppDataInputSchema = z.object({
  appId: z.string().describe('Web app identifier'),
  reasoning: z.string(),
});

export const webAppDataOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: z.record(z.unknown()),
    appId: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type WebAppDataInput = z.infer<typeof webAppDataInputSchema>;
export type WebAppDataOutput = z.infer<typeof webAppDataOutputSchema>;

/**
 * Tool for extracting web app specific data
 */
export const getWebAppData = createTool({
  id: 'get_webapp_data',
  description: 'Extracts data from a rendered web application.',
  inputSchema: webAppDataInputSchema,
  outputSchema: webAppDataOutputSchema,
  metadata: {
    category: 'web',
    tags: ['webapp', 'data', 'extraction'],
    requiresRuntime: ['pageContentAccessor'],
  },
  execute: async ({ context, runtimeContext }): Promise<WebAppDataOutput> => {
    const { appId, reasoning } = context as WebAppDataInput;

    const pageAccessor = runtimeContext?.get<PageContentAccessor>('pageContentAccessor');

    if (!pageAccessor) {
      return {
        success: false,
        error: 'PageContentAccessor not available',
      };
    }

    try {
      const tree = await pageAccessor.getAccessibilityTree();
      // Simplified - in reality would parse app-specific data
      const data = { tree: tree.substring(0, 500), appId };

      return {
        success: true,
        data,
        appId,
      };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to get web app data' };
    }
  },
});
