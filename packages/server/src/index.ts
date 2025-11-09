import http from 'http';
import type { TreeNode } from '@octotree/core';
import type { ServerOptions, AppDependencies } from './types';
import { createApp } from './app';
import { createLevelRedirectMiddleware } from './middleware';

export const startServer = async ({
  port = 3000,
  repoPath,
  ref,
  silent = false,
  level
}: ServerOptions): Promise<http.Server> => {
  if (!repoPath) {
    throw new Error('Server requires a repository path');
  }

  const gitRef = ref ?? 'HEAD';
  const allowFallbackToWorkingTree = ref == null;
  const { app, refreshTree } = createApp(repoPath, gitRef, allowFallbackToWorkingTree, {
    level
  });
  await refreshTree(gitRef);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      if (!silent) {
        console.log(`Server listening on http://localhost:${port}`);
      }
      resolve(server);
    });
    server.on('error', (error) => {
      reject(error);
    });
  });
};

export { createApp, createLevelRedirectMiddleware };
export type { TreeNode, AppDependencies, ServerOptions };
