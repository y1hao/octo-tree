import express, { Request, Response } from 'express';
import path from 'path';
import http from 'http';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import {
  buildRepositoryTree,
  GitRepositoryError,
  TreeNode
} from '@octotree/core';

export interface ServerOptions {
  port?: number;
  repoPath: string;
  ref?: string;
}

interface AppInstance {
  app: express.Express;
  getTree: () => Promise<TreeNode>;
  refreshTree: () => Promise<TreeNode>;
}

interface GitStats {
  totalCommits: number | null;
  latestCommitTimestamp: number | null;
}

const runGitCommand = (repoPath: string, args: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd: repoPath });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `git ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
};

const collectGitStats = async (repoPath: string, ref: string): Promise<GitStats> => {
  try {
    const [countOutput, timeOutput] = await Promise.all([
      runGitCommand(repoPath, ['rev-list', '--count', ref]).catch(() => ''),
      runGitCommand(repoPath, ['show', '-s', '--format=%ct', ref]).catch(() => '')
    ]);

    const totalCommits = countOutput ? Number.parseInt(countOutput, 10) : null;
    const latestCommitTimestamp = timeOutput ? Number.parseInt(timeOutput, 10) * 1000 : null;

    return {
      totalCommits: Number.isNaN(totalCommits ?? NaN) ? null : totalCommits,
      latestCommitTimestamp: Number.isNaN(latestCommitTimestamp ?? NaN)
        ? null
        : latestCommitTimestamp
    };
  } catch (error) {
    console.warn('Failed to collect git statistics:', error);
    return { totalCommits: null, latestCommitTimestamp: null };
  }
};

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

const createApp = (
  repoPath: string,
  gitRef: string,
  allowFallbackToWorkingTree: boolean
): AppInstance => {
  const app = express();
  app.use(express.json());

  let cachedTree: TreeNode | null = null;
  let lastUpdated = 0;
  let buildPromise: Promise<TreeNode> | null = null;
  let gitStats: GitStats | null = null;

  const runBuild = async (): Promise<TreeNode> => {
    const tree = await buildRepositoryTree({
      repoPath,
      ref: gitRef,
      allowFallbackToWorkingTree
    });
    cachedTree = tree;
    lastUpdated = Date.now();
    gitStats = await collectGitStats(repoPath, gitRef);
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
      if (!gitStats) {
        gitStats = await collectGitStats(repoPath, gitRef);
      }
      res.json({ tree, lastUpdated, gitStats });
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
      if (!gitStats) {
        gitStats = await collectGitStats(repoPath, gitRef);
      }
      res.json({ tree, lastUpdated, gitStats });
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

export const startServer = async ({
  port = 3000,
  repoPath,
  ref
}: ServerOptions): Promise<http.Server> => {
  if (!repoPath) {
    throw new Error('Server requires a repository path');
  }

  const gitRef = ref ?? 'HEAD';
  const allowFallbackToWorkingTree = ref == null;
  const { app, refreshTree } = createApp(repoPath, gitRef, allowFallbackToWorkingTree);
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
