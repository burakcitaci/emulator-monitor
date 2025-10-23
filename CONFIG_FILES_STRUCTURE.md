# Configuration Files Structure

## Overview

This project maintains a **single source of truth** for configuration files in the root directory. Both the backend and monitor applications read from this centralized location.

## File Locations

### Root Directory (Single Source of Truth)

```
/
├── docker-compose.yml              # Docker Compose configuration
└── config/
    └── servicebus-config.json      # Service Bus configuration
```

These are the **primary files** that should be edited and maintained.

## How Applications Access These Files

### Backend (NestJS)

**Reading Method**: File system (on server)

**Path Resolution Order**:

1. `../../config/servicebus-config.json` (root directory - preferred)
2. `config/servicebus-config.json` (current directory)
3. Relative paths from dist directory (when built)

**Files Involved**:

- `apps/backend/src/app/common/config.service.ts` - Loads `servicebus-config.json`
- `apps/backend/src/app/file/file.service.ts` - Loads `docker-compose.yml`

**Key Code**:

```typescript
// Both services prioritize the root directory
const possiblePaths = [
  path.join(process.cwd(), '..', '..', 'config', 'servicebus-config.json'),
  // ... fallback paths
];
```

### Monitor (React/Vite)

**Reading Method**: HTTP request (from browser)

**Process**:

1. At **build time**: Vite plugin copies files to `public/` directory
   - `public/docker-compose.yml`
   - `public/servicebus-config.json`

2. At **runtime**: Browser fetches from public URL:
   ```typescript
   const response = await fetch('/servicebus-config.json');
   ```

**Files Involved**:

- `apps/monitor/vite.config.mts` - Build configuration with copy plugin
- `apps/monitor/src/app/hooks/api/useServiceBusConfig.ts` - Fetches config at runtime
- `apps/monitor/src/app/components/containers/ContainerSidebar.tsx` - Fetches docker-compose

## Build Process

### Monitor Build Process

1. **Copy Plugin** runs during `closeBundle` phase:

   ```
   Root/docker-compose.yml → apps/monitor/public/docker-compose.yml
   Root/config/servicebus-config.json → apps/monitor/public/servicebus-config.json
   ```

2. **Public Files** are served during development and bundled in production

3. **Vite** outputs final files to `dist/`:
   ```
   apps/monitor/dist/
   ├── index.html
   ├── assets/
   ├── docker-compose.yml       (copied here)
   └── servicebus-config.json   (copied here)
   ```

### Backend Build Process

1. NestJS compiles TypeScript to JavaScript in `dist/`
2. Backend reads from root directory using relative paths
3. No need to copy files - reads directly from filesystem

## ⚠️ Important Guidelines

### DO ✅

- Edit files in the **root directory only**
- Backend will read from root automatically
- Monitor's build will copy to public during build
- Both apps stay in sync

### DON'T ❌

- Edit `apps/monitor/public/docker-compose.yml` directly
- Edit `apps/monitor/public/servicebus-config.json` directly
- These are generated files - changes will be lost on rebuild

## File Contents

### docker-compose.yml

Defines all services:

- servicebus-emulator
- sqledge (SQL Server)
- azurite (Azure Storage)
- mongodb
- redis
- mockservice

Paths reference the root directory:

```yaml
volumes:
  - './config/servicebus-config.json:/ServiceBus_Emulator/ConfigFiles/Config.json'
  - './azurite-data:/data'
  - './init-test-db.sql:/opt/init-test-db.sql'
```

### servicebus-config.json

Defines Service Bus entities:

- Namespaces
- Queues
- Topics
- Subscriptions

Used by:

- Service Bus Emulator (mounts as Config.json)
- Backend Service Bus Service (reads for configuration)
- Monitor app (displays configuration)

## Running the Application

### Development

```bash
# Start both applications
npm start

# Backend reads from: root/config/servicebus-config.json
# Monitor reads from: root/config/servicebus-config.json (via Vite)
```

### Production

```bash
# Build monitor
npm run build

# Monitor files are copied to public/ during build
# Backend reads from root directory
```

## Troubleshooting

### Backend Can't Find Config File

Check the logs - they will show which paths were tried:

```
✓ Loading Service Bus configuration from: /path/to/root/config/servicebus-config.json
```

If you see `✗ Failed`, the paths in `config.service.ts` may need adjustment based on your environment.

### Monitor Can't Load Config

Check browser console - it shows the fetch path:

```
GET /servicebus-config.json
```

If 404, ensure:

1. Files exist in root directory
2. Build was run (`npm run build`)
3. Files were copied to `public/`

### Files Are Out of Sync

If changes aren't reflected:

1. **Backend**: Restart the backend server
2. **Monitor Dev**: Changes should auto-detect; if not, restart dev server
3. **Monitor Build**: Rebuild with `npm run build`

## Environment Variables

**COMPOSE_PATH** (Optional)

- Set by Docker Compose Service
- Defaults to `process.cwd()`
- Can override docker-compose location

Example:

```bash
export COMPOSE_PATH=/custom/path
npm start
```
