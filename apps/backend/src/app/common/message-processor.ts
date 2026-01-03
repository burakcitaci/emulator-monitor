import { AppLogger } from './logger.service';
import { MessageService } from '../messages/messages.service';

export type MessageDisposition = 'complete' | 'abandon' | 'deadletter' | 'defer';

export interface ProcessMessageContext {
  messageId: string;
  disposition: MessageDisposition;
  queueName: string;
  receivedBy: string;
  emulatorType: 'sqs' | 'azure-service-bus';
}

export interface DispositionActions<TMessage> {
  complete: (message: TMessage) => Promise<void>;
  abandon: (message: TMessage) => Promise<void>;
  deadletter: (message: TMessage) => Promise<void>;
  defer: (message: TMessage) => Promise<void>;
}

/**
 * Shared message processor that handles common patterns across all message queue workers:
 * 1. Mark message as received
 * 2. Add random delay to simulate processing (0-2 seconds)
 * 3. Execute disposition action
 * 4. Update disposition in database
 */
export class MessageProcessor {
  constructor(
    private readonly messageService: MessageService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Creates a random delay between 0 and 2000ms to simulate processing time
   */
  static randomDelay(): Promise<void> {
    const delayMs = Math.floor(Math.random() * 5000);
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  /**
   * Normalizes disposition string to lowercase
   */
  static normalizeDisposition(disposition: string | undefined | null): MessageDisposition {
    const normalized = (disposition || 'complete').toLowerCase();
    if (['complete', 'abandon', 'deadletter', 'defer'].includes(normalized)) {
      return normalized as MessageDisposition;
    }
    return 'complete';
  }

  /**
   * Process a message with the standard flow:
   * 1. Mark as received
   * 2. Random delay
   * 3. Execute disposition action
   * 4. Update disposition in DB
   */
  async processMessage<TMessage>(
    message: TMessage,
    context: ProcessMessageContext,
    actions: DispositionActions<TMessage>,
  ): Promise<void> {
    const { messageId, disposition, queueName, receivedBy, emulatorType } = context;
    console.log( emulatorType, "DISPOSITION", disposition);
    const normalizedDisposition = MessageProcessor.normalizeDisposition(disposition);

    console.log( "NORMALIZED DISPOSITION", normalizedDisposition);
    this.logger.log(
      `[${emulatorType}] Processing message ${messageId} with disposition: ${normalizedDisposition}`,
    );

    // Step 1: Mark message as received
    try {
      await this.messageService.markMessageReceived(messageId, receivedBy);
      this.logger.log(`[${emulatorType}] Marked message ${messageId} as received`);
    } catch (error) {
      this.logger.error(`[${emulatorType}] Failed to mark message ${messageId} as received:`, error);
    }

    console.log( "RANDOM DELAY");
    // Step 2: Random delay to simulate processing
    await MessageProcessor.randomDelay();

    console.log( "EXECUTE DISPOSITION ACTION");
    // Step 3: Execute disposition action
    try {
      switch (normalizedDisposition) {
        case 'complete':
          await actions.complete(message);
          this.logger.log(`[${emulatorType}] Completed message ${messageId} from ${queueName}`);
          break;
        case 'abandon':
          await actions.abandon(message);
          this.logger.log(`[${emulatorType}] Abandoned message ${messageId} from ${queueName}`);
          break;
        case 'deadletter':
          await actions.deadletter(message);
          this.logger.log(`[${emulatorType}] Dead-lettered message ${messageId} from ${queueName}`);
          break;
        case 'defer':
          await actions.defer(message);
          this.logger.log(`[${emulatorType}] Deferred message ${messageId} from ${queueName}`);
          break;
      }
    } catch (error) {
      this.logger.error(
        `[${emulatorType}] Failed to execute ${normalizedDisposition} for message ${messageId}:`,
        error,
      );
      // Try to complete as fallback
      try {
        await actions.complete(message);
        this.logger.log(`[${emulatorType}] Completed message ${messageId} as fallback`);
      } catch (fallbackError) {
        this.logger.error(`[${emulatorType}] Fallback complete also failed for ${messageId}:`, fallbackError);
      }
    }

    // Step 4: Update disposition in database
    try {
      await this.messageService.updateDisposition(messageId, normalizedDisposition, receivedBy);
      this.logger.log(`[${emulatorType}] Updated disposition for message ${messageId} to ${normalizedDisposition}`);
    } catch (error) {
      this.logger.error(`[${emulatorType}] Failed to update disposition for message ${messageId}:`, error);
    }
  }
}

