// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tools system for Browser Operator SDK
 * Following Mastra pattern with Zod schemas
 *
 * @example Basic tool creation
 * ```typescript
 * import { createTool } from '@browser-operator/core/tools';
 * import { z } from 'zod';
 *
 * const weatherTool = createTool({
 *   id: 'get_weather',
 *   description: 'Get current weather for a city',
 *   inputSchema: z.object({
 *     city: z.string().describe('City name'),
 *   }),
 *   outputSchema: z.object({
 *     temperature: z.number(),
 *     conditions: z.string(),
 *   }),
 *   execute: async ({ context }) => {
 *     return await fetchWeather(context.city);
 *   },
 * });
 * ```
 *
 * @example Using runtime context
 * ```typescript
 * const userTool = createTool({
 *   id: 'get_user_data',
 *   description: 'Get user-specific data',
 *   inputSchema: z.object({ userId: z.string() }),
 *   outputSchema: z.object({ name: z.string(), tier: z.string() }),
 *   execute: async ({ context, runtimeContext }) => {
 *     const authToken = runtimeContext?.get<string>('authToken');
 *     return await fetchUserData(context.userId, authToken);
 *   },
 * });
 * ```
 */

export * from './types.js';
export * from './createTool.js';
export * from './utils.js';

// Migrated tools from ai_chat
export * from './readFile.js';
export * from './createFile.js';
