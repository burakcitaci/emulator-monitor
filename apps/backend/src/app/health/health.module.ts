import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthController } from './health.controller';
import { ServiceBusModule } from '../service-bus/service-bus.module';
import { AwsSqsModule } from '../aws-sqs/aws-sqs.module';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [TerminusModule, MongooseModule, ServiceBusModule, AwsSqsModule, RabbitmqModule],
  controllers: [HealthController],
})
export class HealthModule {}
