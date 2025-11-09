import express from 'express';
import { existsSync } from 'fs';
import { buildRepositoryTree, type TreeNode } from '@octotree/core';
import type {
  AppInstance,
  CacheEntry,
  CreateAppOptions
} from './types';
import { collectGitStats } from './git';
import { resolveStaticAssets } from './static-assets';
import { createLevelRedirectMiddleware } from './middleware';
import { createTreeRoutes } from './routes';

export const createApp = (
  repoPath: string,
  defaultRef: string,
  allowFallbackToWorkingTree: boolean,
  options: CreateAppOptions = {}
): AppInstance => {
  const app = express();
  app.use(express.json());

  const buildPromises = new Map<string, Promise<TreeNode>>();

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
    return entry;
  };

  const refreshTreeForRef = async (requestedRef?: string): Promise<CacheEntry> => {
    const { key } = resolveRef(requestedRef);
    buildPromises.delete(key);
    return buildTreeForRef(requestedRef);
  };

  // Setup routes
  if (typeof level === 'number' && Number.isFinite(level) && level > 0) {
    app.use(createLevelRedirectMiddleware(level));
  }

  const treeRoutes = createTreeRoutes(buildTreeForRef, refreshTreeForRef);
  app.get('/api/tree', treeRoutes.getTree);
  app.post('/api/tree/refresh', treeRoutes.refreshTree);

  // Setup static assets
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

