export enum MessageState {
  ACTIVE = 'active', // Message is available for processing
  DEFERRED = 'deferred', // Message processing postponed
  SCHEDULED = 'scheduled', // Message scheduled for future delivery
  DEAD_LETTERED = 'dead-lettered', // Message moved to Dead Letter Queue
  COMPLETED = 'completed', // Message successfully processed
  ABANDONED = 'abandoned', // Message processing failed, returned to queue
  RECEIVED = 'received', // Message received but not yet completed
}
