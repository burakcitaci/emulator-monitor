export const config = {
  api: {
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  },
  app: {
    name: 'E2E Monitor',
    version: '1.0.0',
  },
} as const;

export type Config = typeof config;