import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TrackingMessage, TrackingMessageDocument } from './message.schema';
import { AppLogger } from '../common/logger.service';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(TrackingMessage.name, 'MessageTrackingDb')
    private readonly messageModel: Model<TrackingMessageDocument>,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(MessageService.name);
  }

  async findTrackingMessages(): Promise<TrackingMessage[]> {
    return this.messageModel.find().sort({ sentAt: -1 }).lean().exec();
  }
  async findTrackingMessagesByEmulator(emulator: string): Promise<TrackingMessage[]> {
    return this.messageModel.find({ emulatorType: emulator }).sort({ sentAt: -1 }).lean().exec();
  }

  async findOneTracking(id: string): Promise<TrackingMessage | null> {
    return this.messageModel.findById(id).lean().exec();
  }

  async findOneTrackingByMessageId(messageId: string): Promise<TrackingMessage | null> {
    return this.messageModel.findOne({ messageId }).lean().exec();
  }

  async createTracking(message: Partial<TrackingMessage>): Promise<TrackingMessageDocument> {
    const createdMessage = new this.messageModel(message);
    this.logger.log(`Creating tracking entry for ${message.messageId}`);
    return createdMessage.save();
  }

  async updateTracking(id: string, message: Partial<TrackingMessage>): Promise<TrackingMessage | null> {
    return this.messageModel
      .findByIdAndUpdate(id, { ...message, updatedAt: new Date() }, { new: true })
      .lean()
      .exec();
  }

  async updateTrackingByMessageId(messageId: string, message: Partial<TrackingMessage>): Promise<TrackingMessage | null> {
    return this.messageModel
      .findOneAndUpdate({ messageId }, { ...message, updatedAt: new Date() }, { new: true })
      .lean()
      .exec();
  }

  async removeTracking(id: string): Promise<void> {
    const result = await this.messageModel.findOneAndDelete({ messageId: id }).exec();
    if (!result) {
      this.logger.warn(`No tracking document found with id ${id}`);
    } else {
      this.logger.log(`Removed tracking document ${id}`);
    }
  }

  async markMessageReceived(messageId: string, receivedBy?: string): Promise<TrackingMessage | null> {
    // Use atomic update to ensure status is always set to 'received'
    // This handles race conditions where status might be 'processing' or other values
    const update = await this.messageModel
      .findOneAndUpdate(
        { messageId },
        {
          $set: {
            status: 'received',
            receivedAt: new Date(),
            receivedBy: receivedBy ?? 'service-bus-worker',
          },
        },
        { new: true, upsert: false },
      )
      .lean()
      .exec();

    if (!update) {
      this.logger.warn(`No tracking document found for received message ${messageId}. Status may still be 'processing'.`);
    } else {
      const previousStatus = update.status === 'received' ? 'unknown' : update.status;
      this.logger.log(`Marked message ${messageId} as received. Previous status: ${previousStatus}, Current status: ${update.status}`);
    }

    return update as unknown as TrackingMessage | null;
  }

  async updateDisposition(messageId: string, disposition: string, receivedBy?: string): Promise<TrackingMessage | null> {
    // First, check current document to see if we need to update status
    const currentDoc = await this.messageModel.findOne({ messageId }).lean().exec();
    
    console.log( "CURRENT DOC", currentDoc);
    if (!currentDoc) {
      this.logger.warn(`No tracking document found for message ${messageId} to update disposition`);
      return null;
    }

    const shouldUpdateStatus = currentDoc.status === 'processing';
    
    // Build update data - always update disposition, conditionally update status
    const updateData: any = {
      $set: {
        disposition,
      },
    };
    
    // If status is still 'processing', also update it to 'received'
    // This ensures UI shows disposition badge instead of "Processing" badge
    // This is a safety net in case markMessageReceived failed or didn't complete
    if (shouldUpdateStatus) {
      updateData.$set.status = 'received';
      // Also set receivedAt and receivedBy if not already set
      if (!currentDoc.receivedAt) {
        updateData.$set.receivedAt = new Date();
      }
      if (receivedBy && !currentDoc.receivedBy) {
        updateData.$set.receivedBy = receivedBy;
      }
      this.logger.log(`Status is still 'processing' for message ${messageId}, updating to 'received' along with disposition`);
    } else if (currentDoc.status !== 'received') {
      // Log if status is not 'received' but also not 'processing' (shouldn't happen, but log for debugging)
      this.logger.warn(`Message ${messageId} has unexpected status '${currentDoc.status}' when updating disposition. Expected 'received' or 'processing'.`);
    }

    // Use atomic update with status check in query to prevent race conditions
    const query = shouldUpdateStatus 
      ? { messageId, status: 'processing' }  // Only update if still 'processing'
      : { messageId };  // Otherwise just update disposition

    const update = await this.messageModel
      .findOneAndUpdate(
        query,
        updateData,
        { new: true },
      )
      .lean()
      .exec();

    if (!update) {
      // If atomic update failed (status changed between check and update), try again without status condition
      if (shouldUpdateStatus) {
        this.logger.warn(`Atomic status update failed for message ${messageId}, retrying without status condition`);
        // Retry with both disposition and status update
        const retryUpdateData: any = {
          $set: {
            disposition,
            status: 'received',
          },
        };
        if (!currentDoc.receivedAt) {
          retryUpdateData.$set.receivedAt = new Date();
        }
        if (receivedBy && !currentDoc.receivedBy) {
          retryUpdateData.$set.receivedBy = receivedBy;
        }
        
        const retryUpdate = await this.messageModel
          .findOneAndUpdate(
            { messageId },
            retryUpdateData,
            { new: true },
          )
          .lean()
          .exec();
        
        if (retryUpdate) {
          this.logger.log(`Updated disposition and status for message ${messageId} to ${disposition} and 'received' (retry after race condition)`);
          return retryUpdate as unknown as TrackingMessage | null;
        }
      }
      this.logger.warn(`No tracking document found for message ${messageId} to update disposition`);
      return null;
    }

    // Log a warning if status is still 'processing' after update (shouldn't happen with atomic update)
    if (update.status === 'processing') {
      this.logger.warn(`disposition status is still "processing" for message ${messageId} after updateDisposition call. This indicates a potential issue with the status update.`);
    }
    
    this.logger.log(`Updated disposition for message ${messageId} to ${disposition}. Current document: ${JSON.stringify({ disposition: update.disposition, status: update.status })}`);

    return update as unknown as TrackingMessage | null;
  }
}