// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';

export const renderWebAppInputSchema = z.object({
  html: z.string().describe('HTML content to render'),
  appId: z.string().describe('Unique identifier for this web app instance'),
  reasoning: z.string(),
});

export const renderWebAppOutputSchema = z.discriminatedUnion('success', [
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

export type RenderWebAppInput = z.infer<typeof renderWebAppInputSchema>;
export type RenderWebAppOutput = z.infer<typeof renderWebAppOutputSchema>;

/**
 * Tool for rendering web apps in an iframe or container
 */
export const renderWebApp = createTool({
  id: 'render_webapp',
  description: 'Renders HTML content as a web application in an isolated container.',
  inputSchema: renderWebAppInputSchema,
  outputSchema: renderWebAppOutputSchema,
  metadata: {
    category: 'web',
    tags: ['webapp', 'render', 'iframe'],
  },
  execute: async ({ context }): Promise<RenderWebAppOutput> => {
    const { html, appId, reasoning } = context as RenderWebAppInput;

    try {
      // Simplified - in reality would render in iframe/container
      if (!html || html.trim().length === 0) {
        return {
          success: false,
          error: 'HTML content cannot be empty',
        };
      }

      return {
        success: true,
        appId,
        message: `Rendered web app ${appId}`,
      };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to render web app' };
    }
  },
});
