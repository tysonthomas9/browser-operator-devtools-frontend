// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { END_NODE } from './OrchestrationTypes.js';
import { createLogger } from '../observability/Logger.js';

const logger = createLogger('GraphRoutingHelpers');

/**
 * Helper functions for creating routing logic in state machines
 *
 * These helpers provide common patterns for conditional routing between nodes.
 * Applications should adapt these patterns to their specific state structures.
 */

/**
 * Creates a simple router based on a state property value
 *
 * @example
 * ```typescript
 * const router = createPropertyRouter<MyState>(
 *   'status',
 *   {
 *     'pending': 'processNode',
 *     'complete': END_NODE,
 *     'error': 'errorHandlerNode'
 *   },
 *   'processNode' // default if property value not in map
 * );
 * ```
 */
export function createPropertyRouter<TState>(
  propertyName: keyof TState,
  routeMap: Record<string, string>,
  defaultRoute: string = END_NODE
): (state: TState) => string {
  return (state: TState) => {
    const value = String(state[propertyName]);
    const route = routeMap[value] || defaultRoute;

    logger.debug(`Property router: ${String(propertyName)}=${value} -> ${route}`);
    return route;
  };
}

/**
 * Creates a conditional router based on a predicate function
 *
 * @example
 * ```typescript
 * const router = createConditionalRouter<MyState>(
 *   (state) => state.retryCount < 3,
 *   'retryNode',
 *   'failureNode'
 * );
 * ```
 */
export function createConditionalRouter<TState>(
  condition: (state: TState) => boolean,
  ifTrue: string,
  ifFalse: string
): (state: TState) => string {
  return (state: TState) => {
    const result = condition(state);
    const route = result ? ifTrue : ifFalse;

    logger.debug(`Conditional router: ${result} -> ${route}`);
    return route;
  };
}

/**
 * Creates a router that checks for errors and routes accordingly
 *
 * @example
 * ```typescript
 * const router = createErrorRouter<MyState>(
 *   'errorHandlerNode',
 *   'successNode'
 * );
 * ```
 */
export function createErrorRouter<TState extends { error?: string | Error }>(
  errorRoute: string,
  successRoute: string
): (state: TState) => string {
  return (state: TState) => {
    const hasError = !!state.error;
    const route = hasError ? errorRoute : successRoute;

    logger.debug(`Error router: hasError=${hasError} -> ${route}`);
    return route;
  };
}

/**
 * Creates a multi-condition router that evaluates conditions in order
 *
 * @example
 * ```typescript
 * const router = createMultiConditionRouter<MyState>([
 *   { condition: (s) => s.error, route: 'errorNode' },
 *   { condition: (s) => s.complete, route: END_NODE },
 *   { condition: (s) => s.needsReview, route: 'reviewNode' }
 * ], 'processNode'); // default route
 * ```
 */
export function createMultiConditionRouter<TState>(
  conditions: Array<{
    condition: (state: TState) => boolean;
    route: string;
  }>,
  defaultRoute: string = END_NODE
): (state: TState) => string {
  return (state: TState) => {
    for (const { condition, route } of conditions) {
      if (condition(state)) {
        logger.debug(`Multi-condition router: matched -> ${route}`);
        return route;
      }
    }

    logger.debug(`Multi-condition router: no match, using default -> ${defaultRoute}`);
    return defaultRoute;
  };
}

/**
 * Creates a router based on numeric ranges
 *
 * @example
 * ```typescript
 * const router = createRangeRouter<MyState>(
 *   (state) => state.score,
 *   [
 *     { max: 30, route: 'lowScoreNode' },
 *     { max: 70, route: 'mediumScoreNode' },
 *     { max: Infinity, route: 'highScoreNode' }
 *   ]
 * );
 * ```
 */
export function createRangeRouter<TState>(
  getValue: (state: TState) => number,
  ranges: Array<{ max: number; route: string }>,
  defaultRoute: string = END_NODE
): (state: TState) => string {
  return (state: TState) => {
    const value = getValue(state);

    for (const { max, route } of ranges) {
      if (value <= max) {
        logger.debug(`Range router: ${value} <= ${max} -> ${route}`);
        return route;
      }
    }

    logger.debug(`Range router: ${value} out of range, using default -> ${defaultRoute}`);
    return defaultRoute;
  };
}

/**
 * Creates a router that cycles through a list of nodes
 *
 * @example
 * ```typescript
 * const router = createCycleRouter<MyState>(
 *   (state) => state.iteration,
 *   ['step1', 'step2', 'step3'],
 *   END_NODE // route after all steps complete
 * );
 * ```
 */
export function createCycleRouter<TState>(
  getIndex: (state: TState) => number,
  nodes: string[],
  finalRoute: string = END_NODE
): (state: TState) => string {
  return (state: TState) => {
    const index = getIndex(state);

    if (index >= 0 && index < nodes.length) {
      const route = nodes[index];
      logger.debug(`Cycle router: index=${index} -> ${route}`);
      return route;
    }

    logger.debug(`Cycle router: index=${index} out of bounds -> ${finalRoute}`);
    return finalRoute;
  };
}

/**
 * Creates a router that always routes to END
 * Useful for terminal nodes
 */
export function createEndRouter<TState>(): (state: TState) => string {
  return (_state: TState) => {
    logger.debug('End router: -> END');
    return END_NODE;
  };
}

/**
 * Creates a router that always routes to a specific node
 * Useful for simple sequential flows
 */
export function createFixedRouter<TState>(route: string): (state: TState) => string {
  return (_state: TState) => {
    logger.debug(`Fixed router: -> ${route}`);
    return route;
  };
}

/**
 * Combines multiple routers with fallback logic
 * Tries routers in order until one returns a route other than the fallback
 *
 * @example
 * ```typescript
 * const router = combineRouters<MyState>(
 *   [errorRouter, completionRouter, defaultRouter],
 *   END_NODE // fallback if all routers return this
 * );
 * ```
 */
export function combineRouters<TState>(
  routers: Array<(state: TState) => string>,
  fallbackRoute: string = END_NODE
): (state: TState) => string {
  return (state: TState) => {
    for (const router of routers) {
      const route = router(state);
      if (route !== fallbackRoute) {
        logger.debug(`Combined router: selected route -> ${route}`);
        return route;
      }
    }

    logger.debug(`Combined router: all routes matched fallback -> ${fallbackRoute}`);
    return fallbackRoute;
  };
}

/**
 * Type guard helper for creating type-safe routers
 *
 * @example
 * ```typescript
 * interface StateA { type: 'A'; value: number }
 * interface StateB { type: 'B'; text: string }
 * type MyState = StateA | StateB;
 *
 * const router = createTypeRouter<MyState>(
 *   (state): state is StateA => state.type === 'A',
 *   (stateA) => stateA.value > 10 ? 'highValue' : 'lowValue',
 *   'textProcessor'
 * );
 * ```
 */
export function createTypeRouter<TState, TSubState extends TState>(
  guard: (state: TState) => state is TSubState,
  routeIfTrue: (state: TSubState) => string,
  routeIfFalse: string | ((state: Exclude<TState, TSubState>) => string)
): (state: TState) => string {
  return (state: TState) => {
    if (guard(state)) {
      const route = routeIfTrue(state);
      logger.debug(`Type router: guard passed -> ${route}`);
      return route;
    } else {
      const route = typeof routeIfFalse === 'string'
        ? routeIfFalse
        : routeIfFalse(state as Exclude<TState, TSubState>);
      logger.debug(`Type router: guard failed -> ${route}`);
      return route;
    }
  };
}
