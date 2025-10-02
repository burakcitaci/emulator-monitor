# Service Bus Monitor - Modular Architecture

This application has been refactored following React best practices with a clean, modular architecture.

## Project Structure

```
src/app/
├── components/           # Reusable UI components
│   ├── Header.tsx       # Application header with connection status
│   ├── TabNavigation.tsx # Tab navigation component
│   ├── MessagesTab.tsx  # Messages tab with filtering and table
│   ├── SendMessageTab.tsx # Send message form
│   ├── DeadLetterQueueTab.tsx # DLQ management tab
│   ├── ConnectionTab.tsx # Connection settings tab
│   ├── MessageDetailModal.tsx # Message detail modal
│   ├── MessageTable.tsx # Reusable message table
│   ├── MessageFilters.tsx # Message filtering component
│   ├── DLQTable.tsx     # Dead letter queue table
│   └── index.ts         # Component exports
├── hooks/               # Custom React hooks
│   ├── useMessages.ts   # Message state management
│   └── index.ts         # Hook exports
├── types/               # TypeScript type definitions
│   └── index.ts         # All type definitions
├── utils/               # Utility functions
│   ├── messageUtils.ts  # Message-related utilities
│   └── index.ts         # Utility exports
├── nx-welcome.tsx       # Main application component
└── README.md           # This file
```

## Key Benefits

### 1. **Separation of Concerns**

- Each component has a single responsibility
- Business logic is separated from UI components
- State management is centralized in custom hooks

### 2. **Reusability**

- Components are designed to be reusable across the application
- Utility functions can be shared between components
- Type definitions are centralized and consistent

### 3. **Maintainability**

- Easy to locate and modify specific functionality
- Clear component boundaries make testing easier
- Consistent patterns across all components

### 4. **Type Safety**

- All components are fully typed with TypeScript
- Centralized type definitions prevent inconsistencies
- Better IDE support and error catching

### 5. **Performance**

- Components can be optimized individually
- Potential for lazy loading of tab components
- Better tree-shaking opportunities

## Component Architecture

### Main Component (`nx-welcome.tsx`)

- Orchestrates the overall application state
- Manages tab navigation
- Coordinates between child components
- Handles high-level user interactions

### Feature Components

Each tab is implemented as a separate component:

- **MessagesTab**: Displays and filters messages
- **SendMessageTab**: Form for sending new messages
- **DeadLetterQueueTab**: Manages failed messages
- **ConnectionTab**: Connection configuration

### Shared Components

- **Header**: Application header with status indicators
- **TabNavigation**: Tab switching interface
- **MessageTable**: Reusable table for displaying messages
- **MessageFilters**: Search and filter functionality
- **MessageDetailModal**: Detailed message view

### Custom Hooks

- **useMessages**: Manages message state and operations

### Utilities

- **messageUtils**: Helper functions for message formatting and styling

## Usage Examples

### Adding a New Tab

1. Create a new component in `components/`
2. Add the tab to `TabNavigation.tsx`
3. Import and use in the main component
4. Add the tab type to the `TabId` union type

### Adding a New Message Operation

1. Add the operation to `useMessages` hook
2. Update the relevant component to use the new operation
3. Add any new types to `types/index.ts`

### Styling Components

- All components use Tailwind CSS classes
- Color utilities are centralized in `messageUtils.ts`
- Consistent design patterns across all components

## Best Practices Implemented

1. **Single Responsibility Principle**: Each component has one clear purpose
2. **Props Interface**: All components have well-defined prop interfaces
3. **Custom Hooks**: Business logic is extracted into reusable hooks
4. **Type Safety**: Full TypeScript coverage with proper interfaces
5. **Clean Imports**: Organized imports with barrel exports
6. **Consistent Naming**: Clear, descriptive component and function names
7. **Error Boundaries**: Components handle edge cases gracefully
8. **Accessibility**: Proper ARIA labels and keyboard navigation
