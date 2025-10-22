import { useEffect, useMemo } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useFile } from '../../hooks/useFile';
import { AlertCircle, Container } from 'lucide-react';
import { DockerCompose } from '@e2e-monitor/entities';
import { ContainerSkeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
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
  SidebarTrigger,
  useSidebar,
} from '../ui/sidebar';

interface DockerImage {
  serviceName: string;
  imageName: string;
  imageTag: string;
  fullImage: string;
}

export const DockerImagesSidebar = () => {
  const { state, isMobile, openMobile, setOpenMobile } = useSidebar();
  const {
    data: fileData,
    loading: fileLoading,
    error: fileError,
    fetchFile,
  } = useFile<DockerCompose>();

  useEffect(() => {
    fetchFile('docker-compose.yml');
  }, [fetchFile]);

  // Extract Docker images from docker-compose.yml
  const dockerImages = useMemo(() => {
    if (!fileData?.content.services) return [];

    return Object.entries(fileData.content.services)
      .filter(([, serviceConfig]) => serviceConfig.image)
      .map(([serviceName, serviceConfig]) => {
        const fullImage = serviceConfig.image || '';
        const [imageWithTag] = fullImage.split('@'); // Remove digest if present
        const [imageName, imageTag = 'latest'] = imageWithTag.split(':');

        return {
          serviceName,
          imageName,
          imageTag,
          fullImage: imageWithTag || fullImage,
        } as DockerImage;
      })
      .sort((a, b) => a.imageName.localeCompare(b.imageName));
  }, [fileData]);

  // Auto-close mobile sidebar when an item is clicked
  const handleImageClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Show loading skeleton
  if (fileLoading) {
    return (
      <Sidebar collapsible="icon">
        <SidebarContent className="p-4">
          <div className="space-y-4">
            <div className="h-8 bg-muted rounded mb-4 animate-pulse"></div>
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

  // Show error state
  if (fileError) {
    return (
      <Sidebar collapsible="icon">
        <SidebarContent className="p-4">
          <Card className="border-destructive">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <p className="text-sm font-medium text-destructive">
                  Cannot Load Docker Images
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
                  <p className="font-medium">To view Docker images:</p>
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
                onClick={() => fetchFile('docker-compose.yml')}
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
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        {/* Header with Trigger */}
        <div className="flex items-center justify-between">
          
          <Badge
            variant="secondary"
            className="text-xs group-data-[collapsible=icon]:hidden"
          >
            {dockerImages.length}
          </Badge>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Available Images</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dockerImages.map((image) => (
                <SidebarMenuItem key={`${image.serviceName}-${image.fullImage}`}>
                  <SidebarMenuButton
                    onClick={handleImageClick}
                    tooltip={`${image.imageName}:${image.imageTag}`}
                  >
                    <Container className="w-4 h-4" />
                    <span>{image.imageName}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {dockerImages.length === 0 && (
          <div className="px-2 py-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <Container className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No images found in docker-compose.yml
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

