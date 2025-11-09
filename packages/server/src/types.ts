import type { Express } from 'express';
import type { RepositoryTree } from '@octotree/core';
import { buildRepositoryTree, collectGitStats } from '@octotree/core';

export interface ServerOptions {
  port?: number;
  repoPath: string;
  ref?: string;
  silent?: boolean;
}

export interface AppInstance {
  app: Express;
  getTree: (ref?: string) => Promise<RepositoryTree>;
  refreshTree: (ref?: string) => Promise<RepositoryTree>;
}

export interface AppDependencies {
  buildRepositoryTreeFn?: typeof buildRepositoryTree;
  collectGitStatsFn?: typeof collectGitStats;
}

