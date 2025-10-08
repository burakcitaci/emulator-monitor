/**
 * Service Bus Emulator Monitor Backend
 * A comprehensive API for Docker container management and Service Bus operations
 */

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ConfigService } from './app/common/config.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    // Create the application
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    // Get configuration service - use a more defensive approach
    let configService;
    let corsOrigin: string | string[] = 'http://localhost:4200';
    let port = 3000;

    try {
      configService = app.get(ConfigService);
      if (configService) {
        configService.validateRequiredEnvVars();
        corsOrigin = configService.corsOrigin;
        port = configService.port;
      }
    } catch (error) {
      logger.warn('ConfigService not available, using default configuration');
    }

    // Global prefix for all routes
    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);

    // Enable CORS with configuration
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

    // Global validation pipe
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

    // Graceful shutdown handling
    process.on('SIGTERM', async () => {
      logger.log('SIGTERM received, shutting down gracefully');
      await app.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.log('SIGINT received, shutting down gracefully');
      await app.close();
      process.exit(0);
    });

    // Start the server
    await app.listen(port);

    // Log startup information
    const environment = configService?.nodeEnv || 'development';
    const isProduction = configService?.isProduction || false;

    logger.log(`🚀 Application started successfully!`, 'Bootstrap');
    logger.log(`📊 Environment: ${environment}`, 'Bootstrap');
    logger.log(
      `🌐 Server: http://localhost:${port}/${globalPrefix}`,
      'Bootstrap'
    );
    logger.log(`🔗 Health: http://localhost:${port}/health`, 'Bootstrap');

    if (isProduction) {
      logger.log(`⚡ Production mode enabled`, 'Bootstrap');
    } else {
      logger.log(`🔧 Development mode enabled`, 'Bootstrap');
      logger.log(
        `📋 API Documentation: http://localhost:${port}/${globalPrefix}`,
        'Bootstrap'
      );
    }

    // Log Docker configuration (without sensitive data)
    if (configService) {
      const dockerConfig = configService.getDockerConfig();
      logger.log(`🐳 Docker Socket: ${dockerConfig.socketPath}`, 'Bootstrap');
      logger.log(`⏱️  Docker Timeout: ${dockerConfig.timeout}ms`, 'Bootstrap');
    }
  } catch (error: any) {
    logger.error(
      `❌ Failed to start application: ${error.message}`,
      error.stack,
      'Bootstrap'
    );
    process.exit(1);
  }
}

bootstrap();
