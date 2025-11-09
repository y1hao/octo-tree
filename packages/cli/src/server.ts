import http from 'http';

export interface ClientUrlOptions {
  ref?: string;
  level?: number;
}

export const closeServer = (server: http.Server | null): Promise<void> => {
  if (!server) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

export const getServerPort = (server: http.Server): number => {
  const address = server.address();
  if (typeof address === 'object' && address && 'port' in address) {
    return address.port;
  }
  throw new Error('Failed to determine server port');
};

export const buildClientUrl = (baseUrl: string, { ref, level }: ClientUrlOptions): string => {
  const targetUrl = new URL(baseUrl);
  if (ref) {
    targetUrl.searchParams.set('ref', ref);
  }
  if (typeof level === 'number') {
    targetUrl.searchParams.set('level', level.toString());
  }
  return targetUrl.toString();
};

