# E2E Monitor - Service Bus Monitoring Platform

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

A comprehensive real-time monitoring and management platform for Azure Service Bus, built with modern web technologies including React, NestJS, and Docker.

## 🚀 Overview

The E2E Monitor is a full-stack application that provides:

- **Real-time Service Bus monitoring** with live message tracking
- **Message management** including sending, receiving, and dead letter queue handling
- **Visual configuration management** for Service Bus entities
- **Docker-based Service Bus emulation** for development and testing
- **Modern UI** with Shadcn/UI components and dark/light theme support

## 🏗️ Architecture

### Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Shadcn/UI
- **Backend**: NestJS + TypeScript + MongoDB
- **Service Bus**: Azure Service Bus SDK with Docker emulator
- **Build Tool**: Nx workspace with monorepo structure
- **Testing**: Jest + Playwright + Vitest

### Project Structure

```
/
├── apps/
│   ├── backend/           # NestJS API server
│   ├── backend-e2e/       # Backend integration tests
│   ├── monitor/          # React frontend application
│   └── monitor-e2e/      # Frontend E2E tests
├── libs/
│   └── shared/
│       └── entities/     # Shared TypeScript types/interfaces
├── config/               # Service Bus configuration (single source of truth)
├── docker-compose.yml    # Service Bus emulator setup
└── README.md            # This comprehensive documentation
```

## ⚙️ Configuration Management

### Single Source of Truth

The project maintains centralized configuration in the root directory:

```
/
├── docker-compose.yml              # Docker services configuration
└── config/
    └── servicebus-config.json      # Service Bus entities (topics, queues, subscriptions)
```

### How Applications Access Configuration

#### Backend (NestJS)

- **Method**: Direct filesystem access
- **Path Resolution**: Prioritizes root directory, falls back to relative paths
- **Key Files**:
  - `apps/backend/src/app/common/config.service.ts` - Loads configuration
  - `apps/backend/src/app/service-bus/service-bus.service.ts` - Service Bus initialization

#### Frontend (React)

- **Method**: HTTP requests via Vite build process
- **Process**:
  1. Build time: Vite copies config files to `public/` directory
  2. Runtime: Browser fetches from public URLs (`/servicebus-config.json`)
- **Key Files**:
  - `apps/monitor/vite.config.mts` - Build configuration
  - `apps/monitor/src/app/hooks/api/useServiceBusConfig.ts` - Runtime fetching

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- Git

### Initial Setup

1. **Clone and install dependencies**:

   ```bash
   git clone <repository-url>
   cd e2e-monitor
   npm install
   ```

2. **Start the Service Bus emulator**:

   ```bash
   docker-compose up -d
   ```

3. **Initialize the Service Bus**:

   ```bash
   # The backend will auto-initialize on startup, or manually:
   curl -X POST http://localhost:3000/api/v1/servicebus/debug-init
   ```

4. **Start the development servers**:

   ```bash
   # Start both frontend and backend
   npm start

   # Or individually:
   npm run dev:backend    # Backend on http://localhost:3000
   npm run dev:monitor    # Frontend on http://localhost:4200
   ```

## 🛠️ Development

### Available Scripts

```bash
# Development
npm start                    # Start both backend and frontend
npm run dev:backend         # Start backend only
npm run dev:monitor         # Start frontend only

# Building
npm run build              # Build all projects
npm run build:backend      # Build backend only
npm run build:monitor      # Build frontend only

# Testing
npm run test              # Run all tests
npm run test:backend      # Backend tests only
npm run test:monitor      # Frontend tests only
npm run test:e2e          # End-to-end tests

# Linting & Type Checking
npm run lint              # Lint all projects
npm run typecheck         # TypeScript checking

# Database
npm run init:db           # Initialize test database
```

### Development Workflow

1. **Make configuration changes** in `config/servicebus-config.json`
2. **Restart backend** to pick up configuration changes
3. **Frontend auto-reloads** configuration changes during development
4. **For production builds**: Run `npm run build` to copy config files

## 📱 Frontend Features

### Components & UI

The frontend uses **Shadcn/UI** components for a consistent, modern interface:

- **Navigation**: Sidebar with tab-based navigation (Messages, Send, Configuration)
- **Message Management**: Real-time message display with filtering and search
- **Configuration**: Visual Service Bus entity management
- **Dark/Light Theme**: System-aware theme switching
- **Responsive Design**: Mobile-friendly layout

### Key Components

#### Configuration Tab

- **Connection Status**: Real-time connection testing and status display
- **Service Bus Entities**: Visual display of namespaces, topics, queues, and subscriptions
- **Endpoint Management**: Connection string parsing and validation
- **Entity Statistics**: Count and status of all Service Bus entities

#### Message Management

- **Live Message Feed**: Real-time message monitoring
- **Message Sending**: Test message creation and sending
- **Dead Letter Queue**: DLQ message management and replay
- **Message Filtering**: Advanced filtering and search capabilities

## 🔧 Backend API

### Core Endpoints

#### Service Bus Management

- `GET /api/v1/servicebus/status` - Service Bus initialization status
- `POST /api/v1/servicebus/debug-init` - Manual Service Bus initialization
- `GET /api/v1/servicebus/config` - Current Service Bus configuration
- `GET /api/v1/servicebus/namespaces` - Available namespaces and entities

#### Message Operations

- `POST /api/v1/servicebus/send` - Send messages to topics/queues
- `POST /api/v1/servicebus/send-batch` - Send multiple messages
- `GET /api/v1/servicebus/messages` - Peek active messages
- `GET /api/v1/servicebus/dead-letter-messages` - Retrieve DLQ messages

#### Docker Management

- `GET /api/v1/docker/containers` - List Docker containers
- `POST /api/v1/docker/containers` - Manage container lifecycle
- `GET /api/v1/docker/compose` - Docker Compose configuration

### API Response Format

All endpoints return consistent JSON responses:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    /* response data */
  }
}
```

Error responses:

```json
{
  "statusCode": 500,
  "message": "Error description"
}
```

## 🐳 Docker Services

The application includes a complete Service Bus emulator environment:

### Services Overview

| Service                 | Purpose                    | Ports       | Configuration                      |
| ----------------------- | -------------------------- | ----------- | ---------------------------------- |
| **servicebus-emulator** | Azure Service Bus emulator | 5672, 5300  | Uses config/servicebus-config.json |
| **sqledge**             | SQL Server for emulator    | 1431        | Database storage                   |
| **azurite**             | Azure Storage emulator     | 10000-10002 | Blob/Queue/Table storage           |
| **mongodb**             | Application database       | 27017       | Message persistence                |
| **redis**               | Caching layer              | 6380        | Session and cache storage          |

### Service Bus Configuration

The `config/servicebus-config.json` defines:

```json
{
  "UserConfig": {
    "Namespaces": [
      {
        "Name": "sbemulatorns",
        "Topics": [...],
        "Queues": [...]
      }
    ]
  }
}
```

## 🎨 UI/UX Features

### Shadcn/UI Integration

The frontend uses **Shadcn/UI** for consistent, accessible components:

- **Button variants**: default, outline, ghost, destructive
- **Form components**: Input, Textarea, Select, Label
- **Data display**: Table, Card, Badge components
- **Navigation**: Tabs, Sidebar components
- **Feedback**: Toast notifications with theme support

### Theme System

- **CSS Variables**: Centralized theming via CSS custom properties
- **Dark/Light Mode**: Automatic system theme detection
- **Component Theming**: All shadcn components adapt to theme changes
- **Toast Styling**: Theme-aware notification styling

## 🧪 Testing

### Test Structure

- **Unit Tests**: Jest for component and service testing
- **Integration Tests**: Backend API testing
- **E2E Tests**: Playwright for full user journey testing

### Running Tests

```bash
# All tests
npm run test

# Specific test suites
npm run test:backend
npm run test:monitor
npm run test:e2e

# Coverage reports
npm run test:coverage
```

## 🚀 Production Deployment

### Build Process

1. **Frontend Build**:

   ```bash
   npm run build:monitor
   ```

   - Vite compiles React app
   - Configuration files copied to `dist/`
   - Optimized production bundle created

2. **Backend Build**:
   ```bash
   npm run build:backend
   ```

   - NestJS compiled to JavaScript
   - Production-optimized bundle created

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# Or for production
docker-compose -f docker-compose.prod.yml up -d
```

## 🐛 Troubleshooting

### Common Issues

#### Service Bus Not Initialized (503 Error)

**Symptoms**: Backend returns 503 error for Service Bus operations

**Solution**:

```bash
# Manual initialization
curl -X POST http://localhost:3000/api/v1/servicebus/debug-init

# Or check emulator status
docker-compose ps
```

#### Configuration Files Not Loading

**Symptoms**: Backend can't find config files, frontend shows empty configuration

**Solutions**:

1. Verify files exist in root `config/` directory
2. Restart backend server after config changes
3. Rebuild frontend: `npm run build:monitor`

#### Docker Services Not Starting

**Symptoms**: `docker-compose up` fails or services don't start

**Solutions**:

```bash
# Clean restart
docker-compose down
docker-compose up -d --force-recreate

# Check logs
docker-compose logs servicebus-emulator
```

#### Toast Messages Transparent

**Symptoms**: Toast notifications have transparent background

**Solution**: Toast styling is already configured with solid backgrounds in `providers.tsx`

### Debug Commands

```bash
# Check Service Bus emulator connectivity
curl http://localhost:3000/api/v1/servicebus/status

# Check Docker services
docker-compose ps

# View backend logs
npm run dev:backend  # Check console output

# View frontend logs
npm run dev:monitor  # Check console output
```

## 📚 Additional Resources

### Documentation Files (Consolidated)

This README consolidates information from:

- Configuration Files Structure (`CONFIG_FILES_STRUCTURE.md`)
- Shadcn/UI Integration (`SHADCN_INTEGRATION.md`)
- Setup Summary (`SETUP_SUMMARY.md`)
- App Structure (`apps/monitor/src/app/README.md`)

### External Documentation

- [Nx Workspace](https://nx.dev) - Build system and monorepo management
- [NestJS](https://nestjs.com) - Backend framework
- [React](https://react.dev) - Frontend framework
- [Azure Service Bus](https://azure.microsoft.com/en-us/services/service-bus/) - Message broker
- [Shadcn/UI](https://ui.shadcn.com) - UI component library
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS framework

## 🤝 Contributing

### Development Guidelines

1. **Configuration Changes**: Always edit files in root `config/` directory
2. **Code Style**: Follow ESLint and Prettier configurations
3. **Testing**: Add tests for new features
4. **Documentation**: Update this README for significant changes

### Code Organization

- **Frontend**: Feature-based component organization in `apps/monitor/src/app/components/`
- **Backend**: Module-based organization in `apps/backend/src/app/`
- **Shared**: Type definitions in `libs/shared/entities/src/lib/`

### Pull Request Process

1. Ensure all tests pass: `npm run test`
2. Update documentation if needed
3. Follow conventional commit messages
4. Request review from team members

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:

1. Check the troubleshooting section above
2. Review Docker service logs: `docker-compose logs`
3. Check application console logs
4. Create an issue in the project repository

---

**Built with ❤️ using modern web technologies and best practices.**
