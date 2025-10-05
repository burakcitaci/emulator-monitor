import React, { useEffect, useState } from 'react';
import { Send, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { SendForm } from '../../types';
import { useServiceBusConfig } from '../../hooks';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useServiceBus } from '../../hooks/useServiceBus';
import serviceBusConfigJson from '../../config/servicebus-config.json';
import toast from 'react-hot-toast';
import { FormSkeleton } from '../ui/skeleton';

interface SendMessageTabProps {
  form: SendForm;
  onFormChange: (form: SendForm) => void;
  onSend: () => void;
}

// Connection string for the Service Bus Emulator
const CONNECTION_STRING =
  'Endpoint=sb://localhost;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=SAS_KEY_VALUE;UseDevelopmentEmulator=true';

export const SendMessageTab: React.FC<SendMessageTabProps> = ({
  form,
  onFormChange,
  onSend,
}) => {
  const { getQueueNames, getTopicNames } = useServiceBusConfig();
  const { sendMessage, initialize, isInitialized, loading, error } =
    useServiceBus();

  const queues = getQueueNames();
  const topics = getTopicNames();

  // Validation state - moved before any early returns
  const [validationErrors, setValidationErrors] = useState<{
    queueName?: string;
    body?: string;
    properties?: string;
  }>({});

  // Initialize Service Bus on component mount - moved before early return
  useEffect(() => {
    const initializeServiceBus = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await initialize(serviceBusConfigJson as any, CONNECTION_STRING);
        console.log('Service Bus initialized successfully');
      } catch (err) {
        console.error('Failed to initialize Service Bus:', err);
      }
    };

    if (!isInitialized) {
      initializeServiceBus();
    }
  }, [isInitialized, initialize]);

  // Show loading state while initializing or if no data available
  if (!isInitialized && loading) {
    return <FormSkeleton />;
  }

  const validateForm = () => {
    const errors: typeof validationErrors = {};

    if (!form.queueName.trim()) {
      errors.queueName = 'Queue/Topic name is required';
    }

    if (!form.body.trim()) {
      errors.body = 'Message body is required';
    } else {
      try {
        JSON.parse(form.body);
      } catch {
        errors.body = 'Message body must be valid JSON';
      }
    }

    if (form.properties.trim()) {
      try {
        JSON.parse(form.properties);
      } catch {
        errors.properties = 'Properties must be valid JSON';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateField = (
    field: keyof typeof validationErrors,
    value: string
  ) => {
    const errors = { ...validationErrors };

    switch (field) {
      case 'queueName':
        if (!value.trim()) {
          errors.queueName = 'Queue/Topic name is required';
        } else {
          delete errors.queueName;
        }
        break;
      case 'body':
        if (!value.trim()) {
          errors.body = 'Message body is required';
        } else {
          try {
            JSON.parse(value);
            delete errors.body;
          } catch {
            errors.body = 'Message body must be valid JSON';
          }
        }
        break;
      case 'properties':
        if (value.trim()) {
          try {
            JSON.parse(value);
            delete errors.properties;
          } catch {
            errors.properties = 'Properties must be valid JSON';
          }
        } else {
          delete errors.properties;
        }
        break;
    }

    setValidationErrors(errors);
  };

  const handleInputChange = (field: keyof SendForm, value: string) => {
    onFormChange({ ...form, [field]: value });
    validateField(field, value);
  };

  const handleSendTestMessage = async () => {
    if (!validateForm()) {
      toast.error('Please fix validation errors before sending');
      return;
    }

    try {
      // Parse form data
      const messageBody = form.body ? JSON.parse(form.body) : {};
      const messageProperties = form.properties
        ? JSON.parse(form.properties)
        : undefined;

      await sendMessage({
        namespace: 'solution-monitor-ns', // Azure Service Bus Emulator requires this exact namespace name
        topic: form.queueName, // Use the queue/topic from the form
        message: {
          body: messageBody,
          contentType: 'application/json',
          messageId: `msg-${Date.now()}`,
          timeToLive: 500, // 5 seconds - will expire quickly
          subject: form.queueName,
          applicationProperties: messageProperties,
        },
      });

      toast.success(`Message sent successfully to ${form.queueName}!`, {
        duration: 3000,
        icon: '🚀',
      });

      // Reset form after successful send
      onFormChange({ queueName: '', body: '', properties: '' });
      setValidationErrors({});
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to send message. Please try again.',
        {
          duration: 5000,
        }
      );
    }
  };

  const renderConnectionStatus = () => (
    <div className="rounded-lg border p-4 mb-4">
      <div className="flex items-center space-x-2">
        {isInitialized ? (
          <>
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="font-medium text-green-700">
              Service Bus Connected
            </span>
          </>
        ) : loading ? (
          <>
            <AlertCircle className="w-5 h-5 text-yellow-500 animate-pulse" />
            <span className="font-medium text-yellow-700">
              Initializing Service Bus...
            </span>
          </>
        ) : (
          <>
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="font-medium text-red-700">
              Service Bus Not Connected
            </span>
          </>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-2">Error: {error.message}</p>
      )}
    </div>
  );

  const renderQueueTopicSelect = () => (
    <div className="space-y-2">
      <Label htmlFor="queueName" className="flex items-center gap-2">
        Queue/Topic Name
        <Info
          className="h-4 w-4 text-muted-foreground"
          title="Select a queue or topic to send messages to"
        />
      </Label>
      <Select
        value={form.queueName}
        onValueChange={(value) => handleInputChange('queueName', value)}
      >
        <SelectTrigger
          id="queueName"
          className={validationErrors.queueName ? 'border-destructive' : ''}
        >
          <SelectValue placeholder="Select queue or topic..." />
        </SelectTrigger>
        <SelectContent>
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Queues
          </div>
          {queues.map((queue) => (
            <SelectItem key={queue} value={queue}>
              📦 {queue}
            </SelectItem>
          ))}
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
            Topics
          </div>
          {topics.map((topic) => (
            <SelectItem key={topic} value={topic}>
              📡 {topic}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {validationErrors.queueName && (
        <p className="text-sm text-destructive">{validationErrors.queueName}</p>
      )}
    </div>
  );

  const renderMessageBodyInput = () => (
    <div className="space-y-2">
      <Label htmlFor="messageBody" className="flex items-center gap-2">
        Message Body (JSON)
        <Info
          className="h-4 w-4 text-muted-foreground"
          title="Enter valid JSON for the message body"
        />
      </Label>
      <Textarea
        id="messageBody"
        value={form.body}
        onChange={(e) => handleInputChange('body', e.target.value)}
        rows={8}
        className={`font-mono text-sm ${
          validationErrors.body ? 'border-destructive' : ''
        }`}
        placeholder='{"policyId": "P001", "violation": "speed"}'
      />
      {validationErrors.body && (
        <p className="text-sm text-destructive">{validationErrors.body}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Enter valid JSON. Example:{' '}
        <span aria-label="opening curly brace">{'{'}</span>"policyId": "P001",
        "violation": "speed"<span aria-label="closing curly brace">{'}'}</span>
      </p>
    </div>
  );

  const renderPropertiesInput = () => (
    <div className="space-y-2">
      <Label htmlFor="properties" className="flex items-center gap-2">
        Properties (JSON, Optional)
        <Info
          className="h-4 w-4 text-muted-foreground"
          title="Optional application properties as JSON"
        />
      </Label>
      <Textarea
        id="properties"
        value={form.properties}
        onChange={(e) => handleInputChange('properties', e.target.value)}
        rows={4}
        className={`font-mono text-sm ${
          validationErrors.properties ? 'border-destructive' : ''
        }`}
        placeholder='{"severity": "high"}'
      />
      {validationErrors.properties && (
        <p className="text-sm text-destructive">
          {validationErrors.properties}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Optional JSON properties. Example:{' '}
        <span aria-label="opening curly brace">{'{'}</span>"severity": "high",
        "priority": 1<span aria-label="closing curly brace">{'}'}</span>
      </p>
    </div>
  );

  const renderSendButton = () => {
    const isFormValid = validateForm();
    const canSend = isInitialized && !loading && isFormValid;

    return (
      <div className="space-y-3">
        <Button
          onClick={handleSendTestMessage}
          disabled={!canSend}
          className="w-full"
          size="lg"
        >
          <Send className="w-5 h-5 mr-2" />
          {loading ? 'Sending...' : 'Send Test Message'}
        </Button>
        {!isFormValid && (
          <p className="text-sm text-muted-foreground text-center">
            Please fix the validation errors above before sending
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-2xl space-y-6">
      {renderConnectionStatus()}
      {renderQueueTopicSelect()}
      {renderMessageBodyInput()}
      {renderPropertiesInput()}
      {renderSendButton()}
    </div>
  );
};
