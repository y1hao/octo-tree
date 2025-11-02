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
export interface PolarLayout {
    radius: number;
    angle: number;
    span: number;
}
export interface TreeNodeWithLayout extends TreeNode {
    layout?: PolarLayout;
}
export interface BuildTreeOptions {
    repoPath: string;
}
export declare class GitRepositoryError extends Error {
    constructor(message: string);
}
export declare const buildRepositoryTree: ({ repoPath }: BuildTreeOptions) => Promise<TreeNode>;
//# sourceMappingURL=index.d.ts.map