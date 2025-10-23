/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppLogger extends Logger {
  protected override context: string | undefined;

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, data?: any) {
    const msg = data ? `${message} | ${JSON.stringify(data)}` : message;
    super.log(msg, this.context);
  }

  error(message: string, error?: Error, data?: any) {
    const msg = error
      ? `${message} | ${error.message}${data ? ` | ${JSON.stringify(data)}` : ''}`
      : `${message}${data ? ` | ${JSON.stringify(data)}` : ''}`;
    super.error(msg, error?.stack, this.context);
  }

  warn(message: string, data?: any) {
    const msg = data ? `${message} | ${JSON.stringify(data)}` : message;
    super.warn(msg, this.context);
  }

  debug(message: string, data?: any) {
    const msg = data ? `${message} | ${JSON.stringify(data)}` : message;
    super.debug(msg, this.context);
  }
}
