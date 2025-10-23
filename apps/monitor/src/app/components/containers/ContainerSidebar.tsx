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
import { useFile } from '../../hooks/api/useFile';
import { useDocker } from '../../hooks/api/useDocker';
import { PauseIcon, PlayIcon, Square, AlertCircle } from 'lucide-react';
import { Label } from '../ui/label';
import { useDockerCompose } from '../../hooks/api/useDockerCompose';
import { ContainerSkeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { DockerCompose } from '@e2e-monitor/entities';
import { getContainerStatus, getStatusDisplay } from './helpers';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '../ui/sidebar';

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
      },
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
      <Sidebar collapsible="icon" className="h-screen overflow-hidden">
        <SidebarContent className="p-4 flex-1 min-h-0">
          <div className="space-y-4">
            <div className="h-8 bg-muted rounded-md mb-4 animate-pulse"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <ContainerSkeleton key={i} />
              ))}
            </div>
          </div>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
    );
  }

  // If file loading failed, we can't show anything (no YAML data available)
  if (fileError) {
    return (
      <Sidebar collapsible="icon" className="h-screen overflow-hidden">
        <SidebarContent className="p-4 flex-1 min-h-0">
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
                    <li>
                      Start the backend server (usually runs on port 3000)
                    </li>
                    <li>
                      Ensure docker-compose.yml exists in the project root
                    </li>
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
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
    );
  }

  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      className="h-screen overflow-hidden gap-6"
    >
      <SidebarHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold group-data-[collapsible=icon]:hidden">
              Emulator Containers
            </h2>
            <Badge
              variant="secondary"
              className="text-xs group-data-[collapsible=icon]:hidden"
            >
              {
                containersWithStatus.filter((c) => c.status === 'running')
                  .length
              }
              /{containersWithStatus.length}
            </Badge>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="flex-1 min-h-0 ">
        {/* Docker Error Banner */}
        {dockerError && (
          <Card className="border-black-500 rounded-md shadow-none bg-yellow-50 dark:bg-yellow-950/20 group-data-[collapsible=icon]:hidden">
            <CardContent className="pt-4 pb-4 space-y-2">
              <div className="flex items-start gap-2">
                
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-yellow-800 dark:text-black-500">
                    Docker Connection Error
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-black-400">
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

        {/* Project Filter Dropdown */}
        {projects.length > 0 && (
          <div className="space-y-3 group-data-[collapsible=icon]:hidden mx-1 mb-3">
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
                <SelectTrigger className="w-full h-8 rounded-sm">
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
                        ] === project,
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

        <SidebarGroup className="mx- border border-red-500 rounded-md p-1">
          <SidebarGroupLabel className='text-sm font-bold uppercase'>Containers</SidebarGroupLabel>
          <SidebarGroupContent className="overflow-hidden">
            <SidebarMenu className="space-y-0">
              {containersWithStatus.map((container) => {
                const statusDisplay = getStatusDisplay(container.status);
                return (
                  <SidebarMenuItem key={container.serviceName} className="py-0">
                    <Accordion
                      type="multiple"
                      className="w-full overflow-hidden"
                    >
                      <AccordionItem
                        value={container.serviceName}
                        className="border-none"
                      >
                        <AccordionTrigger className="hover:no-underline py-1 px-0">
                          <SidebarMenuButton
                            asChild
                            tooltip={`${container.serviceConfig.container_name || container.serviceName}: ${statusDisplay.label}`}
                            className="h-auto py-1 w-full"
                          >
                            <div className="flex flex-col gap-1.5 w-full uppercase">
                              {/* Header with name and status badge */}
                              <div className="flex items-center justify-between gap-2 w-full">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                 {/*  <statusDisplay.icon
                                    className={`w-3 h-3 flex-shrink-0 ${statusDisplay.color}`}
                                    aria-hidden="true"
                                  /> */}
                                  <span className="font-medium truncate text-sm">
                                    {container.serviceConfig.container_name ||
                                      container.serviceName}
                                  </span>
                                </div>

                                <Badge
                                  variant="outline"
                                  className="flex items-center gap-1 px-1.5 py-0.5 bg-muted/20 dark:bg-muted/50 flex-shrink-0"
                                >
                                  <statusDisplay.icon
                                    className={`w-2.5 h-2.5 ${statusDisplay.color}`}
                                    aria-hidden="true"
                                  />
                                  <span
                                    className={`text-xs font-medium ${statusDisplay.color}`}
                                  >
                                    {statusDisplay.label}
                                  </span>
                                </Badge>
                              </div>
                            </div>
                          </SidebarMenuButton>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-2 py-2 overflow-hidden">
                          {/* Action buttons */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs text-muted-foreground">
                              {container.containerInfo?.Status ||
                                'No status available'}
                              +
                            </span>
                            <div className="flex gap-1">
                              {container.status === 'exited' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!!dockerError}
                                  onClick={() =>
                                    startContainer(
                                      container.containerInfo?.Id || '',
                                    )
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
                                  className='h-6 px-2 py-0.5 rounded-sm'
                                  variant="outline"
                                  disabled={!!dockerError}
                                  onClick={() =>
                                    stopContainer(
                                      container.containerInfo?.Id || '',
                                    )
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

                          {/* Ports + dependencies */}
                          {(!!container.serviceConfig.ports?.length ||
                            !!container.serviceConfig.depends_on?.length) && (
                            <div className="space-y-2 text-sm">
                              {container.serviceConfig.ports &&
                                container.serviceConfig.ports.length > 0 && (
                                  <div>
                                    <span className="font-medium text-muted-foreground text-xs">
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
                                      {container.serviceConfig.ports.length >
                                        3 && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          +
                                          {container.serviceConfig.ports
                                            .length - 3}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                )}

                              {container.serviceConfig.depends_on &&
                                container.serviceConfig.depends_on.length >
                                  0 && (
                                  <div>
                                    <span className="font-medium text-muted-foreground text-xs">
                                      Depends on:
                                    </span>
                                    <div className="mt-1 text-xs text-muted-foreground break-words">
                                      {container.serviceConfig.depends_on
                                        .slice(0, 2)
                                        .join(', ')}
                                      {container.serviceConfig.depends_on
                                        .length > 2 &&
                                        ` +${
                                          container.serviceConfig.depends_on
                                            .length - 2
                                        } more`}
                                    </div>
                                  </div>
                                )}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {containersWithStatus.length === 0 && (
          <div className="mx-1 mb-3">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No containers found in docker-compose.yml
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
};
