// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Schema property definition for skill parameters
 */
export interface SkillSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  items?: { type: string };
  properties?: Record<string, SkillSchemaProperty>;
  required?: string[];
  default?: unknown;
  enum?: string[];
}

/**
 * JSON Schema for skill parameters
 */
export interface SkillSchema {
  type: 'object';
  properties: Record<string, SkillSchemaProperty>;
  required?: string[];
}

/**
 * Verification status and tracking for a skill
 */
export interface SkillVerification {
  /** Current verification status */
  status: 'unverified' | 'testing' | 'verified' | 'failing';
  /** Total number of test runs */
  testCount: number;
  /** Number of successful test runs */
  successCount: number;
  /** Consecutive failures (resets on success) */
  consecutiveFailures: number;
  /** Timestamp of last test */
  lastTestedAt?: string;
  /** Last error message if any */
  lastError?: string;
  /** Number of successes required for verification (default: 3) */
  requiredSuccesses: number;
}

/**
 * Record of a self-healing operation
 */
export interface HealingRecord {
  /** Timestamp of healing */
  timestamp: string;
  /** Original failing selector */
  originalSelector: string;
  /** Healed selector that worked */
  healedSelector: string;
  /** Number of attempts needed */
  attemptsNeeded: number;
  /** Time spent healing (ms) */
  healingTimeMs: number;
  /** Error type that triggered healing */
  errorType: string;
  /** Page URL where healing occurred */
  pageUrl: string;
}

/**
 * A learned automation skill stored in IndexedDB
 */
export interface LearnedSkill {
  /** UUID */
  id: string;
  /** snake_case name, unique per domain */
  name: string;
  /** Human-readable description */
  description: string;
  /** Version number, increments on updates */
  version: number;
  /** JavaScript function source code */
  source: string;
  /** JSON Schema for parameters */
  schema: SkillSchema;
  /** Domain this skill is scoped to (e.g., "amazon.com") */
  domain: string;
  /** Tags for categorization */
  tags: string[];
  /** Verification status and history */
  verification: SkillVerification;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Self-healing history (optional) */
  healingHistory?: HealingRecord[];
}

/**
 * Input for creating a new skill (without auto-generated fields)
 */
export interface CreateSkillInput {
  name: string;
  description: string;
  source: string;
  schema: SkillSchema;
  domain: string;
  tags?: string[];
}

/**
 * Input for updating an existing skill
 */
export interface UpdateSkillInput {
  name?: string;
  description?: string;
  source?: string;
  schema?: SkillSchema;
  tags?: string[];
}

/**
 * Result from executing a skill
 */
export interface SkillExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Return value from skill (if successful) */
  output?: unknown;
  /** Error message (if failed) */
  error?: string;
  /** Stack trace (if failed) */
  stack?: string;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** ISO timestamp when execution completed */
  capturedAt: string;
  /** Whether self-healing was applied during execution */
  healingApplied?: boolean;
  /** Number of healing attempts made (if healing was applied) */
  healingAttempts?: number;
  /** The healed selector used (if healing was applied) */
  healedSelector?: string;
}

/**
 * Record of a skill test execution
 */
export interface SkillTestRecord {
  /** UUID */
  id: string;
  /** Skill ID this test is for */
  skillId: string;
  /** Arguments passed to the skill */
  args: Record<string, unknown>;
  /** Execution result */
  result: SkillExecutionResult;
  /** URL of the page when test was run */
  pageUrl: string;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Skill proposal from discovery agent
 */
export interface SkillProposal {
  name: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required?: boolean;
  }>;
  exampleUsage: string;
  domain: string;
}
