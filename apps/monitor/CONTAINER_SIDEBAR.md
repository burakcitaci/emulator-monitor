# Container Sidebar Feature

## Overview

The Container Sidebar displays real-time status of all containers defined in your `docker-compose.yml` file. This is crucial for testing your emulators and ensuring all dependencies are running correctly.

## Features

### 1. **Real-time Container Status**

- Automatically fetches container status every 5 seconds
- **Smooth background refresh** - No blinking or loading states during updates
- Small blue indicator shows when data is refreshing
- Smooth transitions when container status changes
- Color-coded status indicators:
  - 🟢 **Green** - Container is running
  - 🔴 **Red** - Container has exited
  - 🟡 **Yellow** - Container is paused
  - 🔵 **Blue** - Container is restarting
  - ⚫ **Gray** - Container not found

### 2. **Container Information Display**

- **Container Name**: Display name from docker-compose.yml
- **Project Badge**: Shows the Docker Compose project label (e.g., "jira-app")
- **Image**: Docker image being used (shortened for readability)
- **Status Badge**: Current container state with detailed status text
- **Ports**: Exposed ports (first 3 shown, with count for additional)
- **Dependencies**: Shows what services this container depends on

### 3. **Visual Indicators**

- Pulsing green dot for running containers
- Border highlighting for active containers
- Badge showing running/total containers at the top
- Small blue pulsing dot during background refresh
- Smooth 300ms transitions for status changes
- No flickering or blinking during updates

### 4. **Project Filtering**

- **Smart dropdown filter** to show containers by Docker Compose project
- Automatically detects projects from `com.docker.compose.project` label
- Shows container count for each project
- Filter persists during auto-refresh (no blinking)
- "All Projects" option to see everything

## How It Works

### Frontend (`useFile` + `useDocker` hooks)

1. **`useFile` Hook** - Fetches and parses the docker-compose.yml file
2. **`useDocker` Hook** - Fetches current Docker container status from backend
3. **ContainerSidebar Component** - Combines both data sources to show accurate status

### Backend API Endpoints

#### Docker Controller (`/api/docker`)

- **GET `/api/docker`** - List all containers (running and stopped)
- **GET `/api/docker/:id`** - Get detailed container information
- **POST `/api/docker/:id/start`** - Start a container
- **POST `/api/docker/:id/stop`** - Stop a container
- **POST `/api/docker/:id/restart`** - Restart a container
- **GET `/api/docker/:id/logs`** - Get container logs (last 100 lines)
- **GET `/api/docker/:id/stats`** - Get container resource statistics

#### File Controller (`/api/file`)

- **GET `/api/file/docker-compose.yml`** - Fetch and parse docker-compose.yml

## Container Matching Logic

The sidebar intelligently matches docker-compose services with running containers using:

1. **Container Name** - Exact match with `container_name` field
2. **Service Name** - Falls back to matching service name in container name
3. **Project Labels** - Reads `com.docker.compose.project` from Docker labels for filtering

## Usage

### Starting Your Emulators

```bash
# Start all containers defined in docker-compose.yml
docker-compose up -d

# Or start specific services
docker-compose up -d emulator sqledge azurite
```

### Monitoring in the UI

1. Open the monitor app (default: http://localhost:4200)
2. The sidebar automatically loads on the left
3. Use the **project filter dropdown** to focus on specific compose projects
4. Watch for status changes in real-time
5. Green pulsing dot = Container is healthy and running
6. Each container shows its project badge for easy identification

### Critical Containers for Testing

Based on your docker-compose.yml, these are your core emulator containers:

1. **servicebus-emulator** - Main Azure Service Bus Emulator

   - Ports: 5672, 5300
   - Dependencies: sqledge, azurite

2. **sqledge** - SQL Server for metadata

   - Port: 1431 (host) → 1433 (container)

3. **azurite** - Azure Storage Emulator

   - Ports: 10000, 10001, 10002

4. **mongodb** - MongoDB for raw errors

   - Port: 27017

5. **redis** - Redis cache

   - Port: 6380 (host) → 6379 (container)

6. **mockservice** - WireMock for API mocking
   - Port: 8081 (host) → 8080 (container)

## Troubleshooting

### Containers Show as "not-found"

```bash
# Check if Docker daemon is running
docker ps

# Start containers if not running
docker-compose up -d

# Check logs for specific container
docker-compose logs emulator
```

### Backend Not Connecting to Docker

Make sure Docker socket is accessible:

**Windows**: Docker Desktop must be running
**Linux**: User must be in docker group

```bash
sudo usermod -aG docker $USER
```

**macOS**: Docker Desktop must be running

### Refresh Issues

The sidebar auto-refreshes every 5 seconds in the background without showing loading states:

- **Smooth updates**: Data refreshes without blinking
- **Visual feedback**: Small blue dot appears during refresh
- **Initial load**: Full loading skeleton only shown on first load
- **Subsequent updates**: Containers update in place with smooth transitions

To force a manual refresh:

1. Reload the page
2. Restart the monitor app

## Future Enhancements

Potential improvements for the sidebar:

- [x] Filter containers by project (using com.docker.compose.project label)
- [ ] Click container to view detailed logs
- [ ] Start/stop/restart buttons for each container
- [ ] Resource usage (CPU/Memory) indicators
- [ ] Container health checks
- [ ] Quick actions menu (restart, view logs, etc.)
- [ ] Filter containers by status (running/exited/etc.)
- [ ] Search containers by name
- [ ] Collapsible sidebar
- [ ] Multiple project selection

## Code Structure

```
apps/monitor/src/app/
├── components/
│   └── ContainerSidebar.tsx       # Main sidebar component
├── hooks/
│   ├── useFile.ts                 # Hook for fetching docker-compose.yml
│   └── useDocker.ts               # Hook for Docker API
└── app.tsx                        # Main app with sidebar integration

apps/backend/src/app/
├── docker/
│   ├── docker.controller.ts       # Docker API endpoints
│   ├── docker.service.ts          # Docker service logic
│   └── docker.module.ts           # Docker module
└── file/
    ├── file.controller.ts         # File API endpoints
    └── file.service.ts            # File service logic
```

## Development

### Adding New Container Actions

1. Add method to `docker.service.ts`:

```typescript
async myAction(idOrName: string) {
  const container = this.docker.getContainer(idOrName);
  return container.myAction();
}
```

2. Add endpoint to `docker.controller.ts`:

```typescript
@Post(':id/myaction')
async myAction(@Param('id') id: string) {
  return this.dockerService.myAction(id);
}
```

3. Add hook method in `useDocker.ts`:

```typescript
const performAction = async (containerId: string) => {
  await fetch(`http://localhost:3000/api/docker/${containerId}/myaction`, {
    method: 'POST',
  });
};
```

4. Add UI button in `ContainerSidebar.tsx`

## API Reference

### Docker Service Methods

| Method                        | Description           | Parameters                         |
| ----------------------------- | --------------------- | ---------------------------------- |
| `listContainers()`            | List all containers   | None                               |
| `getContainer(id)`            | Get container details | Container ID or name               |
| `startContainer(id)`          | Start a container     | Container ID or name               |
| `stopContainer(id)`           | Stop a container      | Container ID or name               |
| `restartContainer(id)`        | Restart a container   | Container ID or name               |
| `getContainerLogs(id, tail?)` | Get logs              | Container ID, lines (default: 100) |
| `getContainerStats(id)`       | Get resource stats    | Container ID or name               |

### Response Types

**ContainerInfo** (from dockerode):

```typescript
{
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
  Ports: Array<{ PrivatePort: number; PublicPort: number; Type: string }>;
  // ... more fields
}
```

**DockerCompose Service**:

```typescript
{
  container_name?: string;
  image?: string;
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
  depends_on?: string[];
  networks?: Record<string, { aliases?: string[] }>;
}
```
