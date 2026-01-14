// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Shared AgentService dependency loader for tools that need AgentService.
 * Returns the AgentService directly instead of a boolean, enabling proper
 * TypeScript type narrowing.
 */

const isNodeEnvironment = typeof window === 'undefined' || typeof document === 'undefined';

export type AgentServiceModule = typeof import('../core/AgentService.js').AgentService;

export type AgentServiceDeps = {
  AgentService: AgentServiceModule;
};

let cachedAgentService: AgentServiceDeps | null = null;
let agentServiceLoading: Promise<AgentServiceDeps | null> | null = null;

/**
 * Gets the AgentService. Returns null in Node.js environment or if loading fails.
 * Uses caching and prevents concurrent loading.
 */
export async function getAgentService(): Promise<AgentServiceDeps | null> {
  if (isNodeEnvironment) return null;
  if (cachedAgentService) return cachedAgentService;
  if (agentServiceLoading) return agentServiceLoading;

  agentServiceLoading = (async () => {
    try {
      const module = await import('../core/AgentService.js');
      cachedAgentService = { AgentService: module.AgentService };
      agentServiceLoading = null;
      return cachedAgentService;
    } catch {
      agentServiceLoading = null;
      return null;
    }
  })();

  return agentServiceLoading;
}
