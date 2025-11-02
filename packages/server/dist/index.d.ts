import express from 'express';
import http from 'http';
import { TreeNode } from '@octotree/core';
export interface ServerOptions {
    port?: number;
    repoPath: string;
}
interface AppInstance {
    app: express.Express;
    getTree: () => Promise<TreeNode>;
    refreshTree: () => Promise<TreeNode>;
}
declare const createApp: (repoPath: string) => AppInstance;
export declare const startServer: ({ port, repoPath }: ServerOptions) => Promise<http.Server>;
export { createApp };
export type { TreeNode };
//# sourceMappingURL=index.d.ts.map