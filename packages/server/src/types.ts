import type { Express } from 'express';
import type { TreeNode } from '@octotree/core';
import { buildRepositoryTree } from '@octotree/core';
import { collectGitStats } from './git';

export interface ServerOptions {
  port?: number;
  repoPath: string;
  ref?: string;
  silent?: boolean;
  level?: number;
}

export interface GitStats {
  totalCommits: number | null;
  latestCommitTimestamp: number | null;
}

export interface CacheEntry {
  tree: TreeNode;
  lastUpdated: number;
  gitStats: GitStats | null;
}

export interface AppInstance {
  app: Express;
  getTree: (ref?: string) => Promise<CacheEntry>;
  refreshTree: (ref?: string) => Promise<CacheEntry>;
}

export interface AppDependencies {
  buildRepositoryTreeFn?: typeof buildRepositoryTree;
  collectGitStatsFn?: typeof collectGitStats;
}

export interface CreateAppOptions {
  dependencies?: AppDependencies;
  level?: number;
}

