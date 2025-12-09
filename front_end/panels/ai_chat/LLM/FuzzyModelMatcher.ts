// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Fuzzy model name matcher for finding the closest available model
 * when an exact match isn't found.
 */

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function similarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

/**
 * Normalize model name for comparison by removing dates, versions, and separators
 */
function normalizeModelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_]/g, '')              // Remove separators
    .replace(/\d{4}-?\d{2}-?\d{2}$/g, '') // Remove date suffixes (2025-04-14 or 20250514)
    .replace(/\d{8}$/g, '')            // Remove date suffixes without dashes
    .trim();
}

/**
 * Check if target is a prefix of candidate (case-insensitive)
 */
function isPrefixMatch(target: string, candidate: string): boolean {
  const normalizedTarget = target.toLowerCase().replace(/[._]/g, '-');
  const normalizedCandidate = candidate.toLowerCase().replace(/[._]/g, '-');
  return normalizedCandidate.startsWith(normalizedTarget);
}

/**
 * Find the closest matching model from available options
 *
 * Matching strategy (in priority order):
 * 1. Exact match - return immediately
 * 2. Prefix match - if target is prefix of an available model
 * 3. Normalized match - strip dates/versions and compare base names
 * 4. Levenshtein similarity - if similarity > threshold, return best match
 *
 * @param targetModel - The model name to find a match for
 * @param availableModels - Array of available model names
 * @param threshold - Minimum similarity score (0-1) for fuzzy matching (default: 0.5)
 * @returns The closest matching model name, or null if no good match found
 */
export function findClosestModel(
  targetModel: string,
  availableModels: string[],
  threshold: number = 0.5
): string | null {
  if (!targetModel || availableModels.length === 0) {
    return null;
  }

  // 1. Exact match
  if (availableModels.includes(targetModel)) {
    return targetModel;
  }

  // 2. Prefix match - find models where target is a prefix
  const prefixMatches = availableModels.filter(model => isPrefixMatch(targetModel, model));
  if (prefixMatches.length > 0) {
    // Return the shortest prefix match (most specific)
    return prefixMatches.sort((a, b) => a.length - b.length)[0];
  }

  // 3. Normalized match - compare base names without dates/versions
  const normalizedTarget = normalizeModelName(targetModel);
  for (const model of availableModels) {
    if (normalizeModelName(model) === normalizedTarget) {
      return model;
    }
  }

  // 4. Levenshtein similarity on normalized names
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const model of availableModels) {
    const score = similarity(normalizedTarget, normalizeModelName(model));
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = model;
    }
  }

  return bestMatch;
}

/**
 * Find closest model with detailed match info for logging
 */
export interface FuzzyMatchResult {
  match: string | null;
  matchType: 'exact' | 'prefix' | 'normalized' | 'similarity' | 'none';
  score: number;
}

export function findClosestModelWithInfo(
  targetModel: string,
  availableModels: string[],
  threshold: number = 0.5
): FuzzyMatchResult {
  if (!targetModel || availableModels.length === 0) {
    return { match: null, matchType: 'none', score: 0 };
  }

  // 1. Exact match
  if (availableModels.includes(targetModel)) {
    return { match: targetModel, matchType: 'exact', score: 1 };
  }

  // 2. Prefix match
  const prefixMatches = availableModels.filter(model => isPrefixMatch(targetModel, model));
  if (prefixMatches.length > 0) {
    const match = prefixMatches.sort((a, b) => a.length - b.length)[0];
    return { match, matchType: 'prefix', score: targetModel.length / match.length };
  }

  // 3. Normalized match
  const normalizedTarget = normalizeModelName(targetModel);
  for (const model of availableModels) {
    if (normalizeModelName(model) === normalizedTarget) {
      return { match: model, matchType: 'normalized', score: 1 };
    }
  }

  // 4. Levenshtein similarity
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const model of availableModels) {
    const score = similarity(normalizedTarget, normalizeModelName(model));
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = model;
    }
  }

  if (bestMatch) {
    return { match: bestMatch, matchType: 'similarity', score: bestScore };
  }

  return { match: null, matchType: 'none', score: 0 };
}
