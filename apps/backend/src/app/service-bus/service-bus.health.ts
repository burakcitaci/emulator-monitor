import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { ServiceBusService } from './service-bus.service';

@Injectable()
export class ServiceBusHealthIndicator extends HealthIndicator {
  constructor(private readonly service: ServiceBusService) {
    super();
  }

  async isHealthy(key = 'serviceBus'): Promise<HealthIndicatorResult> {
    try {
      await this.service.ping();
      return this.getStatus(key, true);
    } catch (error) {
      return this.getStatus(key, false, { error: (error as Error).message });
    }
  }
}
