import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { FileService } from './file.service';

@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get(':id')
  async getFile(@Param('id') id: string) {
    const file = await this.fileService.getFile(id);
    return file;
  }
}
