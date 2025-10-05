import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useFile } from '../../hooks/useFile';
import { useDocker } from '../../hooks/useDocker';
import Docker from 'dockerode';
import { DockerService } from '../../types/dockerCompose';
import { PauseIcon, PlayIcon, Square } from 'lucide-react';
import { Label } from '../ui/label';
import { useDockerCompose } from '../../hooks/useDockerCompose';
import { ContainerSkeleton } from '../ui/skeleton';

interface ContainerWithStatus {
  serviceName: string;
  serviceConfig: DockerService;
  containerInfo?: Docker.ContainerInfo;
  status: 'running' | 'exited' | 'paused' | 'restarting' | 'not-found';
}

export const ContainerSidebar = () => {
  const {
    data: fileData,
    loading: fileLoading,
    error: fileError,
    fetchFile,
  } = useFile();
  const {
    containers,
    loading: dockerLoading,
    error: dockerError,
    isRefreshing,
    startContainer,
    stopContainer,
    fetchContainers,
  } = useDocker();

  const { composeUp } = useDockerCompose();
  const [selectedProject, setSelectedProject] = useState<string>('all');
  useEffect(() => {
    // Initial load
    fetchFile('docker-compose.yml', true);
    fetchContainers(true);

    // Refresh container status every 5 seconds (without loading state)
    const interval = setInterval(() => {
      fetchContainers(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchFile, fetchContainers]);

  // Extract unique projects from container labels
  const projects = useMemo(() => {
    const projectSet = new Set<string>();
    containers.forEach((container) => {
      const projectLabel = container.Labels?.['com.docker.compose.project'];
      if (projectLabel) {
        projectSet.add(projectLabel);
      }
    });
    return Array.from(projectSet).sort();
  }, [containers]);

  const getContainerStatus = (
    containerInfo?: Docker.ContainerInfo
  ): ContainerWithStatus['status'] => {
    if (!containerInfo) return 'not-found';

    const state = containerInfo.State.toLowerCase();
    if (state.includes('running')) return 'running';
    if (state.includes('exited')) return 'exited';
    if (state.includes('paused')) return 'paused';
    if (state.includes('restarting')) return 'restarting';
    return 'exited';
  };

  const getStatusBadgeVariant = (status: ContainerWithStatus['status']) => {
    switch (status) {
      case 'running':
        return 'default'; // green
      case 'exited':
        return 'destructive'; // red
      case 'paused':
        return 'secondary'; // yellow
      case 'restarting':
        return 'outline';
      case 'not-found':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusColor = (status: ContainerWithStatus['status']) => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'exited':
        return 'bg-red-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'restarting':
        return 'bg-blue-500';
      case 'not-found':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const combineData = (): ContainerWithStatus[] => {
    if (!fileData?.content.services) return [];

    return Object.entries(fileData.content.services).map(
      ([serviceName, serviceConfig]) => {
        // Try to find matching container by name
        const containerInfo = containers.find((c) => {
          const containerName = c.Names?.[0]?.replace('/', '') || '';
          return (
            containerName === serviceConfig.container_name ||
            containerName.includes(serviceName)
          );
        });

        const status = getContainerStatus(containerInfo);

        return {
          serviceName,
          serviceConfig,
          containerInfo,
          status,
        };
      }
    );
  };

  const allContainersWithStatus = combineData();

  // Filter containers by selected project
  const containersWithStatus = useMemo(() => {
    if (selectedProject === 'all') {
      return allContainersWithStatus;
    }

    return allContainersWithStatus.filter((container) => {
      const projectLabel =
        container.containerInfo?.Labels?.['com.docker.compose.project'];
      return projectLabel === selectedProject;
    });
  }, [allContainersWithStatus, selectedProject]);

  if (fileLoading || dockerLoading) {
    return (
      <div className="w-80 border-r bg-muted/30 p-4">
        <div className="space-y-4">
          <div className="h-8 bg-muted rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <ContainerSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (fileError || dockerError) {
    return (
      <div className="w-80 border-r bg-muted/30 p-4">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              {fileError?.message ||
                dockerError?.message ||
                'Failed to load data'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-80 border-r bg-muted/30 overflow-y-auto h-screen">
      <div className="p-4 space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Emulator Containers</h2>
              {isRefreshing && (
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              )}
            </div>
            <Badge variant="outline" className="text-xs">
              {
                containersWithStatus.filter((c) => c.status === 'running')
                  .length
              }
              /{containersWithStatus.length}
            </Badge>
          </div>

          {/* Project Filter Dropdown */}
          {projects.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium  text-muted-foreground">
                  Filter by Project
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <Select
                  value={selectedProject}
                  onValueChange={setSelectedProject}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Projects ({allContainersWithStatus.length})
                    </SelectItem>
                    {projects.map((project) => {
                      const count = allContainersWithStatus.filter(
                        (c) =>
                          c.containerInfo?.Labels?.[
                            'com.docker.compose.project'
                          ] === project
                      ).length;
                      return (
                        <SelectItem key={project} value={project}>
                          {project} ({count})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <div className="flex space-x-1">
                  <PlayIcon className="w-5 h-5" onClick={() => composeUp()} />
                  <Square
                    className="w-5 h-5"
                    onClick={() => {
                      containersWithStatus.forEach((c) => {
                        if (c.containerInfo?.Id) {
                          stopContainer(c.containerInfo.Id);
                        }
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {containersWithStatus.map((container) => (
            <Card
              key={container.serviceName}
              className={`transition-all duration-300 ease-in-out hover:shadow-md ${
                container.status === 'running' ? 'border-green-500/50' : ''
              }`}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold truncate">
                        {container.serviceConfig.container_name ||
                          container.serviceName}
                      </CardTitle>
                      {container.containerInfo?.Labels?.[
                        'com.docker.compose.project'
                      ] && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {
                            container.containerInfo.Labels[
                              'com.docker.compose.project'
                            ]
                          }
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate transition-opacity duration-200">
                      {container.serviceConfig.image?.split('@')[0] ||
                        'No image'}
                    </p>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    <div
                      className={`w-2.5 h-2.5 rounded-full bg-amber-300 transition-colors duration-300 ${getStatusColor(
                        container.status
                      )} ${
                        container.status === 'running' ? 'animate-pulse' : ''
                      }`}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={getStatusBadgeVariant(container.status)}
                    className="text-xs transition-all duration-200"
                  >
                    {container.status}
                  </Badge>
                  {container.containerInfo && (
                    <span className="text-xs text-muted-foreground transition-opacity duration-200">
                      {container.containerInfo.Status}
                    </span>
                  )}
                  {container.status === 'exited' ? (
                    <button
                      onClick={() =>
                        startContainer(container.containerInfo?.Id || '')
                      }
                      className="..."
                    >
                      <PlayIcon className="w-4 h-4" />
                      <span className="sr-only">Start container</span>
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        stopContainer(container.containerInfo?.Id || '')
                      }
                      className="..."
                    >
                      <PauseIcon className="w-4 h-4" />
                      <span className="sr-only">Stop container</span>
                    </button>
                  )}
                </div>

                {container.serviceConfig.ports &&
                  container.serviceConfig.ports.length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium text-muted-foreground">
                        Ports:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {container.serviceConfig.ports
                          .slice(0, 3)
                          .map((port, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs"
                            >
                              {port}
                            </Badge>
                          ))}
                        {container.serviceConfig.ports.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{container.serviceConfig.ports.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                {container.serviceConfig.depends_on &&
                  container.serviceConfig.depends_on.length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium text-muted-foreground">
                        Depends on:
                      </span>
                      <p className="text-xs mt-0.5">
                        {container.serviceConfig.depends_on
                          .slice(0, 2)
                          .join(', ')}
                        {container.serviceConfig.depends_on.length > 2 &&
                          ` +${container.serviceConfig.depends_on.length - 2}`}
                      </p>
                    </div>
                  )}
              </CardContent>
            </Card>
          ))}
        </div>

        {containersWithStatus.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                No containers found in docker-compose.yml
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
