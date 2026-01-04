/**
 * CDP Session Adapter - Abstraction layer for Chrome DevTools Protocol
 *
 * This interface allows the same tool implementations to work in both:
 * - DevTools browser context (using SDK.Target)
 * - Backend/Node.js context (using chrome-remote-interface or Puppeteer)
 */

/**
 * Generic CDP agent interface for a single domain
 */
export interface CDPAgent {
  /**
   * Invoke a CDP method on this domain
   * @param method - The method name (e.g., 'getDocument', 'getFullAXTree')
   * @param params - Optional parameters for the method
   * @returns Promise resolving to the method result
   */
  invoke<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
}

/**
 * CDP Session Adapter interface - abstracts access to CDP domains
 *
 * Implementations:
 * - SDKTargetAdapter: Wraps SDK.Target for DevTools context
 * - DirectCDPAdapter: Wraps chrome-remote-interface or any CDP client
 */
export interface CDPSessionAdapter {
  /**
   * Get the DOM domain agent
   * Methods: getDocument, describeNode, getBoxModel, resolveNode, etc.
   */
  domAgent(): CDPAgent;

  /**
   * Get the Runtime domain agent
   * Methods: evaluate, callFunctionOn, etc.
   */
  runtimeAgent(): CDPAgent;

  /**
   * Get the Page domain agent
   * Methods: navigate, captureScreenshot, getFrameTree, etc.
   */
  pageAgent(): CDPAgent;

  /**
   * Get the Accessibility domain agent
   * Methods: getFullAXTree, etc.
   */
  accessibilityAgent(): CDPAgent;

  /**
   * Get the Input domain agent
   * Methods: dispatchMouseEvent, dispatchKeyEvent, etc.
   */
  inputAgent(): CDPAgent;

  /**
   * Get the currently inspected URL
   */
  inspectedURL(): string | undefined;

  /**
   * Send a raw CDP command (fallback for methods not covered by agents)
   * @param domain - The CDP domain (e.g., 'DOM', 'Runtime')
   * @param method - The method name
   * @param params - Optional parameters
   */
  send<T = unknown>(domain: string, method: string, params?: Record<string, unknown>): Promise<T>;
}
