// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Skills Module - Self-improving skill learning for web automation
 *
 * Skills are domain-scoped JavaScript functions that agents can discover,
 * synthesize, and reuse for web automation tasks.
 */

// Core types
export * from './types/SkillTypes.js';

// Storage management
export { SkillStorageManager } from './SkillStorageManager.js';

// Execution
export { SkillExecutor } from './SkillExecutor.js';
export { CDP_HELPER_LIBRARY, CHECK_HELPERS_INJECTED, GET_HELPERS } from './CDPHelperLibrary.js';

// Tool adapter
export { SkillToolAdapter } from './SkillToolAdapter.js';
