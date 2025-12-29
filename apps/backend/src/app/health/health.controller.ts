import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { ServiceBusHealthIndicator } from '../service-bus/service-bus.health';
import { AwsSqsHealthIndicator } from '../aws-sqs/aws-sqs.health';
import { RabbitmqHealthIndicator } from '../rabbitmq/rabbitmq.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
    private readonly serviceBus: ServiceBusHealthIndicator,
    private readonly awsSqs: AwsSqsHealthIndicator,
    private readonly rabbitmq: RabbitmqHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.mongoose.pingCheck('mongoDefault'),
      () => this.mongoose.pingCheck('messageTrackingDb', { connection: 'MessageTrackingDb' }),
      () => this.serviceBus.isHealthy(),
      () => this.awsSqs.isHealthy(),
      () => this.rabbitmq.isHealthy(),
    ]);
  }
}
