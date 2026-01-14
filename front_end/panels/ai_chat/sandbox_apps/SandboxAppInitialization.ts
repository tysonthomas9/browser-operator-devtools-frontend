// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {SandboxAppRegistry} from './SandboxAppRegistry.js';
import {createLogger} from '../core/Logger.js';

const logger = createLogger('SandboxAppInitialization');

let initialized = false;

/**
 * Initialize sandbox apps by registering them with the registry.
 * Should be called once on startup.
 */
export function initializeSandboxApps(): void {
  if (initialized) {
    logger.warn('Sandbox apps already initialized');
    return;
  }

  // Register Data Studio v2
  SandboxAppRegistry.register({
    id: 'data-studio-v2',
    name: 'Data Studio',
    description: 'Build tables of data analyzed by AI agents. Create entity lists and run agents to populate columns with insights.',
    icon: '📊',
    templateName: 'data-studio',
  });

  initialized = true;
  logger.info(`Initialized ${SandboxAppRegistry.getAllApps().length} sandbox apps`);
}
