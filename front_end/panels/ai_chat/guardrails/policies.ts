// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Guardrail Policies - Policy definitions for tool execution safety.
 * Consolidated from GuardrailPolicies.ts.
 */

import type { Policy, ExecutionContext, GuardrailDecision, RiskLevel } from './types.js';

// ============================================================================
// Policy Definitions
// ============================================================================

export const POLICIES: Policy[] = [
  {
    name: 'external_navigation',
    description: 'Controls navigation to external websites',
    instructions: 'Evaluate if the navigation target is safe and expected based on the current context.',
    definitions: {
      'external_domain': 'A domain different from the current page domain',
      'known_safe': 'Domains explicitly allowlisted by the user or commonly trusted (google.com, github.com, etc.)',
      'suspicious_domain': 'Domains with unusual TLDs, misspellings of known brands, or unknown reputation',
    },
    violations: [
      'Navigating to a domain that appears to be a phishing attempt (misspelled brand names)',
      'Navigating to domains with suspicious TLDs (.xyz, .top, .click) unless explicitly requested',
      'Following redirect chains that unexpectedly change domains',
    ],
    safeContent: [
      'Navigating within the same domain',
      'Navigating to well-known, trusted domains (google.com, github.com, stackoverflow.com)',
      'Navigating to URLs explicitly mentioned by the user in their request',
    ],
    escalateCriteria: [
      'Unknown external domain that may be legitimate but cannot be verified',
      'Redirect chains that cross domain boundaries',
      'Navigation to download pages or file hosting sites',
    ],
    examples: [
      {
        input: {
          toolName: 'navigate_url',
          args: { url: 'https://google.com/search?q=test' },
          context: 'User asked to search for something',
        },
        decision: 'safe',
        reasoning: 'Google.com is a well-known trusted domain and the user requested a search.',
      },
      {
        input: {
          toolName: 'navigate_url',
          args: { url: 'https://amaz0n-deals.xyz/login' },
          context: 'Agent found a link claiming to offer Amazon deals',
        },
        decision: 'violation',
        reasoning: 'This appears to be a phishing domain - misspelled brand name (amaz0n) with suspicious TLD (.xyz).',
      },
      {
        input: {
          toolName: 'navigate_url',
          args: { url: 'https://acme-corp.com/products' },
          context: 'User asked to check a company website',
        },
        decision: 'escalate',
        reasoning: 'Unknown domain - cannot verify if this is the legitimate company website without user confirmation.',
      },
    ],
    applicableTools: ['navigate_url', 'click'],
  },

  {
    name: 'sensitive_data_entry',
    description: 'Controls typing sensitive information into form fields',
    instructions: 'Evaluate if the data being entered is sensitive and if the target field/site is appropriate.',
    definitions: {
      'sensitive_data': 'Passwords, credit card numbers, SSN, API keys, or other credentials',
      'pii': 'Personally identifiable information like full name, address, phone, email',
      'secure_context': 'HTTPS connection to a verified, legitimate domain',
    },
    violations: [
      'Entering passwords or credentials on non-HTTPS sites',
      'Typing credit card information on unverified e-commerce sites',
      'Entering API keys or secrets into any form field',
      'Typing SSN or government ID numbers',
    ],
    safeContent: [
      'Typing search queries into search boxes',
      'Entering non-sensitive form data (comments, messages, etc.)',
      'Typing into text editors or note-taking applications',
    ],
    escalateCriteria: [
      'Entering email addresses (PII but often required)',
      'Filling login forms on legitimate but unfamiliar sites',
      'Auto-filling saved credentials on recognized sites',
    ],
    examples: [
      {
        input: {
          toolName: 'type',
          args: { selector: '#search', text: 'best restaurants near me' },
          context: 'User asked to search for restaurants',
        },
        decision: 'safe',
        reasoning: 'Typing a search query is not sensitive data.',
      },
      {
        input: {
          toolName: 'type',
          args: { selector: '#password', text: 'mySecretPassword123' },
          context: 'Agent attempting to log into a website',
        },
        decision: 'violation',
        reasoning: 'Password entry requires explicit user approval to prevent credential theft.',
      },
      {
        input: {
          toolName: 'type',
          args: { selector: '#email', text: 'user@example.com' },
          context: 'Filling out a newsletter signup form',
        },
        decision: 'escalate',
        reasoning: 'Email is PII - user should confirm they want to share this information.',
      },
    ],
    applicableTools: ['type', 'fill_form'],
  },

  {
    name: 'form_submission',
    description: 'Controls form submissions that may have side effects',
    instructions: 'Evaluate if the form submission could have significant consequences.',
    definitions: {
      'transactional_form': 'Forms that trigger purchases, transfers, or irreversible actions',
      'data_collection_form': 'Forms that collect and submit personal information',
      'safe_form': 'Search forms, filters, or navigation controls',
    },
    violations: [
      'Submitting payment or checkout forms',
      'Submitting forms that delete data or accounts',
      'Submitting legal agreements or contracts',
    ],
    safeContent: [
      'Submitting search queries',
      'Applying filters or sort options',
      'Navigating via form-based menus',
    ],
    escalateCriteria: [
      'Submitting contact or registration forms',
      'Submitting feedback or review forms',
      'Submitting any form with filled personal information',
    ],
    examples: [
      {
        input: {
          toolName: 'click',
          args: { selector: 'button[type="submit"]', elementInfo: 'Search button' },
          context: 'Submitting a search form',
        },
        decision: 'safe',
        reasoning: 'Search form submission has no side effects beyond navigation.',
      },
      {
        input: {
          toolName: 'click',
          args: { selector: '#place-order', elementInfo: 'Place Order - $99.99' },
          context: 'Checkout page with items in cart',
        },
        decision: 'violation',
        reasoning: 'Order placement is a financial transaction requiring explicit user approval.',
      },
    ],
    applicableTools: ['click', 'submit_form'],
  },

  {
    name: 'script_execution',
    description: 'Controls execution of JavaScript code',
    instructions: 'Evaluate if the JavaScript code could cause harm or unexpected behavior.',
    definitions: {
      'read_only_script': 'Scripts that only query data without modifying state',
      'mutating_script': 'Scripts that modify DOM, storage, or make network requests',
      'dangerous_script': 'Scripts that access credentials, make purchases, or delete data',
    },
    violations: [
      'Scripts that access localStorage/sessionStorage credentials',
      'Scripts that make fetch/XHR requests to external domains',
      'Scripts that modify cookie values',
      'Scripts that trigger downloads or file access',
    ],
    safeContent: [
      'Scripts that query DOM elements for information',
      'Scripts that read page content or metadata',
      'Scripts that check element visibility or state',
    ],
    escalateCriteria: [
      'Scripts that modify DOM elements',
      'Scripts that scroll or interact with the page',
      'Scripts with complex logic that is hard to verify',
    ],
    examples: [
      {
        input: {
          toolName: 'execute_javascript',
          args: { code: 'document.querySelectorAll("a").length' },
          context: 'Counting links on a page',
        },
        decision: 'safe',
        reasoning: 'Read-only DOM query with no side effects.',
      },
      {
        input: {
          toolName: 'execute_javascript',
          args: { code: 'localStorage.getItem("auth_token")' },
          context: 'Agent trying to get authentication info',
        },
        decision: 'violation',
        reasoning: 'Accessing stored credentials is a security-sensitive operation.',
      },
    ],
    applicableTools: ['execute_javascript', 'evaluate'],
  },

  {
    name: 'file_operations',
    description: 'Controls file downloads and uploads',
    instructions: 'Evaluate if the file operation is safe and expected.',
    definitions: {
      'safe_download': 'Downloads from trusted sources explicitly requested by user',
      'risky_download': 'Executable files, scripts, or downloads from unknown sources',
      'upload': 'Any file upload operation',
    },
    violations: [
      'Downloading executable files (.exe, .dmg, .sh, .bat)',
      'Uploading files without explicit user consent',
      'Downloading from suspicious or unknown domains',
    ],
    safeContent: [
      'Downloading documents explicitly requested by user (PDF, images)',
      'Downloading from verified, trusted sources',
    ],
    escalateCriteria: [
      'Any file download not explicitly requested',
      'Downloads from unfamiliar but potentially legitimate sources',
    ],
    examples: [
      {
        input: {
          toolName: 'click',
          args: { selector: 'a[href$=".exe"]', elementInfo: 'Download installer' },
          context: 'Software download page',
        },
        decision: 'violation',
        reasoning: 'Executable downloads require explicit user approval due to security risks.',
      },
    ],
    applicableTools: ['click', 'download_file'],
  },
];

// ============================================================================
// Policy Lookup Utilities
// ============================================================================

/**
 * Get policies applicable to a specific tool
 */
export function getPoliciesForTool(toolName: string): Policy[] {
  return POLICIES.filter(policy => {
    if (!policy.applicableTools || policy.applicableTools.length === 0) {
      return true;
    }
    return policy.applicableTools.includes(toolName);
  });
}

/**
 * Get a specific policy by name
 */
export function getPolicy(name: string): Policy | undefined {
  return POLICIES.find(p => p.name === name);
}

// ============================================================================
// Rule-Based Evaluation Functions
// ============================================================================

/** Trusted domains that don't require approval */
const TRUSTED_DOMAINS = [
  'google.com', 'www.google.com',
  'github.com', 'www.github.com',
  'stackoverflow.com', 'www.stackoverflow.com',
  'wikipedia.org', 'en.wikipedia.org',
  'youtube.com', 'www.youtube.com',
  'amazon.com', 'www.amazon.com',
];

/** Suspicious TLDs often associated with spam/phishing */
const SUSPICIOUS_TLDS = ['.xyz', '.top', '.click', '.work', '.tk', '.ml'];

/** Brand misspellings commonly used in phishing */
const BRAND_MISSPELLINGS = ['amaz0n', 'g00gle', 'faceb00k', 'paypa1', 'micros0ft'];

/**
 * Evaluate navigation actions
 */
export function evaluateNavigation(url: string, context: ExecutionContext): GuardrailDecision {
  try {
    const targetUrl = new URL(url);
    const targetDomain = targetUrl.hostname;

    // Same domain navigation is safe
    if (context.currentDomain && targetDomain === context.currentDomain) {
      return createSafeDecision('Navigation within same domain');
    }

    // Trusted domains are safe with low risk
    if (TRUSTED_DOMAINS.some(d => targetDomain.endsWith(d))) {
      return {
        requiresApproval: false,
        riskLevel: 'low',
        decision: 'safe',
        reasoning: 'Navigation to well-known trusted domain',
        policyMatched: 'external_navigation',
        suggestedMessage: `Navigating to trusted domain: ${targetDomain}`,
        isDefinitive: true,
      };
    }

    // Suspicious TLDs require approval
    if (SUSPICIOUS_TLDS.some(tld => targetDomain.endsWith(tld))) {
      return createViolationDecision(
        'high',
        'Navigation to domain with suspicious TLD',
        `The agent wants to navigate to ${url}. This domain uses a suspicious TLD commonly associated with spam or phishing.`,
        'external_navigation'
      );
    }

    // Brand misspellings are critical violations
    if (BRAND_MISSPELLINGS.some(m => targetDomain.includes(m))) {
      return createViolationDecision(
        'critical',
        'Possible phishing domain detected',
        `The agent wants to navigate to ${url}. This domain appears to be a phishing attempt with a misspelled brand name.`,
        'external_navigation'
      );
    }

    // Unknown external domain - escalate for human judgment
    return {
      requiresApproval: true,
      riskLevel: 'medium',
      decision: 'escalate',
      reasoning: 'Unknown external domain - cannot verify legitimacy without user input',
      policyMatched: 'external_navigation',
      suggestedMessage: `The agent wants to navigate to an external domain: ${targetDomain}. Please confirm this is the intended destination.`,
      isDefinitive: false,
    };

  } catch {
    // Invalid URL - escalate
    return {
      requiresApproval: true,
      riskLevel: 'medium',
      decision: 'escalate',
      reasoning: 'Could not parse URL for safety evaluation',
      policyMatched: 'external_navigation',
      suggestedMessage: `The agent wants to navigate to: ${url}. Please verify this URL is correct.`,
      isDefinitive: false,
    };
  }
}

/**
 * Evaluate text input actions
 */
export function evaluateDataEntry(
  args: Record<string, unknown>,
  _context: ExecutionContext
): GuardrailDecision {
  const text = (args.text as string) || '';
  const selector = (args.selector as string) || '';
  const elementInfo = (args.elementInfo as string) || '';

  // Password fields
  if (
    selector.includes('password') ||
    elementInfo.toLowerCase().includes('password') ||
    selector.includes('type="password"')
  ) {
    return createViolationDecision(
      'high',
      'Typing into password field',
      'The agent wants to enter text into a password field. Please confirm you want to allow credential entry.',
      'sensitive_data_entry'
    );
  }

  // Credit card patterns
  const ccPattern = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;
  if (ccPattern.test(text)) {
    return createViolationDecision(
      'critical',
      'Credit card number detected',
      'The agent wants to enter what appears to be a credit card number. This requires explicit approval.',
      'sensitive_data_entry'
    );
  }

  // SSN pattern
  const ssnPattern = /\b\d{3}[-]?\d{2}[-]?\d{4}\b/;
  if (ssnPattern.test(text)) {
    return createViolationDecision(
      'critical',
      'SSN pattern detected',
      'The agent wants to enter what appears to be a Social Security Number. This requires explicit approval.',
      'sensitive_data_entry'
    );
  }

  // API key patterns
  const apiKeyPatterns = [
    /sk-[a-zA-Z0-9]{32,}/,  // OpenAI
    /ghp_[a-zA-Z0-9]{36}/,  // GitHub
    /AKIA[0-9A-Z]{16}/,     // AWS
  ];
  if (apiKeyPatterns.some(p => p.test(text))) {
    return createViolationDecision(
      'critical',
      'API key or secret detected',
      'The agent wants to enter what appears to be an API key or secret. This is highly sensitive.',
      'sensitive_data_entry'
    );
  }

  // Email addresses - escalate (PII but often necessary)
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  if (emailPattern.test(text)) {
    return {
      requiresApproval: true,
      riskLevel: 'low',
      decision: 'escalate',
      reasoning: 'Email address is PII - user should confirm sharing',
      policyMatched: 'sensitive_data_entry',
      suggestedMessage: `The agent wants to enter an email address: ${text.match(emailPattern)?.[0]}. Is this correct?`,
      isDefinitive: false,
    };
  }

  // Standard text input is safe
  return createSafeDecision('Standard text input - no sensitive data detected');
}

/**
 * Evaluate click actions
 */
export function evaluateClick(args: Record<string, unknown>): GuardrailDecision {
  const selector = (args.selector as string) || '';
  const elementInfo = (args.elementInfo as string) || '';
  const text = elementInfo.toLowerCase();

  // Purchase/checkout buttons
  const purchaseKeywords = ['place order', 'buy now', 'purchase', 'checkout', 'pay now', 'submit order', 'confirm purchase'];
  if (purchaseKeywords.some(k => text.includes(k))) {
    return createViolationDecision(
      'critical',
      'Purchase/checkout action detected',
      `The agent wants to click: "${elementInfo}". This appears to be a purchase action that requires your explicit approval.`,
      'form_submission'
    );
  }

  // Delete/destructive actions
  const deleteKeywords = ['delete', 'remove', 'cancel account', 'deactivate', 'unsubscribe'];
  if (deleteKeywords.some(k => text.includes(k))) {
    return createViolationDecision(
      'high',
      'Destructive action detected',
      `The agent wants to click: "${elementInfo}". This appears to be a destructive action.`,
      'form_submission'
    );
  }

  // Downloads
  if (
    selector.includes('.exe') ||
    selector.includes('.dmg') ||
    selector.includes('.msi') ||
    selector.includes('download') ||
    text.includes('download')
  ) {
    return {
      requiresApproval: true,
      riskLevel: 'medium',
      decision: 'escalate',
      reasoning: 'Download action detected',
      policyMatched: 'file_operations',
      suggestedMessage: 'The agent wants to initiate a download. Please confirm this is intended.',
      isDefinitive: false,
    };
  }

  // Form submit buttons (generally safe)
  if (
    selector.includes('type="submit"') ||
    text.includes('submit') ||
    text.includes('send')
  ) {
    return {
      requiresApproval: false,
      riskLevel: 'low',
      decision: 'safe',
      reasoning: 'Form submission - not a high-risk transaction',
      policyMatched: 'form_submission',
      suggestedMessage: 'Standard form submission',
      isDefinitive: true,
    };
  }

  return createSafeDecision('Standard click action');
}

/**
 * Evaluate JavaScript execution
 */
export function evaluateScript(args: Record<string, unknown>): GuardrailDecision {
  const code = (args.code as string) || (args.expression as string) || '';

  // Credential access patterns
  const credentialPatterns = [
    /localStorage\.getItem\s*\(\s*['"`].*(?:token|auth|session|key|password)/i,
    /sessionStorage\.getItem/i,
    /document\.cookie/i,
  ];
  if (credentialPatterns.some(p => p.test(code))) {
    return createViolationDecision(
      'high',
      'Credential access in script',
      'The script attempts to access stored credentials or sensitive data.',
      'script_execution'
    );
  }

  // Network requests
  if (/fetch\s*\(|XMLHttpRequest|\.ajax\(/.test(code)) {
    return {
      requiresApproval: true,
      riskLevel: 'medium',
      decision: 'escalate',
      reasoning: 'Script makes network requests',
      policyMatched: 'script_execution',
      suggestedMessage: 'The script makes network requests. Please review before allowing.',
      isDefinitive: false,
    };
  }

  // DOM modification (generally safe)
  if (/\.innerHTML|\.outerHTML|document\.write|\.insertAdjacentHTML/.test(code)) {
    return {
      requiresApproval: false,
      riskLevel: 'low',
      decision: 'safe',
      reasoning: 'Script modifies DOM - generally safe',
      policyMatched: 'script_execution',
      suggestedMessage: 'Script modifies page content',
      isDefinitive: true,
    };
  }

  // Read-only queries are safe
  if (/querySelector|querySelectorAll|getElementById|getElementsBy|\.textContent|\.innerText/.test(code)) {
    return createSafeDecision('Read-only DOM query');
  }

  // Unknown script - escalate
  return {
    requiresApproval: true,
    riskLevel: 'medium',
    decision: 'escalate',
    reasoning: 'Script with unknown effects',
    policyMatched: 'script_execution',
    suggestedMessage: 'Please review this script before execution.',
    isDefinitive: false,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function createSafeDecision(reasoning: string): GuardrailDecision {
  return {
    requiresApproval: false,
    riskLevel: 'none',
    decision: 'safe',
    reasoning,
    suggestedMessage: 'Action approved automatically.',
    isDefinitive: true,
  };
}

function createViolationDecision(
  riskLevel: RiskLevel,
  reasoning: string,
  suggestedMessage: string,
  policyMatched?: string
): GuardrailDecision {
  return {
    requiresApproval: true,
    riskLevel,
    decision: 'violation',
    reasoning,
    policyMatched,
    suggestedMessage,
    isDefinitive: true,
  };
}
