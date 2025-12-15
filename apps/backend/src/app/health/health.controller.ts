import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { ServiceBusHealthIndicator } from '../service-bus/service-bus.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
    private readonly serviceBus: ServiceBusHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.mongoose.pingCheck('mongoDefault'),
      () => this.mongoose.pingCheck('messageTrackingDb', { connection: 'MessageTrackingDb' }),
      () => this.serviceBus.isHealthy(),
    ]);
  }
}
