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

export interface GitStats {
  totalCommits: number | null;
  latestCommitTimestamp: number | null;
}

export interface TreeResponse {
  tree: TreeNode;
  lastUpdated: number;
  gitStats?: GitStats | null;
}
