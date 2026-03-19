// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Error types that can trigger self-healing recovery.
 */
export type HealableErrorType =
  | 'timeout'           // Element not found within timeout
  | 'strict_violation'  // Multiple elements matched when one expected
  | 'invalid_selector'  // Malformed selector syntax
  | 'element_not_found' // Element doesn't exist in DOM
  | 'stale_reference';  // Element was removed from DOM

/**
 * Execution context captured for self-healing.
 */
export interface ExecutionContext {
  /** Original source code that failed */
  sourceCode: string;
  /** Line number where error occurred (if determinable) */
  lineNumber?: number;
  /** Local variable values at error point */
  locals: Record<string, unknown>;
  /** The failing selector that caused the error */
  failingSelector: string;
  /** Current page URL */
  pageUrl: string;
  /** Accessibility tree snapshot */
  accessibilityTree: string;
  /** Original error message */
  errorMessage: string;
  /** Classified error type */
  errorType: HealableErrorType;
  /** The action that was attempted (click, type, etc.) */
  actionType?: string;
}

/**
 * MCQ option for element selection.
 * Represents a single element choice presented to the LLM.
 */
export interface ElementOption {
  /** Option identifier (A, B, C, etc.) */
  id: string;
  /** Suggested CSS or accessibility selector */
  selector: string;
  /** Element description from accessibility tree */
  description: string;
  /** Element role (button, link, textbox, etc.) */
  role?: string;
  /** Element name/label */
  name?: string;
  /** Backend node ID for CDP operations */
  backendNodeId?: number;
  /** Element tag name */
  tagName?: string;
  /** Additional attributes for context */
  attributes?: Record<string, string>;
}

/**
 * LLM's selector suggestion response.
 */
export interface SelectorSuggestion {
  /** Selected option ID (A, B, C, etc.) */
  selectedOption: string;
  /** The selector to try */
  selector: string;
  /** LLM's reasoning for the selection */
  reasoning: string;
  /** Confidence level (0-1) */
  confidence: number;
}

/**
 * Result of validating a suggested selector.
 */
export interface ValidationResult {
  /** Whether selector is syntactically valid */
  syntaxValid: boolean;
  /** Whether selector finds element(s) */
  findsElements: boolean;
  /** Number of elements found */
  elementCount: number;
  /** Whether element is visible */
  isVisible: boolean;
  /** Whether element is interactable (not disabled, not covered) */
  isInteractable: boolean;
  /** Element matches expected role/type */
  matchesExpectedType: boolean;
  /** Accessibility properties match expectations */
  accessibilityMatch: boolean;
  /** Overall validation passed */
  passed: boolean;
  /** Failure reason if validation failed */
  failureReason?: string;
}

/**
 * Record of a single recovery attempt.
 */
export interface RecoveryAttempt {
  /** Attempt number (1-5) */
  attemptNumber: number;
  /** Suggested selector */
  suggestedSelector: string;
  /** The selected MCQ option */
  selectedOption: string;
  /** LLM's reasoning */
  reasoning: string;
  /** Validation results */
  validation: ValidationResult;
  /** Whether this attempt succeeded */
  success: boolean;
  /** Timestamp */
  timestamp: string;
}

/**
 * Complete self-healing result.
 */
export interface SelfHealingResult {
  /** Whether healing was successful */
  success: boolean;
  /** The working selector (if found) */
  healedSelector?: string;
  /** All recovery attempts made */
  attempts: RecoveryAttempt[];
  /** Final error if healing failed */
  finalError?: string;
  /** Whether the original function should be disabled */
  disableFunction: boolean;
  /** Total time spent on healing (ms) */
  healingTimeMs: number;
  /** Original failing selector */
  originalSelector: string;
  /** Error type that triggered healing */
  errorType: HealableErrorType;
}

/**
 * Healing record stored with skills for history tracking.
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
  errorType: HealableErrorType;
  /** Page URL where healing occurred */
  pageUrl: string;
}

/**
 * Options for self-healing execution.
 */
export interface SelfHealingOptions {
  /** Maximum number of recovery attempts (default: 5) */
  maxAttempts?: number;
  /** Maximum number of MCQ options to present (default: 5) */
  maxMCQOptions?: number;
  /** Whether to update skill source on successful healing */
  updateSkillOnHeal?: boolean;
  /** Timeout for each validation attempt (ms) */
  validationTimeout?: number;
}

/**
 * Configuration for the self-healing system.
 */
export interface SelfHealingConfig {
  /** Whether self-healing is enabled */
  enabled: boolean;
  /** Default options */
  defaultOptions: SelfHealingOptions;
  /** Error types to heal (empty = all) */
  healableErrors: HealableErrorType[];
}

/**
 * Default configuration for self-healing.
 */
export const DEFAULT_SELF_HEALING_CONFIG: SelfHealingConfig = {
  enabled: true,
  defaultOptions: {
    maxAttempts: 5,
    maxMCQOptions: 5,
    updateSkillOnHeal: false, // Prompt user first
    validationTimeout: 5000,
  },
  healableErrors: ['timeout', 'strict_violation', 'invalid_selector', 'element_not_found', 'stale_reference'],
};
