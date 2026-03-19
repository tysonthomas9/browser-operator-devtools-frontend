// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../../core/Logger.js';

const logger = createLogger('MiniAppRouter');

/**
 * Route definition for a mini app
 */
export interface RouteDefinition {
  /** Route name (e.g., 'selector', 'table', 'agent') */
  name: string;
  /** URL pattern with params (e.g., '#data-studio/table/:tableId') */
  pattern: string;
}

/**
 * Parsed route information
 */
export interface ParsedRoute {
  appId: string;
  routeName: string;
  params: Record<string, string>;
}

/**
 * MiniAppRouter - Central router for mini app URL handling
 *
 * Responsibilities:
 * - Store route definitions from all mini apps
 * - Parse URL hashes into route info
 * - Build URL hashes from route info
 */
export class MiniAppRouter {
  private static _instance: MiniAppRouter | null = null;
  private routes = new Map<string, RouteDefinition[]>();

  private constructor() {}

  static getInstance(): MiniAppRouter {
    if (!MiniAppRouter._instance) {
      MiniAppRouter._instance = new MiniAppRouter();
    }
    return MiniAppRouter._instance;
  }

  /**
   * Register routes for a mini app
   */
  registerRoutes(appId: string, routes: RouteDefinition[]): void {
    this.routes.set(appId, routes);
    logger.info(`Registered ${routes.length} routes for ${appId}:`, routes.map(r => r.pattern));
  }

  /**
   * Get all registered routes for an app
   */
  getRoutes(appId: string): RouteDefinition[] {
    return this.routes.get(appId) || [];
  }

  /**
   * Parse a URL hash into route information
   *
   * @param hash - The URL hash (e.g., '#data-studio/table/123')
   * @returns ParsedRoute or null if no match
   */
  parseHash(hash: string): ParsedRoute | null {
    if (!hash || !hash.startsWith('#')) {
      return null;
    }

    // Try to match against all registered routes
    for (const [appId, appRoutes] of this.routes) {
      for (const route of appRoutes) {
        const match = this.matchPattern(hash, route.pattern);
        if (match) {
          logger.info(`Matched hash "${hash}" to route "${route.name}" for app "${appId}"`);
          return {
            appId,
            routeName: route.name,
            params: match,
          };
        }
      }
    }

    logger.info(`No route matched for hash: ${hash}`);
    return null;
  }

  /**
   * Build a URL hash from route information
   *
   * @param appId - The app ID
   * @param routeName - The route name
   * @param params - Route parameters
   * @returns The URL hash string
   */
  buildHash(appId: string, routeName: string, params?: Record<string, string>): string {
    const appRoutes = this.routes.get(appId);
    if (!appRoutes) {
      logger.warn(`No routes registered for app: ${appId}`);
      return '#' + appId.replace(/_/g, '-');
    }

    const route = appRoutes.find(r => r.name === routeName);
    if (!route) {
      logger.warn(`Route "${routeName}" not found for app: ${appId}`);
      return '#' + appId.replace(/_/g, '-');
    }

    let hash = route.pattern;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        hash = hash.replace(':' + key, encodeURIComponent(value));
      }
    }

    return hash;
  }

  /**
   * Match a hash against a pattern and extract parameters
   *
   * Pattern examples:
   * - '#data-studio' (exact match)
   * - '#data-studio/table/:tableId' (with parameter)
   * - '#agent-studio/agent/:name' (with parameter)
   *
   * @returns Object with extracted params, or null if no match
   */
  private matchPattern(hash: string, pattern: string): Record<string, string> | null {
    // Extract parameter names from pattern
    const paramNames: string[] = [];
    const regexPattern = pattern.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });

    // Create regex for matching
    const regex = new RegExp('^' + regexPattern + '$');
    const match = hash.match(regex);

    if (!match) {
      return null;
    }

    // Extract parameter values
    const params: Record<string, string> = {};
    paramNames.forEach((name, index) => {
      params[name] = decodeURIComponent(match[index + 1]);
    });

    return params;
  }

  /**
   * Reset the router (for testing)
   */
  reset(): void {
    this.routes.clear();
    logger.info('Router reset');
  }
}
