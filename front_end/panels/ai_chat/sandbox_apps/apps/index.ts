// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Sandbox Apps - App Definitions Registry
 *
 * This module initializes and registers all sandbox app definitions.
 * Call initializeSandboxApps() during DevTools initialization.
 */

import {SandboxAppRegistry} from '../SandboxAppRegistry.js';
import {dataStudioApp} from './data-studio/index.js';

/**
 * Initialize and register all sandbox app definitions.
 * Call this once during DevTools startup.
 */
export function initializeSandboxApps(): void {
  // Register Data Studio
  SandboxAppRegistry.registerAppDefinition(dataStudioApp);

  // Register additional apps here as they are created:
  // SandboxAppRegistry.registerAppDefinition(formBuilderApp);
  // SandboxAppRegistry.registerAppDefinition(dashboardApp);
}

/**
 * Get all registered app types.
 */
export function getRegisteredAppTypes(): string[] {
  return SandboxAppRegistry.getAllAppDefinitions().map(app => app.id);
}

// Re-export app definitions for direct access
export {dataStudioApp} from './data-studio/index.js';
