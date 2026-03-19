# Mini Apps Architecture

This document describes the Mini Apps framework in the DevTools frontend - a system that enables self-contained UI applications to run as full-screen iframes within DevTools with AI read/write control.

## Overview

Mini apps use a **Controller/SPA pattern** with a message-passing bridge:

```
DevTools Context                    Iframe Context
┌────────────────────┐              ┌─────────────────────┐
│ MiniAppController  │◄────────────►│  SPA (HTML/CSS/JS)  │
│ (business logic)   │    Bridge    │  (UI rendering)     │
└────────────────────┘              └─────────────────────┘
```

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `front_end/panels/ai_chat/mini_apps/` | Core framework and infrastructure |
| `front_end/panels/ai_chat/mini_apps/apps/` | Individual mini app implementations |
| `front_end/panels/ai_chat/mini_apps/routing/` | URL routing system |
| `front_end/panels/ai_chat/tools/mini_app/` | AI tool integrations |

## Core Components

### Type System (`MiniAppTypes.ts`)

```typescript
// Core interfaces
MiniApp {
  id, name, description, icon
  routes: RouteDefinition[]
  getSPA(): MiniAppSPA
  getSupportedActions(): MiniAppAction[]
  getStateSchema(): MiniAppStateSchema
  createController(): MiniAppController
}

MiniAppController {
  initialize(bridge: MiniAppBridge)
  getState() / setState() / updateState()
  executeAction(actionName, args)
  cleanup()
  onClose(callback)
}

MiniAppBridge {
  install(webappId)
  uninstall()
  sendToSPA(action)
  onAction(handler)
  getState()
}
```

### Registry (`MiniAppRegistry.ts`)

Manages mini app lifecycle:
- Registers/unregisters mini app definitions
- Launches instances (single instance per app type)
- Tracks running instances
- Handles cleanup and disposal

### Bridge (`GenericMiniAppBridge.ts`)

Uses Chrome DevTools Protocol (CDP) for bidirectional communication:

**SPA → DevTools** (Event-Driven):
```javascript
// Runtime.addBinding creates this function in iframe
window.__miniAppBridge_{appId}(payload)
// Triggers BindingCalledEvent in DevTools
```

**DevTools → SPA** (Polling + Retry):
```javascript
// Runtime.evaluate calls this in iframe
window.miniApp.dispatch(action)
// Implements exponential backoff (100ms, 200ms, 400ms, 800ms, 1600ms)
```

### Router (`MiniAppRouter.ts` + `MiniAppRouterSPA.ts`)

Hash-based URL routing for navigation state:

```typescript
// Route definitions
routes = [
  { name: 'list', pattern: '#agent-studio' },
  { name: 'agent', pattern: '#agent-studio/agent/:id' },
  { name: 'new', pattern: '#agent-studio/new' },
]

// SPA-side navigation
window.miniAppRouter.navigate('agent', { id: agentId })  // Push history
window.miniAppRouter.replace('agent', { id: agentId })   // Replace current
```

## Data Flow

### Launch Flow

```
1. Registry checks if app already running (single instance per type)
2. Gets SPA content (HTML/CSS/JS) from MiniApp definition
3. Wraps JS with protocol wrapper + router code
4. RenderWebAppTool creates full-screen iframe via srcdoc
5. Bridge installs CDP binding for communication
6. Controller initializes with bridge reference
7. EventBus emits 'app_launched'
```

### Communication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ DevTools Process                                                │
│                                                                 │
│  MiniAppRegistry.launch("agent_studio")                         │
│    ├─ Get SPA content                                           │
│    ├─ Wrap JS with protocol + router                            │
│    └─ RenderWebAppTool → creates iframe                         │
│                                                                 │
│  GenericMiniAppBridge                                           │
│    ├─ sendToSPA(action) → Runtime.evaluate                      │
│    └─ onAction(handler) ← BindingCalledEvent                    │
│                                                                 │
│  Controller.handleAction(SPAAction)                             │
│    └─ Execute business logic, send updates back                 │
└─────────────────────────────────────────────────────────────────┘
                              ↕ CDP Runtime
┌─────────────────────────────────────────────────────────────────┐
│ Iframe (devtools-webapp-{id})                                   │
│                                                                 │
│  Protocol Wrapper:                                              │
│    window.miniApp.dispatch(action)  - receive from DevTools     │
│    window.miniApp.getState()        - return state              │
│    window.miniApp.sendAction()      - send to DevTools          │
│    window.__miniAppBridge_{appId}() - notify DevTools           │
│                                                                 │
│  Router:                                                        │
│    window.miniAppRouter.navigate()                              │
│    window.miniAppRouter.replace()                               │
└─────────────────────────────────────────────────────────────────┘
```

## Protocol Wrapper

Injected into every SPA by `MiniAppRegistry.wrapSPAJavaScript()`:

```javascript
window.miniApp = {
  dispatch(action)              // Handle actions from DevTools
  getState()                    // Return current state
  setState(newState)            // Update state and notify
  updateState(updates)          // Partial state update
  sendAction(type, payload)     // Send custom action to DevTools
  close()                       // Trigger close event
}
```

## Page Refresh Handling (`MiniAppPageMonitor.ts`)

Restores mini apps when the inspected page refreshes:

1. Observes `ResourceTreeModel` for `PrimaryPageChanged` events
2. Detects main frame navigation
3. Parses URL hash for mini app pattern
4. Clears stale instances
5. Relaunches mini app with restored state

## Storage (`MiniAppStorageManager.ts`)

IndexedDB-based persistent storage:

```typescript
// Database: mini_apps_storage_db (v1)
// Object Store: miniAppData
// Key Path: {appId}::{key}

get(appId, key)
set(appId, key, value)
getAll(appId)
clear(appId)
```

## Event Bus (`MiniAppEventBus.ts`)

Event types:
- `app_launched` - When mini app starts
- `app_closed` - When mini app closes
- `state_changed` - When app state changes
- `action_received` / `action_executed` - Action lifecycle
- `error` - When error occurs

```typescript
eventBus.subscribe(callback)                        // All events
eventBus.subscribeToApp(appId, callback)            // Specific app
eventBus.subscribeToType(eventType, callback)       // Specific type
eventBus.waitForEvent(appId, eventType, timeout?)   // Promise-based
```

## AI Tool Integration

Six tools for AI agent control:

| Tool | Purpose |
|------|---------|
| `ListMiniAppsTool` | Discover available apps and their actions |
| `LaunchMiniAppTool` | Start a mini app |
| `GetMiniAppStateTool` | Read current state |
| `UpdateMiniAppStateTool` | Modify state |
| `ExecuteMiniAppActionTool` | Trigger app actions |
| `CloseMiniAppTool` | Terminate app |

## Existing Mini Apps

| App | Location | Purpose |
|-----|----------|---------|
| AgentStudioMiniApp | `apps/agent_studio/` | Agent and tool management |
| DataStudioMiniApp | `apps/data_studio/` | Data visualization |
| FileManagerMiniApp | `apps/file_manager/` | File operations |
| QAAgentMiniApp | `apps/qa_agent/` | Q&A interface |
| AppBuilderMiniApp | `apps/app_builder/` | App creation |
| SkillStudioMiniApp | `apps/skill_studio/` | Skill management |

## Creating a New Mini App

### 1. Create the MiniApp Definition

```typescript
// mini_apps/apps/my_app/MyAppMiniApp.ts
import { MiniApp, MiniAppController, MiniAppBridge } from '../../types/MiniAppTypes.js';

export class MyAppMiniApp implements MiniApp {
  id = 'my_app';
  name = 'My App';
  description = 'Description of my app';
  icon = 'icon-name';

  routes = [
    { name: 'home', pattern: '#my-app' },
    { name: 'detail', pattern: '#my-app/item/:id' },
  ];

  getSPA() {
    return {
      html: `<div id="app"></div>`,
      css: `/* styles */`,
      javascript: `/* SPA code */`,
    };
  }

  getSupportedActions() {
    return [
      { name: 'create-item', description: 'Create new item', schema: {...} },
      { name: 'delete-item', description: 'Delete item', schema: {...} },
    ];
  }

  getStateSchema() {
    return {
      type: 'object',
      properties: {
        items: { type: 'array' },
        selectedId: { type: 'string' },
      },
    };
  }

  createController() {
    return new MyAppController();
  }
}
```

### 2. Create the Controller

```typescript
class MyAppController implements MiniAppController {
  private bridge: MiniAppBridge | null = null;
  private state: MyAppState = { items: [], selectedId: null };

  async initialize(bridge: MiniAppBridge) {
    this.bridge = bridge;
    bridge.onAction(this.handleAction.bind(this));
  }

  private async handleAction(action: SPAToDevToolsAction) {
    switch (action.action) {
      case 'ready':
        await this.bridge?.sendToSPA({
          action: 'init-state',
          payload: this.state,
        });
        break;
      case 'create-item':
        // Handle create
        break;
    }
  }

  async executeAction(actionName: string, args: Record<string, unknown>) {
    // Handle AI-triggered actions
  }

  getState() { return this.state; }
  setState(state: MyAppState) { this.state = state; }
  updateState(updates: Partial<MyAppState>) {
    this.state = { ...this.state, ...updates };
  }

  cleanup() { /* cleanup resources */ }
  onClose(callback: () => void) { /* register close handler */ }
}
```

### 3. Register in Initialization

```typescript
// mini_apps/MiniAppInitialization.ts
import { MyAppMiniApp } from './apps/my_app/MyAppMiniApp.js';

export function initializeMiniApps() {
  // ...existing registrations...
  MiniAppRegistry.register(new MyAppMiniApp());
}
```

## Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `MiniAppTypes.ts` | 282 | Type definitions |
| `GenericMiniAppBridge.ts` | 296 | CDP communication |
| `MiniAppRegistry.ts` | 412 | Lifecycle management |
| `MiniAppRouter.ts` | 168 | Central router |
| `MiniAppRouterSPA.ts` | 202 | SPA router code |
| `MiniAppPageMonitor.ts` | 286 | Page refresh handling |
| `MiniAppEventBus.ts` | 235 | Event propagation |
| `MiniAppStorageManager.ts` | 301 | IndexedDB storage |
| `RenderWebAppTool.ts` | 258 | Iframe creation |
| `AgentStudioMiniApp.ts` | 1337 | Reference implementation |
