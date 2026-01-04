/**
 * SDK Target Adapter - Wraps SDK.Target for DevTools context
 *
 * This adapter allows shared tool implementations to work with
 * the DevTools SDK by implementing the CDPSessionAdapter interface.
 */

import * as SDK from '../../../core/sdk/sdk.js';
import type {CDPSessionAdapter, CDPAgent} from './CDPSessionAdapter.js';

/**
 * Creates a CDPAgent wrapper for an SDK domain agent
 * SDK agents use invoke_methodName pattern, we translate to invoke(methodName)
 */
function wrapSDKAgent(agent: unknown): CDPAgent {
  return {
    async invoke<T>(method: string, params?: Record<string, unknown>): Promise<T> {
      const invokeMethod = `invoke_${method}`;
      const agentAny = agent as Record<string, Function>;
      if (typeof agentAny[invokeMethod] !== 'function') {
        throw new Error(`Method ${invokeMethod} not found on agent`);
      }
      const result = await agentAny[invokeMethod](params || {});
      // SDK returns protocol response which may have getError()
      if (result && typeof result.getError === 'function') {
        const error = result.getError();
        if (error) {
          throw new Error(error);
        }
      }
      return result as T;
    },
  };
}

/**
 * SDKTargetAdapter implements CDPSessionAdapter for DevTools context
 */
export class SDKTargetAdapter implements CDPSessionAdapter {
  private readonly target: SDK.Target.Target;

  constructor(target: SDK.Target.Target) {
    this.target = target;
  }

  domAgent(): CDPAgent {
    const agent = this.target.domAgent();
    if (!agent) {
      throw new Error('DOM agent not available');
    }
    return wrapSDKAgent(agent);
  }

  runtimeAgent(): CDPAgent {
    const agent = this.target.runtimeAgent();
    if (!agent) {
      throw new Error('Runtime agent not available');
    }
    return wrapSDKAgent(agent);
  }

  pageAgent(): CDPAgent {
    const agent = this.target.pageAgent();
    if (!agent) {
      throw new Error('Page agent not available');
    }
    return wrapSDKAgent(agent);
  }

  accessibilityAgent(): CDPAgent {
    const agent = this.target.accessibilityAgent();
    if (!agent) {
      throw new Error('Accessibility agent not available');
    }
    return wrapSDKAgent(agent);
  }

  inputAgent(): CDPAgent {
    const agent = this.target.inputAgent();
    if (!agent) {
      throw new Error('Input agent not available');
    }
    return wrapSDKAgent(agent);
  }

  inspectedURL(): string|undefined {
    return this.target.inspectedURL();
  }

  async send<T>(domain: string, method: string, params?: Record<string, unknown>): Promise<T> {
    // Get the agent for the domain
    const agentMethod = `${domain.toLowerCase()}Agent` as keyof SDK.Target.Target;
    const agent = (this.target as unknown as Record<string, () => unknown>)[agentMethod]?.();
    if (!agent) {
      throw new Error(`Agent for domain ${domain} not available`);
    }
    return wrapSDKAgent(agent).invoke<T>(method, params);
  }

  /**
   * Get the underlying SDK.Target for cases where direct access is needed
   */
  getTarget(): SDK.Target.Target {
    return this.target;
  }
}
