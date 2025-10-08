import { Module, Global } from '@nestjs/common';
import { ConfigService } from './config.service';
import { AppLogger } from './logger.service';

@Global()
@Module({
  providers: [ConfigService, AppLogger],
  exports: [ConfigService, AppLogger],
})
export class CommonModule {}
