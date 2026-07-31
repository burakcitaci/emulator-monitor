import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ServiceBusHealthIndicator } from '../service-bus/service-bus.health';
import { AwsSqsHealthIndicator } from '../aws-sqs/aws-sqs.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
    private readonly serviceBus: ServiceBusHealthIndicator,
    private readonly awsSqs: AwsSqsHealthIndicator,
    @InjectConnection('MessageTrackingDb')
    private readonly messageTrackingConnection: Connection,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.checkReadiness();
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.checkReadiness();
  }

  @Get('live')
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  private checkReadiness() {
    return this.health.check([
      () =>
        this.mongoose.pingCheck('messageTrackingDb', {
          connection: this.messageTrackingConnection,
        }),
      () => this.serviceBus.isHealthy(),
      () => this.awsSqs.isHealthy(),
    ]);
  }
}
