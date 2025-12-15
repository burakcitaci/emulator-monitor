
import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app/app.module.js';
import { AppConfigService } from './app/common/app-config.service.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    const configService = app.get(AppConfigService);
    const reflector = app.get(Reflector);

    const port = configService.port;
    const corsOrigin = configService.corsOrigin;

    // Global prefix
    app.setGlobalPrefix('api');

    // CORS
    app.enableCors({
      origin: corsOrigin,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    // API versioning
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    // Global validation
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      })
    );

    app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));

    await app.listen(port);

    logger.log(`🚀 Application started on http://localhost:${port}/api`);
    logger.log(`📊 Environment: ${configService.nodeEnv}`);
    logger.log(`🐳 Docker Socket: ${configService.getDockerConfig().socketPath}`);
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`❌ Failed to start application: ${error.message}`, error.stack);
    } else {
      logger.error('❌ Failed to start application due to an unknown error');
    }
    process.exit(1);
  }
}

bootstrap();
