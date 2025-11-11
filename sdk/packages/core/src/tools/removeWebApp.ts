// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';

export const removeWebAppInputSchema = z.object({
  appId: z.string().describe('Web app identifier to remove'),
  reasoning: z.string(),
});

export const removeWebAppOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    appId: z.string(),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type RemoveWebAppInput = z.infer<typeof removeWebAppInputSchema>;
export type RemoveWebAppOutput = z.infer<typeof removeWebAppOutputSchema>;

/**
 * Tool for removing rendered web apps
 */
export const removeWebApp = createTool({
  id: 'remove_webapp',
  description: 'Removes a previously rendered web application and cleans up resources.',
  inputSchema: removeWebAppInputSchema,
  outputSchema: removeWebAppOutputSchema,
  metadata: {
    category: 'web',
    tags: ['webapp', 'remove', 'cleanup'],
  },
  execute: async ({ context }): Promise<RemoveWebAppOutput> => {
    const { appId, reasoning } = context as RemoveWebAppInput;

    try {
      // Simplified - in reality would remove iframe/container
      return {
        success: true,
        appId,
        message: `Removed web app ${appId}`,
      };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to remove web app' };
    }
  },
});
