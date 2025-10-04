interface DockerCompose {
  services: Record<string, Service>;
  networks: Record<string, any>;
}

interface Service {
  container_name?: string;
  image?: string;
  pull_policy?: string;
  volumes?: string[];
  ports?: string[];
  environment?: Record<string, string>;
  depends_on?: string[];
  networks?: Record<string, any>;
}
