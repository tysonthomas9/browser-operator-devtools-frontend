// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {
  createPropertyRouter,
  createConditionalRouter,
  createErrorRouter,
  createMultiConditionRouter,
  createRangeRouter,
  createCycleRouter,
  createEndRouter,
  createFixedRouter,
  combineRouters,
  createTypeRouter
} from '../../src/orchestration/GraphRoutingHelpers';
import { END_NODE } from '../../src/orchestration/OrchestrationTypes';

interface TestState {
  status: string;
  value: number;
  error?: string;
  complete?: boolean;
  iteration?: number;
}

describe('GraphRoutingHelpers', () => {
  describe('createPropertyRouter', () => {
    it('should route based on property value', () => {
      const router = createPropertyRouter<TestState>(
        'status',
        {
          'pending': 'processNode',
          'complete': END_NODE,
          'error': 'errorHandlerNode'
        },
        'defaultNode'
      );

      expect(router({ status: 'pending', value: 0 })).toBe('processNode');
      expect(router({ status: 'complete', value: 0 })).toBe(END_NODE);
      expect(router({ status: 'error', value: 0 })).toBe('errorHandlerNode');
    });

    it('should use default route for unmapped values', () => {
      const router = createPropertyRouter<TestState>(
        'status',
        { 'pending': 'processNode' },
        'defaultNode'
      );

      expect(router({ status: 'unknown', value: 0 })).toBe('defaultNode');
    });

    it('should use END_NODE as default when not specified', () => {
      const router = createPropertyRouter<TestState>(
        'status',
        { 'pending': 'processNode' }
      );

      expect(router({ status: 'unknown', value: 0 })).toBe(END_NODE);
    });
  });

  describe('createConditionalRouter', () => {
    it('should route based on condition result', () => {
      const router = createConditionalRouter<TestState>(
        (state) => state.value > 10,
        'highValueNode',
        'lowValueNode'
      );

      expect(router({ status: '', value: 15 })).toBe('highValueNode');
      expect(router({ status: '', value: 5 })).toBe('lowValueNode');
    });
  });

  describe('createErrorRouter', () => {
    it('should route to error node when error present', () => {
      const router = createErrorRouter<TestState>(
        'errorHandlerNode',
        'successNode'
      );

      expect(router({ status: '', value: 0, error: 'Something went wrong' }))
        .toBe('errorHandlerNode');
    });

    it('should route to success node when no error', () => {
      const router = createErrorRouter<TestState>(
        'errorHandlerNode',
        'successNode'
      );

      expect(router({ status: '', value: 0 })).toBe('successNode');
    });
  });

  describe('createMultiConditionRouter', () => {
    it('should evaluate conditions in order and return first match', () => {
      const router = createMultiConditionRouter<TestState>(
        [
          { condition: (s) => !!s.error, route: 'errorNode' },
          { condition: (s) => s.complete === true, route: END_NODE },
          { condition: (s) => s.value > 100, route: 'highValueNode' }
        ],
        'processNode'
      );

      expect(router({ status: '', value: 0, error: 'fail' })).toBe('errorNode');
      expect(router({ status: '', value: 0, complete: true })).toBe(END_NODE);
      expect(router({ status: '', value: 150 })).toBe('highValueNode');
    });

    it('should use default route when no conditions match', () => {
      const router = createMultiConditionRouter<TestState>(
        [
          { condition: (s) => s.value > 100, route: 'highValueNode' }
        ],
        'defaultNode'
      );

      expect(router({ status: '', value: 50 })).toBe('defaultNode');
    });
  });

  describe('createRangeRouter', () => {
    it('should route based on numeric ranges', () => {
      const router = createRangeRouter<TestState>(
        (state) => state.value,
        [
          { max: 30, route: 'lowNode' },
          { max: 70, route: 'mediumNode' },
          { max: Infinity, route: 'highNode' }
        ]
      );

      expect(router({ status: '', value: 20 })).toBe('lowNode');
      expect(router({ status: '', value: 50 })).toBe('mediumNode');
      expect(router({ status: '', value: 90 })).toBe('highNode');
    });

    it('should use default route when value exceeds all ranges', () => {
      const router = createRangeRouter<TestState>(
        (state) => state.value,
        [
          { max: 50, route: 'node1' }
        ],
        'defaultNode'
      );

      expect(router({ status: '', value: 100 })).toBe('defaultNode');
    });
  });

  describe('createCycleRouter', () => {
    it('should cycle through nodes based on index', () => {
      const router = createCycleRouter<TestState>(
        (state) => state.iteration || 0,
        ['step1', 'step2', 'step3'],
        END_NODE
      );

      expect(router({ status: '', value: 0, iteration: 0 })).toBe('step1');
      expect(router({ status: '', value: 0, iteration: 1 })).toBe('step2');
      expect(router({ status: '', value: 0, iteration: 2 })).toBe('step3');
    });

    it('should route to final node when index exceeds cycle', () => {
      const router = createCycleRouter<TestState>(
        (state) => state.iteration || 0,
        ['step1', 'step2'],
        END_NODE
      );

      expect(router({ status: '', value: 0, iteration: 3 })).toBe(END_NODE);
    });

    it('should handle negative index', () => {
      const router = createCycleRouter<TestState>(
        (state) => state.iteration || 0,
        ['step1', 'step2'],
        'errorNode'
      );

      expect(router({ status: '', value: 0, iteration: -1 })).toBe('errorNode');
    });
  });

  describe('createEndRouter', () => {
    it('should always route to END_NODE', () => {
      const router = createEndRouter<TestState>();

      expect(router({ status: 'any', value: 123 })).toBe(END_NODE);
      expect(router({ status: 'other', value: 456, error: 'fail' })).toBe(END_NODE);
    });
  });

  describe('createFixedRouter', () => {
    it('should always route to specified node', () => {
      const router = createFixedRouter<TestState>('targetNode');

      expect(router({ status: 'any', value: 123 })).toBe('targetNode');
      expect(router({ status: 'other', value: 456 })).toBe('targetNode');
    });
  });

  describe('combineRouters', () => {
    it('should try routers in order and use first non-fallback result', () => {
      const errorRouter = (state: TestState) => state.error ? 'errorNode' : END_NODE;
      const valueRouter = (state: TestState) => state.value > 50 ? 'highValueNode' : END_NODE;
      const defaultRouter = (_state: TestState) => 'defaultNode';

      const combined = combineRouters<TestState>(
        [errorRouter, valueRouter, defaultRouter],
        END_NODE
      );

      expect(combined({ status: '', value: 0, error: 'fail' })).toBe('errorNode');
      expect(combined({ status: '', value: 100 })).toBe('highValueNode');
      expect(combined({ status: '', value: 10 })).toBe('defaultNode');
    });

    it('should return fallback when all routers return fallback', () => {
      const router1 = (_state: TestState) => END_NODE;
      const router2 = (_state: TestState) => END_NODE;

      const combined = combineRouters<TestState>(
        [router1, router2],
        END_NODE
      );

      expect(combined({ status: '', value: 0 })).toBe(END_NODE);
    });
  });

  describe('createTypeRouter', () => {
    interface StateA {
      type: 'A';
      value: number;
    }

    interface StateB {
      type: 'B';
      text: string;
    }

    type MyState = StateA | StateB;

    it('should route based on type guard', () => {
      const router = createTypeRouter<MyState, StateA>(
        (state): state is StateA => state.type === 'A',
        (stateA) => stateA.value > 10 ? 'highValue' : 'lowValue',
        'textProcessor'
      );

      expect(router({ type: 'A', value: 15 })).toBe('highValue');
      expect(router({ type: 'A', value: 5 })).toBe('lowValue');
      expect(router({ type: 'B', text: 'hello' })).toBe('textProcessor');
    });

    it('should support function router for false case', () => {
      const router = createTypeRouter<MyState, StateA>(
        (state): state is StateA => state.type === 'A',
        () => 'typeA',
        (stateB) => stateB.text.length > 5 ? 'longText' : 'shortText'
      );

      expect(router({ type: 'A', value: 10 })).toBe('typeA');
      expect(router({ type: 'B', text: 'hello world' })).toBe('longText');
      expect(router({ type: 'B', text: 'hi' })).toBe('shortText');
    });
  });
});
