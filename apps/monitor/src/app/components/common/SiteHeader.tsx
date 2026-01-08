import { useLocation, useNavigate } from 'react-router';
import { Separator } from '../ui/separator';
import { SidebarTrigger } from '../ui/sidebar';
import { ModeToggle } from './mode-toggle';
import { ThemeSelector } from './ThemeSelector';
import { ArrowLeft } from 'lucide-react';
import {
  IconBrandAws,
  IconBrandAzure,
} from '@tabler/icons-react';

type NavItem = {
  title: string;
  url: string;
};

export function SiteHeader({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  function getItemTitle(itemName: string) {

    if (pathname === '/sqs') {
      return 'AWS SQS';
    }
    if (pathname === '/azure-service-bus') {
      return 'Azure Service Bus';
    }
    if (pathname === '/messaging-resources') {
      return 'Messaging Resources';
    }
    return 'Dashboard';
  }
  const currentItem = items.find((item) => {
    if (item.url === pathname) {
      return pathname === item.url;
    }
    return pathname === item.url || pathname.startsWith(item.url + '/');
  });

  function handleNavigateBack(title: string) {
   
    if (title === 'AWS SQS') {
      return (
        <div
          className="flex items-center gap-4 font-bold cursor-pointer"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="size-5" />
          {title}
          <IconBrandAws className="size-5" />
        </div>
      );
    } else if (title === 'Azure Service Bus') {
      return (
        <div
          className="flex items-center gap-4 cursor-pointer"
          onClick={() => navigate(-1)}
        > 
          <ArrowLeft className="size-5" />
          {title}
          <IconBrandAzure className="size-5" />
        </div>
      );
    } else if (title === 'Messaging Resources') {
      return (
        <div
          className="flex items-center gap-4 cursor-pointer"
          onClick={() => navigate(-1)}
        >
          {title}
        </div>
      );
    } else {
      return (
        <div>
          {title}
        </div>
      );
    }
  }

  return (
    <header className="relative flex h-(--header-height) shrink-0 items-center border-b">
      <div className="flex w-full items-center px-4 lg:px-6">
        {/* LEFT */}
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />

          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />

          <div className="text-lg font-default flex items-center gap-2 font-medium">
           
            {handleNavigateBack(getItemTitle(currentItem?.url ?? ''))}
          </div>
        </div>
        {/* RIGHT */}
        <div className="ml-auto flex items-center gap-2">
          <ThemeSelector />
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
