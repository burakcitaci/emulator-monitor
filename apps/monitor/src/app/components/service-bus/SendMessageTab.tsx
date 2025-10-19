import React, { useState, useCallback } from 'react';
import {
  Send,
  CheckCircle,
  AlertCircle,
  Info,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { SendForm } from '@e2e-monitor/entities';
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
import { useServiceBusConfig } from '../../hooks/useServiceBusConfig';
import { useMonitor } from '../../hooks/useMonitor';
import toast from 'react-hot-toast';
import { FormSkeleton } from '../ui/skeleton';

interface SendMessageTabProps {
  form: SendForm;
  onFormChange: (form: SendForm) => void;
  onSend: () => void;
}

export const SendMessageTab: React.FC<SendMessageTabProps> = ({
  form,
  onFormChange,
  onSend,
}) => {
  const {
    config,
    getQueueNames,
    getTopicNames,
    loading: configLoading,
  } = useServiceBusConfig();
  const { isLoading, isSendingMessage, error } = useMonitor();

  const queues = getQueueNames();
  const topics = getTopicNames();

  // Validation state - moved before any early returns
  const [validationErrors, setValidationErrors] = useState<{
    queueName?: string;
    body?: string;
    properties?: string;
    subject?: string;
  }>({});

  // Memoize validation functions to prevent infinite re-renders
  const validateForm = useCallback(() => {
    const errors: typeof validationErrors = {};

    if (!form.queueName.trim()) {
      errors.queueName = 'Queue/Topic name is required';
    }

    if (!form.subject.trim()) {
      errors.subject = 'Subject is required';
    }

    if (!form.body.trim()) {
      errors.body = 'Message body is required';
    } else {
      try {
        const parsed = JSON.parse(form.body);
        // Check if the parsed JSON is an empty object
        if (
          parsed &&
          typeof parsed === 'object' &&
          Object.keys(parsed).length === 0
        ) {
          errors.body = 'Message body cannot be empty JSON object {}';
        }
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
  }, [form.queueName, form.subject, form.body, form.properties]);

  // Validation is now inlined in handleInputChange to avoid dependency issues

  const handleInputChange = useCallback(
    (field: keyof SendForm, value: string) => {
      const updatedForm = { ...form, [field]: value };

      // If queueName is being changed, also update the subject to match
      if (field === 'queueName' && value.trim()) {
        updatedForm.subject = value;
      }

      onFormChange(updatedForm);

      // Inline validation to avoid dependency issues
      const errors = { ...validationErrors };

      if (field === 'queueName' || field === 'subject') {
        if (!value.trim()) {
          if (field === 'queueName') {
            errors.queueName = 'Queue/Topic name is required';
          } else {
            errors.subject = 'Subject is required';
          }
        } else {
          if (field === 'queueName') {
            delete errors.queueName;
          } else {
            delete errors.subject;
          }
        }
      } else if (field === 'body') {
        if (!value.trim()) {
          errors.body = 'Message body is required';
        } else {
          try {
            const parsed = JSON.parse(value);
            // Check if the parsed JSON is an empty object
            if (
              parsed &&
              typeof parsed === 'object' &&
              Object.keys(parsed).length === 0
            ) {
              errors.body = 'Message body cannot be empty JSON object {}';
            } else {
              delete errors.body;
            }
          } catch {
            errors.body = 'Message body must be valid JSON';
          }
        }
      } else if (field === 'properties') {
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
      }

      setValidationErrors(errors);
    },
    [form, onFormChange, validationErrors]
  );

  const generateDummyData = useCallback(
    (queueName?: string) => {
      const dummyData = {
        subject: form.subject || queueName || form.queueName || 'test-queue',
        policyId: `P${Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, '0')}`,
        violation: ['speed', 'parking', 'red_light', 'no_entry', 'wrong_way'][
          Math.floor(Math.random() * 5)
        ],
        location: {
          street: ['Main St', 'Oak Ave', 'Elm St', 'Park Rd', 'First Ave'][
            Math.floor(Math.random() * 5)
          ],
          city: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][
            Math.floor(Math.random() * 5)
          ],
          state: ['NY', 'CA', 'IL', 'TX', 'AZ'][Math.floor(Math.random() * 5)],
        },
        timestamp: new Date().toISOString(),
        severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        officerId: `OFF${Math.floor(Math.random() * 100)
          .toString()
          .padStart(3, '0')}`,
        vehicleInfo: {
          licensePlate: `ABC${Math.floor(Math.random() * 900) + 100}`,
          make: ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'BMW'][
            Math.floor(Math.random() * 5)
          ],
          model: ['Camry', 'Civic', 'F-150', 'Silverado', 'X3'][
            Math.floor(Math.random() * 5)
          ],
          color: ['White', 'Black', 'Silver', 'Blue', 'Red'][
            Math.floor(Math.random() * 5)
          ],
        },
      };

      const formattedData = JSON.stringify(dummyData, null, 2);
      handleInputChange('body', formattedData);
    },
    [handleInputChange, form.subject, form.queueName]
  );

  // Show loading state only during initial loading, not when backend is unavailable
  if (configLoading) {
    return <FormSkeleton />;
  }

  const handleSendTestMessage = async () => {
    if (!validateForm()) {
      toast.error('Please fix validation errors before sending');
      return;
    }

    try {
      // Call the parent's send handler (which uses useMonitor's sendMessage)
      onSend();
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

  const renderConnectionStatus = () => {
    const isBackendUnavailable = !config && !configLoading;

    let statusContent;
    if (isBackendUnavailable) {
      statusContent = (
        <>
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="font-medium text-red-700">
            Backend Service Unavailable
          </span>
        </>
      );
    } else if (isLoading) {
      statusContent = (
        <>
          <AlertCircle className="w-5 h-5 text-yellow-500 animate-pulse" />
          <span className="font-medium text-yellow-700">
            Initializing Service Bus...
          </span>
        </>
      );
    } else {
      statusContent = (
        <>
          <CheckCircle className="w-5 h-5 text-green-500" />
          <span className="font-medium text-green-700">
            Service Bus Connected
          </span>
        </>
      );
    }

    return (
      <div className="rounded-lg border p-4 mb-4">
        <div className="flex items-center space-x-2">{statusContent}</div>
        {isBackendUnavailable && (
          <p className="text-sm text-red-600 mt-2">
            Unable to connect to backend service. Please ensure the backend is
            running and accessible.
          </p>
        )}
        {error && !isBackendUnavailable && (
          <p className="text-sm text-red-600 mt-2">Error: {error}</p>
        )}
      </div>
    );
  };

  const renderQueueTopicSelect = () => (
    <div className="space-y-2">
      <Label htmlFor="queueName" className="flex items-center gap-2">
        Queue/Topic Name
        <Info className="h-4 w-4 text-muted-foreground" />
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
              <span aria-hidden="true">📦</span> {queue}
            </SelectItem>
          ))}
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
            Topics
          </div>
          {topics.map((topic) => (
            <SelectItem key={topic} value={topic}>
              <span aria-hidden="true">📡</span> {topic}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {validationErrors.queueName && (
        <p className="text-sm text-destructive">{validationErrors.queueName}</p>
      )}
    </div>
  );

  const renderSubjectInput = () => (
    <div className="space-y-2">
      <Label htmlFor="subject" className="flex items-center gap-2">
        Subject
        <Info className="h-4 w-4 text-muted-foreground" />
      </Label>
      <input
        id="subject"
        type="text"
        value={form.subject}
        onChange={(e) => handleInputChange('subject', e.target.value)}
        className={`w-full px-3 py-2 border rounded-md text-sm ${
          validationErrors.subject ? 'border-destructive' : 'border-input'
        }`}
        placeholder="Enter message subject..."
      />
      {validationErrors.subject && (
        <p className="text-sm text-destructive">{validationErrors.subject}</p>
      )}
    </div>
  );

  const renderMessageBodyInput = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="messageBody" className="flex items-center gap-2">
          Message Body (JSON)
          <Info className="h-4 w-4 text-muted-foreground" />
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => generateDummyData(form.queueName)}
          className="h-7 px-2 text-xs"
        >
          <Sparkles className="h-3 w-3 mr-1" />
          Fill
        </Button>
      </div>
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
        <Info className="h-4 w-4 text-muted-foreground" />
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
    const isBackendUnavailable = !config && !configLoading;

    // Check if form is valid based on validationErrors state (no state updates during render)
    const isFormValid =
      Object.keys(validationErrors).length === 0 &&
      form.queueName.trim() !== '' &&
      form.subject.trim() !== '' &&
      form.body.trim() !== '';
    const canSend = !isSendingMessage && isFormValid && !isBackendUnavailable;

    return (
      <div className="space-y-3">
        <Button
          onClick={handleSendTestMessage}
          disabled={!canSend || isSendingMessage}
          className="w-full"
          size="lg"
        >
          {isSendingMessage ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              Send Test Message
            </>
          )}
        </Button>
        {isBackendUnavailable && (
          <p className="text-sm text-muted-foreground text-center">
            Backend service is unavailable. Please start the backend service to
            send messages.
          </p>
        )}
        {!isBackendUnavailable && Object.keys(validationErrors).length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Please fix the validation errors above before sending
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Send Test Message</h2>
        <p className="text-muted-foreground">
          Send a test message to your Service Bus emulator for testing purposes.
        </p>
      </div>

      {/* Connection Status */}
      {renderConnectionStatus()}

      {/* Main Form */}
      <div className="bg-card border rounded-lg p-8 shadow-sm">
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              {renderQueueTopicSelect()}
              {renderSubjectInput()}
              {renderMessageBodyInput()}
            </div>
            <div className="space-y-6">
              {renderPropertiesInput()}
              {renderSendButton()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
