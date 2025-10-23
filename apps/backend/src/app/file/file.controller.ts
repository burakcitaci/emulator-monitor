import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { FileService } from './file.service';
import { AppLogger } from '../common/logger.service';

@Controller('file')
export class FileController {
  constructor(
    private readonly fileService: FileService,
    private readonly logger: AppLogger
  ) {
    this.logger.setContext('FileController');
  }

  @Get(':name')
  async getFile(@Param('name') name: string) {
    try {
      this.logger.log(`Fetching file: ${name}`);
      const fileContent = await this.fileService.getFile(name);

      return {
        name,
        content: fileContent,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get file ${name}`, error as Error);

      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: 'File Not Found',
          message: errorMessage,
          file: name,
        },
        HttpStatus.NOT_FOUND
      );
    }
  }
}
