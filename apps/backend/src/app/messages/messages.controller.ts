import { Controller, Get, Post, Put, Delete, Param, Body } from "@nestjs/common";
import { MessageService } from "./messages.service";
import { TrackingMessage } from "./message.schema";

@Controller('tracked-messages')
export class MessagesController {
    constructor(private readonly messagesService: MessageService) {}
    
    @Get('tracking')
    async getTrackingMessages() {
        const result =  await this.messagesService.findTrackingMessages();
        console.log('Retrieved tracking messages:', result);
        return result;
    }

    @Get('tracking/:id')
    async getTrackingMessage(@Param('id') id: string) {
        const result = await this.messagesService.findOneTracking(id);
        console.log('Retrieved tracking message:', result);
        return result;
    }

    @Post('tracking')
    async createTrackingMessage(@Body() message: Partial<TrackingMessage>) {
        const result = await this.messagesService.createTracking(message);
        console.log('Created tracking message:', result);
        return result;
    }

    @Put('tracking/:id')
    async updateTrackingMessage(@Param('id') id: string, @Body() message: Partial<TrackingMessage>) {
        const result = await this.messagesService.updateTracking(id, message);
        console.log('Updated tracking message:', result);
        return result;
    }

    @Delete('tracking/:id')
    async deleteTrackingMessage(@Param('id') id: string) {
        await this.messagesService.removeTracking(id);
        console.log('Deleted tracking message with id:', id);
        return { message: 'Tracking message deleted successfully' };
    }
}
