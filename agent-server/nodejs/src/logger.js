import winston from 'winston';
import { existsSync, mkdirSync } from 'fs';
import { CONFIG } from './config.js';

// Ensure logs directory exists
if (!existsSync(CONFIG.logging.dir)) {
  mkdirSync(CONFIG.logging.dir, { recursive: true });
}

const logger = winston.createLogger({
  level: CONFIG.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'bo-eval-server' },
  transports: [
    new winston.transports.File({ 
      filename: `${CONFIG.logging.dir}/error.log`, 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: `${CONFIG.logging.dir}/combined.log` 
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Create dedicated request logger once to avoid recreating on each call
const requestLogger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: `${CONFIG.logging.dir}/requests.jsonl`
    })
  ]
});

export function logRequest(requestData) {
  const logEntry = {
    type: 'request',
    timestamp: new Date().toISOString(),
    ...requestData
  };

  // Pretty print request summary to console
  console.log('\n' + '='.repeat(80));
  console.log(`📊 REQUEST COMPLETED: ${requestData.name}`);
  console.log('='.repeat(80));
  console.log(`🆔 ID: ${requestData.requestId}`);
  console.log(`🔧 Tool: ${requestData.tool}`);
  console.log(`⏱️  Duration: ${requestData.duration}ms`);
  console.log(`👤 Client: ${requestData.clientId}`);

  if (requestData.response?.output?.output) {
    console.log(`\n📝 Output:\n${requestData.response.output.output}`);
  }

  if (requestData.validation?.result) {
    const val = requestData.validation.result;
    console.log(`\n📋 Validation:`);
    console.log(`   ✅ Passed: ${requestData.validation.passed ? 'YES' : 'NO'}`);
    console.log(`   📊 Overall Score: ${val.overall_score}/10`);
    if (val.strengths?.length > 0) {
      console.log(`   💪 Strengths: ${val.strengths.join(', ')}`);
    }
    if (val.weaknesses?.length > 0) {
      console.log(`   ⚠️  Weaknesses: ${val.weaknesses.join(', ')}`);
    }
  }

  console.log('='.repeat(80) + '\n');

  // Also log structured data for file logs
  logger.info('Request completed', logEntry);

  // Also save to dedicated request log
  requestLogger.info(logEntry);
}

// Backward compatibility alias
export function logEvaluation(evaluationData) {
  // Map evaluationId to requestId if present
  const requestData = { ...evaluationData };
  if (evaluationData.evaluationId && !evaluationData.requestId) {
    requestData.requestId = evaluationData.evaluationId;
    delete requestData.evaluationId;
  }
  return logRequest(requestData);
}

export function logRpcCall(callData) {
  logger.info('RPC call', {
    type: 'rpc',
    timestamp: new Date().toISOString(),
    ...callData
  });
}

export function logConnection(connectionData) {
  logger.info('Connection event', {
    type: 'connection',
    timestamp: new Date().toISOString(),
    ...connectionData
  });
}

export default logger;