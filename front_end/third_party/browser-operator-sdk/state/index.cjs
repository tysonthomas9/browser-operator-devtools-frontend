'use strict';

// src/state/index.ts
function createInitialState() {
  return {
    messages: [],
    context: {},
    metadata: {},
    variables: {}
  };
}
function createUserMessage(text, entity) {
  return {
    entity,
    text,
    id: generateId(),
    timestamp: Date.now()
  };
}
function addMessage(state, message) {
  return {
    ...state,
    messages: [...state.messages, message]
  };
}
function updateContext(state, context) {
  return {
    ...state,
    context: { ...state.context, ...context }
  };
}
function updateVariables(state, variables) {
  return {
    ...state,
    variables: { ...state.variables, ...variables }
  };
}
function setError(state, error) {
  return {
    ...state,
    error
  };
}
function clearError(state) {
  const { error, ...rest } = state;
  return rest;
}
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
function cloneState(state) {
  return {
    ...state,
    messages: [...state.messages],
    context: { ...state.context },
    metadata: { ...state.metadata },
    variables: { ...state.variables }
  };
}

exports.addMessage = addMessage;
exports.clearError = clearError;
exports.cloneState = cloneState;
exports.createInitialState = createInitialState;
exports.createUserMessage = createUserMessage;
exports.setError = setError;
exports.updateContext = updateContext;
exports.updateVariables = updateVariables;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map