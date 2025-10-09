/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import * as path from 'path';

@Injectable()
export class FileService {
  async getFile(fileName: string): Promise<string> {
    console.log('Attempting to read file:', fileName);
    console.log('Current working directory:', process.cwd());

    // Try multiple possible paths for docker-compose.yml
    const possiblePaths = [
      path.join(process.cwd(), fileName),
      path.join(process.cwd(), '..', fileName),
      path.join(process.cwd(), '../..', fileName),
    ];

    let filePath = '';
    let file = '';

    for (const testPath of possiblePaths) {
      try {
        console.log('Trying path:', testPath);
        file = readFileSync(testPath, 'utf-8');
        filePath = testPath;
        console.log('Successfully read file from:', filePath);
        break;
      } catch (error: any) {
        console.log('Failed to read from:', testPath, error.message);
      }
    }

    if (!file) {
      throw new Error(
        `File not found: ${fileName}. Tried paths: ${possiblePaths.join(', ')}`
      );
    }

    return file;
  }
}
