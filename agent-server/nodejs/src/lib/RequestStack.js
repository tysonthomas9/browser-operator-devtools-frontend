// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * RequestStack - A simple stack-like structure for managing requests
 *
 * Provides LIFO (Last In, First Out) access to request objects.
 * Useful for distributing different requests across multiple client connections.
 */
export class RequestStack {
  constructor() {
    this.requests = [];
  }

  /**
   * Add a request to the top of the stack
   * @param {Object} request - The request object to add
   */
  push(request) {
    if (!request || typeof request !== 'object') {
      throw new Error('Request must be a valid object');
    }

    // Validate required fields
    const requiredFields = ['id', 'name', 'tool', 'input'];
    for (const field of requiredFields) {
      if (!request[field]) {
        throw new Error(`Request missing required field: ${field}`);
      }
    }

    this.requests.push(request);
  }

  /**
   * Remove and return the request from the top of the stack
   * @returns {Object|null} The request object, or null if stack is empty
   */
  pop() {
    return this.requests.pop() || null;
  }

  /**
   * Check if the stack is empty
   * @returns {boolean} True if stack has no requests
   */
  isEmpty() {
    return this.requests.length === 0;
  }

  /**
   * Get the number of requests in the stack
   * @returns {number} The stack size
   */
  size() {
    return this.requests.length;
  }

  /**
   * Peek at the top request without removing it
   * @returns {Object|null} The top request object, or null if stack is empty
   */
  peek() {
    if (this.isEmpty()) {
      return null;
    }
    return this.requests[this.requests.length - 1];
  }

  /**
   * Clear all requests from the stack
   */
  clear() {
    this.requests = [];
  }

  /**
   * Get a copy of all requests in the stack (top to bottom)
   * @returns {Array} Array of request objects
   */
  toArray() {
    return [...this.requests].reverse();
  }
}