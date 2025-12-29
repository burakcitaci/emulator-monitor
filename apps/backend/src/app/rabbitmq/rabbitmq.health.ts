import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { RabbitmqService } from './rabbitmq.service';

@Injectable()
export class RabbitmqHealthIndicator extends HealthIndicator {
  constructor(private readonly service: RabbitmqService) {
    super();
  }

  async isHealthy(key = 'rabbitmq'): Promise<HealthIndicatorResult> {
    try {
      await this.service.ping();
      return this.getStatus(key, true);
    } catch (error) {
      return this.getStatus(key, false, { error: (error as Error).message });
    }
  }
}

