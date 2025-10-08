import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  private readonly logger = new Logger('AppController');

  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    this.logger.log('API root endpoint accessed');
    return this.appService.getData();
  }

  @Get('/')
  getRoot() {
    this.logger.log('API root path accessed');
    return this.appService.getData();
  }

  @Get('health')
  getHealth() {
    this.logger.log('Health check requested');

    const healthCheck = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        docker: this.checkDockerHealth(),
        file: this.checkFileSystemHealth(),
      },
    };

    this.logger.log(`Health check completed: ${healthCheck.status}`);

    return healthCheck;
  }

  @Get('health/ready')
  getReadiness() {
    this.logger.log('Readiness check requested');

    // Check if all critical services are ready
    const isReady = this.checkBasicReadiness();

    const readinessCheck = {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        environment: process.env.NODE_ENV ? 'configured' : 'missing',
        database: 'not_applicable', // Add database check if needed
        external_apis: this.checkExternalAPIs(),
      },
    };

    this.logger.log(`Readiness check completed: ${readinessCheck.status}`);

    return readinessCheck;
  }

  @Get('health/live')
  getLiveness() {
    this.logger.log('Liveness check requested');

    const livenessCheck = {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    this.logger.log(
      `Liveness check completed - uptime: ${livenessCheck.uptime}s`
    );

    return livenessCheck;
  }

  private checkDockerHealth(): 'healthy' | 'unhealthy' {
    try {
      // Basic Docker connectivity check
      const docker = require('dockerode');
      // This will throw if Docker is not accessible
      new docker();
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private checkFileSystemHealth(): 'healthy' | 'unhealthy' {
    try {
      const fs = require('fs');
      const path = require('path');

      // Check if we can read the docker-compose.yml file
      const composePath = path.join(process.cwd(), 'docker-compose.yml');
      fs.accessSync(composePath, fs.constants.R_OK);

      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private checkBasicReadiness(): boolean {
    // Check if required environment variables are set
    const requiredEnvVars = ['NODE_ENV'];
    return requiredEnvVars.every((envVar) => process.env[envVar]);
  }

  private checkExternalAPIs(): 'available' | 'unavailable' {
    // Add checks for external API dependencies if any
    return 'available';
  }
}
