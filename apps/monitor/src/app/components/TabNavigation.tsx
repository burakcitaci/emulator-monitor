import React from 'react';
import { Activity, Send, Trash2, Database, Settings } from 'lucide-react';

type TabId = 'messages' | 'send' | 'dlq' | 'connection' | 'configuration';

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs = [
  { id: 'messages' as const, name: 'Messages', icon: Activity },
  { id: 'send' as const, name: 'Send Message', icon: Send },
  { id: 'dlq' as const, name: 'Dead Letter Queue', icon: Trash2 },
  { id: 'configuration' as const, name: 'Configuration', icon: Settings },
  { id: 'connection' as const, name: 'Connection', icon: Database },
];

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="border-b border-gray-200">
      <nav
        className="flex flex-wrap sm:flex-nowrap overflow-x-auto px-4 sm:px-6"
        aria-label="Tabs"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center space-x-1 sm:space-x-2 py-3 sm:py-4 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline">{tab.name}</span>
            <span className="xs:hidden">{tab.name.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
