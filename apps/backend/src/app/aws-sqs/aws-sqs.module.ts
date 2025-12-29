import { Module } from '@nestjs/common';
import { SQSClient } from '@aws-sdk/client-sqs';
import { CommonModule } from '../common/common.module';
import { AppConfigService } from '../common/app-config.service';
import { MessageModule } from '../messages/messages.module';
import { AWS_SQS_CLIENT } from './aws-sqs.constants';
import { AwsSqsService } from './aws-sqs.service';
import { AwsSqsController } from './aws-sqs.controller';
import { AwsSqsHealthIndicator } from './aws-sqs.health';

@Module({
  imports: [CommonModule, MessageModule],
  providers: [
    {
      provide: AWS_SQS_CLIENT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        new SQSClient({
          endpoint: config.awsSqsEndpoint,
          region: config.awsRegion,
          credentials: {
            accessKeyId: config.awsAccessKeyId,
            secretAccessKey: config.awsSecretAccessKey,
          },
        }),
    },
    AwsSqsService,
    AwsSqsHealthIndicator,
  ],
  controllers: [AwsSqsController],
  exports: [AwsSqsService, AwsSqsHealthIndicator],
})
export class AwsSqsModule {}

