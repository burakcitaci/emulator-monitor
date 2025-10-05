import React from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
interface MessageFiltersProps {
  searchTerm: string;
  filterQueue: string;
  uniqueQueues: string[];
  onSearchChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onClearFilters: () => void;
}

export const MessageFilters: React.FC<MessageFiltersProps> = ({
  searchTerm,
  filterQueue,
  uniqueQueues,
  onSearchChange,
  onFilterChange,
  onClearFilters,
}) => {
  return (
    <div className="space-y-4 mb-6">
      {/* Desktop Layout */}
      <div className="hidden sm:flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
          <Input
            type="text"
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="w-[200px]">
          <Select
            value={filterQueue || 'all'}
            onValueChange={(value) =>
              onFilterChange(value === 'all' ? '' : value)
            }
          >
            <SelectTrigger>
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Queues" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Queues</SelectItem>
              {uniqueQueues.map((queue) => (
                <SelectItem key={queue} value={queue}>
                  {queue}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(searchTerm || filterQueue) && (
          <Button onClick={onClearFilters} variant="outline">
            Clear Filters
          </Button>
        )}
      </div>

      {/* Mobile Layout */}
      <div className="block sm:hidden space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
          <Input
            type="text"
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex-1">
            <Select
              value={filterQueue || 'all'}
              onValueChange={(value) =>
                onFilterChange(value === 'all' ? '' : value)
              }
            >
              <SelectTrigger>
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Queues" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Queues</SelectItem>
                {uniqueQueues.map((queue) => (
                  <SelectItem key={queue} value={queue}>
                    {queue}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(searchTerm || filterQueue) && (
            <Button onClick={onClearFilters} variant="outline" size="sm">
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
