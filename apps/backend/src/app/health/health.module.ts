import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthController } from './health.controller';
import { ServiceBusModule } from '../service-bus/service-bus.module';
import { AwsSqsModule } from '../aws-sqs/aws-sqs.module';

@Module({
  imports: [TerminusModule, MongooseModule, ServiceBusModule, AwsSqsModule],
  controllers: [HealthController],
})
export class HealthModule {}
