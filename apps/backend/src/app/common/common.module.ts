import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import { AppLogger } from './logger.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [AppConfigService, AppLogger],
  exports: [AppConfigService, AppLogger],
})
export class CommonModule {}
