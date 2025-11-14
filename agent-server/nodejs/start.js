import { BrowserAgentServer } from "./src/lib/BrowserAgentServer.js";
import { HTTPWrapper } from "./src/lib/HTTPWrapper.js";

const WS_PORT = parseInt(process.env.PORT || "8082");
const HTTP_PORT = parseInt(process.env.API_PORT || "8081");
const HOST = process.env.HOST || "0.0.0.0";

console.log("🔧 Creating BrowserAgentServer...");
const browserAgentServer = new BrowserAgentServer({
  host: HOST,
  port: WS_PORT
});

console.log("🔧 Creating HTTP wrapper...");
const httpWrapper = new HTTPWrapper(browserAgentServer, {
  port: HTTP_PORT,
  host: HOST
});

console.log("🔧 Starting BrowserAgentServer...");
await browserAgentServer.start();
console.log(`✅ BrowserAgentServer started on ws://${HOST}:${WS_PORT}`);

console.log("🔧 Starting HTTP wrapper...");
await httpWrapper.start();
console.log(`✅ HTTP API started on http://${HOST}:${HTTP_PORT}`);

console.log("⏳ Server ready for connections...");

// Keep process alive
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});
