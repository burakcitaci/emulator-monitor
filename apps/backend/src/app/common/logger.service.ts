import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppLogger extends Logger {
  private context: string;

  setContext(context: string) {
    this.context = context;
  }

  logWithContext(message: string, context?: string, data?: any) {
    const logContext = context || this.context || 'App';
    const logMessage = data
      ? `${message} | Data: ${JSON.stringify(data)}`
      : message;

    super.log(logMessage, logContext);
  }

  errorWithContext(
    message: string,
    context?: string,
    error?: Error,
    data?: any
  ) {
    const logContext = context || this.context || 'App';
    const errorInfo = error
      ? ` | Error: ${error.message}${
          error.stack ? ` | Stack: ${error.stack}` : ''
        }`
      : '';
    const dataInfo = data ? ` | Data: ${JSON.stringify(data)}` : '';
    const fullMessage = `${message}${errorInfo}${dataInfo}`;

    super.error(fullMessage, error?.stack, logContext);
  }

  warnWithContext(message: string, context?: string, data?: any) {
    const logContext = context || this.context || 'App';
    const logMessage = data
      ? `${message} | Data: ${JSON.stringify(data)}`
      : message;

    super.warn(logMessage, logContext);
  }

  debugWithContext(message: string, context?: string, data?: any) {
    const logContext = context || this.context || 'App';
    const logMessage = data
      ? `${message} | Data: ${JSON.stringify(data)}`
      : message;

    super.debug(logMessage, logContext);
  }

  // Docker-specific logging methods
  logDockerOperation(operation: string, containerId?: string, data?: any) {
    this.logWithContext(`Docker ${operation}`, 'DockerService', {
      operation,
      containerId,
      ...data,
    });
  }

  logDockerError(
    operation: string,
    error: Error,
    containerId?: string,
    data?: any
  ) {
    this.errorWithContext(
      `Docker ${operation} failed`,
      'DockerService',
      error,
      {
        operation,
        containerId,
        ...data,
      }
    );
  }

  // Service Bus logging methods
  logServiceBusOperation(operation: string, namespace?: string, data?: any) {
    this.logWithContext(`ServiceBus ${operation}`, 'ServiceBusService', {
      operation,
      namespace,
      ...data,
    });
  }

  logServiceBusError(
    operation: string,
    error: Error,
    namespace?: string,
    data?: any
  ) {
    this.errorWithContext(
      `ServiceBus ${operation} failed`,
      'ServiceBusService',
      error,
      {
        operation,
        namespace,
        ...data,
      }
    );
  }

  // File operation logging
  logFileOperation(operation: string, fileName: string, data?: any) {
    this.logWithContext(`File ${operation}`, 'FileService', {
      operation,
      fileName,
      ...data,
    });
  }

  logFileError(operation: string, error: Error, fileName: string, data?: any) {
    this.errorWithContext(`File ${operation} failed`, 'FileService', error, {
      operation,
      fileName,
      ...data,
    });
  }
}
