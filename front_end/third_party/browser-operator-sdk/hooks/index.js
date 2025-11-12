// src/hooks/index.ts
async function executeOnStart(hooks, context) {
  if (hooks?.onStart) {
    await hooks.onStart(context);
  }
}
async function executeOnIteration(hooks, context, iteration) {
  if (hooks?.onIteration) {
    await hooks.onIteration(context, iteration);
  }
}
async function executeOnToolCall(hooks, context, toolCall) {
  if (hooks?.onToolCall) {
    await hooks.onToolCall(context, toolCall);
  }
}
async function executeOnToolResult(hooks, context, result) {
  if (hooks?.onToolResult) {
    await hooks.onToolResult(context, result);
  }
}
async function executeOnFinish(hooks, context, result) {
  if (hooks?.onFinish) {
    await hooks.onFinish(context, result);
  }
}
async function executeOnError(hooks, context, error) {
  if (hooks?.onError) {
    await hooks.onError(context, error);
  }
}
function createDefaultHooks() {
  return {
    onStart: async () => {
    },
    onIteration: async () => {
    },
    onToolCall: async () => {
    },
    onToolResult: async () => {
    },
    onFinish: async () => {
    },
    onError: async () => {
    }
  };
}
function mergeHooks(base, override) {
  return {
    onStart: override.onStart || base.onStart,
    onIteration: override.onIteration || base.onIteration,
    onToolCall: override.onToolCall || base.onToolCall,
    onToolResult: override.onToolResult || base.onToolResult,
    onFinish: override.onFinish || base.onFinish,
    onError: override.onError || base.onError
  };
}

export { createDefaultHooks, executeOnError, executeOnFinish, executeOnIteration, executeOnStart, executeOnToolCall, executeOnToolResult, mergeHooks };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map