import http from 'http';
import { startServer } from '@octotree/server';

/**
 * Start a test server and return the server instance and URL
 */
export const startTestServer = async (repoPath: string, options?: {
  port?: number;
  ref?: string;
}): Promise<{ server: http.Server; url: string; port: number }> => {
  const server = await startServer({
    port: options?.port ?? 0,
    repoPath,
    ref: options?.ref,
    silent: true
  });

  const address = server.address();
  if (typeof address !== 'object' || !address || !('port' in address)) {
    throw new Error('Failed to get server port');
  }

  const port = address.port;
  const url = `http://localhost:${port}`;

  return { server, url, port };
};

/**
 * Close a server and wait for it to finish
 */
export const closeTestServer = async (server: http.Server): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
};

