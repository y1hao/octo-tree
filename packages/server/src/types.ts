import type { Express } from 'express';
import type { TreeNode, GitStats } from '@octotree/core';
import { buildRepositoryTree, collectGitStats } from '@octotree/core';

export interface ServerOptions {
  port?: number;
  repoPath: string;
  ref?: string;
  silent?: boolean;
}

export interface TreeResult {
  tree: TreeNode;
  lastUpdated: number;
  gitStats: GitStats | null;
}

export interface AppInstance {
  app: Express;
  getTree: (ref?: string) => Promise<TreeResult>;
  refreshTree: (ref?: string) => Promise<TreeResult>;
}

export interface AppDependencies {
  buildRepositoryTreeFn?: typeof buildRepositoryTree;
  collectGitStatsFn?: typeof collectGitStats;
}

