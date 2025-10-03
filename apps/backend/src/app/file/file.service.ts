import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';

@Injectable()
export class FileService {
  private readonly folder = '../../../../nx.json';
  async getFile(id: string): Promise<string> {
    const filePath = `${this.folder}/${id}`;
    const file = readFileSync(this.folder, 'utf-8');
    return JSON.stringify(file);
  }
}
