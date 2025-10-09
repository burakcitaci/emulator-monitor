import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
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
import {
  PauseIcon,
  PlayIcon,
  Square,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Label } from '../ui/label';
import { useDockerCompose } from '../../hooks/useDockerCompose';
import { ContainerSkeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { DockerService } from '@emulator-monitor/entities';

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

  // Log errors for debugging
  React.useEffect(() => {
    if (dockerError) {
      console.error('Docker error:', dockerError);
    }
  }, [dockerError]);

  const { composeUp } = useDockerCompose();
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  useEffect(() => {
    // Initial load
    fetchFile('docker-compose.yml', true);
    fetchContainers(true);

    // Refresh container status every 5 seconds (without loading state)
    const interval = setInterval(() => {
      fetchContainers(false);
    }, 15000);

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
    return Array.from(projectSet).sort((a, b) => a.localeCompare(b));
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

  const getStatusDisplay = (status: ContainerWithStatus['status']) => {
    switch (status) {
      case 'running':
        return {
          icon: PlayIcon,
          label: 'Running',
          color: 'text-green-600 dark:text-green-400',
          bgColor:
            'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
          dotColor: 'bg-green-500',
        };
      case 'exited':
        return {
          icon: Square,
          label: 'Stopped',
          color: 'text-red-600 dark:text-red-400',
          bgColor:
            'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
          dotColor: 'bg-red-500',
        };
      case 'paused':
        return {
          icon: PauseIcon,
          label: 'Paused',
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor:
            'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
          dotColor: 'bg-yellow-500',
        };
      case 'restarting':
        return {
          icon: AlertCircle,
          label: 'Restarting',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor:
            'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
          dotColor: 'bg-blue-500',
        };
      case 'not-found':
        return {
          icon: AlertCircle,
          label: 'Not Found',
          color: 'text-gray-600 dark:text-gray-400',
          bgColor:
            'bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800',
          dotColor: 'bg-gray-500',
        };
      default:
        return {
          icon: AlertCircle,
          label: status,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor:
            'bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800',
          dotColor: 'bg-gray-500',
        };
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
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                Failed to Load Data
              </p>
            </div>

            {fileError && (
              <div className="text-xs">
                <p className="font-medium text-muted-foreground">File Error:</p>
                <p className="text-destructive">{fileError.message}</p>
              </div>
            )}

            {dockerError && (
              <div className="text-xs">
                <p className="font-medium text-muted-foreground">
                  Docker Error:
                </p>
                <p className="text-destructive">{dockerError.message}</p>
                <p className="text-muted-foreground mt-1">
                  Make sure Docker Desktop is running and the backend server is
                  accessible.
                </p>
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                fetchFile('docker-compose.yml', true);
                fetchContainers(true);
              }}
              className="w-full"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={`${
        isCollapsed ? 'w-16' : 'w-80 lg:w-96'
      } border-r bg-background/50 backdrop-blur-sm overflow-y-auto h-screen transition-all duration-300`}
    >
      <div className={`${isCollapsed ? 'p-2' : 'p-4'} space-y-4`}>
        {/* Header with collapse button */}
        <div className={`${isCollapsed ? 'flex justify-center' : 'space-y-3'}`}>
          {!isCollapsed && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Emulator Containers</h2>
                {isRefreshing && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {
                    containersWithStatus.filter((c) => c.status === 'running')
                      .length
                  }
                  /{containersWithStatus.length}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="h-6 w-6 p-0"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3 h-3" />
                  ) : (
                    <ChevronLeft className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="flex flex-col items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <div className="flex flex-col items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <Badge variant="outline" className="text-xs">
                  {
                    containersWithStatus.filter((c) => c.status === 'running')
                      .length
                  }
                </Badge>
              </div>
            </div>
          )}

          {/* Project Filter Dropdown - Hidden when collapsed */}
          {!isCollapsed && projects.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-muted-foreground">
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => composeUp()}
                    className="h-8 w-8 p-0"
                  >
                    <PlayIcon className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      containersWithStatus.forEach((c) => {
                        if (c.containerInfo?.Id) {
                          stopContainer(c.containerInfo.Id);
                        }
                      });
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <Square className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <Accordion type="multiple" className="space-y-2">
          {containersWithStatus.map((container) => {
            const statusDisplay = getStatusDisplay(container.status);
            return (
              <AccordionItem
                key={container.serviceName}
                value={container.serviceName}
                className={`transition-all duration-300 border rounded-md ${statusDisplay.bgColor}`}
              >
                {/* Custom header */}
                <div className="flex items-center justify-between w-full p-3">
                  {/* Left section: status + name + image */}
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <div />
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold truncate">
                        {container.serviceConfig.container_name ||
                          container.serviceName}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {container.serviceConfig.image?.split('@')[0] ||
                          'No image specified'}
                      </span>
                    </div>
                  </div>

                  {/* Right section: status badge + toggle */}
                  <div className="flex items-center flex-shrink-0 gap-2">
                    <Badge
                      variant="outline"
                      className={`flex items-center gap-1 px-2 py-0.5 ${statusDisplay.bgColor}`}
                    >
                      <statusDisplay.icon
                        className={`w-3 h-3 ${statusDisplay.color}`}
                      />
                      <span
                        className={`text-xs font-medium ${statusDisplay.color}`}
                      >
                        {statusDisplay.label}
                      </span>
                    </Badge>

                    {/* Accordion toggle only here */}
                    <AccordionTrigger className="ml-1 p-1 rounded-md hover:bg-muted transition-all hover:cursor-pointer" />
                  </div>
                </div>

                <AccordionContent className="p-3 pt-0 space-y-3 text-sm">
                  {/* Status text + buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {container.containerInfo?.Status || 'No status available'}
                    </span>

                    <div className="flex flex-wrap gap-2">
                      {container.status === 'exited' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            startContainer(container.containerInfo?.Id || '')
                          }
                        >
                          <PlayIcon className="w-3 h-3 mr-1" />
                          Start
                        </Button>
                      )}
                      {container.status === 'running' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            stopContainer(container.containerInfo?.Id || '')
                          }
                        >
                          <PauseIcon className="w-3 h-3 mr-1" />
                          Stop
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Ports + dependencies (same TS-safe logic) */}
                  {(!!container.serviceConfig.ports?.length ||
                    !!container.serviceConfig.depends_on?.length) && (
                    <div className="border-t pt-3 space-y-2">
                      {container.serviceConfig.ports &&
                        container.serviceConfig.ports.length > 0 && (
                          <div>
                            <span className="font-medium text-muted-foreground">
                              Ports:
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {container.serviceConfig.ports
                                .slice(0, 3)
                                .map((port) => (
                                  <Badge
                                    key={port}
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
                          <div>
                            <span className="font-medium text-muted-foreground">
                              Depends on:
                            </span>
                            <div className="mt-1 text-xs text-muted-foreground break-words">
                              {container.serviceConfig.depends_on
                                .slice(0, 2)
                                .join(', ')}
                              {container.serviceConfig.depends_on.length > 2 &&
                                ` +${
                                  container.serviceConfig.depends_on.length - 2
                                } more`}
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

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
