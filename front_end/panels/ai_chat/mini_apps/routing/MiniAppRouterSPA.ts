// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { RouteDefinition } from './MiniAppRouter.js';

/**
 * Generate JavaScript code for the SPA-side router
 *
 * This code is injected into mini app SPAs to provide a clean routing API:
 * - window.miniAppRouter.navigate(routeName, params) - Navigate with history entry
 * - window.miniAppRouter.replace(routeName, params) - Replace current state
 * - window.miniAppRouter.buildHash(routeName, params) - Build hash without navigating
 *
 * The router automatically handles:
 * - Building URL hashes from route definitions
 * - Listening for popstate events (back/forward navigation)
 * - Notifying DevTools of route changes
 */
export function generateSPARouterCode(appId: string, routes: RouteDefinition[]): string {
  return `
// ============================================================================
// Mini App Router (auto-injected)
// ============================================================================
(function() {
  var routes = ${JSON.stringify(routes)};
  var appId = '${appId}';
  var lastNavigatedRoute = null;
  var lastNavigatedParams = null;

  window.miniAppRouter = {
    routes: routes,
    appId: appId,

    /**
     * Navigate to a route (creates history entry for back/forward)
     * @param {string} routeName - The route name (e.g., 'table', 'selector')
     * @param {Object} params - Route parameters (e.g., { tableId: '123' })
     */
    navigate: function(routeName, params) {
      // Prevent duplicate navigation
      if (routeName === lastNavigatedRoute &&
          JSON.stringify(params) === JSON.stringify(lastNavigatedParams)) {
        console.log('[MiniAppRouter] Skipping duplicate navigation to:', routeName);
        return;
      }

      var hash = this.buildHash(routeName, params);
      var state = {
        appId: this.appId,
        routeName: routeName,
        params: params || {},
        timestamp: Date.now()
      };

      try {
        window.parent.history.pushState(state, '', hash);
        lastNavigatedRoute = routeName;
        lastNavigatedParams = params;
        console.log('[MiniAppRouter] Navigated to:', routeName, params, hash);
      } catch (e) {
        console.error('[MiniAppRouter] Failed to pushState:', e);
      }
    },

    /**
     * Replace current route (no history entry)
     * @param {string} routeName - The route name
     * @param {Object} params - Route parameters
     */
    replace: function(routeName, params) {
      var hash = this.buildHash(routeName, params);
      var state = {
        appId: this.appId,
        routeName: routeName,
        params: params || {},
        timestamp: Date.now()
      };

      try {
        window.parent.history.replaceState(state, '', hash);
        lastNavigatedRoute = routeName;
        lastNavigatedParams = params;
        console.log('[MiniAppRouter] Replaced with:', routeName, params, hash);
      } catch (e) {
        console.error('[MiniAppRouter] Failed to replaceState:', e);
      }
    },

    /**
     * Build a URL hash from route name and parameters
     * @param {string} routeName - The route name
     * @param {Object} params - Route parameters
     * @returns {string} The URL hash
     */
    buildHash: function(routeName, params) {
      var route = this.routes.find(function(r) { return r.name === routeName; });
      if (!route) {
        console.warn('[MiniAppRouter] Unknown route:', routeName);
        return '#' + this.appId.replace(/_/g, '-');
      }

      var hash = route.pattern;
      if (params) {
        for (var key in params) {
          if (params.hasOwnProperty(key)) {
            hash = hash.replace(':' + key, encodeURIComponent(params[key]));
          }
        }
      }
      return hash;
    },

    /**
     * Parse a URL hash into route information
     * @param {string} hash - The URL hash
     * @returns {Object|null} { routeName, params } or null
     */
    parseHash: function(hash) {
      if (!hash || hash.charAt(0) !== '#') return null;

      for (var i = 0; i < this.routes.length; i++) {
        var route = this.routes[i];
        var match = this._matchPattern(hash, route.pattern);
        if (match) {
          return { routeName: route.name, params: match };
        }
      }
      return null;
    },

    /**
     * Match a hash against a pattern and extract parameters
     * @private
     */
    _matchPattern: function(hash, pattern) {
      var paramNames = [];
      var regexPattern = pattern.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, function(_, name) {
        paramNames.push(name);
        return '([^/]+)';
      });

      var regex = new RegExp('^' + regexPattern + '$');
      var match = hash.match(regex);

      if (!match) return null;

      var params = {};
      paramNames.forEach(function(name, index) {
        params[name] = decodeURIComponent(match[index + 1]);
      });
      return params;
    },

    /**
     * Handle route restoration (called by DevTools on page refresh)
     * @param {Object} routeInfo - { routeName, params }
     */
    handleRestore: function(routeInfo) {
      console.log('[MiniAppRouter] Restoring route:', routeInfo);
      lastNavigatedRoute = routeInfo.routeName;
      lastNavigatedParams = routeInfo.params;

      // Notify SPA of route restoration
      if (typeof window.onRouteRestore === 'function') {
        window.onRouteRestore(routeInfo.routeName, routeInfo.params);
      }
    },

    /**
     * Initialize popstate listener for back/forward navigation
     * @private
     */
    _initPopstateListener: function() {
      var self = this;
      window.parent.addEventListener('popstate', function(e) {
        if (e.state && e.state.appId === self.appId) {
          console.log('[MiniAppRouter] Popstate event:', e.state);
          lastNavigatedRoute = e.state.routeName;
          lastNavigatedParams = e.state.params;

          // Notify SPA of navigation
          if (typeof window.onRouteChange === 'function') {
            window.onRouteChange(e.state.routeName, e.state.params);
          }
        }
      });
    }
  };

  // Initialize popstate listener
  window.miniAppRouter._initPopstateListener();

  console.log('[MiniAppRouter] Initialized for app:', appId, 'with routes:', routes.map(function(r) { return r.name; }));
})();
// ============================================================================
// End Mini App Router
// ============================================================================

`;
}
