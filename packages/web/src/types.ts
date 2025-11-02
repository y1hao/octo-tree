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

export interface TreeResponse {
  tree: TreeNode;
  lastUpdated: number;
}
