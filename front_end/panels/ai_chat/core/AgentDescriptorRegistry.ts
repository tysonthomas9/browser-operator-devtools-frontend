// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Platform from '../../../core/platform/platform.js';
import { createLogger } from './Logger.js';

const logger = createLogger('AgentDescriptorRegistry');

export interface AgentDescriptor {
  name: string;
  type?: string;
  version: string;
  promptHash: string;
  toolsetHash: string;
  generatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AgentDescriptorSource {
  name: string;
  type?: string;
  version?: string;
  promptProvider: () => string | Promise<string>;
  toolNamesProvider: () => string[] | Promise<string[]>;
  metadataProvider?: () => Record<string, unknown> | Promise<Record<string, unknown>>;
}

const descriptorSources = new Map<string, AgentDescriptorSource>();
const descriptorCache = new Map<string, Promise<AgentDescriptor>>();

async function computeHash(value: string): Promise<string> {
  const normalized = value.replace(/\r\n/g, '\n');

  try {
    if (typeof globalThis.crypto?.subtle !== 'undefined') {
      const encoder = new TextEncoder();
      const data = encoder.encode(normalized);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(digest));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (error) {
    logger.warn('Falling back to hashCode due to subtle crypto failure', error);
  }

  const fallback = Platform.StringUtilities.hashCode(normalized);
  return fallback.toString(16);
}

async function computeDescriptorFromSource(source: AgentDescriptorSource): Promise<AgentDescriptor> {
  const prompt = await source.promptProvider();
  const toolNames = await source.toolNamesProvider();
  const metadata = source.metadataProvider ? await source.metadataProvider() : undefined;

  const promptHash = await computeHash(prompt);
  const toolsetPayload = JSON.stringify({
    tools: [...toolNames].sort(),
    metadata: metadata ?? {}
  });
  const toolsetHash = await computeHash(toolsetPayload);

  return {
    name: source.name,
    type: source.type,
    version: source.version ?? 'unversioned',
    promptHash,
    toolsetHash,
    generatedAt: new Date().toISOString(),
    ...(metadata ? { metadata } : {}),
  };
}

function invalidateCache(name: string): void {
  descriptorCache.delete(name);
}

export class AgentDescriptorRegistry {
  static registerSource(source: AgentDescriptorSource): void {
    const existing = descriptorSources.get(source.name);
    if (existing) {
      logger.warn('Agent descriptor source already registered, overwriting', {
        name: source.name,
        previousType: existing.type,
        newType: source.type
      });
    }
    descriptorSources.set(source.name, source);
    invalidateCache(source.name);
  }

  static async getDescriptor(name: string): Promise<AgentDescriptor | null> {
    if (!descriptorSources.has(name)) {
      return null;
    }

    if (!descriptorCache.has(name)) {
      const source = descriptorSources.get(name)!;
      const promise = computeDescriptorFromSource(source);
      descriptorCache.set(name, promise);
    }

    try {
      return await descriptorCache.get(name)!;
    } catch (error) {
      logger.error('Failed to compute descriptor', { name, error });
      descriptorCache.delete(name);
      return null;
    }
  }

  static async listDescriptors(): Promise<AgentDescriptor[]> {
    const list = Array.from(descriptorSources.keys()).map(name => this.getDescriptor(name));
    const results = await Promise.all(list);
    return results.filter((descriptor): descriptor is AgentDescriptor => Boolean(descriptor));
  }

  static hasDescriptor(name: string): boolean {
    return descriptorSources.has(name);
  }
}

// Convenience helpers exposed globally for debugging during development.
if (typeof window !== 'undefined') {
  (window as any).listAgentDescriptors = () => AgentDescriptorRegistry.listDescriptors();
  (window as any).getAgentDescriptor = (name: string) => AgentDescriptorRegistry.getDescriptor(name);
}

export async function ensureDescriptor(name: string, fallbackSource: AgentDescriptorSource): Promise<AgentDescriptor> {
  if (!AgentDescriptorRegistry.hasDescriptor(name)) {
    AgentDescriptorRegistry.registerSource(fallbackSource);
  }
  const descriptor = await AgentDescriptorRegistry.getDescriptor(name);
  if (!descriptor) {
    throw new Error(`Failed to compute agent descriptor for ${name}`);
  }
  return descriptor;
}
