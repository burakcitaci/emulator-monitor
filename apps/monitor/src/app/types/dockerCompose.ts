import fs from 'fs';
import yaml from 'yaml';

export interface DockerCompose {
  services: Record<string, Service>;
  networks?: Record<string, any>;
}

export interface Service {
  container_name?: string;
  image?: string;
  pull_policy?: string;
  volumes?: string[];
  ports?: string[];
  environment?: Record<string, string>;
  depends_on?: string[];
  networks?: Record<string, any>;
}

export function loadDockerCompose(path: string): DockerCompose {
  const file = fs.readFileSync(path, 'utf8');
  return yaml.parse(file) as DockerCompose;
}
