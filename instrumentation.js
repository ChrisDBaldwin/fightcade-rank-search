/**
 * OpenTelemetry Node.js Instrumentation
 *
 * This file sets up automatic instrumentation for Node.js/Express applications.
 * It should be required BEFORE your application code.
 *
 * Usage:
 *   node -r ./instrumentation.js app.js
 *
 * Or in your package.json:
 *   "scripts": {
 *     "start": "node -r ./instrumentation.js app.js"
 *   }
 *
 * Environment Variables:
 *   OTEL_SERVICE_NAME - Name of your service (default: package.json name or 'unknown-service')
 *   OTEL_EXPORTER_OTLP_ENDPOINT - OTLP endpoint (default: http://localhost:4317)
 *   OTEL_TRACES_SAMPLER - Sampler type (default: parentbased_always_on)
 *   OTEL_TRACES_SAMPLER_ARG - Sampler argument (e.g., 0.1 for 10% sampling)
 *   OTEL_LOG_LEVEL - Log level (default: info)
 *   NODE_ENV - Environment (development, production, etc.)
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { Resource } = require('@opentelemetry/resources');
const {
  SemanticResourceAttributes,
  SemanticAttributes
} = require('@opentelemetry/semantic-conventions');
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');

// Set up diagnostic logging (useful for debugging)
const logLevel = process.env.OTEL_LOG_LEVEL?.toUpperCase() || 'INFO';
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel[logLevel]);

// Get service name from environment or package.json
let serviceName = process.env.OTEL_SERVICE_NAME;
if (!serviceName) {
  try {
    const packageJson = require('./package.json');
    serviceName = packageJson.name || 'unknown-service';
  } catch {
    serviceName = 'unknown-service';
  }
}

// Configure resource attributes
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  [SemanticResourceAttributes.SERVICE_NAMESPACE]: process.env.SERVICE_NAMESPACE || 'default',
  // Add custom attributes
  'service.instance.id': process.env.HOSTNAME || require('os').hostname(),
  'process.runtime.name': 'nodejs',
  'process.runtime.version': process.version,
});

// Configure OTLP exporters
// For HTTP exporters, if full path is provided, use it; otherwise use base URL
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://otel.voidtalker.com/v1/traces';
// Extract base URL if full path is provided, otherwise use as-is
const otlpBaseUrl = otlpEndpoint.includes('/v1/') 
  ? otlpEndpoint.substring(0, otlpEndpoint.indexOf('/v1/'))
  : otlpEndpoint;

const traceExporter = new OTLPTraceExporter({
  url: otlpBaseUrl,
});

const metricExporter = new OTLPMetricExporter({
  url: otlpBaseUrl,
});

// Configure metric reader
const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 30000, // Export every 30 seconds
});

// Configure auto-instrumentations
const instrumentations = getNodeAutoInstrumentations({
  // Express instrumentation
  '@opentelemetry/instrumentation-express': {
    requestHook: (span, request) => {
      // Add custom attributes to Express spans
      span.setAttribute('http.route', request.route?.path || 'unknown');
      span.setAttribute('express.type', request.route ? 'route' : 'middleware');
    },
  },
  // HTTP instrumentation
  '@opentelemetry/instrumentation-http': {
    requestHook: (span, request) => {
      // Add custom HTTP request attributes
      span.setAttribute('http.client_ip', request.socket?.remoteAddress || 'unknown');
      span.setAttribute('http.user_agent', request.headers['user-agent'] || 'unknown');
    },
    responseHook: (span, response) => {
      // Add response attributes
      span.setAttribute('http.response.content_length', response.headers['content-length'] || 0);
    },
    // Filter out health check endpoints from tracing
    ignoreIncomingRequestHook: (request) => {
      const ignorePaths = ['/health', '/healthz', '/ping', '/metrics'];
      return ignorePaths.some(path => request.url?.startsWith(path));
    },
  },
  // Database instrumentations - disabled since this app doesn't use databases
  '@opentelemetry/instrumentation-pg': {
    enabled: false,
  },
  '@opentelemetry/instrumentation-mongodb': {
    enabled: false,
  },
  '@opentelemetry/instrumentation-mysql': {
    enabled: false,
  },
  '@opentelemetry/instrumentation-redis': {
    enabled: false,
  },
  // Disable instrumentations you don't need
  '@opentelemetry/instrumentation-fs': {
    enabled: false, // Can be noisy
  },
  '@opentelemetry/instrumentation-dns': {
    enabled: false, // Can be noisy
  },
});

// Initialize the SDK
const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader,
  instrumentations,
});

// Start the SDK
sdk.start();

console.log(`[OTEL] Tracing initialized for ${serviceName}`);
console.log(`[OTEL] Exporting to ${otlpEndpoint}`);
console.log(`[OTEL] Environment: ${resource.attributes[SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]}`);

// Gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('[OTEL] Tracing terminated'))
    .catch((error) => console.error('[OTEL] Error terminating tracing', error))
    .finally(() => process.exit(0));
});

process.on('SIGINT', () => {
  sdk
    .shutdown()
    .then(() => console.log('[OTEL] Tracing terminated'))
    .catch((error) => console.error('[OTEL] Error terminating tracing', error))
    .finally(() => process.exit(0));
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[OTEL] Uncaught exception:', error);
  sdk
    .shutdown()
    .then(() => console.log('[OTEL] Tracing terminated'))
    .catch((error) => console.error('[OTEL] Error terminating tracing', error))
    .finally(() => process.exit(1));
});

module.exports = sdk;

