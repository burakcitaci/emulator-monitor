import fs from 'fs';
import yaml from 'yaml';

export interface DockerService {
  container_name?: string;
  image?: string;
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
  depends_on?: string[];
  networks?: Record<string, { aliases?: string[] }>;
}

export interface DockerCompose {
  version?: string;
  services: Record<string, DockerService>;
}

export function loadDockerCompose(path: string): DockerCompose {
  const file = fs.readFileSync(path, 'utf8');
  return yaml.parse(file) as DockerCompose;
}
