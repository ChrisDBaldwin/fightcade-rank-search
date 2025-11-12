# Task: Implement OpenTelemetry Instrumentation in Fightcade Rank Search

Implement OpenTelemetry instrumentation for the fightcade rank search Node.js/Express web application using the reference implementation from `project-sky-ripple/instrumentation/nodejs/`. Follow these steps:

## Steps to Implement

### 1. Copy Instrumentation File
- Copy `instrumentation/nodejs/instrumentation.js` from the `project-sky-ripple` repo to the root of the fightcade rank search project
- Ensure the file is named `instrumentation.js` and placed at the project root

### 2. Add Dependencies to package.json
Add the following dependencies to the `dependencies` section of `package.json`:

```json
"@opentelemetry/api": "^1.8.0",
"@opentelemetry/auto-instrumentations-node": "^0.43.0",
"@opentelemetry/exporter-metrics-otlp-grpc": "^0.49.1",
"@opentelemetry/exporter-trace-otlp-grpc": "^0.49.1",
"@opentelemetry/instrumentation": "^0.49.1",
"@opentelemetry/instrumentation-express": "^0.38.0",
"@opentelemetry/instrumentation-http": "^0.49.1",
"@opentelemetry/resources": "^1.22.0",
"@opentelemetry/sdk-metrics": "^1.22.0",
"@opentelemetry/sdk-node": "^0.49.1",
"@opentelemetry/sdk-trace-base": "^1.22.0",
"@opentelemetry/sdk-trace-node": "^1.22.0",
"@opentelemetry/semantic-conventions": "^1.22.0"
```

### 3. Update Start Scripts
Modify the `scripts` section in `package.json` to load instrumentation before the app starts:

- If there's a `start` script, update it to: `"start": "node -r ./instrumentation.js <your-entry-file>"` (replace `<your-entry-file>` with the actual entry point, e.g., `app.js`, `server.js`, `index.js`)
- If there's a `dev` script (for development), update it similarly: `"dev": "nodemon -r ./instrumentation.js <your-entry-file>"` (or use `NODE_OPTIONS='-r ./instrumentation.js'` if nodemon doesn't support `-r`)

### 4. Create or Update .env File
Create a `.env` file (or update existing one) with these variables:

```env
OTEL_SERVICE_NAME=fightcade-rank-search
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_LOG_LEVEL=info
NODE_ENV=production
SERVICE_VERSION=1.0.0
```

Adjust `NODE_ENV` and `SERVICE_VERSION` as appropriate for your project. Make sure `.env` is in `.gitignore`.

### 5. Customize Instrumentation (Optional but Recommended)
Review the `instrumentation.js` file and adjust as needed:

- **Health check paths**: Update the `ignoreIncomingRequestHook` array if your app uses different health check endpoints (currently filters `/health`, `/healthz`, `/ping`, `/metrics`)
- **Database instrumentation**: Enable/disable specific database instrumentations (`@opentelemetry/instrumentation-pg`, `@opentelemetry/instrumentation-mongodb`, etc.) based on what databases your app actually uses
- **Custom attributes**: Add any service-specific resource attributes if needed

### 6. Install Dependencies
Run `npm install` to install the new dependencies.

### 7. Verify Integration
- Ensure the instrumentation file loads before any application code
- Check that the app starts without errors
- Verify console output shows: `[OTEL] Tracing initialized for fightcade-rank-search`
- Test that the app functions normally (instrumentation should be transparent)

## Important Notes

- The instrumentation **must** be loaded BEFORE your application code (using `-r ./instrumentation.js`)
- No code changes are required - instrumentation is automatic for Express routes, HTTP requests, and database queries
- If you want custom spans for business logic (e.g., search operations), you can add them later using the OpenTelemetry API (see the README for examples)
- The instrumentation will automatically trace all Express routes, HTTP requests, database queries, and errors

## Testing Checklist

- [ ] App starts without errors
- [ ] Console shows OTEL initialization message
- [ ] App routes work normally
- [ ] Health check endpoints are filtered from traces (if applicable)
- [ ] Dependencies installed successfully

## Reference

See `project-sky-ripple/instrumentation/nodejs/README.md` for detailed documentation, troubleshooting tips, and examples of manual instrumentation.

