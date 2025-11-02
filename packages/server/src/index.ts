import express, { Request, Response } from 'express';
import path from 'path';
import http from 'http';
import { existsSync } from 'fs';
import {
  buildRepositoryTree,
  GitRepositoryError,
  TreeNode
} from '@octotree/core';

export interface ServerOptions {
  port?: number;
  repoPath: string;
}

interface AppInstance {
  app: express.Express;
  getTree: () => Promise<TreeNode>;
  refreshTree: () => Promise<TreeNode>;
}

const resolveStaticAssets = (): { root: string; indexPath: string } => {
  const distPath = path.resolve(__dirname, '..', '..', 'web', 'dist');
  const indexPath = path.join(distPath, 'index.html');

  if (!existsSync(distPath) || !existsSync(indexPath)) {
    console.warn(
      'Front-end build not found. Run `npm run build:web` to generate assets before launching the server.'
    );
  }

  return { root: distPath, indexPath };
};

const createApp = (repoPath: string): AppInstance => {
  const app = express();
  app.use(express.json());

  let cachedTree: TreeNode | null = null;
  let lastUpdated = 0;
  let buildPromise: Promise<TreeNode> | null = null;

  const runBuild = async (): Promise<TreeNode> => {
    const tree = await buildRepositoryTree({ repoPath });
    cachedTree = tree;
    lastUpdated = Date.now();
    return tree;
  };

  const refreshTree = async (): Promise<TreeNode> => {
    if (!buildPromise) {
      buildPromise = runBuild().finally(() => {
        buildPromise = null;
      });
    }
    return buildPromise;
  };

  const getTree = async (): Promise<TreeNode> => {
    if (cachedTree) {
      return cachedTree;
    }
    return refreshTree();
  };

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', repoPath, lastUpdated });
  });

  app.get('/api/tree', async (_req: Request, res: Response) => {
    try {
      const tree = await getTree();
      res.json({ tree, lastUpdated });
    } catch (error) {
      if (error instanceof GitRepositoryError) {
        res.status(400).json({ error: error.message });
        return;
      }
      console.error(error);
      res.status(500).json({ error: 'Failed to build repository tree' });
    }
  });

  app.post('/api/tree/refresh', async (_req: Request, res: Response) => {
    try {
      const tree = await refreshTree();
      res.json({ tree, lastUpdated });
    } catch (error) {
      if (error instanceof GitRepositoryError) {
        res.status(400).json({ error: error.message });
        return;
      }
      console.error(error);
      res.status(500).json({ error: 'Failed to refresh repository tree' });
    }
  });

  const { root: staticRoot, indexPath } = resolveStaticAssets();
  if (existsSync(staticRoot)) {
    app.use(express.static(staticRoot));
  }

  app.get('*', (_req, res) => {
    if (existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res
        .status(503)
        .send(
          'Front-end build missing. Run `npm run build:web` to generate visualization assets.'
        );
    }
  });

  return { app, getTree, refreshTree };
};

export const startServer = async ({ port = 3000, repoPath }: ServerOptions): Promise<http.Server> => {
  if (!repoPath) {
    throw new Error('Server requires a repository path');
  }

  const { app, refreshTree } = createApp(repoPath);
  await refreshTree();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`Server listening on http://localhost:${port}`);
      resolve(server);
    });
    server.on('error', (error) => {
      reject(error);
    });
  });
};

export { createApp };
export type { TreeNode };
