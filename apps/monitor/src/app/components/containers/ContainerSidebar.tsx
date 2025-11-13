import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
import { useFile } from '../../hooks/api/useFile';
import { useDocker } from '../../hooks/api/useDocker';
import { PauseIcon, PlayIcon, Square, AlertCircle, Settings } from 'lucide-react';
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

interface ComposeOptions {
  forceRecreate: boolean;
  build: boolean;
  removeOrphans: boolean;
  noDeps: boolean;
}

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

  const [composeOptions, setComposeOptions] = useState<ComposeOptions>({
    forceRecreate: false,
    build: false,
    removeOrphans: false,
    noDeps: false,
  });
  const [isComposing, setIsComposing] = useState(false);

  const handleComposeUpWithOptions = async () => {
    setIsComposing(true);
    try {
      // Build query parameters from selected options
      const params = new URLSearchParams();
      if (composeOptions.forceRecreate) params.append('forceRecreate', 'true');
      if (composeOptions.build) params.append('build', 'true');
      if (composeOptions.removeOrphans) params.append('removeOrphans', 'true');
      if (composeOptions.noDeps) params.append('noDeps', 'true');

      const queryString = params.toString();
      const url = queryString
        ? `http://localhost:3000/api/v1/docker-compose/up?${queryString}`
        : 'http://localhost:3000/api/v1/docker-compose/up';

      const response = await fetch(url, { method: 'POST' });
      if (response.ok) {
        // Refresh containers after a short delay
        setTimeout(() => fetchContainers(), 2000);
      }
    } catch (error) {
      console.error('Error running docker-compose up:', error);
    } finally {
      setIsComposing(false);
    }
  };

  useEffect(() => {
    fetchFile('docker-compose.yml');
    fetchContainers();
  }, [fetchFile, fetchContainers]);

  const allContainersWithStatus = useMemo(() => {
    if (!fileData?.content.services) return [];

    return Object.entries(fileData.content.services).map(
      ([serviceName, serviceConfig]) => {
        // If we have a docker error or no containers, show services but mark as unavailable
        if (dockerError || containers.length === 0) {
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

  // Show loading skeleton only while file is loading (since we need docker-compose.yml to show services)
  if (fileLoading) {
    return (
      <Sidebar collapsible="icon" className="h-screen overflow-hidden">
        <SidebarContent className="p-4 flex-1 min-h-0">
          <div className="space-y-4">
            <div className="h-8 bg-muted rounded-sm mb-4 animate-pulse"></div>
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

  // If file loading failed, show a simple message but don't block the UI
  if (fileError && !fileData) {
    return (
      <Sidebar collapsible="icon" className="h-screen overflow-hidden">
        <SidebarContent className="p-1 flex-1 min-h-0">
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

                <div className="text-muted-foreground">
                  <p className="font-medium">To view Docker services:</p>
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Ensure docker-compose.yml exists in the project root</li>
                    <li>Make sure the file is accessible</li>
                  </ol>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchFile('docker-compose.yml')}
                className="w-full"
              >
                Retry
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
 
      <SidebarSeparator />

      <SidebarContent className="flex-1 min-h-0 ">
        {/* Docker Status Warning - Only show if we have file data but docker error */}
        {dockerError && fileData && (
          <Card className="border-amber-400 dark:border-amber-900/50 rounded-lg shadow-sm bg-gradient-to-br from-amber-100 to-amber-50/80 dark:from-amber-950/40 dark:to-amber-950/20 group-data-[collapsible=icon]:hidden">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-500 flex-shrink-0" />
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-100">
                  Docker status unavailable - Showing services only
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => fetchContainers()}
                  className="h-6 px-2 text-xs hover:bg-amber-200/50 dark:hover:bg-amber-900/40 ml-auto text-amber-700 dark:text-amber-300"
                >
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Collapsible Settings Section */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="settings" className="border-none">
            <AccordionTrigger className="hover:no-underline py-2 px-3 rounded-sm hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Docker Compose Options</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 py-2 bg-muted/30 mx-1 rounded-sm overflow-hidden space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="forceRecreate"
                  checked={composeOptions.forceRecreate}
                  onChange={(e) =>
                    setComposeOptions({ ...composeOptions, forceRecreate: e.target.checked })
                  }
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                />
                <label htmlFor="forceRecreate" className="text-sm text-muted-foreground">
                  Force recreate containers
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="build"
                  checked={composeOptions.build}
                  onChange={(e) =>
                    setComposeOptions({ ...composeOptions, build: e.target.checked })
                  }
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                />
                <label htmlFor="build" className="text-sm text-muted-foreground">
                  Rebuild images
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="removeOrphans"
                  checked={composeOptions.removeOrphans}
                  onChange={(e) =>
                    setComposeOptions({ ...composeOptions, removeOrphans: e.target.checked })
                  }
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                />
                <label htmlFor="removeOrphans" className="text-sm text-muted-foreground">
                  Remove orphaned containers
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="noDeps"
                  checked={composeOptions.noDeps}
                  onChange={(e) =>
                    setComposeOptions({ ...composeOptions, noDeps: e.target.checked })
                  }
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                />
                <label htmlFor="noDeps" className="text-sm text-muted-foreground">
                  No dependencies
                </label>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleComposeUpWithOptions}
                disabled={isComposing}
                className="w-full"
              >
                {isComposing ? 'Composing...' : 'Compose Up with Options'}
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <SidebarGroup className="rounded-lg px-2 py-1">
          <SidebarGroupLabel className="text-xs font-bold uppercase tracking-widest text-foreground/70 mb-4">
            {fileData?.content?.name || 'Containers'}
               <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            {/* Container count */}
            <Badge
              variant="secondary"
              className="text-xs"
            >
              {
                allContainersWithStatus.filter((c) => c.status === 'running')
                  .length
              }
              /{allContainersWithStatus.length}
            </Badge>

            {/* Action buttons on the right */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={!!dockerError || isComposing}
                onClick={handleComposeUpWithOptions}
                className="h-9 w-9 p-0 rounded-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                title={
                  dockerError
                    ? 'Backend server not available'
                    : 'Start all containers'
                }
              >
                <PlayIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!!dockerError}
                onClick={() => {
                  allContainersWithStatus.forEach((c) => {
                    if (c.containerInfo?.Id) {
                      stopContainer(c.containerInfo.Id);
                    }
                  });
                }}
                className="h-9 w-9 p-0 rounded-sm hover:bg-red-50 dark:hover:bg-red-950/20"
                title={
                  dockerError
                    ? 'Backend server not available'
                    : 'Stop all containers'
                }
              >
                <Square className="w-4 h-4 text-red-600 dark:text-red-500" />
              </Button>
            </div>
          </div>
          </SidebarGroupLabel>
          <SidebarGroupContent className="overflow-hidden">
            <SidebarMenu className="space-y-1">
              {allContainersWithStatus.map((container) => {
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
                        <AccordionTrigger className="hover:no-underline py-2 px-3 rounded-sm hover:bg-muted/60 transition-colors">
                          <SidebarMenuButton
                            asChild
                            tooltip={`${container.serviceConfig.container_name || container.serviceName}: ${statusDisplay.label}`}
                            className="h-auto py-0 w-full"
                          >
                            <div className="flex flex-col gap-2 w-full">
                              {/* Header with name and status badge */}
                              <div className="flex items-center justify-between gap-2 w-full">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <span className="font-semibold truncate text-sm text-foreground">
                                    {container.serviceConfig.container_name ||
                                      container.serviceName}
                                  </span>
                                </div>

                                <Badge
                                  variant="outline"
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded-sm flex-shrink-0 text-xs font-medium border transition-colors ${
                                    dockerError || containers.length === 0
                                      ? 'bg-gray-50/50 dark:bg-gray-950/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800'
                                      : container.status === 'running'
                                        ? 'bg-emerald-100 dark:bg-emerald-350/20 text-emerald-900 dark:text-green-800 border-emerald-400 dark:border-emerald-900/50'
                                        : container.status === 'exited'
                                          ? 'bg-slate-50/50 dark:bg-slate-950/20 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                                          : 'bg-yellow-50/50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900/50'
                                  }`}
                                >
                                  <statusDisplay.icon
                                    className={`w-3 h-3`}
                                    aria-hidden="true"
                                  />
                                  <span>
                                    {dockerError || containers.length === 0
                                      ? 'Status unavailable'
                                      : statusDisplay.label}
                                  </span>
                                </Badge>
                              </div>
                            </div>
                          </SidebarMenuButton>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3 py-2 bg-muted/30 mx-1 rounded-sm overflow-hidden space-y-3">
                          {/* Action buttons */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground/80">
                              {dockerError || containers.length === 0
                                ? 'Status unavailable'
                                : container.containerInfo?.Status || 'No status available'}
                            </span>
                            <div className="flex gap-1.5">
                              {(container.status === 'exited' || (dockerError || containers.length === 0)) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!!dockerError || containers.length === 0}
                                  onClick={() =>
                                    startContainer(
                                      container.containerInfo?.Id || '',
                                    )
                                  }
                                  title={
                                    (dockerError || containers.length === 0)
                                      ? 'Backend server not available'
                                      : 'Start container'
                                  }
                                  className="h-7 px-2 py-0.5 rounded-sm text-xs hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30"
                                >
                                  <PlayIcon className="w-3 h-3 mr-1 text-emerald-600 dark:text-emerald-500" />
                                  Start
                                </Button>
                              )}
                              {(container.status === 'running' || (dockerError || containers.length === 0)) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!!dockerError || containers.length === 0}
                                  onClick={() =>
                                    stopContainer(
                                      container.containerInfo?.Id || '',
                                    )
                                  }
                                  title={
                                    (dockerError || containers.length === 0)
                                      ? 'Backend server not available'
                                      : 'Stop container'
                                  }
                                  className="h-7 px-2 py-0.5 rounded-sm text-xs hover:bg-red-100/50 dark:hover:bg-red-900/30"
                                >
                                  <PauseIcon className="w-3 h-3 mr-1 text-red-600 dark:text-red-500" />
                                  Stop
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Container details */}
                          <div className="space-y-3 text-sm">
                            {/* Project name */}
                            {container.containerInfo?.Labels?.['com.docker.compose.project'] && (
                              <div>
                                <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                                  Project
                                </span>
                                <div className="mt-1.5">
                                  <Badge variant="outline" className="text-xs">
                                    {container.containerInfo.Labels['com.docker.compose.project']}
                                  </Badge>
                                </div>
                              </div>
                            )}

                            {/* Ports + dependencies */}
                            {(!!container.serviceConfig.ports?.length ||
                              !!container.serviceConfig.depends_on?.length) && (
                              <>
                                {container.serviceConfig.ports &&
                                  container.serviceConfig.ports.length > 0 && (
                                    <div>
                                      <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                                        Ports
                                      </span>
                                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                                        {container.serviceConfig.ports
                                          .slice(0, 3)
                                          .map((port) => (
                                            <Badge
                                              key={port}
                                              variant="secondary"
                                              className="text-xs font-mono rounded-sm"
                                            >
                                              {port}
                                            </Badge>
                                          ))}
                                        {container.serviceConfig.ports.length >
                                          3 && (
                                          <Badge
                                            variant="secondary"
                                            className="text-xs rounded-sm"
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
                                      <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                                        Dependencies
                                      </span>
                                      <div className="mt-1.5 text-xs text-muted-foreground/90 break-words font-mono">
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
                              </>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {allContainersWithStatus.length === 0 && (
          <div className="px-2 py-4">
            <Card className="rounded-lg shadow-sm border-dashed">
              <CardContent className="pt-6 pb-6 text-center">
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
