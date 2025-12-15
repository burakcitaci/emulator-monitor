import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthController } from './health.controller';
import { ServiceBusModule } from '../service-bus/service-bus.module';

@Module({
  imports: [TerminusModule, MongooseModule, ServiceBusModule],
  controllers: [HealthController],
})
export class HealthModule {}
