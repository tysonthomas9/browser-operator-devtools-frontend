// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {QAAgentMiniApp} from '../QAAgentMiniApp.js';

describe('ai_chat: QAAgentMiniApp', () => {
  describe('parseGeneratedSteps', () => {
    let controller: any;

    beforeEach(() => {
      const miniApp = new QAAgentMiniApp();
      controller = miniApp.createController();
    });

    afterEach(() => {
      sinon.restore();
    });

    it('parses JSON array directly', () => {
      const json = JSON.stringify([
        {
          id: 'step-1',
          type: 'click',
          description: 'Click button',
          cdpCommand: {click: {xpath: '//button'}},
        },
      ]);

      const steps = controller.parseGeneratedSteps(json);

      assert.isArray(steps);
      assert.lengthOf(steps, 1);
      assert.strictEqual(steps[0].id, 'step-1');
      assert.strictEqual(steps[0].type, 'click');
      assert.strictEqual(steps[0].description, 'Click button');
      assert.deepEqual(steps[0].cdpCommand, {click: {xpath: '//button'}});
    });

    it('extracts JSON from markdown code block with json tag', () => {
      const output = `Here are the generated steps:

\`\`\`json
[
  {
    "id": "step-1",
    "type": "navigate",
    "description": "Navigate to page",
    "cdpCommand": {"navigate": {"url": "https://example.com"}}
  }
]
\`\`\`

These steps should work.`;

      const steps = controller.parseGeneratedSteps(output);

      assert.isArray(steps);
      assert.lengthOf(steps, 1);
      assert.strictEqual(steps[0].id, 'step-1');
      assert.strictEqual(steps[0].type, 'navigate');
    });

    it('extracts JSON from markdown code block without language tag', () => {
      const output = `\`\`\`
[{"id": "step-1", "type": "click", "description": "Click", "cdpCommand": {"click": {}}}]
\`\`\``;

      const steps = controller.parseGeneratedSteps(output);

      assert.isArray(steps);
      assert.lengthOf(steps, 1);
    });

    it('extracts raw JSON array from text', () => {
      const output = `Here are the steps: [{"id": "step-1", "type": "fill", "description": "Fill input", "cdpCommand": {"fill": {"xpath": "//input", "value": "test"}}}] Hope this helps!`;

      const steps = controller.parseGeneratedSteps(output);

      assert.isArray(steps);
      assert.lengthOf(steps, 1);
      assert.strictEqual(steps[0].type, 'fill');
    });

    it('filters invalid steps missing type field', () => {
      const json = JSON.stringify([
        {id: 'step-1', description: 'Missing type', cdpCommand: {}},
        {id: 'step-2', type: 'click', description: 'Valid', cdpCommand: {click: {}}},
      ]);

      const steps = controller.parseGeneratedSteps(json);

      assert.isArray(steps);
      assert.lengthOf(steps, 1);
      assert.strictEqual(steps[0].id, 'step-2');
    });

    it('filters invalid steps missing description field', () => {
      const json = JSON.stringify([
        {id: 'step-1', type: 'click', cdpCommand: {click: {}}},
        {id: 'step-2', type: 'click', description: 'Valid', cdpCommand: {click: {}}},
      ]);

      const steps = controller.parseGeneratedSteps(json);

      assert.isArray(steps);
      assert.lengthOf(steps, 1);
      assert.strictEqual(steps[0].id, 'step-2');
    });

    it('filters invalid steps missing cdpCommand field', () => {
      const json = JSON.stringify([
        {id: 'step-1', type: 'click', description: 'Missing cdpCommand'},
        {id: 'step-2', type: 'click', description: 'Valid', cdpCommand: {click: {}}},
      ]);

      const steps = controller.parseGeneratedSteps(json);

      assert.isArray(steps);
      assert.lengthOf(steps, 1);
      assert.strictEqual(steps[0].id, 'step-2');
    });

    it('generates IDs for steps without them', () => {
      const json = JSON.stringify([
        {type: 'click', description: 'Click 1', cdpCommand: {click: {}}},
        {type: 'click', description: 'Click 2', cdpCommand: {click: {}}},
        {id: 'custom-id', type: 'click', description: 'Click 3', cdpCommand: {click: {}}},
      ]);

      const steps = controller.parseGeneratedSteps(json);

      assert.isArray(steps);
      assert.lengthOf(steps, 3);
      assert.strictEqual(steps[0].id, 'step-1');
      assert.strictEqual(steps[1].id, 'step-2');
      assert.strictEqual(steps[2].id, 'custom-id');
    });

    it('handles invalid JSON gracefully', () => {
      const output = 'This is not valid JSON {broken';

      const steps = controller.parseGeneratedSteps(output);

      assert.isArray(steps);
      assert.lengthOf(steps, 0);
    });

    it('handles non-array JSON gracefully', () => {
      const output = '{"type": "click", "description": "Single object"}';

      const steps = controller.parseGeneratedSteps(output);

      assert.isArray(steps);
      assert.lengthOf(steps, 0);
    });

    it('handles empty array', () => {
      const output = '[]';

      const steps = controller.parseGeneratedSteps(output);

      assert.isArray(steps);
      assert.lengthOf(steps, 0);
    });

    it('preserves timeout field when present', () => {
      const json = JSON.stringify([
        {
          id: 'step-1',
          type: 'wait',
          description: 'Wait for element',
          cdpCommand: {wait: {type: 'selector', selector: '#btn'}},
          timeout: 5000,
        },
      ]);

      const steps = controller.parseGeneratedSteps(json);

      assert.isArray(steps);
      assert.lengthOf(steps, 1);
      assert.strictEqual(steps[0].timeout, 5000);
    });

    it('parses multiple valid steps', () => {
      const json = JSON.stringify([
        {id: 'step-1', type: 'navigate', description: 'Go to page', cdpCommand: {navigate: {url: 'https://example.com'}}},
        {id: 'step-2', type: 'fill', description: 'Enter username', cdpCommand: {fill: {xpath: '//input[@name="user"]', value: 'testuser'}}},
        {id: 'step-3', type: 'click', description: 'Submit form', cdpCommand: {click: {xpath: '//button[@type="submit"]'}}},
        {id: 'step-4', type: 'assert', description: 'Check URL', cdpCommand: {assert: {type: 'urlContains', expected: '/dashboard'}}},
      ]);

      const steps = controller.parseGeneratedSteps(json);

      assert.isArray(steps);
      assert.lengthOf(steps, 4);
      assert.strictEqual(steps[0].type, 'navigate');
      assert.strictEqual(steps[1].type, 'fill');
      assert.strictEqual(steps[2].type, 'click');
      assert.strictEqual(steps[3].type, 'assert');
    });

    it('handles whitespace in JSON', () => {
      const json = `
        [
          {
            "id": "step-1",
            "type": "click",
            "description": "Click button",
            "cdpCommand": {
              "click": {
                "xpath": "//button"
              }
            }
          }
        ]
      `;

      const steps = controller.parseGeneratedSteps(json);

      assert.isArray(steps);
      assert.lengthOf(steps, 1);
    });
  });

  describe('QAAgentMiniApp metadata', () => {
    it('has correct id', () => {
      const miniApp = new QAAgentMiniApp();
      assert.strictEqual(miniApp.id, 'qa_agent');
    });

    it('has correct name', () => {
      const miniApp = new QAAgentMiniApp();
      assert.strictEqual(miniApp.name, 'QA Agent');
    });

    it('has description', () => {
      const miniApp = new QAAgentMiniApp();
      assert.isString(miniApp.description);
      assert.isNotEmpty(miniApp.description);
    });

    it('has icon', () => {
      const miniApp = new QAAgentMiniApp();
      assert.isString(miniApp.icon);
    });

    it('has routes defined', () => {
      const miniApp = new QAAgentMiniApp();
      assert.isArray(miniApp.routes);
      assert.isNotEmpty(miniApp.routes);

      // Check for expected routes
      const routeNames = miniApp.routes.map(r => r.name);
      assert.include(routeNames, 'list');
      assert.include(routeNames, 'test');
      assert.include(routeNames, 'new');
      assert.include(routeNames, 'suite');
    });
  });

  describe('getSPA', () => {
    it('returns SPA with html, css, and js', () => {
      const miniApp = new QAAgentMiniApp();
      const spa = miniApp.getSPA();

      assert.isObject(spa);
      assert.isString(spa.html);
      assert.isString(spa.css);
      assert.isString(spa.js);
    });
  });

  describe('getSupportedActions', () => {
    it('returns array of action schemas', () => {
      const miniApp = new QAAgentMiniApp();
      const actions = miniApp.getSupportedActions();

      assert.isArray(actions);
      assert.isNotEmpty(actions);

      // Check that actions have required fields
      for (const action of actions) {
        assert.isString(action.name);
        assert.isString(action.description);
        assert.isObject(action.schema);
      }
    });

    it('includes expected actions', () => {
      const miniApp = new QAAgentMiniApp();
      const actions = miniApp.getSupportedActions();
      const actionNames = actions.map(a => a.name);

      assert.include(actionNames, 'list-tests');
      assert.include(actionNames, 'create-test');
      assert.include(actionNames, 'generate-steps');
      assert.include(actionNames, 'run-test');
      assert.include(actionNames, 'delete-test');
      assert.include(actionNames, 'list-suites');
      assert.include(actionNames, 'create-suite');
    });
  });

  describe('getStateSchema', () => {
    it('returns state schema object', () => {
      const miniApp = new QAAgentMiniApp();
      const schema = miniApp.getStateSchema();

      assert.isObject(schema);
      assert.strictEqual(schema.type, 'object');
      assert.isObject(schema.properties);
    });

    it('includes expected state properties', () => {
      const miniApp = new QAAgentMiniApp();
      const schema = miniApp.getStateSchema();

      assert.property(schema.properties, 'view');
      assert.property(schema.properties, 'activeTab');
      assert.property(schema.properties, 'testCases');
      assert.property(schema.properties, 'testSuites');
      assert.property(schema.properties, 'isGeneratingSteps');
      assert.property(schema.properties, 'isRunningTest');
    });
  });

  describe('createController', () => {
    it('creates a controller instance', () => {
      const miniApp = new QAAgentMiniApp();
      const controller = miniApp.createController();

      assert.isObject(controller);
      assert.isFunction(controller.initialize);
      assert.isFunction(controller.cleanup);
      assert.isFunction(controller.getState);
      assert.isFunction(controller.setState);
      assert.isFunction(controller.executeAction);
    });
  });
});
