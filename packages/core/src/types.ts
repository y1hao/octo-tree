export type NodeType = 'file' | 'directory';

export interface TreeNode {
  id: string;
  name: string;
  relativePath: string;
  type: NodeType;
  size: number;
  mtimeMs: number;
  depth: number;
  children: TreeNode[];
}

export interface BuildTreeOptions {
  repoPath: string;
  ref?: string;
  allowFallbackToWorkingTree?: boolean;
}

export class GitRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitRepositoryError';
  }
}

export interface GitStats {
  totalCommits: number | null;
  latestCommitTimestamp: number | null;
}

export interface RepositoryTree {
  tree: TreeNode;
  lastUpdated: number;
  gitStats: GitStats | null;
}

