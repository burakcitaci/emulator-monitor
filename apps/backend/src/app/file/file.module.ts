import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';

@Module({
  providers: [FileService],
  controllers: [FileController],
  exports: [FileService], // export if you want to use it outside
})
export class FileModule {}
