import { useEffect, useState, useMemo } from 'react';
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
import { DockerCompose } from '@emulator-monitor/entities';
import { getContainerStatus, getStatusDisplay } from './helpers';

export const ContainerSidebar = () => {
  const {
    data: fileData,
    loading: fileLoading,
    error: fileError,
    fetchFile,
  } = useFile<DockerCompose>();
  const {
    containers,
    error: dockerError,
    startContainer,
    stopContainer,
    fetchContainers,
  } = useDocker();

  const { composeUp } = useDockerCompose();
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  useEffect(() => {
    fetchFile('docker-compose.yml');
    fetchContainers();
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

  const allContainersWithStatus = useMemo(() => {
    if (!fileData?.content.services) return [];

    return Object.entries(fileData.content.services).map(
      ([serviceName, serviceConfig]) => {
        if (dockerError) {
          return {
            serviceName,
            serviceConfig,
            containerInfo: undefined,
            status: 'not-found' as const,
          };
        }

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
  }, [fileData, containers, dockerError]);

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

  // Show loading skeleton only while file is loading (since we need docker-compose.yml to show services)
  if (fileLoading) {
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

  // If file loading failed, we can't show anything (no YAML data available)
  if (fileError) {
    return (
      <div className="w-80 border-r bg-muted/30 p-4">
        <Card className="border-destructive">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                Cannot Load Docker Services
              </p>
            </div>

            <div className="text-xs space-y-2">
              <div>
                <p className="font-medium text-muted-foreground">
                  Connection Error:
                </p>
                <p className="text-destructive">{fileError.message}</p>
              </div>

              {dockerError && (
                <div>
                  <p className="font-medium text-muted-foreground">
                    Docker Status:
                  </p>
                  <p className="text-destructive">{dockerError.message}</p>
                </div>
              )}

              <div className="text-muted-foreground">
                <p className="font-medium">To view Docker services:</p>
                <ol className="list-decimal list-inside mt-1 space-y-1">
                  <li>Start the backend server (usually runs on port 3000)</li>
                  <li>Ensure docker-compose.yml exists in the project root</li>
                  <li>Make sure Docker Desktop is running</li>
                </ol>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                fetchFile('docker-compose.yml');
                fetchContainers();
              }}
              className="w-full"
            >
              Retry Connection
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
        {/* Docker Error Banner */}
        {dockerError && !isCollapsed && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="pt-4 pb-4 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                    Docker Connection Error
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    {dockerError.message.includes('timeout') ||
                    dockerError.message.includes('Failed to fetch') ||
                    dockerError.message.includes('NetworkError')
                      ? 'Cannot connect to backend server. Make sure the backend server is running on port 3000.'
                      : dockerError.message.includes('ECONNREFUSED')
                      ? 'Backend server is not accessible. Make sure the backend is running.'
                      : dockerError.message.includes('connect') ||
                        dockerError.message.includes('ENOTFOUND')
                      ? 'Cannot connect to Docker. Make sure Docker Desktop is running.'
                      : 'Connection error. Please check your backend server and Docker Desktop.'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Showing services from docker-compose.yml. Status information
                    is unavailable. Auto-refresh disabled until connection
                    restored.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchContainers()}
                className="w-full text-xs"
              >
                Retry Connection
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Header with collapse button */}
        <div className={`${isCollapsed ? 'flex justify-center' : 'space-y-3'}`}>
          {!isCollapsed && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Emulator Containers</h2>
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
              {dockerError && (
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              )}
              <div className="flex flex-col items-center gap-1">
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
                    disabled={!!dockerError}
                    onClick={() => composeUp()}
                    className="h-8 w-8 p-0"
                    title={
                      dockerError
                        ? 'Backend server not available'
                        : 'Start all containers'
                    }
                  >
                    <PlayIcon className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!dockerError}
                    onClick={() => {
                      containersWithStatus.forEach((c) => {
                        if (c.containerInfo?.Id) {
                          stopContainer(c.containerInfo.Id);
                        }
                      });
                    }}
                    className="h-8 w-8 p-0"
                    title={
                      dockerError
                        ? 'Backend server not available'
                        : 'Stop all containers'
                    }
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
                className={`transition-all duration-300 border rounded-md bg-muted/20 hover:bg-muted/30 dark:bg-muted/50 dark:hover:bg-muted/50 border-l-2 ${statusDisplay.borderColor}`}
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
                      className={`flex items-center gap-1 px-2 py-0.5 bg-muted/20 dark:bg-muted/50`}
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
                          disabled={!!dockerError}
                          onClick={() =>
                            startContainer(container.containerInfo?.Id || '')
                          }
                          title={
                            dockerError
                              ? 'Backend server not available'
                              : 'Start container'
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
                          disabled={!!dockerError}
                          onClick={() =>
                            stopContainer(container.containerInfo?.Id || '')
                          }
                          title={
                            dockerError
                              ? 'Backend server not available'
                              : 'Stop container'
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
