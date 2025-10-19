import { DockerService } from '@e2e-monitor/entities';
import { useDocker } from '../../hooks/useDocker';
import Docker from 'dockerode';
import { PlayIcon, Square, PauseIcon, AlertCircle } from 'lucide-react';
interface ContainerWithStatus {
  serviceName: string;
  serviceConfig: DockerService;
  containerInfo?: Docker.ContainerInfo;
  status: 'running' | 'exited' | 'paused' | 'restarting' | 'not-found';
}
export const getContainerStatus = (
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

export const getStatusDisplay = (status: ContainerWithStatus['status']) => {
  const statusMap = {
    running: {
      icon: PlayIcon,
      label: 'Running',
      color: 'text-green-600 dark:text-green-400',
      borderColor: 'border-green-500',
      dotColor: 'bg-green-500',
    },
    exited: {
      icon: Square,
      label: 'Stopped',
      color: 'text-red-600 dark:text-red-400',
      borderColor: 'border-red-500',
      dotColor: 'bg-red-500',
    },
    paused: {
      icon: PauseIcon,
      label: 'Paused',
      color: 'text-yellow-600 dark:text-yellow-400',
      borderColor: 'border-yellow-500',
      dotColor: 'bg-yellow-500',
    },
    restarting: {
      icon: AlertCircle,
      label: 'Restarting',
      color: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-500',
      dotColor: 'bg-blue-500',
    },
    'not-found': {
      icon: AlertCircle,
      label: 'Not Found',
      color: 'text-gray-600 dark:text-gray-400',
      borderColor: 'border-gray-500',
      dotColor: 'bg-gray-500',
    },
  };

  return statusMap[status] ?? statusMap['not-found'];
};
