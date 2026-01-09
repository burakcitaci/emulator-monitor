import { InjectModel } from "@nestjs/mongoose";
import { MessagingResource, MessagingResourceDocument } from "./message-resources.schema";
import { Model } from "mongoose";
import { CreateMessageResourceDto } from "./dto/create-message.dto";
import { UpdateMessageResourceDto } from "./dto/update-message.dto";
import { NotFoundException } from "@nestjs/common";

export class MessageResourcesService {
  constructor(
    @InjectModel(MessagingResource.name, 'MessageTrackingDb')
    private readonly messagingResourceModel: Model<MessagingResourceDocument>,
  ) {}

  async findMessageResources(): Promise<MessagingResource[]> {
    return this.messagingResourceModel.find().lean().exec();
  }
  async createMessageResource(dto: CreateMessageResourceDto): Promise<MessagingResource> {
    const created = await this.messagingResourceModel.create({
      id: crypto.randomUUID(),
      ...dto,
    });
    return created.toObject();
  }
  async updateMessageResource(id: string, dto: UpdateMessageResourceDto): Promise<MessagingResource> {
    const result = await this.messagingResourceModel.findOneAndUpdate({ id }, dto, { new: true }).lean().exec();
    if (!result) {
      throw new NotFoundException('Message resource not found');
    }
    return result;
  }
  async deleteMessageResource(id: string): Promise<MessagingResource> {
    const result = await this.messagingResourceModel.findOneAndDelete({ id }).lean().exec();
    if (!result) {
      throw new NotFoundException('Message resource not found');
    }
    return result;
  }
}   