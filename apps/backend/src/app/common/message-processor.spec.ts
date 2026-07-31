import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { AppLogger } from './logger.service';
import type { MessageService } from '../messages/messages.service';
import {
  type DispositionActions,
  type ProcessMessageContext,
  MessageProcessor,
} from './message-processor';

type TestMessage = { id: string };
type SettlementAction = (message: TestMessage) => Promise<void>;

function createHarness() {
  const messageService = {
    markMessageReceived:
      jest.fn<MessageService['markMessageReceived']>().mockResolvedValue(null),
    updateDisposition:
      jest.fn<MessageService['updateDisposition']>().mockResolvedValue(null),
  } as unknown as MessageService;
  const logger = {
    log: jest.fn(),
    error: jest.fn(),
  } as unknown as AppLogger;
  const actions: DispositionActions<TestMessage> = {
    complete: jest.fn<SettlementAction>().mockResolvedValue(undefined),
    abandon: jest.fn<SettlementAction>().mockResolvedValue(undefined),
    deadletter: jest.fn<SettlementAction>().mockResolvedValue(undefined),
    defer: jest.fn<SettlementAction>().mockResolvedValue(undefined),
  };
  const context: ProcessMessageContext = {
    messageId: 'message-1',
    disposition: 'complete',
    queueName: 'orders',
    receivedBy: 'test-worker',
    emulatorType: 'sqs',
  };

  jest.spyOn(MessageProcessor, 'randomDelay').mockResolvedValue(undefined);

  return {
    actions,
    context,
    messageService,
    processor: new MessageProcessor(messageService, logger),
  };
}

describe('MessageProcessor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('normalizes supported dispositions and rejects invalid values', () => {
    expect(MessageProcessor.normalizeDisposition(undefined)).toBe('complete');
    expect(MessageProcessor.normalizeDisposition(' DeadLetter ')).toBe(
      'deadletter',
    );
    expect(() => MessageProcessor.normalizeDisposition('discard')).toThrow(
      'Unsupported message disposition: discard',
    );
  });

  it('leaves a message unsettled and skips the tracking outcome when settlement fails', async () => {
    const harness = createHarness();
    const settlementError = new Error('broker unavailable');
    const deadletter = harness.actions.deadletter as jest.Mock<SettlementAction>;
    const complete = harness.actions.complete as jest.Mock<SettlementAction>;
    const updateDisposition = harness.messageService
      .updateDisposition as jest.MockedFunction<
      MessageService['updateDisposition']
    >;

    deadletter.mockRejectedValue(settlementError);

    await expect(
      harness.processor.processMessage(
        { id: 'message-1' },
        { ...harness.context, disposition: 'deadletter' },
        harness.actions,
      ),
    ).rejects.toBe(settlementError);

    expect(complete).not.toHaveBeenCalled();
    expect(updateDisposition).not.toHaveBeenCalled();
  });

  it('records the disposition only after settlement succeeds', async () => {
    const harness = createHarness();
    const abandon = harness.actions.abandon as jest.Mock<SettlementAction>;
    const updateDisposition = harness.messageService
      .updateDisposition as jest.MockedFunction<
      MessageService['updateDisposition']
    >;

    await harness.processor.processMessage(
      { id: 'message-1' },
      { ...harness.context, disposition: 'abandon' },
      harness.actions,
    );

    expect(abandon).toHaveBeenCalledWith({ id: 'message-1' });
    expect(updateDisposition).toHaveBeenCalledWith(
      'message-1',
      'sqs',
      'abandon',
      'test-worker',
    );
  });
});
