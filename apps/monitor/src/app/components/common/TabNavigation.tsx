import React from 'react';
import { Activity, Send, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

type TabId = 'messages' | 'send' | 'dlq' | 'configuration';

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs = [
  {
    id: 'messages' as const,
    name: 'Messages',
    icon: Activity,
    color: 'text-blue-600',
  },
  {
    id: 'send' as const,
    name: 'Send Message',
    icon: Send,
    color: 'text-green-600',
  },
  {
    id: 'configuration' as const,
    name: 'Configuration',
    icon: Settings,
    color: 'text-orange-600',
  },
];

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="flex overflow-x-auto px-6" aria-label="Main navigation">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 whitespace-nowrap group',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 transition-colors',
                  isActive ? tab.color : 'group-hover:text-foreground'
                )}
              />
              <span className="hidden sm:inline">{tab.name}</span>
              <span className="sm:hidden">{tab.name.split(' ')[0]}</span>

              {/* Active indicator */}
              <div
                className={cn(
                  'absolute bottom-0 left-0 right-0 h-0.5 bg-primary transition-all duration-200',
                  isActive ? 'opacity-100' : 'opacity-0'
                )}
              />

              {/* Hover effect */}
              <div
                className={cn(
                  'absolute inset-0 bg-muted/50 opacity-0 transition-opacity duration-200',
                  !isActive && 'group-hover:opacity-100'
                )}
              />
            </button>
          );
        })}
      </nav>
    </div>
  );
};
