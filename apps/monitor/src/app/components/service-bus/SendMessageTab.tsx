/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Send, Info, Sparkles } from 'lucide-react';
import { SendForm } from '@e2e-monitor/entities';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import toast from 'react-hot-toast';

// ---------------------------
// STATIC CONFIG
// ---------------------------
const CONFIG = {
  UserConfig: {
    Namespaces: [
      {
        Name: "sbemulatorns",
        Topics: [
          {
            Name: "system-messages",
            Properties: {
              DefaultMessageTimeToLive: "PT1H",
              DuplicateDetectionHistoryTimeWindow: "PT20S",
              RequiresDuplicateDetection: false,
            },
            Subscriptions: [
              {
                Name: "funcapp-processor-dev",
                DeadLetteringOnMessageExpiration: true,
                MaxDeliveryCount: 10,
              },
            ],
          },
          {
            Name: "application-events",
            Properties: {
              DefaultMessageTimeToLive: "PT1H",
              DuplicateDetectionHistoryTimeWindow: "PT30S",
              RequiresDuplicateDetection: true,
            },
            Subscriptions: [
              {
                Name: "analytics-processor",
                DeadLetteringOnMessageExpiration: true,
                MaxDeliveryCount: 5,
              },
              {
                Name: "logging-service",
                DeadLetteringOnMessageExpiration: false,
                MaxDeliveryCount: 3,
              },
            ],
          },
        ],
        Queues: [
          {
            Name: "orders-queue",
            Properties: {
              DefaultMessageTimeToLive: "PT1H",
              MaxDeliveryCount: 10,
              DeadLetteringOnMessageExpiration: true,
            },
          },
          {
            Name: "notifications-queue",
            Properties: {
              DefaultMessageTimeToLive: "PT1H",
              MaxDeliveryCount: 5,
              DeadLetteringOnMessageExpiration: true,
            },
          },
          {
            Name: "errm-policy-triggered",
            Properties: {
              DefaultMessageTimeToLive: "PT1H",
              MaxDeliveryCount: 3,
              DeadLetteringOnMessageExpiration: true,
            },
          },
        ],
      },
    ],
    Logging: { Type: "File" },
  },
};

// ---------------------------
// MAIN COMPONENT
// ---------------------------

interface Props {
  form: SendForm;
  onFormChange: (form: SendForm) => void;
  onSend: () => void;
}

export const SendMessageTab: React.FC<Props> = ({ form, onFormChange, onSend }) => {
  const [isInitLoading, setIsInitLoading] = useState(false);
  const [serviceBusInitialized, setServiceBusInitialized] = useState<boolean | null>(null);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // ---------------------------
  // SERVICE BUS STATUS CHECK
  // ---------------------------
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/v1/servicebus/status', {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const data = await res.json();
          setServiceBusInitialized(data.initialized || false);
        } else {
          setServiceBusInitialized(false);
        }
      } catch {
        setServiceBusInitialized(null);
      }
    };

    check();
    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, []);

  // ---------------------------
  // FORM VALIDATION
  // ---------------------------
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};

    const requiredFields = ['queueName', 'subject', 'body'] as const;
    requiredFields.forEach((field) => {
      if (!form[field].trim()) errors[field] = `${field} is required`;
    });

    // body JSON validation
    if (form.body.trim()) {
      try {
        const parsed = JSON.parse(form.body);
        if (typeof parsed === 'object' && Object.keys(parsed).length === 0)
          errors.body = 'Message body cannot be empty JSON object {}';
      } catch {
        errors.body = 'Message body must be valid JSON';
      }
    }

    // properties JSON validation
    if (form.properties.trim()) {
      try {
        JSON.parse(form.properties);
      } catch {
        errors.properties = 'Properties must be valid JSON';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

  // ---------------------------
  // INPUT CHANGE HANDLER
  // ---------------------------
  const handleChange = useCallback(
    (field: keyof SendForm, value: string) => {
      const updated = { ...form, [field]: value };

      // auto-set subject = queueName
      if (field === 'queueName' && value.trim()) {
        updated.subject = value;
      }

      onFormChange(updated);
    },
    [form, onFormChange],
  );

  // ---------------------------
  // DUMMY JSON GENERATION
  // ---------------------------
  const generateDummyData = useCallback(() => {
    const dummy = {
      subject: form.subject || form.queueName,
      policyId: `P${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      violation: ['speed', 'parking', 'red_light'][Math.floor(Math.random() * 3)],
      location: {
        street: ['Main St', 'Oak Ave', 'Elm St'][Math.floor(Math.random() * 3)],
        city: ['New York', 'Los Angeles', 'Chicago'][Math.floor(Math.random() * 3)],
      },
      timestamp: new Date().toISOString(),
    };

    handleChange('body', JSON.stringify(dummy, null, 2));
  }, [form.subject, form.queueName, handleChange]);

  // ---------------------------
  // SEND MESSAGE
  // ---------------------------
  const handleSend = async () => {
    if (!validateForm()) {
      toast.error('Please fix validation errors before sending');
      return;
    }

    try {
      await onSend();
    } catch (err) {
      toast.error('Failed to send message');
    }
  };

  // ---------------------------
  // SERVICE BUS INIT
  // ---------------------------
  const initServiceBus = async () => {
    setIsInitLoading(true);

    try {
      const res = await fetch('http://localhost:3000/api/v1/servicebus/debug-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Initialization failed');
      }

      toast.success('Service Bus initialized!');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message ?? 'Error initializing Service Bus');
    } finally {
      setIsInitLoading(false);
    }
  };

  // ---------------------------
  // UI HELPERS
  // ---------------------------

  const canSend = useMemo(() => {
    const noErrors = Object.keys(validationErrors).length === 0;
    const filled =
      form.queueName.trim() &&
      form.subject.trim() &&
      form.body.trim() &&
      serviceBusInitialized;

    return noErrors && filled;
  }, [validationErrors, form, serviceBusInitialized]);

  // ---------------------------
  // JSX
  // ---------------------------

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Send a test message to your Service Bus emulator.
        </p>

        {serviceBusInitialized === false && (
          <Button
            variant="outline"
            size="sm"
            onClick={initServiceBus}
            disabled={isInitLoading}
          >
            {isInitLoading ? 'Initializing...' : 'Initialize Service Bus'}
          </Button>
        )}
      </div>

      {/* FORM GRID */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* LEFT SIDE */}
        <div className="space-y-6">
          {/* QUEUE SELECT */}
          <QueueTopicSelect
            errors={validationErrors}
            value={form.queueName}
            config={CONFIG}
            onChange={(v:any) => handleChange('queueName', v)}
          />

          {/* BODY */}
          <MessageBodyInput
            value={form.body}
            onChange={(v:any) => handleChange('body', v)}
            onFill={generateDummyData}
            error={validationErrors.body}
          />
        </div>

        {/* RIGHT SIDE */}
        <div className="space-y-6">
          <PropertiesInput
            value={form.properties}
            error={validationErrors.properties}
            onChange={(v:any) => handleChange('properties', v)}
          />

          <Button
            size="lg"
            className="w-full"
            onClick={handleSend}
            disabled={!canSend}
          >
            <Send className="w-5 h-5 mr-2" /> Send Test Message
          </Button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------
// SMALLER SUBCOMPONENTS
// ---------------------------

const QueueTopicSelect = ({ value, onChange, config, errors }: any) => (
  <div className="space-y-1">
    <Label className="flex items-center gap-2">
      Queue/Topic Name <Info className="h-4 w-4 text-muted-foreground" />
    </Label>

    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={errors.queueName ? 'border-destructive' : ''}>
        <SelectValue placeholder="Select..." />
      </SelectTrigger>

      <SelectContent>
        <Section title="Queues" items={config.UserConfig.Namespaces[0].Queues} icon="📦" />
        <Section title="Topics" items={config.UserConfig.Namespaces[0].Topics} icon="📡" />
      </SelectContent>
    </Select>

    {errors.queueName && <p className="text-sm text-destructive">{errors.queueName}</p>}
  </div>
);

const Section = ({ title, items, icon }: any) => (
  <>
    <div className="px-2 py-1.5 mt-1 text-xs font-semibold text-muted-foreground border-t first:border-none first:mt-0">
      {title}
    </div>
    {items.map((x: any) => (
      <SelectItem key={x.Name} value={x.Name}>
        <span aria-hidden>{icon}</span> {x.Name}
      </SelectItem>
    ))}
  </>
);

const MessageBodyInput = ({ value, onChange, onFill, error }: any) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label className="flex items-center gap-2">
        Message Body (JSON) <Info className="h-4 w-4 text-muted-foreground" />
      </Label>
      <Button type="button" variant="outline" size="sm" onClick={onFill}>
        <Sparkles className="h-3 w-3 mr-1" /> Fill
      </Button>
    </div>

    <Textarea
      rows={8}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={error ? 'border-destructive text-sm' : 'text-sm'}
    />

    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);

const PropertiesInput = ({ value, onChange, error }: any) => (
  <div className="space-y-2">
    <Label className="flex items-center gap-2">
      Properties (JSON, Optional) <Info className="h-4 w-4 text-muted-foreground" />
    </Label>

    <Textarea
      rows={4}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={error ? 'border-destructive text-sm' : 'text-sm'}
    />

    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);
