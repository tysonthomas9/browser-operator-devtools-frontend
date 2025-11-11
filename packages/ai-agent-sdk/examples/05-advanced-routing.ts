// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Example 5: Advanced Routing Patterns
 *
 * This example demonstrates how to:
 * - Use property-based routing for state-driven workflows
 * - Implement range-based routing for numeric thresholds
 * - Create cycle routers for iterative processing
 * - Combine multiple routers with fallback logic
 * - Use type guards for type-safe routing
 */

import {
  GraphBuilder,
  createAsyncTransformNode,
  createPropertyRouter,
  createRangeRouter,
  createCycleRouter,
  createMultiConditionRouter,
  createTypeRouter,
  combineRouters,
  END_NODE
} from '../src/index.js';

// Example 1: Content moderation workflow with property routing
interface ContentModerationState {
  content: string;
  category: 'safe' | 'review' | 'unsafe' | 'unknown';
  confidence: number;
  reviewCount: number;
}

// Example 2: Data quality workflow with range routing
interface DataQualityState {
  data: string;
  qualityScore: number;
  processedBy: string[];
  stage: 'initial' | 'processing' | 'complete';
}

// Example 3: Batch processing with cycle routing
interface BatchProcessingState {
  items: string[];
  currentIndex: number;
  processed: string[];
  totalItems: number;
}

// Example 4: Type-based routing with discriminated unions
type TaskState =
  | { type: 'text'; content: string; wordCount?: number }
  | { type: 'image'; url: string; dimensions?: { width: number; height: number } }
  | { type: 'video'; url: string; duration?: number };

async function advancedRoutingExample() {
  console.log('=== Example 5: Advanced Routing Patterns ===\n');

  // ============================================================
  // Pattern 1: Property-Based Routing
  // ============================================================

  console.log('--- Pattern 1: Property-Based Routing ---\n');

  const categorizeNode = createAsyncTransformNode<ContentModerationState>(
    'categorize',
    async (state) => {
      // Simulate ML-based categorization
      const lowerContent = state.content.toLowerCase();

      let category: ContentModerationState['category'];
      let confidence: number;

      if (lowerContent.includes('spam') || lowerContent.includes('scam')) {
        category = 'unsafe';
        confidence = 0.95;
      } else if (lowerContent.includes('maybe') || lowerContent.includes('unclear')) {
        category = 'review';
        confidence = 0.6;
      } else {
        category = 'safe';
        confidence = 0.9;
      }

      console.log(`  Categorized as: ${category} (confidence: ${confidence})`);

      return { ...state, category, confidence };
    }
  );

  const safeNode = createAsyncTransformNode<ContentModerationState>(
    'safe',
    async (state) => {
      console.log('  ✅ Content approved');
      return state;
    }
  );

  const reviewNode = createAsyncTransformNode<ContentModerationState>(
    'review',
    async (state) => {
      console.log('  ⚠️  Content sent for human review');
      return { ...state, reviewCount: state.reviewCount + 1 };
    }
  );

  const unsafeNode = createAsyncTransformNode<ContentModerationState>(
    'unsafe',
    async (state) => {
      console.log('  ❌ Content blocked');
      return state;
    }
  );

  // Create property-based router
  const categoryRouter = createPropertyRouter<ContentModerationState>(
    'category',
    {
      'safe': 'safe',
      'review': 'review',
      'unsafe': 'unsafe'
    },
    'review' // default to review if unknown
  );

  const moderationGraph = new GraphBuilder<ContentModerationState>()
    .addNode('categorize', categorizeNode)
    .addNode('safe', safeNode)
    .addNode('review', reviewNode)
    .addNode('unsafe', unsafeNode)
    .addEdge('categorize', categoryRouter)
    .addEdge('safe', END_NODE)
    .addEdge('review', END_NODE)
    .addEdge('unsafe', END_NODE)
    .setEntryPoint('categorize')
    .build();

  const testContent = [
    'Hello, this is a friendly message!',
    'Maybe this content is unclear?',
    'This is spam and a scam!'
  ];

  for (const content of testContent) {
    console.log(`\nTesting: "${content}"`);
    const result = await moderationGraph.invoke({
      content,
      category: 'unknown',
      confidence: 0,
      reviewCount: 0
    });
    console.log(`Result: ${result.category}`);
  }

  // ============================================================
  // Pattern 2: Range-Based Routing
  // ============================================================

  console.log('\n--- Pattern 2: Range-Based Routing ---\n');

  const analyzeQualityNode = createAsyncTransformNode<DataQualityState>(
    'analyzeQuality',
    async (state) => {
      // Simulate quality scoring
      const score = state.data.length > 50 ? 0.9 :
                    state.data.length > 20 ? 0.6 :
                    0.3;

      console.log(`  Quality score: ${score}`);

      return { ...state, qualityScore: score };
    }
  );

  const highQualityNode = createAsyncTransformNode<DataQualityState>(
    'highQuality',
    async (state) => {
      console.log('  ⭐ High quality - fast track processing');
      return { ...state, processedBy: [...state.processedBy, 'fast-track'] };
    }
  );

  const mediumQualityNode = createAsyncTransformNode<DataQualityState>(
    'mediumQuality',
    async (state) => {
      console.log('  📊 Medium quality - standard processing');
      return { ...state, processedBy: [...state.processedBy, 'standard'] };
    }
  );

  const lowQualityNode = createAsyncTransformNode<DataQualityState>(
    'lowQuality',
    async (state) => {
      console.log('  ⚠️  Low quality - enhanced processing');
      return { ...state, processedBy: [...state.processedBy, 'enhanced'] };
    }
  );

  // Create range-based router
  const qualityRouter = createRangeRouter<DataQualityState>(
    (state) => state.qualityScore,
    [
      { max: 0.5, route: 'lowQuality' },
      { max: 0.8, route: 'mediumQuality' },
      { max: 1.0, route: 'highQuality' }
    ],
    END_NODE
  );

  const qualityGraph = new GraphBuilder<DataQualityState>()
    .addNode('analyzeQuality', analyzeQualityNode)
    .addNode('highQuality', highQualityNode)
    .addNode('mediumQuality', mediumQualityNode)
    .addNode('lowQuality', lowQualityNode)
    .addEdge('analyzeQuality', qualityRouter)
    .addEdge('highQuality', END_NODE)
    .addEdge('mediumQuality', END_NODE)
    .addEdge('lowQuality', END_NODE)
    .setEntryPoint('analyzeQuality')
    .build();

  const testData = [
    'Short',
    'This is a medium length data item',
    'This is a high quality data item with sufficient length and detail for processing'
  ];

  for (const data of testData) {
    console.log(`\nTesting data: "${data.substring(0, 30)}..."`);
    const result = await qualityGraph.invoke({
      data,
      qualityScore: 0,
      processedBy: [],
      stage: 'initial'
    });
    console.log(`Processed by: ${result.processedBy.join(', ')}`);
  }

  // ============================================================
  // Pattern 3: Cycle Router for Batch Processing
  // ============================================================

  console.log('\n--- Pattern 3: Cycle Router for Batch Processing ---\n');

  const processItemNode = createAsyncTransformNode<BatchProcessingState>(
    'processItem',
    async (state) => {
      const currentItem = state.items[state.currentIndex];
      console.log(`  Processing item ${state.currentIndex + 1}/${state.totalItems}: ${currentItem}`);

      return {
        ...state,
        processed: [...state.processed, currentItem.toUpperCase()],
        currentIndex: state.currentIndex + 1
      };
    }
  );

  const validateItemNode = createAsyncTransformNode<BatchProcessingState>(
    'validateItem',
    async (state) => {
      const lastProcessed = state.processed[state.processed.length - 1];
      console.log(`  ✓ Validated: ${lastProcessed}`);
      return state;
    }
  );

  const logItemNode = createAsyncTransformNode<BatchProcessingState>(
    'logItem',
    async (state) => {
      console.log(`  📝 Logged item ${state.processed.length}`);
      return state;
    }
  );

  // Create cycle router that iterates through processing steps
  const batchRouter = createCycleRouter<BatchProcessingState>(
    (state) => state.currentIndex,
    ['processItem', 'validateItem', 'logItem'],
    END_NODE
  );

  const batchGraph = new GraphBuilder<BatchProcessingState>()
    .addNode('processItem', processItemNode)
    .addNode('validateItem', validateItemNode)
    .addNode('logItem', logItemNode)
    .addEdge('processItem', (state) =>
      state.currentIndex < state.totalItems ? 'validateItem' : END_NODE
    )
    .addEdge('validateItem', 'logItem')
    .addEdge('logItem', batchRouter)
    .setEntryPoint('processItem')
    .build();

  const batchItems = ['apple', 'banana', 'cherry'];

  console.log(`\nProcessing batch of ${batchItems.length} items:\n`);

  const batchResult = await batchGraph.invoke({
    items: batchItems,
    currentIndex: 0,
    processed: [],
    totalItems: batchItems.length
  }, { maxSteps: 20 });

  console.log(`\n✅ Batch complete: ${batchResult.processed.join(', ')}`);

  // ============================================================
  // Pattern 4: Combined Routers with Multi-Condition
  // ============================================================

  console.log('\n--- Pattern 4: Combined Multi-Condition Routing ---\n');

  interface ComplexState {
    priority: 'high' | 'medium' | 'low';
    status: 'new' | 'in_progress' | 'complete';
    retryCount: number;
    error?: string;
  }

  const processNode = createAsyncTransformNode<ComplexState>(
    'process',
    async (state) => {
      console.log(`  Processing ${state.priority} priority task...`);
      return { ...state, status: 'in_progress' as const };
    }
  );

  const urgentNode = createAsyncTransformNode<ComplexState>(
    'urgent',
    async (state) => {
      console.log('  🚨 Urgent processing!');
      return state;
    }
  );

  const retryNode = createAsyncTransformNode<ComplexState>(
    'retry',
    async (state) => {
      console.log('  🔄 Retrying...');
      return { ...state, retryCount: state.retryCount + 1 };
    }
  );

  // Create multi-condition router with priority-based logic
  const complexRouter = createMultiConditionRouter<ComplexState>(
    [
      {
        condition: (s) => !!s.error && s.retryCount < 3,
        route: 'retry'
      },
      {
        condition: (s) => s.priority === 'high' && s.status === 'new',
        route: 'urgent'
      },
      {
        condition: (s) => s.status === 'complete',
        route: END_NODE
      }
    ],
    'process'
  );

  const complexGraph = new GraphBuilder<ComplexState>()
    .addNode('process', processNode)
    .addNode('urgent', urgentNode)
    .addNode('retry', retryNode)
    .addEdge('process', (state) => ({ ...state, status: 'complete' as const }) as any)
    .addEdge('urgent', 'process')
    .addEdge('retry', 'process')
    .setEntryPoint((state) => complexRouter(state))
    .build();

  const testCases: ComplexState[] = [
    { priority: 'high', status: 'new', retryCount: 0 },
    { priority: 'low', status: 'new', retryCount: 0 },
    { priority: 'medium', status: 'new', retryCount: 0, error: 'temp failure' }
  ];

  for (const testCase of testCases) {
    console.log(`\nTesting: priority=${testCase.priority}, error=${!!testCase.error}`);
    await complexGraph.invoke(testCase, { maxSteps: 5 });
  }

  console.log('\n=== Example Complete ===\n');
  console.log('💡 Key Takeaways:');
  console.log('  - Property routers enable state-driven workflow branching');
  console.log('  - Range routers handle numeric thresholds elegantly');
  console.log('  - Cycle routers simplify iterative batch processing');
  console.log('  - Multi-condition routers support complex decision logic');
  console.log('  - Routers can be combined for sophisticated workflows');
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  advancedRoutingExample().catch(console.error);
}

export { advancedRoutingExample };
