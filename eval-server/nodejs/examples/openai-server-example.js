#!/usr/bin/env node

// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Example demonstrating how to use the OpenAI-compatible API server.
 * 
 * This example shows how to start both the WebSocket evaluation server
 * and the OpenAI-compatible HTTP wrapper that multiplexes requests to
 * connected DevTools tabs.
 */

import { EvalServer } from '../src/lib/EvalServer.js';
import { OpenAICompatibleWrapper } from '../src/lib/OpenAICompatibleWrapper.js';

console.log(`
🌟 Browser Operator Evaluation Server with OpenAI-Compatible API

This server provides:
- WebSocket server for DevTools tab connections (port 8080)
- OpenAI-compatible HTTP API (port 8081)

To use:
1. Start this server
2. Connect DevTools tabs via WebSocket to ws://127.0.0.1:8080  
3. Send OpenAI-compatible requests to http://127.0.0.1:8081

Available endpoints:
- GET  /v1/models           - List available models
- POST /v1/chat/completions - Chat completions
- GET  /health              - Health check

Example usage:
  curl http://127.0.0.1:8081/v1/models
  
  curl -X POST http://127.0.0.1:8081/v1/chat/completions \\
    -H "Content-Type: application/json" \\
    -d '{
      "model": "gpt-4.1", 
      "messages": [{"role": "user", "content": "Hello!"}]
    }'

Press Ctrl+C to stop the server.
`);

async function main() {
  console.log('🚀 Starting Browser Operator evaluation server with OpenAI-compatible API...');
  
  // Create WebSocket evaluation server
  const evalServer = new EvalServer({
    authKey: 'hello',
    host: '127.0.0.1',
    port: 8080
  });

  // Set up client connection handlers
  evalServer.onConnect((client) => {
    console.log(`✅ DevTools tab connected: ${client.id}`);
    console.log(`   Tab ID: ${client.tabId}`);
    console.log(`   Base Client ID: ${client.baseClientId}`);
    console.log(`   Connected at: ${new Date().toISOString()}`);
    
    // The client is now ready to receive evaluations via OpenAI API
  });

  evalServer.onDisconnect((clientInfo) => {
    console.log(`❌ DevTools tab disconnected: ${clientInfo.clientId}`);
  });

  // Create OpenAI-compatible HTTP wrapper
  const openaiWrapper = new OpenAICompatibleWrapper(evalServer, {
    host: '127.0.0.1',
    port: 8081,
    modelCacheTTL: 300000 // 5 minutes
  });

  // Graceful shutdown handler
  const shutdown = async () => {
    console.log('\n🛑 Shutting down servers...');
    try {
      await openaiWrapper.stop();
      await evalServer.stop();
      console.log('✅ Servers stopped successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    // Start WebSocket server first
    console.log('🔧 Starting WebSocket evaluation server on ws://127.0.0.1:8080');
    await evalServer.start();
    
    // Start OpenAI-compatible HTTP wrapper
    console.log('🔧 Starting OpenAI-compatible API server on http://127.0.0.1:8081');
    await openaiWrapper.start();
    
    console.log('🎉 Both servers started successfully!');
    console.log('');
    console.log('📡 WebSocket Server: ws://127.0.0.1:8080 (for DevTools connections)');
    console.log('🌐 OpenAI API Server: http://127.0.0.1:8081 (for HTTP requests)');
    console.log('');
    console.log('⏳ Waiting for DevTools tabs to connect...');
    
    // Monitor server status periodically
    const statusInterval = setInterval(() => {
      const evalStatus = evalServer.getStatus();
      const openaiStatus = openaiWrapper.getStatus();
      
      console.log(`📊 Status - Connected clients: ${evalStatus.connectedClients}, Ready: ${evalStatus.readyClients}`);
      console.log(`📊 OpenAI API: ${openaiStatus.isRunning ? 'running' : 'stopped'} on ${openaiStatus.url}`);
    }, 30000); // Every 30 seconds
    
    // Keep the process running
    process.on('beforeExit', () => {
      clearInterval(statusInterval);
    });
    
  } catch (error) {
    console.error('❌ Failed to start servers:', error);
    await shutdown();
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

main().catch(console.error);