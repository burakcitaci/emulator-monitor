# Service Bus Configuration Guide

## 📋 Overview

The Service Bus Monitor now reads its queue and topic configuration from a JSON file, making it easy to manage your Azure Service Bus infrastructure without code changes.

## 🗂️ Configuration File

Location: `apps/monitor/src/app/config/servicebus-config.json`

### Structure

```json
{
  "UserConfig": {
    "Namespaces": [
      {
        "Name": "solution-monitor-ns",
        "Topics": [...],
        "Queues": [...]
      }
    ],
    "Logging": {
      "Type": "File"
    }
  }
}
```

## 📦 Queues Configuration

Each queue has:

- **Name**: The queue identifier
- **Properties**: Configuration settings
  - `DefaultMessageTimeToLive`: How long messages live (ISO 8601 duration)
  - `MaxDeliveryCount`: Maximum delivery attempts before dead-lettering
  - `DeadLetteringOnMessageExpiration`: Whether to dead-letter expired messages

Example:

```json
{
  "Name": "orders-queue",
  "Properties": {
    "DefaultMessageTimeToLive": "PT24H",
    "MaxDeliveryCount": 10,
    "DeadLetteringOnMessageExpiration": true
  }
}
```

## 📡 Topics Configuration

Each topic has:

- **Name**: The topic identifier
- **Properties**: Topic settings
  - `DefaultMessageTimeToLive`: Message lifetime
  - `DuplicateDetectionHistoryTimeWindow`: Time window for duplicate detection
  - `RequiresDuplicateDetection`: Enable/disable duplicate detection
- **Subscriptions**: Array of topic subscriptions

### Subscriptions

Each subscription has:

- **Name**: Subscription identifier
- **DeadLetteringOnMessageExpiration**: Dead-letter on expiration
- **MaxDeliveryCount**: Maximum delivery attempts

Example:

```json
{
  "Name": "system-messages",
  "Properties": {
    "DefaultMessageTimeToLive": "PT1H",
    "DuplicateDetectionHistoryTimeWindow": "PT20S",
    "RequiresDuplicateDetection": false
  },
  "Subscriptions": [
    {
      "Name": "funcapp-processor-dev",
      "DeadLetteringOnMessageExpiration": true,
      "MaxDeliveryCount": 10
    }
  ]
}
```

## 🔧 Current Configuration

### Namespaces

- **solution-monitor-ns**

### Queues

1. **orders-queue**

   - TTL: 24 hours
   - Max Delivery: 10
   - Dead-letter on expiration: ✅

2. **notifications-queue**

   - TTL: 6 hours
   - Max Delivery: 5
   - Dead-letter on expiration: ✅

3. **errm-policy-triggered**
   - TTL: 12 hours
   - Max Delivery: 3
   - Dead-letter on expiration: ✅

### Topics

1. **system-messages**

   - TTL: 1 hour
   - Duplicate Detection: 20 seconds
   - Subscriptions:
     - `funcapp-processor-dev` (Max: 10 deliveries)

2. **application-events**
   - TTL: 2 hours
   - Duplicate Detection: 30 seconds (enabled)
   - Subscriptions:
     - `analytics-processor` (Max: 5 deliveries)
     - `logging-service` (Max: 3 deliveries)

## 💻 How It Works

### 1. Custom Hook: `useServiceBusConfig`

Located: `apps/monitor/src/app/hooks/useServiceBusConfig.ts`

Provides:

```typescript
{
  config, // Full configuration object
    queuesAndTopics, // All items with details
    allDestinations, // Simple list of all names
    getQueueNames, // Returns only queue names
    getTopicNames, // Returns only topic names
    getSubscriptionsByTopic; // Get subscriptions for a topic
}
```

### 2. Type Definitions

Located: `apps/monitor/src/app/types/servicebus.ts`

Includes all TypeScript interfaces for:

- `ServiceBusConfig`
- `ServiceBusNamespace`
- `ServiceBusTopic`
- `ServiceBusQueue`
- `ServiceBusSubscription`
- `QueueTopicItem`

### 3. UI Integration

#### Send Message Tab

- Dropdown populated with configured queues and topics
- Grouped display: Queues (📦) and Topics (📡)
- Auto-updates when configuration changes

#### Message Filters

- Filter dropdown uses configured destinations
- Shows all active queues and topics

#### Dead Letter Queue Tab

- Queue selector populated from configuration

## 🚀 Usage Examples

### Adding a New Queue

1. Open `servicebus-config.json`
2. Add to the `Queues` array:

```json
{
  "Name": "payments-queue",
  "Properties": {
    "DefaultMessageTimeToLive": "PT1H",
    "MaxDeliveryCount": 5,
    "DeadLetteringOnMessageExpiration": true
  }
}
```

3. Save the file - the UI will automatically pick it up!

### Adding a New Topic with Subscriptions

```json
{
  "Name": "user-events",
  "Properties": {
    "DefaultMessageTimeToLive": "PT3H",
    "DuplicateDetectionHistoryTimeWindow": "PT1M",
    "RequiresDuplicateDetection": true
  },
  "Subscriptions": [
    {
      "Name": "email-service",
      "DeadLetteringOnMessageExpiration": true,
      "MaxDeliveryCount": 3
    },
    {
      "Name": "webhook-notifier",
      "DeadLetteringOnMessageExpiration": false,
      "MaxDeliveryCount": 5
    }
  ]
}
```

## ⏱️ Time Format (ISO 8601 Duration)

- `PT1H` = 1 hour
- `PT24H` = 24 hours
- `PT30M` = 30 minutes
- `PT20S` = 20 seconds
- `P1D` = 1 day
- `PT2H30M` = 2 hours 30 minutes

## 📊 Mock Data

The application includes realistic mock data for testing:

- 5 sample messages across different queues/topics
- 2 dead-letter messages
- Various message types (orders, events, notifications, policies)

## 🎯 Benefits

1. **No Code Changes**: Update configuration without touching code
2. **Type Safety**: Full TypeScript support with interfaces
3. **Auto-Discovery**: UI automatically discovers new queues/topics
4. **Organized Display**: Clear separation between queues and topics
5. **Easy Testing**: Mock data matches actual configuration

## 🔄 Future Enhancements

Potential additions:

- Load configuration from API endpoint
- Runtime configuration updates
- Multiple namespace support in UI
- Configuration validation
- Import/export configuration
- Environment-specific configs (dev/staging/prod)

## 📝 Notes

- The configuration is loaded once at application start
- Changes require a page refresh to take effect
- All destinations are available in filters and selectors
- Topic subscriptions are tracked but not yet shown in UI (future enhancement)
