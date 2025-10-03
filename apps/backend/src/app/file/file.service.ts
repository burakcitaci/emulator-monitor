import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import * as path from 'path';

@Injectable()
export class FileService {
  async getFile(fileName: string): Promise<string> {
    const filePath = path.join(process.cwd(), fileName);
    const file = readFileSync(filePath, 'utf-8');
    return file;
  }
}
