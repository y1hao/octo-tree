"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = exports.startServer = void 0;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const core_1 = require("@octotree/core");
const resolveStaticAssets = () => {
    const distPath = path_1.default.resolve(__dirname, '..', '..', 'web', 'dist');
    const indexPath = path_1.default.join(distPath, 'index.html');
    if (!(0, fs_1.existsSync)(distPath) || !(0, fs_1.existsSync)(indexPath)) {
        console.warn('Front-end build not found. Run `npm run build:web` to generate assets before launching the server.');
    }
    return { root: distPath, indexPath };
};
const createApp = (repoPath) => {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    let cachedTree = null;
    let lastUpdated = 0;
    let buildPromise = null;
    const runBuild = async () => {
        const tree = await (0, core_1.buildRepositoryTree)({ repoPath });
        cachedTree = tree;
        lastUpdated = Date.now();
        return tree;
    };
    const refreshTree = async () => {
        if (!buildPromise) {
            buildPromise = runBuild().finally(() => {
                buildPromise = null;
            });
        }
        return buildPromise;
    };
    const getTree = async () => {
        if (cachedTree) {
            return cachedTree;
        }
        return refreshTree();
    };
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', repoPath, lastUpdated });
    });
    app.get('/api/tree', async (_req, res) => {
        try {
            const tree = await getTree();
            res.json({ tree, lastUpdated });
        }
        catch (error) {
            if (error instanceof core_1.GitRepositoryError) {
                res.status(400).json({ error: error.message });
                return;
            }
            console.error(error);
            res.status(500).json({ error: 'Failed to build repository tree' });
        }
    });
    app.post('/api/tree/refresh', async (_req, res) => {
        try {
            const tree = await refreshTree();
            res.json({ tree, lastUpdated });
        }
        catch (error) {
            if (error instanceof core_1.GitRepositoryError) {
                res.status(400).json({ error: error.message });
                return;
            }
            console.error(error);
            res.status(500).json({ error: 'Failed to refresh repository tree' });
        }
    });
    const { root: staticRoot, indexPath } = resolveStaticAssets();
    if ((0, fs_1.existsSync)(staticRoot)) {
        app.use(express_1.default.static(staticRoot));
    }
    app.get('*', (_req, res) => {
        if ((0, fs_1.existsSync)(indexPath)) {
            res.sendFile(indexPath);
        }
        else {
            res
                .status(503)
                .send('Front-end build missing. Run `npm run build:web` to generate visualization assets.');
        }
    });
    return { app, getTree, refreshTree };
};
exports.createApp = createApp;
const startServer = async ({ port = 3000, repoPath }) => {
    if (!repoPath) {
        throw new Error('Server requires a repository path');
    }
    const { app, refreshTree } = createApp(repoPath);
    await refreshTree();
    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
            console.log(`Server listening on http://localhost:${port}`);
            resolve(server);
        });
        server.on('error', (error) => {
            reject(error);
        });
    });
};
exports.startServer = startServer;
//# sourceMappingURL=index.js.map