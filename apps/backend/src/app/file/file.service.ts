/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import * as path from 'path';

@Injectable()
export class FileService {
  async getFile(fileName: string): Promise<string> {
    console.log(`📄 Reading file: ${fileName}`);
    console.log(`📂 CWD: ${process.cwd()}`);
    console.log(`📂 __dirname: ${__dirname}`);

    // Resolve the workspace root from the backend's location
    // __dirname = .../apps/backend/dist/app/file (in production)
    // or .../apps/backend/src/app/file (in dev with ts-node)
    const findWorkspaceRoot = (): string => {
      let current = __dirname;
      // Go up from /dist/app/file or /src/app/file to find the workspace root
      for (let i = 0; i < 5; i++) {
        if (current.endsWith('monorepo') || 
            current.endsWith('emulator-monitor') ||
            current === path.dirname(current)) {
          break;
        }
        current = path.dirname(current);
      }
      return current;
    };

    const workspaceRoot = findWorkspaceRoot();
    console.log(`📂 Workspace root: ${workspaceRoot}`);

    // Paths to try, in order of priority
    const possiblePaths = [
      path.join(process.cwd(), fileName),
      path.join(process.cwd(), 'config', fileName),
      path.join(workspaceRoot, fileName),
      path.join(workspaceRoot, 'config', fileName),
      path.join(__dirname, '..', '..', '..', '..', fileName),
      path.join(__dirname, '..', '..', '..', '..', 'config', fileName),
    ];

    let filePath = '';
    let file = '';

    for (const testPath of possiblePaths) {
      try {
        console.log(`  Trying: ${testPath}`);
        file = readFileSync(testPath, 'utf-8');
        filePath = testPath;
        console.log(`✓ Found at: ${filePath}`);
        break;
      } catch (error: any) {
        console.log(`  ✗ Not found: ${error.code}`);
      }
    }

    if (!file) {
      const errorMsg = `File not found: ${fileName}\nTried:\n${possiblePaths.map(p => `  - ${p}`).join('\n')}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log(`✓ Loaded: ${fileName} (${file.length} bytes)`);
    return file;
  }
}
