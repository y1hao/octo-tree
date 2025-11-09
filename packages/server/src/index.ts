import express, { Request, Response, type RequestHandler } from 'express';
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
  silent?: boolean;
  level?: number;
}

interface CacheEntry {
  tree: TreeNode;
  lastUpdated: number;
  gitStats: GitStats | null;
}

interface AppInstance {
  app: express.Express;
  getTree: (ref?: string) => Promise<CacheEntry>;
  refreshTree: (ref?: string) => Promise<CacheEntry>;
}

interface GitStats {
  totalCommits: number | null;
  latestCommitTimestamp: number | null;
}

interface AppDependencies {
  buildRepositoryTreeFn?: typeof buildRepositoryTree;
  collectGitStatsFn?: typeof collectGitStats;
}

interface CreateAppOptions {
  dependencies?: AppDependencies;
  level?: number;
}

const createLevelRedirectMiddleware = (level: number): RequestHandler => {
  return (req, res, next) => {
    if (req.method !== 'GET' || req.path !== '/' || req.query.level != null) {
      next();
      return;
    }

    try {
      const url = new URL(req.originalUrl ?? '/', 'http://localhost');
      url.searchParams.set('level', level.toString());
      res.redirect(url.pathname + url.search);
    } catch (error) {
      console.warn('Failed to apply level redirect:', error);
      res.redirect(`/?level=${level}`);
    }
  };
};

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
      totalCommits: totalCommits != null && Number.isFinite(totalCommits) ? totalCommits : null,
      latestCommitTimestamp:
        latestCommitTimestamp != null && Number.isFinite(latestCommitTimestamp)
          ? latestCommitTimestamp
          : null
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
  defaultRef: string,
  allowFallbackToWorkingTree: boolean,
  options: CreateAppOptions = {}
): AppInstance => {
  const app = express();
  app.use(express.json());

  const buildPromises = new Map<string, Promise<TreeNode>>();
  let defaultRefLastUpdated = 0;

  const { dependencies = {}, level } = options;

  const buildTree = dependencies.buildRepositoryTreeFn ?? buildRepositoryTree;
  const collectStats = dependencies.collectGitStatsFn ?? collectGitStats;

  const resolveRef = (requestedRef?: string): {
    key: string;
    refForBuild: string;
    allowFallback: boolean;
  } => {
    if (requestedRef?.trim()) {
      const ref = requestedRef.trim();
      return { key: ref, refForBuild: ref, allowFallback: false };
    }
    return {
      key: defaultRef,
      refForBuild: defaultRef,
      allowFallback: allowFallbackToWorkingTree
    };
  };

  const buildTreeForRef = async (requestedRef?: string): Promise<CacheEntry> => {
    const { key, refForBuild, allowFallback } = resolveRef(requestedRef);
    let promise = buildPromises.get(key);
    if (!promise) {
      promise = buildTree({
        repoPath,
        ref: refForBuild,
        allowFallbackToWorkingTree: allowFallback
      });
      buildPromises.set(key, promise);
    }

    let tree: TreeNode;
    try {
      tree = await promise;
    } finally {
      buildPromises.delete(key);
    }

    const gitStats = await collectStats(repoPath, refForBuild);
    const entry: CacheEntry = {
      tree,
      lastUpdated: Date.now(),
      gitStats
    };
    if (key === defaultRef) {
      defaultRefLastUpdated = entry.lastUpdated;
    }
    return entry;
  };

  const refreshTreeForRef = async (requestedRef?: string): Promise<CacheEntry> => {
    const { key } = resolveRef(requestedRef);
    buildPromises.delete(key);
    return buildTreeForRef(requestedRef);
  };

  const extractRefParam = (req: Request): string | undefined => {
    const { ref } = req.query;
    if (typeof ref === 'string' && ref.trim().length > 0) {
      return ref.trim();
    }
    return undefined;
  };

  const handleTreeRequest = async (
    req: Request,
    res: Response,
    handler: (ref?: string) => Promise<CacheEntry>,
    errorMessage: string
  ): Promise<void> => {
    const requestedRef = extractRefParam(req);
    try {
      const { tree, lastUpdated, gitStats } = await handler(requestedRef);
      res.json({ tree, lastUpdated, gitStats });
    } catch (error) {
      if (error instanceof GitRepositoryError) {
        res.status(400).json({ error: error.message });
        return;
      }
      console.error(error);
      res.status(500).json({ error: errorMessage });
    }
  };

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      repoPath,
      lastUpdated: defaultRefLastUpdated
    });
  });

  if (typeof level === 'number' && Number.isFinite(level) && level > 0) {
    app.use(createLevelRedirectMiddleware(level));
  }

  app.get('/api/tree', async (req, res) => {
    await handleTreeRequest(req, res, buildTreeForRef, 'Failed to build repository tree');
  });

  app.post('/api/tree/refresh', async (req, res) => {
    await handleTreeRequest(req, res, refreshTreeForRef, 'Failed to refresh repository tree');
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

  return {
    app,
    getTree: buildTreeForRef,
    refreshTree: refreshTreeForRef
  };
};

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
export type { TreeNode, AppDependencies };
