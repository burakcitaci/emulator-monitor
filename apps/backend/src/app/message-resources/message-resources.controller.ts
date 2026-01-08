import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { MessageResourcesService } from "./message-resources.service";
import { CreateMessageResourceDto } from "./dto/create-message.dto";
import { UpdateMessageResourceDto } from "./dto/update-message.dto";

@Controller('message-resources')
export class MessageResourcesController {
  constructor(
    private readonly messageResourcesService: MessageResourcesService,
  ) {}

  @Get('resources')
  async getMessageResources() {
    const result = await this.messageResourcesService.findMessageResources();
    return {
      success: true,
      data: result,
    };
  }
  @Post('resources')
  async createMessageResource(@Body() dto: CreateMessageResourceDto) {
    const result = await this.messageResourcesService.createMessageResource(dto);
    return {
      success: true,
      data: result,
    };
  }
  @Put('resources/:id')
  async updateMessageResource(@Param('id') id: string, @Body() dto: UpdateMessageResourceDto) {
    const result = await this.messageResourcesService.updateMessageResource(id, dto);
    return {
      success: true,
      data: result,
    };
  }
  @Delete('resources/:id')
  async deleteMessageResource(@Param('id') id: string) {
    const result = await this.messageResourcesService.deleteMessageResource(id);
    return {
      success: true,
      data: result,
    };
  }
}