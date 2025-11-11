// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../observability/Logger.js';
import type { Tool, ToolFactory } from './Tool.js';

const logger = createLogger('ToolRegistry');

/**
 * Registry for managing tools and agents.
 * Provides a centralized place to register and retrieve tool instances.
 */
export class ToolRegistry {
  private static toolFactories = new Map<string, ToolFactory>();
  private static registeredTools = new Map<string, Tool<any, any>>(); // Store instances

  /**
   * Register a tool factory and create/store an instance
   */
  static registerToolFactory(name: string, factory: ToolFactory): void {
    if (this.toolFactories.has(name)) {
      logger.warn(`Tool factory already registered for: ${name}. Overwriting.`);
    }
    if (this.registeredTools.has(name)) {
      logger.warn(`Tool instance already registered for: ${name}. Overwriting.`);
    }
    this.toolFactories.set(name, factory);
    // Create and store the instance immediately upon registration
    try {
      const instance = factory();
      this.registeredTools.set(name, instance);
      logger.info(`Registered and instantiated tool: ${name}`);
    } catch (error) {
      logger.error(`Failed to instantiate tool '${name}' during registration:`, error);
      // Remove the factory entry if instantiation fails
      this.toolFactories.delete(name);
    }
  }

  /**
   * Get a tool instance by name (creates new instance from factory)
   */
  static getToolInstance(name: string): Tool<any, any> | null {
    const factory = this.toolFactories.get(name);
    return factory ? factory() : null;
  }

  /**
   * Get a pre-registered tool instance by name (returns cached instance)
   */
  static getRegisteredTool(name: string): Tool<any, any> | null {
    const instance = this.registeredTools.get(name);
    if (!instance) {
      return null;
    }
    return instance;
  }

  /**
   * Check if a tool is registered
   */
  static hasTool(name: string): boolean {
    return this.toolFactories.has(name);
  }

  /**
   * Get all registered tool names
   */
  static getRegisteredToolNames(): string[] {
    return Array.from(this.toolFactories.keys());
  }

  /**
   * Get all registered tool instances
   */
  static getAllRegisteredTools(): Tool<any, any>[] {
    return Array.from(this.registeredTools.values());
  }

  /**
   * Clear all registered tools (useful for testing)
   */
  static clear(): void {
    this.toolFactories.clear();
    this.registeredTools.clear();
    logger.info('Tool Registry cleared');
  }

  /**
   * Get registry statistics
   */
  static getStats(): {
    toolCount: number;
    toolNames: string[];
  } {
    return {
      toolCount: this.toolFactories.size,
      toolNames: Array.from(this.toolFactories.keys()),
    };
  }

  /**
   * Unregister a specific tool
   */
  static unregisterTool(name: string): boolean {
    const hadFactory = this.toolFactories.delete(name);
    const hadInstance = this.registeredTools.delete(name);
    if (hadFactory || hadInstance) {
      logger.info(`Unregistered tool: ${name}`);
    }
    return hadFactory || hadInstance;
  }

  /**
   * Register multiple tools at once
   */
  static registerTools(tools: Record<string, ToolFactory>): void {
    for (const [name, factory] of Object.entries(tools)) {
      this.registerToolFactory(name, factory);
    }
  }
}
