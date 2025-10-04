import { Controller, Get, Param } from '@nestjs/common';
import { FileService } from './file.service';

@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get(':name')
  async getFile(@Param('name') name: string) {
    const file = await this.fileService.getFile(name);
    return file;
  }
}
