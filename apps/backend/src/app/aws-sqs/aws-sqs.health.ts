import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { AwsSqsService } from './aws-sqs.service';

@Injectable()
export class AwsSqsHealthIndicator extends HealthIndicator {
  constructor(private readonly service: AwsSqsService) {
    super();
  }

  async isHealthy(key = 'awsSqs'): Promise<HealthIndicatorResult> {
    try {
      await this.service.ping();
      return this.getStatus(key, true);
    } catch (error) {
      return this.getStatus(key, false, { error: (error as Error).message });
    }
  }
}

